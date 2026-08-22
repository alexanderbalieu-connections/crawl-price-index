#!/usr/bin/env node
/**
 * CPI — build public/explore-preview.json  (node build-explore-preview.cjs)
 * ===========================================================================
 * Feeds the dashboard preview on /explore. Every value here is a real measured
 * figure from this edition — nothing on that page is illustrative, invented or
 * rounded for effect. What the preview withholds it withholds by MASKING, not
 * by faking: the Domains tab shows real rows for a handful of domains and
 * literal dots for the rest.
 *
 * The sample rows are drawn from the top of the frame, which is the same
 * material the free newsletter already hands out in full (top-100 rows on
 * signup), so nothing is given away here that is not already free.
 *
 * Run after rebuild.cjs, every edition. check-explore.cjs fails the build if
 * this file's edition does not match the published one — the preview is never
 * allowed to sit one week behind the page around it.
 */
const fs = require("fs");

const J = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const feed = J("index.json");
const dash = J("app/data/dashboard.json");
const doms = J("private/domains.json");
let baz = null; try { baz = J("app/data/bazaar.json"); } catch (e) {}

const edition = dash.edition || doms.edition;
if (!edition) throw new Error("no edition on dashboard.json");
if (doms.edition !== edition)
  throw new Error("domains.json is edition " + doms.edition + " but dashboard.json is " + edition +
                  " — refusing to build a preview from mismatched inputs");

/* ---- crawler ladder, with the role/vendor tags the dashboard uses -------- */
const crawlers = (dash.crawlers || []).map((c) => ({
  name: c.name, vendor: c.vendor, role: c.role,
  blocked_pct: c.blocked_pct,
}));

/* ---- sample domain rows -------------------------------------------------
   Chosen for spread across the five states rather than for looking good: a
   heavy blocker, a total blocker, a partial, an explicit allower, and a
   household name that has said nothing at all. If any is missing from this
   edition's frame we fall back to the highest-ranked row in that state, so
   this never hardcodes a row that has stopped existing.                     */
const WANT = ["amazon.com", "msn.com", "netflix.com", "cloudflare.com", "wikipedia.org", "instagram.com"];
const byDomain = new Map(doms.rows.map((r) => [r[1], r]));
const LEG = doms.legend;                       // {b:blocked, p:partial, ...}
const counts = (sig) => {
  const o = {};
  for (const ch of sig) o[LEG[ch] || ch] = (o[LEG[ch] || ch] || 0) + 1;
  return o;
};
const dominant = (sig) => Object.entries(counts(sig)).sort((a, b) => b[1] - a[1])[0][0];

const picked = [];
const seenState = new Set();
for (const d of WANT) {
  const r = byDomain.get(d);
  if (!r) continue;
  picked.push(r);
  seenState.add(dominant(r[2]));
}
// backfill any state we failed to represent, from the highest-ranked example
for (const state of ["blocked", "partial", "allowed", "unlisted", "no_robots"]) {
  if (seenState.has(state) || picked.length >= 6) continue;
  const r = doms.rows.filter((x) => dominant(x[2]) === state).sort((a, b) => a[0] - b[0])[0];
  if (r) { picked.push(r); seenState.add(state); }
}
picked.sort((a, b) => a[0] - b[0]);

const sample_rows = picked.slice(0, 6).map((r) => ({
  rank: r[0], domain: r[1], sig: r[2], counts: counts(r[2]),
}));

/* ---- policy changes: real rows, named ----------------------------------- */
const chAll = (dash.changes && dash.changes.items) || [];
// one row per domain: the items list is grouped by domain, so a plain
// slice(0,5) showed the same site five times over
const seenDom = new Set();
const changes_sample = [];
for (const c of chAll) {
  if (seenDom.has(c.domain)) continue;
  seenDom.add(c.domain);
  const n = chAll.filter((x) => x.domain === c.domain).length;
  changes_sample.push({ domain: c.domain, rank: c.rank, crawler: c.crawler, prev: c.prev, cur: c.cur, also: n - 1 });
  if (changes_sample.length === 5) break;
}
const changed_domains = seenDom.size === chAll.length ? seenDom.size
  : new Set(chAll.map((c) => c.domain)).size;

