#!/usr/bin/env node
/**
 * CPI — capture the terms fields as columns. No census, no tab, no headline.
 * ===========================================================================
 * DECISION, after four adversarial reviews split 2 "he is right" / 1 "partly"
 * / 1 "he is rationalising":
 *
 *   ABANDONED   a terms census — a tab, a headline, a marketed dataset.
 *               Cloudflare Radar publishes agent-standard adoption across
 *               200,000 domains weekly with an API. That position is gone.
 *
 *   DONE HERE   the fields captured as columns on CPI's own frame, at zero
 *               additional HTTP requests, in a SEPARATE file so that not one
 *               downstream consumer of scan-robots.csv changes.
 *
 * Why self-collect rather than read Radar's API: Radar's frame is the top
 * 10k/200k by Cloudflare's own traffic view; CPI's is a 50k Tranco-derived
 * frame. Joining them would mean two denominators and two edition dates —
 * the exact failure the editorial rules exist to prevent. Collecting on our
 * own frame costs nothing because the file is already open.
 *
 * WHAT IS DELIBERATELY NOT HERE, on reviewer instruction:
 *   - no five-state terms model (it smuggled an ordinal judgement, and the
 *     states are not mutually exclusive — a domain can be signalled AND
 *     reserved AND licensed at once). Orthogonal fields instead.
 *   - no "vendor default / human edited" label. That is an inference.
 *     Provenance is recorded as: known_template / non_template / none.
 *   - no whitelisting of Content-Signal keys. Every key is kept verbatim.
 *     The first version of this parser discarded `use`, which turned out to
 *     be present on 37 of 39 default lines and to change the reading.
 *   - no rate published anywhere until the full 50,000 has run.
 *
 * OUTPUT: scan-terms.csv, one row per domain with a readable robots.txt
 *   rank,domain,cs_raw,cs_provenance,rsl_license,tdm_reservation,tdm_policy
 *
 * Same domain key, same edition, same archive. Separate schema, so a citation
 * of the access census cannot accidentally inherit terms-layer caveats.
 */
const fs = require("fs");
const F = "run-big.cjs";
let s = fs.readFileSync(F, "utf8");
if (s.includes("TERMS_OUT")) { console.log("already applied"); process.exit(0); }
if (!s.includes("ARCHIVE_BODIES")) throw new Error("run archive-bodies.cjs first");
fs.copyFileSync(F, F + ".bak-terms");

const sub = (from, to, label) => {
  if (!s.includes(from)) throw new Error("not found: " + label);
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(label + ": expected 1 match, found " + n);
  s = s.split(from).join(to);
};

sub(
  `const ARCHIVE_BODIES = process.env.CPI_NO_ARCHIVE !== "1";`,
  `const ARCHIVE_BODIES = process.env.CPI_NO_ARCHIVE !== "1";

/* ---- declared-USE fields, alongside declared-ACCESS ------------------------
   Separate file, separate schema, same domain key. Nothing that reads
   scan-robots.csv is affected. No rate is published from this until the full
   frame has run and repeatability is measured. */
const TERMS_OUT = "scan-terms.csv";
const termsRows = [];
// Cloudflare's documented managed-robots.txt default. Recorded as a TEMPLATE
// MATCH, never as "the publisher did not choose this" — a non-template line
// can come from a CMS, a plugin, a consultant or a copied config.
function csProvenance(kv) {
  if (!kv) return "none";
  const known = kv.search === "yes" && kv["ai-train"] === "no" && kv["ai-input"] === undefined;
  return known ? "known_template" : "non_template";
}
function parseTerms(body, hdr) {
  const t = { cs_raw: "", cs_provenance: "none", rsl: "", tdm: "", tdmPolicy: "" };
  if (body) {
    const m = body.match(/^[ \\t]*content-signal[ \\t]*:[ \\t]*(.+)$/im);
    if (m) {
      t.cs_raw = m[1].trim();
      const kv = {};
      for (const part of t.cs_raw.split(",")) {
        const p = part.split("=");
        if (p.length === 2) kv[p[0].trim().toLowerCase()] = p[1].trim().toLowerCase();
      }
      t.cs_provenance = csProvenance(kv);
    }
    const l = body.match(/^[ \\t]*license[ \\t]*:[ \\t]*(https?:\\/\\/\\S+)/im);
    if (l) t.rsl = l[1];
  }
  if (hdr) { if (hdr.tdm != null) t.tdm = String(hdr.tdm); if (hdr.tdmPolicy) t.tdmPolicy = hdr.tdmPolicy; }
  return t;
}
const csvq = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';`,
  "terms helpers"
);

