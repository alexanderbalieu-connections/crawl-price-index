#!/usr/bin/env node
// Publishes the free sample (top-100 rows) to DATA KV. Run after push-dataset.
const fs = require("fs");
const { execSync } = require("child_process");
const d = JSON.parse(fs.readFileSync("paid-dataset.json", "utf8"));
const rows = d.per_domain || [];
const sample = {
  name: "The Crawl Price Index — free sample (top 100 domains)",
  generated_utc: d.generated_utc,
  coverage: d.coverage,
  block_rates: d.block_rates,
  per_domain_sample: rows.slice(0, 100),
  note: "Free sample for Weekly Crawl subscribers: the top-100 ranked rows of " + rows.length.toLocaleString() + " total. Full dataset + country editions + weekly history: https://crawlpriceindex.com/#access",
  license: "Sample free to evaluate with attribution; full dataset is single-subscriber licensed.",
};
fs.writeFileSync("sample-dataset.json", JSON.stringify(sample, null, 2));
execSync("wrangler kv key put sample --binding=DATA --path=sample-dataset.json --remote", { stdio: "inherit" });
console.log("sample published: " + Math.min(100, rows.length) + " rows of " + rows.length);
