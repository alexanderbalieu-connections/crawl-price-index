#!/usr/bin/env node
/**
 * CPI — extend the public index.json feed  (node extend-feed.cjs)
 * ===========================================================================
 * index.json is the contract between the pipeline and every public surface.
 * It predates the strongest findings, so the homepage literally cannot show
 * them. This patches rebuild.cjs to publish, in the free headline tier:
 *
 *   asymmetry       training-only vs search-only blockers + ratio  (14.8:1)
 *   changes         direction of travel: more / less restrictive / reversions
 *   reachability    alive / dead / timeout / bot-walled across the frame
 *   site_evidence   ads.txt · platform · feed · schema · any-signal union
 *   bazaar          endpoints, sellers, median ask, in-frame penetration
 *   frame           CPI-50K provenance (list id, inputs, excluded inputs)
 *
 * It also fixes two legacy defects in the feed itself:
 *   - evidence_summary.derived listed "country editions" (banned framing)
 *   - terms text promised "complete country editions"
 *   - full_dataset pointed at the retired /#access anchor and the old API
 * and demotes cctld_headline behind an explicit suffix-group label.
 *
 * Everything added is aggregate. No per-domain rows enter the free feed.
 */
const fs = require("fs");
const P = "rebuild.cjs";
let s = fs.readFileSync(P, "utf8");
if (s.includes("asymmetry_headline")) { console.log("already extended"); process.exit(0); }

/* ---- 1. loaders, inserted just before the publicFeed object -------------- */
const anchor = "const publicFeed = {";
if (!s.includes(anchor)) throw new Error("publicFeed anchor missing");

const loaders = `/* ---- free-tier headline extras -----------------------------------------
   Read from artefacts the pipeline already writes. Every one is aggregate;
   none exposes a per-domain row. Each is null-safe: a missing artefact simply
   omits the key rather than failing the build. */
function _readJSON(p) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return null; } }

const _dash = _readJSON("app/data/dashboard.json");

const asymmetryHeadline = (() => {
  const a = _dash && _dash.roles && _dash.roles.asymmetry && _dash.roles.asymmetry.vs_search;
  if (!a) return null;
  return {
    basis: "domains with a readable robots.txt in the current frame",
    denominator: _dash.panel ? _dash.panel.robots_parsed : null,
    blocks_training_role_only: a.a,
    blocks_search_role_only: a.b,
    ratio: a.ratio,
    note: "Role tags describe the crawler's stated function. Declared robots.txt policy only; not evidence of intent or of access actually denied.",
  };
})();

const changesHeadline = (() => {
  const c = _dash && _dash.changes;
  if (!c || !c.available || !c.transitions) return null;
  const RANK = { allowed: 0, unlisted: 1, partial: 2, blocked: 3 };
  let more = 0, less = 0, rev = 0;
  for (const [k, n] of Object.entries(c.transitions)) {
    const [f, t] = String(k).split("->");
    if (RANK[f] == null || RANK[t] == null) continue;
    if (RANK[t] > RANK[f]) more += n; else if (RANK[t] < RANK[f]) less += n;
    if (f === "blocked") rev += n;
  }
  return {
    interval: c.interval, total: c.total_changes, domains_changed: c.changed_domains,
    more_restrictive: more, less_restrictive: less, moved_off_a_block: rev,
    note: "One edition-over-edition comparison, not a trend. Domains entering or leaving the frame are excluded so frame churn is never counted as a policy change.",
  };
})();

const reachabilityHeadline = (() => {
  const r = _dash && _dash.reachability;
  if (!r || !r.states) return null;
  return {
    frame: r.domains, alive: r.states.alive, dead_dns: r.states.dead_dns,
    timeout: r.states.timeout, bot_walled: r.states.bot_walled,
    disallowed_our_crawler: r.states.disallowed,
    note: "Reachability of the ranked frame itself. bot_walled = serves robots.txt but refuses an identified crawler at the homepage (403/429): a declared-versus-enforced divergence, not a robots.txt policy.",
  };
})();

const siteEvidenceHeadline = (() => {
  const f = fs.readdirSync(".").filter(x => /^reachability-.*-summary\\.json$/.test(x)).sort().pop();
  const j = f ? _readJSON(f) : null;
  if (!j || !j.evidence) return null;
  const e = j.evidence, n = j.domains || 0;
  return {
    frame: n, has_ads_txt: e.has_ads_txt, platform_fingerprint: e.platform,
    has_feed: e.has_feed, schema_org_types: e.schema_any, self_declared_news: e.news_schema || undefined,
    note: "Counts of self-declared, publicly served signals observed on each domain's own homepage. Observations, not classifications.",
  };
})();

const bazaarHeadline = (() => {
  if (!fs.existsSync("bazaar")) return null;
  const f = fs.readdirSync("bazaar").filter(x => /-summary\\.json$/.test(x)).sort().pop();
  const b = f ? _readJSON("bazaar/" + f) : null;
  if (!b) return null;
  const i = b.intersection || {}, u = b.usd || {}, sel = b.sellers || {};
  return {
    date: b.date, endpoints_real_priced: b.real_priced, distinct_pay_to_addresses: sel.distinct,
    median_advertised_usd: u.median, by_type: b.by_type,
    rail_share_pct: b.rail_share_pct, asset_usdc_share_pct: b.asset_usdc_share_pct,
    in_frame_domains: i.in_frame_total, in_frame_content: i.in_frame_content,
    blocks_crawlers_yet_sells: i.blockers_that_sell,
    note: "Advertised, opt-in acceptance in a public machine-payment registry (x402). Never transactions, volume or revenue. Distinct from Cloudflare pay-per-crawl, which is a different rail that also returns HTTP 402.",
  };
})();

const frameProvenance = (() => {
  const p = _readJSON("frame-cpi50k-v1.json");
  if (!p) return null;
  return {
    name: p.frame, source: p.source.provider, list_id: p.source.list_id,
    permalink: p.source.permalink, inputs: p.source.inputs,
    excluded_inputs: (p.source.excluded_inputs || []).map(x => x.name + " (" + x.licence + ")"),
    excluded_rows: p.excluded_total,
    attribution: p.attribution,
  };
})();

`;
s = s.replace(anchor, loaders + anchor);