sub(
  `          archiveBody(d, rank, r.status, r.body);   // additive; never throws
          const v = parseRobots(r.body);`,
  `          archiveBody(d, rank, r.status, r.body);   // additive; never throws
          try {
            const tm = parseTerms(r.body, r);
            if (tm.cs_raw || tm.rsl || tm.tdm || tm.tdmPolicy)
              termsRows.push([rank, csvq(d), csvq(tm.cs_raw), tm.cs_provenance,
                              csvq(tm.rsl), csvq(tm.tdm), csvq(tm.tdmPolicy)].join(","));
          } catch (e) { /* terms capture must never break a sweep */ }
          const v = parseRobots(r.body);`,
  "terms capture"
);

sub(
  `  const _arc = archiveClose();`,
  `  try {
    fs.writeFileSync(TERMS_OUT,
      "rank,domain,cs_raw,cs_provenance,rsl_license,tdm_reservation,tdm_policy\\n" +
      termsRows.join("\\n") + (termsRows.length ? "\\n" : ""));
    const known = termsRows.filter((r) => r.includes(",known_template,")).length;
    const nont  = termsRows.filter((r) => r.includes(",non_template,")).length;
    console.log("Declared-use fields: " + termsRows.length + " domains carry at least one (" +
      known + " known template, " + nont + " non-template) -> " + TERMS_OUT);
    console.log("  Not a census. No rate from this is published until the full frame has run");
    console.log("  and repeatability is measured. Cloudflare Radar publishes the population view.");
  } catch (e) { console.log("  WARN: terms file not written (" + e.message + ")"); }

  const _arc = archiveClose();`,
  "terms write"
);

fs.writeFileSync(F, s);
require("child_process").execSync("node --check " + F);

/* ---- verify -------------------------------------------------------------- */
const out = fs.readFileSync(F, "utf8");
for (const m of ["const TERMS_OUT", "function parseTerms(", "known_template", "scan-terms.csv"])
  if (!out.includes(m)) throw new Error("missing after patch: " + m);
if (out.includes('"vendor default"') || out.includes("human_edited"))
  throw new Error("an inference label leaked into the schema");
// the access pipeline must be untouched
if ((out.match(/rows\.push\(\[rank, d, \.\.\.ROBOTS_BOTS/g) || []).length !== 2)
  throw new Error("the access CSV builders were disturbed");
if (!out.includes(`fs.appendFileSync(OUT, rows.join("\\n") + "\\n");`))
  throw new Error("the access CSV append was disturbed");

/* ---- exercise the parser against real shapes ---------------------------- */
{
  const src = out.slice(out.indexOf("function csProvenance"), out.indexOf("const csvq"));
  const fn = new Function(src + "; return { csProvenance, parseTerms };")();
  const cases = [
    ["User-agent: *\nContent-Signal: search=yes, ai-train=no, use=reference\nAllow: /", null, "known_template", "use kept"],
    ["Content-signal: search=yes, ai-input=yes, ai-train=yes", null, "non_template", "all-yes edit"],
    ["Content-Signal: search=yes, ai-train=no", null, "known_template", "older default, no use key"],
    ["User-agent: *\nDisallow:", null, "none", "no signal"],
    ["License: https://example.com/license.xml", null, "none", "rsl only"],
  ];
  for (const [body, hdr, wantProv, label] of cases) {
    const t = fn.parseTerms(body, hdr);
    if (t.cs_provenance !== wantProv) throw new Error(label + ": provenance " + t.cs_provenance + " != " + wantProv);
  }
  const t1 = fn.parseTerms("Content-Signal: search=yes, ai-train=no, use=reference", null);
  if (!t1.cs_raw.includes("use=reference")) throw new Error("the `use` key was dropped again");
  const t2 = fn.parseTerms("License: https://x.com/l.xml", null);
  if (t2.rsl !== "https://x.com/l.xml") throw new Error("rsl not captured");
  const t3 = fn.parseTerms("", { tdm: 1, tdmPolicy: "https://p" });
  if (t3.tdm !== "1" || t3.tdmPolicy !== "https://p") throw new Error("tdm headers not captured");
  console.log("parser self-test: 5 provenance cases + use-key + rsl + tdm headers  OK");
}

console.log("");
console.log("declared-use fields wired into the sweep");
console.log("  -> scan-terms.csv, separate schema, same domain key, zero extra requests");
console.log("  provenance: known_template / non_template / none — never 'human edited'");
console.log("  every Content-Signal key kept verbatim, including `use`");
console.log("  scan-robots.csv and every downstream consumer untouched");
console.log("");
console.log("  no tab, no headline, no published rate. This is inventory, not a product.");
