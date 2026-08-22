#!/usr/bin/env node
/**
 * CPI — /explore preview freshness guard  (node check-explore.cjs)
 * ===========================================================================
 * "No stale nonsense." The dashboard preview on /explore shows real, dated
 * measurements, which means the one way it can lie is by being a week behind
 * the page around it. This fails loudly if that happens.
 *
 * Wired into sunday-run.command after build-explore-preview.cjs.
 */
const fs = require("fs");
let bad = 0, n = 0;
const ok = (cond, label, detail) => {
  n++;
  console.log("  " + (cond ? "ok  " : "FAIL") + "  " + label + (detail ? "\n         " + detail : ""));
  if (!cond) bad++;
};

console.log("\nEXPLORE PREVIEW GUARD");
console.log("-".repeat(74));

if (!fs.existsSync("public/explore-preview.json")) {
  console.log("  FAIL  public/explore-preview.json does not exist — run build-explore-preview.cjs");
  process.exit(1);
}
const P = JSON.parse(fs.readFileSync("public/explore-preview.json", "utf8"));
const dash = JSON.parse(fs.readFileSync("app/data/dashboard.json", "utf8"));
const feed = JSON.parse(fs.readFileSync("index.json", "utf8"));

ok(P.edition === dash.edition,
   "preview edition matches the published dashboard edition",
   "preview " + P.edition + " vs dashboard " + dash.edition);

ok(P.source_editions && P.source_editions.domains === P.edition,
   "per-domain rows come from the same edition as the aggregates",
   "domains " + (P.source_editions || {}).domains + " vs preview " + P.edition);

const feedDay = (feed.generated_utc || "").slice(0, 10);
const previewDay = (P.generated_utc || "").slice(0, 10);
ok(previewDay >= feedDay,
   "preview was rebuilt no earlier than the feed it summarises",
   "preview built " + previewDay + ", feed generated " + feedDay);

/* the numbers on the preview must be the numbers we publish elsewhere */
ok(P.overview && P.overview.parsed === feed.coverage.robots_parsed,
   "parsed count agrees with index.json",
   P.overview && P.overview.parsed + " vs " + feed.coverage.robots_parsed);
ok(P.overview && P.overview.asymmetry && P.overview.asymmetry.ratio === feed.asymmetry_headline.ratio,
   "asymmetry ratio agrees with index.json");
ok(P.domains && P.domains.total_rows === feed.coverage.tranco_top_n,
   "per-domain row count equals the ranked frame",
   P.domains && P.domains.total_rows + " vs " + feed.coverage.tranco_top_n);

/* the sample must be real rows, and must actually show variety — a preview
   where every sample domain blocks everything sells a false picture */
const rows = (P.domains && P.domains.sample_rows) || [];
ok(rows.length >= 4, "at least four real sample rows", rows.length + " rows");
ok(rows.every(r => r.domain && /\./.test(r.domain) && r.sig && r.sig.length === P.domains.columns.length),
   "every sample row is a real domain with a full crawler signature");
const states = new Set();
rows.forEach(r => Object.keys(r.counts || {}).forEach(k => states.add(k)));
ok(states.size >= 3,
   "the sample spans at least three policy states, not one",
   [...states].sort().join(", "));

/* masking, not fabrication */
ok(P.domains && P.domains.masked_rows === P.domains.total_rows - rows.length,
   "masked count is the real remainder, not a round number");

/* changes sample must not be one domain repeated */
const cd = new Set(((P.changes || {}).sample || []).map(c => c.domain));
ok(cd.size === ((P.changes || {}).sample || []).length,
   "the policy-changes sample shows distinct domains",
   cd.size + " distinct of " + ((P.changes || {}).sample || []).length);

/* fields the renderer dereferences by name — a rename upstream printed
   "undefined%" on the Segments tab and nothing failed */
const seg = P.segments || {};
ok(seg.band_metric && Array.isArray(seg.bands) && seg.bands.every(b => typeof b.pct === "number"),
   "every segment band carries a numeric rate");
ok(!seg.tld_most || typeof seg.tld_most.any_ai_block_pct === "number",
   "suffix group carries any_ai_block_pct",
   seg.tld_most ? JSON.stringify(seg.tld_most) : "absent");
ok(!/any_blocked_pct/.test(fs.readFileSync("public/explore.html", "utf8")),
   "explore.html does not reference the old any_blocked_pct field name");

/* the page must actually be wired to the file */
const html = fs.readFileSync("public/explore.html", "utf8");
ok(html.includes("/explore-preview.json"), "explore.html reads the preview file");
ok(html.includes("dp-edition"), "explore.html prints the edition on the panel");
ok(!/lead-in">Training versus traffic/.test(html),
   "the asymmetry card is not duplicated onto /explore — it belongs to the homepage");
ok(!/Is the ranked web even alive/.test(html),
   "the old bespoke reachability card is gone");
ok(/lead-in">Declared versus enforced/.test(html),
   "the edition cuts moved off the homepage did land here");

console.log("-".repeat(74));
if (bad) { console.log(bad + " of " + n + " checks FAILED — the /explore preview is stale or inconsistent.\n"); process.exit(1); }
console.log("All " + n + " checks pass — the preview matches this edition.\n");