/* ---- 2. add the keys to the feed --------------------------------------- */
const after = `  observed_prices_headline: prices.slice(0, 1).map(p => ({ raw: p })), // just the one flagship quote`;
if (!s.includes(after)) throw new Error("prices anchor missing");
s = s.replace(after, after + `
  // --- headline findings (aggregate only; added 2026-08-21) ---------------
  asymmetry_headline: asymmetryHeadline,
  changes_headline: changesHeadline,
  reachability_headline: reachabilityHeadline,
  site_evidence_headline: siteEvidenceHeadline,
  bazaar_headline: bazaarHeadline,
  frame_provenance: frameProvenance,`);

/* ---- 3. fix the legacy defects ----------------------------------------- */
const fixes = [
  [`derived: ["block rates", "country editions", "trends"]`,
   `derived: ["block rates", "suffix-group cuts", "edition-over-edition comparisons"]`],
  [`terms: "Headline figures free to cite with attribution. Full per-domain data, complete country editions, and weekly history require a Terminal subscription.",`,
   `terms: "Headline figures free to cite with attribution. Full per-domain data, suffix-group detail and weekly history require a subscription.",`],
  [`full_dataset: "gated — subscribe at https://crawlpriceindex.com/#access ; API at https://api.crawlpriceindex.com/v1/dataset",`,
   `full_dataset: "gated — subscribe at https://app.crawlpriceindex.com/dashboard.html#account",`],
  [`  cctld_headline: (() => {`,
   `  // Suffix groups, never countries. Retained for continuity; the dashboard's
  // Segments tab is the canonical surface and carries the full caveat.
  suffix_group_headline: (() => {`],
];
let applied = 0;
for (const [a, b] of fixes) { if (s.includes(a)) { s = s.split(a).join(b); applied++; } else console.log("  MISS: " + a.slice(0, 60)); }

fs.writeFileSync(P, s);
console.log("rebuild.cjs extended: 6 headline blocks added, " + applied + "/" + fixes.length + " legacy fixes applied");