/* ---- wire evidence: the exhibit classes, with their real counts ---------- */
const wire = dash.wire || {};
const wire_classes = [];
if (wire.prices) wire_classes.push({ k: "Priced", n: wire.prices.length, d: "named a per-crawl price in the response" });
if (wire.p402) wire_classes.push({ k: "402 / token wall", n: wire.p402.length, d: "payment required, or a marketplace token demanded" });
if (wire.blocked) wire_classes.push({ k: "Bot-blocked", n: wire.blocked.length, d: "served a browser, refused an identified AI crawler" });

const out = {
  edition,
  generated_utc: new Date().toISOString(),
  source_editions: { dashboard: dash.edition, domains: doms.edition, feed: (feed.generated_utc || "").slice(0, 10) },
  frame: (dash.panel && dash.panel.domains) || 50000,
  parsed: (dash.panel && dash.panel.robots_parsed) || feed.coverage.robots_parsed,

  tabs: [
    { id: "overview", title: "This edition", access: "free" },
    { id: "crawlers", title: "Crawlers", access: "free" },
    { id: "policy", title: "Policy layer", access: "free" },
    { id: "changes", title: "Policy changes", access: "free" },
    { id: "segments", title: "Segments", access: "free" },
    { id: "wire", title: "Wire evidence", access: "free" },
    { id: "bazaar", title: "The Bazaar", access: "free" },
    { id: "domains", title: "Domains", access: "terminal" },
  ],

  overview: {
    parsed: feed.coverage.robots_parsed,
    frame: feed.coverage.tranco_top_n,
    asymmetry: feed.asymmetry_headline,
    changes: feed.changes_headline,
    reachability: feed.reachability_headline,
  },

  crawlers,
  legend: LEG,
  crawler_names: doms.crawlers,

  policy: dash.policy_layer ? {
    ladder: dash.policy_layer.ladder,
    rows: (dash.policy_layer.crawlers || []).slice(0, 6).map((c) => ({
      name: c.name, role: c.role,
      named_pct: c.named_pct, blocked_when_named_pct: c.blocked_when_named_pct,
      blocked_pct_parsed: c.blocked_pct_parsed,
    })),
    total_rows: (dash.policy_layer.crawlers || []).length,
  } : null,

  changes: {
    interval: (dash.changes && dash.changes.interval) || (feed.changes_headline || {}).interval,
    total: chAll.length,
    domains: changed_domains,
    sample: changes_sample,
  },

  segments: {
    // rank_bands has `band` and a per-crawler `blocked_pct` map — there is no
    // any_blocked_pct on it. We quote GPTBot, the most-blocked crawler, and
    // the page names it rather than implying an all-crawler rate.
    band_metric: "GPTBot",
    bands: (dash.rank_bands || []).map((b) => ({
      label: b.band, n: b.n, n_total: b.n_total,
      pct: b.blocked_pct ? b.blocked_pct.GPTBot : null,
    })).filter((b) => b.label && b.pct != null),
    tld_most: (feed.suffix_group_headline || {}).most_blocking,
    tld_least: (feed.suffix_group_headline || {}).least_blocking,
  },

  wire: { classes: wire_classes, prices: (wire.prices || []).slice(0, 3) },

  bazaar: feed.bazaar_headline || (baz && baz.headline) || null,

  domains: {
    columns: doms.crawlers,
    sample_rows,
    total_rows: doms.rows.length,
    masked_rows: doms.rows.length - sample_rows.length,
    note: "Real rows for a handful of domains this edition. The rest are masked, not invented.",
  },
};

fs.mkdirSync("public", { recursive: true });
fs.writeFileSync("public/explore-preview.json", JSON.stringify(out));

console.log("public/explore-preview.json — edition " + edition);
console.log("  " + crawlers.length + " crawlers, " + sample_rows.length + " real sample rows, " +
            out.domains.masked_rows.toLocaleString() + " masked");
console.log("  sample: " + sample_rows.map((r) => r.domain).join(", "));
const cellStates = new Set();
sample_rows.forEach((r) => Object.keys(r.counts).forEach((k) => cellStates.add(k)));
console.log("  states in the sample: " + [...cellStates].sort().join(", "));
console.log("  changes sample domains: " + changes_sample.map((c) => c.domain).join(", "));
