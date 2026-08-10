#!/usr/bin/env node
// Builds the domain-lookup index for /v1/check from paid-dataset.json:
// 64 shards (lookup:00..lookup:3f) + lookup:meta, pushed to DATA KV in ONE
// bulk write. Sharding = sha256(domain) so the worker can find any domain
// with a single small KV read + tiny JSON.parse (free-plan CPU safe).
const fs = require("fs");
const crypto = require("crypto");
const { execSync } = require("child_process");

const d = JSON.parse(fs.readFileSync("paid-dataset.json", "utf8"));
const rows = d.per_domain || [];
if (!rows.length) { console.error("no per_domain rows - aborting"); process.exit(1); }

const bots = Object.keys(rows[0]).filter(k => k !== "rank" && k !== "domain");
const code = v => ({ blocked: "b", allowed: "a", partial: "p", unlisted: "u", no_robots: "n" }[v] || "u");
const shardOf = domain => crypto.createHash("sha256").update(domain).digest()[0] % 64;

const shards = Array.from({ length: 64 }, () => ({}));
const hist = new Array(bots.length + 1).fill(0);
let parsed = 0;
for (const r of rows) {
  const verdicts = bots.map(b => code(r[b]));
  shards[shardOf(r.domain)][r.domain] = [Number(r.rank) || 0].concat(verdicts);
  if (verdicts.some(v => v !== "n")) {
    parsed++;
    hist[verdicts.filter(v => v === "b").length]++;
  }
}

const meta = {
  generated_utc: d.generated_utc,
  tranco_top_n: (d.coverage && d.coverage.tranco_top_n) || 50000,
  robots_parsed: parsed,
  bots,
  hist,
  top_price: "USD 0.50 (stackoverflow.com -> ClaudeBot)",
};

const bulk = [{ key: "lookup:meta", value: JSON.stringify(meta) }];
for (let i = 0; i < 64; i++) {
  bulk.push({ key: "lookup:" + i.toString(16).padStart(2, "0"), value: JSON.stringify(shards[i]) });
}
fs.writeFileSync(".lookup-bulk.json", JSON.stringify(bulk));
execSync("wrangler kv bulk put .lookup-bulk.json --binding=DATA --remote", { stdio: "inherit" });
fs.unlinkSync(".lookup-bulk.json");
const sizes = bulk.slice(1).map(e => e.value.length);
console.log("lookup index published: " + rows.length.toLocaleString() + " domains, 64 shards ("
  + Math.round(Math.min(...sizes) / 1024) + "-" + Math.round(Math.max(...sizes) / 1024) + " KB), "
  + bots.length + " bots, parsed " + parsed.toLocaleString());
