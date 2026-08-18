#!/usr/bin/env node
/**
 * CRAWL PRICE INDEX — PER-DOMAIN EDITION ARCHIVER  (node archive-editions.cjs)
 * ===========================================================================
 * history/<date>.json keeps AGGREGATES. This keeps the per-domain rows —
 * the raw 50k x 18 status matrix — so future editions can be DIFFED:
 * the policy-change feed ("example.com | GPTBot | allowed -> blocked")
 * and transition matrices are impossible without it.
 *
 * Writes: editions/<YYYY-MM-DD>.csv.gz   (~1-2 MB gzipped)
 * Reads:  scan-robots-full.csv + scan-summary.json (for the date)
 * Idempotent: refuses to overwrite an existing edition unless --force.
 */
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

if (!fs.existsSync("scan-robots-full.csv")) {
  console.error("no scan-robots-full.csv — run a scan first");
  process.exit(1);
}
let date = new Date().toISOString().slice(0, 10);
try {
  const s = JSON.parse(fs.readFileSync("scan-summary.json", "utf8"));
  if (s.generated_utc) date = new Date(s.generated_utc).toISOString().slice(0, 10);
} catch (e) { /* fall back to today */ }

fs.mkdirSync("editions", { recursive: true });
const out = path.join("editions", `${date}.csv.gz`);

if (fs.existsSync(out) && !process.argv.includes("--force")) {
  console.error("REFUSING to overwrite existing edition " + out);
  console.error("Per-domain history cannot be reconstructed if lost.");
  console.error("If this really is a corrected re-scan:  node archive-editions.cjs --force");
  process.exit(3);
}
if (fs.existsSync(out)) {
  fs.copyFileSync(out, out + ".replaced-" + Date.now());
  console.log("--force: previous edition kept as a .replaced- backup");
}

const raw = fs.readFileSync("scan-robots-full.csv");
fs.writeFileSync(out, zlib.gzipSync(raw, { level: 9 }));
const mb = (fs.statSync(out).size / 1048576).toFixed(2);
const editions = fs.readdirSync("editions").filter(f => /^\d{4}-\d{2}-\d{2}\.csv\.gz$/.test(f)).sort();
console.log(`Archived per-domain edition ${date} (${mb} MB gzipped).`);
console.log(`Editions retained: ${editions.length} (${editions[0]?.slice(0,10)} -> ${editions[editions.length-1]?.slice(0,10)})`);
if (editions.length >= 2) console.log("  Diffable: the policy-change feed can now compare consecutive editions.");
else console.log("  First per-domain edition — the change feed goes live after the next scan.");
