#!/usr/bin/env node
/**
 * CRAWL PRICE INDEX — PUBLIC-SURFACE GUARD  (node check-public.cjs)
 * =========================================================================
 * The sibling of check-copy.cjs. check-copy guards the *dashboard's* prose;
 * this guards the *public* surface — index.json and the marketing/credibility
 * pages (home, world, status, methodology, explore) that strangers actually
 * see. It exists because public numbers reach the site by two unguarded
 * routes: generated files whose field NAMES can drift from their contents, and
 * hardcoded HTML that silently goes stale. Both have bitten this project.
 *
 * Two kinds of check:
 *   HARD  — structural invariants of index.json + reconciliation against the
 *           scan's source of truth (scan-summary.json). A failure means the
 *           published feed is internally wrong or disagrees with the data.
 *   LINT  — forbidden phrases across the public HTML: the exact framings the
 *           editorial rules forbid and the exact regressions already fixed
 *           ("% of the web", "scanned/reachable web", enforcement-as-a-rate,
 *           "top 2,000" as the block-rate population, ccTLD mislabelled country).
 *
 * Run after rebuild.cjs / build-status.cjs, before deploy. Exit 0 = clean.
 * Exit 1 = at least one HARD failure or forbidden phrase found; the failure
 * names the surface and the fix.
 */
const fs = require("fs");

const results = [];
function check(kind, where, claim, fn) {
  let ok, detail = "";
  try { const r = fn(); ok = r === true || (r && r.ok); detail = (r && r.detail) || ""; }
  catch (e) { ok = false; detail = "threw: " + e.message; }
  results.push({ kind, where, claim, ok, detail });
}
const readJSON = p => JSON.parse(fs.readFileSync(p, "utf8"));
const readMaybe = p => { try { return fs.readFileSync(p, "utf8"); } catch { return null; } };

if (!fs.existsSync("index.json")) { console.error("index.json not found — run from the repo root, after rebuild.cjs"); process.exit(1); }
const idx = readJSON("index.json");
const sum = fs.existsSync("scan-summary.json") ? readJSON("scan-summary.json") : null;

/* ---- HARD: index.json internal invariants ------------------------------- */
check("HARD", "index.json", "block_rates denominator equals the parsed count", () => {
  const br = idx.block_rates, cov = idx.coverage;
  if (!br || !cov) return { ok: false, detail: "block_rates or coverage missing" };
  return { ok: br.denominator === cov.robots_parsed,
           detail: `block_rates.denominator=${br.denominator} vs coverage.robots_parsed=${cov.robots_parsed}` };
});
check("HARD", "index.json", "ccTLD headline present, country headline gone", () => ({
  ok: !!(idx.suffix_group_headline || idx.cctld_headline) && !idx.country_headline,
  detail: `suffix_group_headline=${!!idx.suffix_group_headline} cctld_headline=${!!idx.cctld_headline} country_headline=${!!idx.country_headline}`,
}));
check("HARD", "index.json", "probe-panel observations present, no enforcement rate", () => {
  const s = JSON.stringify(idx);
  const badKey = /enforcement_headline|declared_blocks_enforced_pct|enforced_pct/.test(s);
  return { ok: !!idx.probe_panel_observations && !badKey,
           detail: badKey ? "an enforcement-rate key is still in the feed" : "probe_panel_observations present, no rate key" };
});
check("HARD", "index.json", "no block_rates_top2000 key (renamed to block_rates)", () => ({
  ok: !("block_rates_top2000" in idx),
  detail: "block_rates_top2000" in idx ? "stale key still present" : "absent",
}));

/* ---- HARD: reconcile the feed against the scan's source of truth --------- */
if (sum) {
  check("HARD", "index.json vs scan-summary.json", "coverage matches the scan", () => ({
    ok: idx.coverage.robots_parsed === sum.robots_parsed,
    detail: `index=${idx.coverage.robots_parsed} scan=${sum.robots_parsed}`,
  }));
  check("HARD", "index.json vs scan-summary.json", "every published block rate matches the scan", () => {
    const pct = (idx.block_rates && idx.block_rates.pct) || {};
    const bad = [];
    for (const [k, v] of Object.entries(sum.block_rates || {})) {
      const feed = pct[k], truth = v.rate_pct;
      if (feed == null) { bad.push(`${k}: missing in feed`); continue; }
      if (Math.abs(feed - truth) > 0.05) bad.push(`${k}: feed ${feed} vs scan ${truth}`);
    }
    return { ok: !bad.length, detail: bad.length ? bad.join("; ") : `${Object.keys(sum.block_rates || {}).length} crawlers reconcile` };
  });
} else {
  check("HARD", "scan-summary.json", "present for reconciliation", () => ({ ok: false, detail: "scan-summary.json missing — cannot reconcile feed against source" }));
}

