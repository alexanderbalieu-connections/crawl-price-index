#!/usr/bin/env node
/**
 * CPI — ONE-SHOT BACKFILL  (node backfill-editions.cjs)
 * =====================================================
 * Recovers per-domain history from backups/edition-<date>/scan-robots-full.csv
 * into editions/<date>.csv.gz, so the policy-change feed can diff editions
 * that predate the archiver. Never overwrites an existing edition.
 */
const fs = require("fs"), path = require("path"), zlib = require("zlib");
if (!fs.existsSync("backups")) { console.error("no backups/ directory"); process.exit(1); }
fs.mkdirSync("editions", { recursive: true });

let done = 0, skipped = 0;
for (const dir of fs.readdirSync("backups").sort()) {
  const m = dir.match(/^edition-(\d{4}-\d{2}-\d{2})$/);
  if (!m) continue;
  const date = m[1];
  const src = path.join("backups", dir, "scan-robots-full.csv");
  const dst = path.join("editions", `${date}.csv.gz`);
  if (!fs.existsSync(src)) { continue; }
  if (fs.existsSync(dst)) { console.log(`skip ${date} (already archived)`); skipped++; continue; }
  const raw = fs.readFileSync(src);
  const rows = raw.toString("utf8").trim().split("\n").length - 1;
  fs.writeFileSync(dst, zlib.gzipSync(raw, { level: 9 }));
  console.log(`backfilled ${date}: ${rows.toLocaleString("en-GB")} domains -> ${(fs.statSync(dst).size/1048576).toFixed(2)} MB`);
  done++;
}
const eds = fs.readdirSync("editions").filter(f => /\.csv\.gz$/.test(f)).sort();
console.log(`\nbackfilled ${done}, skipped ${skipped}. Editions now: ${eds.length} (${eds.map(e=>e.slice(0,10)).join(", ")})`);
if (eds.length >= 2) console.log("Change feed can now diff consecutive editions — rerun: node compute-dashboard.cjs && node compute-domains.cjs");
