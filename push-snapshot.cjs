#!/usr/bin/env node
// Builds the SNAPSHOT edition for machine (pay-per-crawl) access: the current
// week's rows and aggregates, with trends/history stripped. History is the
// moat and stays subscriber-only.
const fs = require("fs");
const { execSync } = require("child_process");
const d = JSON.parse(fs.readFileSync("paid-dataset.json", "utf8"));
const snap = {};
for (const k of Object.keys(d)) {
  if (k === "trends" || k === "history" || k === "history_span") continue;
  snap[k] = d[k];
}
snap.edition = "snapshot";
snap.note = "Single weekly edition, purchased per crawl. Week/month/quarter/year trends, the accumulated history record, and the movers feed are part of the Terminal subscription: https://crawlpriceindex.com/#access";
fs.writeFileSync("snapshot-dataset.json", JSON.stringify(snap));
execSync("wrangler kv key put dataset-snapshot --binding=DATA --path=snapshot-dataset.json --remote", { stdio: "inherit" });
const rows = (d.per_domain || []).length;
console.log("snapshot edition published: " + rows.toLocaleString() + " rows, history stripped (" + Math.round(fs.statSync("snapshot-dataset.json").size / 1024) + " KB)");