/* ---- LINT: forbidden phrases across the public HTML --------------------- */
// Each rule: a label, a regex, and an allow-regex for legitimate exceptions
// (e.g. the word "country" inside "country-code" or "not a country").
const PAGES = ["public/index.html", "public/world.html", "public/status.html", "public/methodology.html", "public/explore.html", "public/terms.html"];
const FORBIDDEN = [
  { label: '"of the scanned web"', re: /of the scanned web/i },
  { label: '"of the reachable web"', re: /of the reachable web/i },
  { label: '"% of the web" / "share of the web"', re: /(%|percent|share)\s+of\s+the\s+web\b/i },
  { label: 'enforcement stated as a rate', re: /(\benforcement metric\b|\d[\d.]*\s*%[^.]{0,40}\benforced\b|blocks were actually enforced|declared blocks[^.]{0,40}enforced)/i },
  { label: 'stale reached/parsed numbers (39,000 / 72%)', re: /39,?000|~?\s*72%\s*of the/i },
  { label: '"top 2,000" as the block-rate population', re: /top\s*2,?000\s+(web\s+)?(sites|domains)\b/i, pages: ["public/index.html"] },
  // --- v3 guard: the reviewers' red flags -------------------------------
  { label: 'causal language (data shows state changes, not intent)', re: /\b(driven by|because of|in response to|reacting to|retaliat\w+)\b/i },
  { label: 'market framing of an opt-in registry', re: /\b(market share|market price|market rate|monetisation rate|monetization rate)\b/i, negatable: true },
  { label: 'x402 described as transactions/revenue/demand', re: /\b(transaction volume|revenue from (crawl|machine)|proven demand|actual payments)\b/i },
  { label: '"no explicit instruction" conflated with "allowed"', re: /no explicit instruction[^.]{0,30}\b(means|=|is)\s+allow/i },
  { label: 'trend language on a young series', re: /\b(long-?run trend|established trend|trend line|trajectory shows)\b/i, negatable: true },
  { label: '"sellers" where the unit is a pay-to address', re: /\b\d[\d,]*\s+sellers\b/i },
  // --- v4 guard: site-rebuild regressions -------------------------------
  { label: 'stale pricing (the retired 79 tier)', re: /\u20AC\s?79|&euro;\s?79|\b79\/mo\b/i },
  { label: 'valuation/advice framing (we measure, never advise)', re: /what could (your|my) (site|domain) charge|start charging now|begin charging AI/i },
  { label: 'old CTA labels (superseded by Full dataset)', re: /Get the Terminal|Free dashboard/i },
];
// "country" mislabelling: flag the word except in allowed contexts
const COUNTRY_RE = /countr(y|ies)/gi;
// A claim that is explicitly DENIED is not a violation — the product's whole
// voice is "X is not Y". Only flag these when they are asserted, not negated.
const NEGATED_OK = /\b(not|never|isn'?t|aren'?t|no)\b[^.]{0,24}$/i;
const COUNTRY_OK = /country-code|not a country|isn'?t a country|never a country|rarely (british|[a-z]+ ocean)/i;

for (const p of PAGES) {
  const html = readMaybe(p);
  if (html === null) continue;
  // strip script/style so JS identifiers/CSS don't trip the linter
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  for (const rule of FORBIDDEN) {
    if (rule.pages && !rule.pages.includes(p)) continue;
    let m = text.match(rule.re);
    if (m && rule.negatable && NEGATED_OK.test(text.slice(Math.max(0, m.index - 26), m.index))) m = null;
    check("LINT", p, `must not contain ${rule.label}`, () => ({
      ok: !m, detail: m ? `found: "${m[0].trim().slice(0, 60)}"` : "clean",
    }));
  }
  // country lint: soft — collect offending occurrences, ignore allowed contexts
  const hits = [];
  let mm;
  while ((mm = COUNTRY_RE.exec(text))) {
    const ctx = text.slice(Math.max(0, mm.index - 40), mm.index + 40);
    if (!COUNTRY_OK.test(ctx)) hits.push(ctx.replace(/\s+/g, " ").trim());
  }
  check("LINT", p, 'ccTLD groups not labelled "country"', () => ({
    ok: hits.length === 0,
    detail: hits.length ? `${hits.length}×, e.g. "…${hits[0].slice(0, 70)}…"` : "clean",
  }));
}

/* ---- report ------------------------------------------------------------- */
const hardFail = results.filter(r => r.kind === "HARD" && !r.ok);
const lintFail = results.filter(r => r.kind === "LINT" && !r.ok);
const pad = Math.max(...results.map(r => (r.where + r.claim).length));
console.log(`\nPUBLIC-SURFACE GUARD — edition ${idx.coverage ? idx.coverage.robots_parsed + " parsed" : ""} (${results.length} checks)`);
console.log("-".repeat(78));
for (const r of results) {
  const tag = r.ok ? "  ok  " : (r.kind === "HARD" ? " FAIL " : " lint ");
  console.log(`${tag}[${r.kind}] ${r.where} — ${r.claim}`);
  if (!r.ok && r.detail) console.log(`        ${r.detail}`);
}
console.log("-".repeat(78));
if (!hardFail.length && !lintFail.length) {
  console.log(`All ${results.length} checks pass. Public surface is consistent with the data.`);
  process.exit(0);
}
if (hardFail.length) console.log(`${hardFail.length} HARD failure(s): the published feed is wrong or disagrees with the scan.`);
if (lintFail.length) console.log(`${lintFail.length} forbidden phrase(s) on the public pages — fix the wording (or its generator) before deploy.`);
console.log("");
process.exit(1);
