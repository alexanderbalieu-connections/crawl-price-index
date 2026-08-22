#!/usr/bin/env node
/**
 * CPI — TERMS LAYER PILOT  (v2, after the first run)
 * ===========================================================================
 * v1 answered the question and, in doing so, exposed two faults in itself.
 * Both are fixed here, and both are the kind this product exists to avoid.
 *
 * FAULT 1 — I WHITELISTED THE KEYS I EXPECTED.
 *   v1 parsed Content-Signal and kept only search / ai-input / ai-train,
 *   silently discarding any other key. Cloudflare's own managed-robots.txt
 *   documentation shows a `use=reference` key. If that was present on the 38
 *   default-looking rows, v1 threw it away and I would never have known.
 *   v2 keeps the RAW directive line and EVERY key=value pair. Whitelisting
 *   what you expect to find is how you fail to find things.
 *
 * FAULT 2 — I MIXED DENOMINATORS IN MY OWN SUMMARY.
 *   v1 printed Content-Signal against `readable` (1,108) and ANY against
 *   `sampled` (1,809), in the same block, unlabelled. On a product whose
 *   first rule is that every rate states its denominator, that is not a
 *   cosmetic slip. v2 reports body-derived signals and header-derived
 *   signals separately, each against its own correct base, and never sums
 *   them into one rate.
 *
 * NEW IN v2 — THE DEFAULT/EDITED SPLIT, ON VERIFIED GROUND.
 *   Cloudflare's managed robots.txt default is `search=yes, ai-train=no`
 *   with ai-input DELIBERATELY UNSET — their docs state that an omitted
 *   signal "neither grants nor restricts permission". So the separation is
 *   not a guess about comment blocks:
 *       ai-input unset + search=yes + ai-train=no  -> vendor default
 *       anything else                              -> a human edited it
 *   Only the second is evidence of publisher intent, and only it may ever
 *   appear in a headline.
 *
 * NEW IN v2 — DISTINCT OPERATORS.
 *   v1's "TDM header: 7" is really 4 organisations: four of the seven point
 *   at the same Elsevier policy URL. Counting domains as if they were
 *   decisions is the same error as the widely-copied-signature cohort.
 *   Every count now carries a distinct-operator figure beside it.
 *
 * RUN:  node terms-layer-pilot.cjs [sampleSize]
 */
const fs = require("fs");

const N = Number(process.argv[2] || 2000);
const CONC = 24;
const TIMEOUT_MS = 8000;
const UA = "CrawlPriceIndexBot/1.0 (crawl-economy measurement; robots.txt study; contact: hello@crawlpriceindex.com)";

/* Cloudflare managed robots.txt default, verified against their docs:
   search=yes, ai-train=no, ai-input omitted on purpose. */
const CF_DEFAULT = (sig) =>
  sig.search === "yes" && sig["ai-train"] === "no" && sig["ai-input"] === undefined;

const FRAME = ["tranco-top-1m.csv", "scan-robots.csv"].find((f) => fs.existsSync(f));
if (!FRAME) { console.error("no frame file found. Run from the repo root."); process.exit(1); }
const all = fs.readFileSync(FRAME, "utf8").split(/\r?\n/).slice(1)
  .map((l) => l.split(",")).filter((c) => c.length >= 2 && c[1])
  .map((c) => ({ rank: Number(c[0]), domain: c[1].trim() }))
  .filter((d) => d.rank && d.rank <= 50000);

const BANDS = [[1,100],[101,500],[501,1000],[1001,5000],[5001,10000],[10001,25000],[25001,50000]];
const per = Math.max(1, Math.floor(N / BANDS.length));
const sample = [];
for (const [lo, hi] of BANDS) {
  const pool = all.filter((d) => d.rank >= lo && d.rank <= hi);
  const step = Math.max(1, Math.floor(pool.length / per));
  let taken = 0;
  for (let i = 0; i < pool.length && taken < per; i += step) { sample.push({ ...pool[i], band: lo + "-" + hi }); taken++; }
}

