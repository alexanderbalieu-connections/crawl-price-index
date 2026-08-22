#!/usr/bin/env node
/**
 * CRAWL PRICE INDEX — BAZAAR COPY GUARD  (node check-bazaar.cjs)
 * =========================================================================
 * Sibling of check-copy.cjs / check-public.cjs, for the Machine-payments tab.
 * The tab's numbers interpolate from the data, but the *characterisations*
 * around them ("mostly APIs and tools, not paid web pages", "on Base rail",
 * micro-price median) are qualitative claims that could go stale as the market
 * moves. This asserts each one against the latest weekly Bazaar summary so a
 * sentence that no longer matches is caught before publish.
 *
 * Reads bazaar/<latest>-summary.json. Exit 0 = clean, 1 = a claim drifted.
 * Wire non-fatally into the Sunday run (like check-public).
 */
const fs = require("fs");
const path = require("path");

if (!fs.existsSync("bazaar")) { console.log("no bazaar/ capture yet — skipping bazaar copy guard"); process.exit(0); }
const sf = fs.readdirSync("bazaar").filter(f => /-summary\.json$/.test(f)).sort().pop();
if (!sf) { console.log("no bazaar summary yet — skipping"); process.exit(0); }
const s = JSON.parse(fs.readFileSync(path.join("bazaar", sf), "utf8"));
const t = s.by_type || {}, u = s.usd || {}, sel = s.sellers || {};

const results = [];
const check = (claim, ok, detail) => results.push({ claim, ok: !!ok, detail: detail || "" });

check("APIs are the largest endpoint type (tab: 'mostly APIs and tools')",
  (t.api || 0) >= (t.content || 0) && (t.api || 0) >= (t.mcp || 0),
  `api=${t.api || 0} content=${t.content || 0} mcp=${t.mcp || 0}`);
check("APIs outnumber content (tab: 'not paid web pages')",
  (t.api || 0) > (t.content || 0), `api=${t.api || 0} vs content=${t.content || 0}`);
check("Base is the dominant settlement rail (tab: 'on Base rail')",
  (s.rail_share_pct || 0) >= 50, `rail_share=${s.rail_share_pct}%`);
check("USDC is the dominant asset",
  (s.asset_usdc_share_pct || 0) >= 50, `usdc_share=${s.asset_usdc_share_pct}%`);
check("median advertised price is a micro-price (<= $1)",
  u.median != null && u.median <= 1, `median=$${u.median}`);
check("more than one distinct seller (tab: 'not one lister')",
  (sel.distinct || 0) > 1, `distinct_sellers=${sel.distinct}`);
check("testnet endpoints are being separated from USD stats",
  typeof u.testnet_excluded === "number", `testnet_excluded=${u.testnet_excluded}`);

const fail = results.filter(r => !r.ok);
console.log(`\nBAZAAR COPY GUARD — ${s.date} (${results.length} checks)`);
console.log("-".repeat(72));
for (const r of results) {
  console.log(`${r.ok ? "  ok  " : " FAIL "} ${r.claim}`);
  if (!r.ok) console.log(`        ${r.detail}`);
}
console.log("-".repeat(72));
if (!fail.length) { console.log(`All ${results.length} checks pass — the Machine-payments tab copy still matches the data.`); process.exit(0); }
console.log(`${fail.length} claim(s) drifted — update the wording in app/views.js (renderBazaar) before publish.\n`);
process.exit(1);
