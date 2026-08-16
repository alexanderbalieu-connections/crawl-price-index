#!/usr/bin/env node
// THE PRICE-SERIES FIX
// 1. archive.cjs: /([\d.]+)/ matches the dot in ".com" before any digit,
//    so every history point stored top_observed_price_usd: null.
//    (LESSONS-LEARNED already documents this exact regex trap.)
// 2. Backfills existing history points from the best available source:
//    current paid-dataset.json, backups/, then git history.
// 3. Recomputes trends and refreshes the paid dataset.
const fs = require("fs");
const { execSync } = require("child_process");

// ---- 1. fix the regex at source -------------------------------------------
let a = fs.readFileSync("archive.cjs", "utf8");
const bad = 'const m = String(p.raw || "").match(/([\\d.]+)/);';
const good = 'const m = String(p.raw || "").match(/(\\d[\\d.]*)/);  // digit-first: never the dot in a domain';
if (a.indexOf(bad) !== -1) {
  fs.copyFileSync("archive.cjs", "archive.cjs.bak-price");
  a = a.replace(bad, good);
  fs.writeFileSync("archive.cjs", a);
  execSync("node --check archive.cjs");
  console.log("archive.cjs regex fixed");
} else if (a.indexOf("digit-first") !== -1) console.log("archive.cjs already fixed");
else { console.error("ABORT: expected regex not found in archive.cjs"); process.exit(1); }

// ---- 2. backfill history points --------------------------------------------
const priceFrom = (paid) => {
  let top = null;
  for (const p of (paid.observed_prices || [])) {
    const m = String(p.raw || "").match(/(\d[\d.]*)/);
    if (m) top = Math.max(top || 0, parseFloat(m[1]));
  }
  return top;
};
const sources = [];
try { sources.push(["current paid-dataset", JSON.parse(fs.readFileSync("paid-dataset.json","utf8"))]); } catch(e){}
try { sources.push(["backup 2026-08-15", JSON.parse(fs.readFileSync("backups/edition-2026-08-15/paid-dataset.json","utf8"))]); } catch(e){}
try {
  const hashes = execSync("git log --format=%H -- paid-dataset.json").toString().trim().split("\n").slice(0,12);
  for (const h of hashes) {
    try { sources.push(["git " + h.slice(0,7), JSON.parse(execSync("git show " + h + ":paid-dataset.json", {maxBuffer:64*1024*1024}).toString())]); } catch(e){}
  }
} catch(e){}

// map generated date -> price
const byDate = {};
for (const [label, paid] of sources) {
  const d = (paid.generated_utc || "").slice(0,10);
  const p = priceFrom(paid);
  if (d && p != null && byDate[d] == null) { byDate[d] = { p, label }; }
}
console.log("price sources found:", JSON.stringify(Object.fromEntries(Object.entries(byDate).map(([k,v])=>[k, v.p + " (" + v.label + ")"]))));

let filled = 0;
for (const f of fs.readdirSync("history").filter(x => x.endsWith(".json") && !x.includes("replaced"))) {
  const p = "history/" + f;
  const snap = JSON.parse(fs.readFileSync(p, "utf8"));
  if (snap.top_observed_price_usd != null) continue;
  const date = f.replace(".json","");
  // exact date, else nearest earlier source (price held at 0.5 across all scans)
  let src = byDate[date];
  if (!src) {
    const earlier = Object.keys(byDate).filter(d => d <= date).sort().pop();
    if (earlier) src = { p: byDate[earlier].p, label: byDate[earlier].label + " (nearest)" };
  }
  if (!src) { console.log("  " + f + ": no source found, left null"); continue; }
  snap.top_observed_price_usd = src.p;
  snap.price_backfill = { source: src.label, backfilled_utc: new Date().toISOString(), reason: "regex bug: [\\d.]+ matched domain dot; fixed 2026-08-16" };
  fs.writeFileSync(p, JSON.stringify(snap, null, 1));
  console.log("  " + f + ": price backfilled = " + src.p + "  (from " + src.label + ")");
  filled++;
}

// ---- 3. recompute trends, fold into the paid dataset ------------------------
if (filled || true) {
  try { execSync("node trends.cjs", {stdio:"inherit"}); } catch(e){ console.log("trends.cjs rerun failed — run manually"); }
}
console.log("\nDone. Verify with:");
console.log("  node -e 'console.log(JSON.stringify(JSON.parse(require(\"fs\").readFileSync(\"paid-dataset.json\",\"utf8\")).trends.observed_price_usd,null,1))'");
