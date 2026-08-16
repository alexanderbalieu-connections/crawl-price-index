#!/usr/bin/env node
// Builds public/suggest.txt — a plain rank-ordered domain list used only for
// the checker's type-ahead. Deliberately a STATIC ASSET, not a Worker route:
// prefix search over 27k domains cannot fit the free plan's 10ms CPU ceiling,
// and this costs the Worker nothing. The real lookup still goes to /v1/check.
const fs = require("fs");

const N = Number(process.env.SUGGEST_N || 12000);
const src = fs.existsSync("paid-dataset.json") ? "paid-dataset.json"
          : (fs.existsSync("public/paid-dataset.json") ? "public/paid-dataset.json" : null);
if (!src) { console.error("no paid-dataset.json found — run rebuild.cjs first"); process.exit(1); }

const d = JSON.parse(fs.readFileSync(src, "utf8"));
const rows = d.per_domain || d.rows || [];
if (!rows.length) { console.error("dataset has no per-domain rows"); process.exit(1); }

const seen = new Set();
const out = [];
rows.slice()
  .sort(function (a, b) { return (a.rank || 1e9) - (b.rank || 1e9); })
  .forEach(function (r) {
    const dom = (r.domain || "").toLowerCase().trim();
    if (!dom || seen.has(dom)) return;
    seen.add(dom);
    if (out.length < N) out.push(dom);
  });

fs.writeFileSync("public/suggest.txt", out.join("\n") + "\n");
const kb = Math.round(fs.statSync("public/suggest.txt").size / 1024);
console.log("wrote public/suggest.txt — " + out.length.toLocaleString("en-GB") + " domains, " + kb + " KB (rank order)");