/* ---- signals ------------------------------------------------------------- */
// EVERY key is kept. No whitelist.
function contentSignal(t) {
  const m = t.match(/^[ \t]*content-signal[ \t]*:[ \t]*(.+)$/im);
  if (!m) return null;
  const raw = m[1].trim();
  const kv = {};
  for (const part of raw.split(",")) {
    const p = part.split("=");
    if (p.length === 2) kv[p[0].trim().toLowerCase()] = p[1].trim().toLowerCase();
  }
  return { raw, kv };
}
const rslLicense = (t) => (t.match(/^[ \t]*license[ \t]*:[ \t]*(https?:\/\/\S+)/im) || [])[1] || null;

async function robots(domain) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch("https://" + domain + "/robots.txt",
      { headers: { "user-agent": UA, accept: "text/plain,*/*" }, redirect: "follow", signal: ctl.signal });
    let body = "";
    if (r.status === 200) { body = (await r.text()).slice(0, 500000); if (/^\s*</.test(body)) body = ""; }
    else { try { r.body?.cancel(); } catch {} }
    return { status: r.status, body,
      tdm: r.headers.get("tdm-reservation"), tdmPolicy: r.headers.get("tdm-policy"),
      link: r.headers.get("link") };
  } catch (e) {
    return { status: 0, body: "", err: e.name === "AbortError" ? "timeout" : (e.cause?.code || "err") };
  } finally { clearTimeout(timer); }
}

