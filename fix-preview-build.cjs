#!/usr/bin/env node
/**
 * CPI — corrections to build-explore-preview.cjs
 * ===========================================================================
 * Caught by reading the generated file rather than trusting the field names:
 *
 *  1. rank_bands carries `band` and a per-crawler `blocked_pct` map. I asked
 *     for `label` and `any_blocked_pct`, neither of which exists, so every
 *     segment row came out with an undefined rate. The preview now derives
 *     GPTBot's rate per band from the map that is actually there, and says so.
 *  2. The Policy-changes sample was five rows from the SAME domain — the items
 *     list is ordered by domain, so slicing the first five gave one site five
 *     times. There are 27 distinct domains in this edition's changes; the
 *     sample now takes one row each from the first five of them.
 *  3. The "states covered" line reported only the DOMINANT state per row, so
 *     it claimed two states when the sample actually exercises four.
 */
const fs = require("fs");
const P = "build-explore-preview.cjs";
let s = fs.readFileSync(P, "utf8");
if (s.includes("one row per domain")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(P, P + ".bak");

const sub = (from, to, label) => {
  if (!s.includes(from)) throw new Error("not found: " + label);
  s = s.split(from).join(to);
};

/* 2. one change row per domain */
sub(
  "const chAll = (dash.changes && dash.changes.items) || [];\n" +
  "const changes_sample = chAll.slice(0, 5).map((c) => ({\n" +
  "  domain: c.domain, rank: c.rank, crawler: c.crawler, prev: c.prev, cur: c.cur,\n" +
  "}));",
  "const chAll = (dash.changes && dash.changes.items) || [];\n" +
  "// one row per domain: the items list is grouped by domain, so a plain\n" +
  "// slice(0,5) showed the same site five times over\n" +
  "const seenDom = new Set();\n" +
  "const changes_sample = [];\n" +
  "for (const c of chAll) {\n" +
  "  if (seenDom.has(c.domain)) continue;\n" +
  "  seenDom.add(c.domain);\n" +
  "  const n = chAll.filter((x) => x.domain === c.domain).length;\n" +
  "  changes_sample.push({ domain: c.domain, rank: c.rank, crawler: c.crawler, prev: c.prev, cur: c.cur, also: n - 1 });\n" +
  "  if (changes_sample.length === 5) break;\n" +
  "}\n" +
  "const changed_domains = seenDom.size === chAll.length ? seenDom.size\n" +
  "  : new Set(chAll.map((c) => c.domain)).size;",
  "changes sample"
);
sub(
  "  changes: {\n" +
  "    interval: (dash.changes && dash.changes.interval) || (feed.changes_headline || {}).interval,\n" +
  "    total: chAll.length,\n" +
  "    sample: changes_sample,\n" +
  "  },",
  "  changes: {\n" +
  "    interval: (dash.changes && dash.changes.interval) || (feed.changes_headline || {}).interval,\n" +
  "    total: chAll.length,\n" +
  "    domains: changed_domains,\n" +
  "    sample: changes_sample,\n" +
  "  },",
  "changes block"
);

/* 1. segments use the fields rank_bands actually has */
sub(
  "  segments: {\n" +
  "    bands: (dash.rank_bands || []).map((b) => ({\n" +
  "      label: b.label || b.band, n: b.band_n || b.n, any_blocked_pct: b.any_blocked_pct,\n" +
  "    })).filter((b) => b.label),",
  "  segments: {\n" +
  "    // rank_bands has `band` and a per-crawler `blocked_pct` map — there is no\n" +
  "    // any_blocked_pct on it. We quote GPTBot, the most-blocked crawler, and\n" +
  "    // the page names it rather than implying an all-crawler rate.\n" +
  "    band_metric: \"GPTBot\",\n" +
  "    bands: (dash.rank_bands || []).map((b) => ({\n" +
  "      label: b.band, n: b.n, n_total: b.n_total,\n" +
  "      pct: b.blocked_pct ? b.blocked_pct.GPTBot : null,\n" +
  "    })).filter((b) => b.label && b.pct != null),",
  "segments block"
);

/* 3. honest state coverage */
sub(
  'console.log("  states covered: " + [...seenState].join(", "));',
  'const cellStates = new Set();\n' +
  'sample_rows.forEach((r) => Object.keys(r.counts).forEach((k) => cellStates.add(k)));\n' +
  'console.log("  states in the sample: " + [...cellStates].sort().join(", "));\n' +
  'console.log("  changes sample domains: " + changes_sample.map((c) => c.domain).join(", "));',
  "state coverage log"
);

fs.writeFileSync(P, s);
require("child_process").execSync("node --check " + P);
console.log("build-explore-preview.cjs corrected");
console.log("  segments read `band` + blocked_pct.GPTBot (the fields that exist)");
console.log("  changes sample takes one row per domain, not five rows of one domain");
console.log("  state coverage counts every cell, not just each row's dominant state");
