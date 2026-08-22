#!/usr/bin/env node
/**
 * build-bazaar-appdata.cjs
 * Assembles what the app needs from the weekly Bazaar capture:
 *   app/data/bazaar.json          FREE aggregate (composition, price, reach, ~5 examples) + series
 *   app/private/bazaar-domains.json  GATED full per-domain table (served via /api/bazaar-domains)
 * Reads the latest bazaar/<date>-summary.json + bazaar-index.json + private/bazaar-domains.json.
 * Idempotent; safe to run every publish. Non-fatal if the capture is missing.
 */
const fs = require("fs");
const path = require("path");
try {
  if (!fs.existsSync("bazaar")) { console.log("no bazaar/ yet — skipping app-data build"); process.exit(0); }
  const sf = fs.readdirSync("bazaar").filter(f => /-summary\.json$/.test(f)).sort().pop();
  if (!sf) { console.log("no bazaar summary yet — skipping"); process.exit(0); }
  const s = JSON.parse(fs.readFileSync(path.join("bazaar", sf), "utf8"));
  let series = [];
  try { series = JSON.parse(fs.readFileSync("bazaar-index.json", "utf8")); } catch {}

  const i = s.intersection || null;
  const free = {
    date: s.date, generated_utc: s.generated_utc,
    total: s.total, priced: s.priced, real_priced: s.real_priced, real_domain: s.real_domain,
    by_type: s.by_type, by_network: s.by_network,
    rail_share_pct: s.rail_share_pct, asset_usdc_share_pct: s.asset_usdc_share_pct,
    usd: s.usd, sellers: s.sellers ? { distinct: s.sellers.distinct, top_share_pct: s.sellers.top_share_pct } : null,
    reach: s.reach, capped: s.capped, vs_prior: s.vs_prior, new_endpoints: s.new_endpoints,
    intersection: i ? {
      frame_source: i.frame_source, frame_size: i.frame_size,
      in_frame_total: i.in_frame_total, in_frame_content: i.in_frame_content, hosting_excluded: i.hosting_excluded,
      by_rank_band: i.by_rank_band, blockers_that_sell: i.blockers_that_sell,
      examples: (i.examples || []).slice(0, 5),                       // teaser only
      blockers_examples: (i.blockers_that_sell_examples || []).slice(0, 3),
    } : null,
    series: series.map(r => ({ date: r.date, real_priced: r.real_priced, by_type: r.by_type,
      usd_median: r.usd_median, sellers: r.sellers, in_frame: r.in_frame })),
  };
  fs.mkdirSync(path.join("app", "data"), { recursive: true });
  fs.writeFileSync(path.join("app", "data", "bazaar.json"), JSON.stringify(free));
  console.log("wrote app/data/bazaar.json (free aggregate, " + (free.series.length) + " editions)");

  if (fs.existsSync(path.join("private", "bazaar-domains.json"))) {
    fs.mkdirSync(path.join("app", "private"), { recursive: true });
    fs.copyFileSync(path.join("private", "bazaar-domains.json"), path.join("app", "private", "bazaar-domains.json"));
    console.log("copied gated per-domain table -> app/private/bazaar-domains.json");
  }
} catch (e) { console.log("bazaar app-data build failed (non-fatal): " + (e.message || e)); process.exit(0); }
