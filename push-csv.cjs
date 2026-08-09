#!/usr/bin/env node
// Builds the CSV flavour of the paid dataset and pushes it to DATA KV.
const fs = require("fs");
const { execSync } = require("child_process");
const d = JSON.parse(fs.readFileSync("paid-dataset.json", "utf8"));
const rows = d.per_domain || [];
if (!rows.length) { console.error("no per_domain rows — aborting"); process.exit(1); }
const cols = Object.keys(rows[0]);
const esc = v => { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const lines = [cols.join(",")];
for (const r of rows) lines.push(cols.map(c => esc(r[c])).join(","));
fs.writeFileSync("dataset.csv", lines.join("\n") + "\n");
execSync("wrangler kv key put dataset-csv --binding=DATA --path=dataset.csv --remote", { stdio: "inherit" });
console.log("CSV published: " + rows.length.toLocaleString() + " rows, " + cols.length + " columns");