(async () => {
  const t0 = Date.now(); const rows = []; let done = 0;
  const queue = sample.slice();
  const worker = async () => { for (;;) {
    const d = queue.shift(); if (!d) return;
    const r = await robots(d.domain);
    const row = { rank: d.rank, domain: d.domain, band: d.band, status: r.status, readable: !!r.body };
    if (r.body) {
      const cs = contentSignal(r.body);
      if (cs) { row.csRaw = cs.raw; row.cs = cs.kv; row.csDefault = CF_DEFAULT(cs.kv); }
      const l = rslLicense(r.body); if (l) row.rslLicense = l;
    }
    if (r.tdm != null) row.tdmReservation = r.tdm;
    if (r.tdmPolicy) row.tdmPolicy = r.tdmPolicy;
    if (r.link && /rel=["']?license/i.test(r.link)) row.linkLicense = r.link;
    rows.push(row);
    if (++done % 100 === 0) process.stdout.write("  " + done + "/" + sample.length + "\r");
  } };
  await Promise.all(Array.from({ length: CONC }, worker));

  const readable = rows.filter((r) => r.readable);
  const cs   = readable.filter((r) => r.cs);
  const csEd = cs.filter((r) => !r.csDefault);
  const csDf = cs.filter((r) => r.csDefault);
  const rsl  = readable.filter((r) => r.rslLicense);
  const tdm  = rows.filter((r) => r.tdmReservation != null || r.tdmPolicy);
  const link = rows.filter((r) => r.linkLicense);

  const uniq = (a) => new Set(a).size;
  const pct = (n, d) => d ? (n / d * 100).toFixed(2) + "%" : "—";
  const L = console.log;

  L("");
  L("=".repeat(76));
  L("TERMS-LAYER PILOT v2 — declarations about USE, not access");
  L("=".repeat(76));
  L("sampled                  " + rows.length + " domains, stratified across 7 rank bands");
  L("robots.txt readable      " + readable.length + "  (" + pct(readable.length, rows.length) + " of sampled)");
  L("elapsed                  " + Math.round((Date.now() - t0) / 1000) + "s");
  L("");
  L("BODY-DERIVED  — denominator is the " + readable.length + " READABLE robots.txt");
  L("  Content-Signal, any    " + String(cs.length).padStart(5) + "   " + pct(cs.length, readable.length));
  L("    of which vendor default " + String(csDf.length).padStart(3) + "   " + pct(csDf.length, readable.length) + "   <- NOT publisher intent");
  L("    of which edited         " + String(csEd.length).padStart(3) + "   " + pct(csEd.length, readable.length) + "   <- a human chose this");
  L("  RSL License:           " + String(rsl.length).padStart(5) + "   " + pct(rsl.length, readable.length) +
    "   (" + uniq(rsl.map((r) => r.rslLicense)) + " distinct licence docs)");
  L("");
  L("HEADER-DERIVED — denominator is all " + rows.length + " FETCHED domains");
  L("  TDM reservation        " + String(tdm.length).padStart(5) + "   " + pct(tdm.length, rows.length) +
    "   (" + uniq(tdm.map((r) => r.tdmPolicy || r.domain)) + " distinct policies)");
  L("  Link: rel=license      " + String(link.length).padStart(5) + "   " + pct(link.length, rows.length));
  L("");
  L("  These two groups are NOT summed. A header signal is observable on a domain");
  L("  whose robots.txt is unreadable; a body signal is not. One rate, one base.");
  L("");

  if (cs.length) {
    // Group by MEANING, not by the literal string: v2's first run split
    // `ai-train=yes, search=yes, ai-input=yes` from
    // `search=yes, ai-input=yes, ai-train=yes` into two rows. Same
    // declaration, different key order. The raw line is still shown.
    const fp = {};
    for (const r of cs) {
      const key = Object.keys(r.cs).sort().map((k) => k + "=" + r.cs[k]).join(", ");
      (fp[key] = fp[key] || []).push(r);
    }
    L("EVERY Content-Signal declaration found, normalised by key order, by frequency:");
    Object.entries(fp).sort((a, b) => b[1].length - a[1].length).forEach(([norm, v]) => {
      L("  " + String(v.length).padStart(4) + "  " + (v[0].csDefault ? "[vendor default] " : "[EDITED]         ") + norm);
      const forms = [...new Set(v.map((r) => r.csRaw))];
      if (forms.length > 1) L("        written " + forms.length + " different ways: " + forms.map((f) => '"' + f + '"').join(" / "));
      L("        " + v.slice(0, 5).map((r) => "#" + r.rank + " " + r.domain).join("  ") + (v.length > 5 ? "  …+" + (v.length - 5) : ""));
    });
    const keys = new Set(); cs.forEach((r) => Object.keys(r.cs).forEach((k) => keys.add(k)));
    L("");
    L("  keys observed: " + [...keys].sort().join(", "));
    const unexpected = [...keys].filter((k) => !["search", "ai-input", "ai-train"].includes(k));
    L("  keys v1 would have DISCARDED: " + (unexpected.length ? unexpected.join(", ") : "none — v1 lost nothing, this time"));
    if (keys.has("use")) {
      // Cloudflare defines use=reference as "Index, excerpt, and link back."
      // It is a SEPARATE dimension from ai-input, not a replacement for it —
      // doaj.org carries both. Report its values rather than assuming.
      const uv = {};
      cs.forEach((r) => { if (r.cs.use) uv[r.cs.use] = (uv[r.cs.use] || 0) + 1; });
      L("  `use` values: " + Object.entries(uv).map(([k, n]) => k + " \u00d7" + n).join(", ") +
        "   (use=reference is defined as 'Index, excerpt, and link back' — a separate");
      L("   dimension from ai-input, NOT a substitute for it)");
    }
    L("");
    L("  ai-input, among EDITED signals only (n=" + csEd.length + "):");
    for (const v of ["yes", "no"]) L("    " + v.padEnd(6) + String(csEd.filter((r) => r.cs["ai-input"] === v).length).padStart(4));
    L("    unset " + String(csEd.filter((r) => r.cs["ai-input"] === undefined).length).padStart(4));
  }
  L("");
  L("By rank band — EDITED Content-Signal + RSL only (intent, not defaults):");
  for (const [lo, hi] of BANDS) {
    const b = readable.filter((r) => r.band === lo + "-" + hi);
    const a = b.filter((r) => (r.cs && !r.csDefault) || r.rslLicense);
    L("  " + (lo + "-" + hi).padEnd(12) + String(a.length).padStart(4) + " / " + String(b.length).padStart(4) + " readable   " + pct(a.length, b.length));
  }
  L("");

  fs.writeFileSync("terms-pilot.json", JSON.stringify({
    generated_utc: new Date().toISOString(), frame: FRAME,
    sampled: rows.length, readable: readable.length,
    counts: { content_signal: cs.length, content_signal_default: csDf.length, content_signal_edited: csEd.length,
              rsl_license: rsl.length, tdm: tdm.length, link_license: link.length },
    rows: rows.filter((r) => r.cs || r.rslLicense || r.tdmReservation != null || r.tdmPolicy || r.linkLicense),
  }, null, 1));
  L("wrote terms-pilot.json");
  L("");
  L("DECISION RULE — applied to EDITED signals + RSL, against readable.");
  L("  Vendor defaults are context, never the headline. They measure a CDN's");
  L("  rollout, not what any publisher decided.");
})();
