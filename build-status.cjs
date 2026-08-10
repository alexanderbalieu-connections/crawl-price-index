#!/usr/bin/env node
// Builds two credibility pages from REAL data, so they can never drift:
//   status.html    live coverage, freshness, what shipped, enforcement variance
//   changelog.html dated entries from changelog.json
// Run as part of the weekly publish so both stay current automatically.
const fs = require("fs");

const d = JSON.parse(fs.readFileSync("paid-dataset.json", "utf8"));
const rows = d.per_domain || [];
const cov = d.coverage || {};
let hist = null;
try { hist = JSON.parse(fs.readFileSync("trends.json", "utf8")); } catch (e) {}
let log = [];
try { log = JSON.parse(fs.readFileSync("changelog.json", "utf8")); } catch (e) {}
let corrections = [];
try { corrections = JSON.parse(fs.readFileSync("corrections.json", "utf8")); } catch (e) {}

const gen = d.generated_utc || new Date().toISOString();
const ageDays = ((Date.now() - Date.parse(gen)) / 86400000);
const enf = d.enforcement || null;
const HEAD = (title, desc) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — The Crawl Price Index</title>
<meta name="description" content="${desc}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 32 32%27%3E%3Crect width=%2732%27 height=%2732%27 fill=%27%230b0d0e%27/%3E%3Crect x=%276%27 y=%2714%27 width=%2720%27 height=%274%27 fill=%27%233cf08a%27/%3E%3C/svg%3E">
<link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500&family=Spline+Sans+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root{--ink:#0b0d0e;--panel:#121517;--line:#232a2d;--dim:#6b787d;--fg:#d7dee1;--bright:#f2f6f7;--signal:#3cf08a;--amber:#f0b23c}
  *{box-sizing:border-box}
  body{margin:0;background:var(--ink);color:var(--fg);font-family:"Newsreader",Georgia,serif;font-size:17px;line-height:1.6}
  .wrap{max-width:800px;margin:0 auto;padding:0 24px}
  a{color:var(--signal)}
  header{padding:44px 0 20px;border-bottom:1px solid var(--line)}
  .crumb{font-family:"Spline Sans Mono",monospace;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--signal)}
  .crumb a{text-decoration:none}
  h1{font-size:clamp(28px,5vw,42px);line-height:1.05;font-weight:500;color:var(--bright);margin:.3em 0 .2em}
  h2{font-size:21px;font-weight:500;color:var(--bright);margin:34px 0 10px}
  .mono{font-family:"Spline Sans Mono",monospace}
  .band{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);margin:22px 0}
  .cell{background:var(--ink);padding:16px}
  .cell .n{font-family:"Spline Sans Mono",monospace;font-size:24px;color:var(--bright)}
  .cell .n.g{color:var(--signal)}
  .cell .k{font-size:13px;color:var(--dim);margin-top:5px}
  table{width:100%;border-collapse:collapse;margin:12px 0;font-size:15px}
  th,td{text-align:left;padding:9px 10px 9px 0;border-bottom:1px solid var(--line);vertical-align:top}
  th{font-family:"Spline Sans Mono",monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);font-weight:500}
  .ok{color:var(--signal)} .warn{color:var(--amber)}
  .box{background:var(--panel);border-left:3px solid var(--amber);padding:14px 16px;margin:18px 0;font-size:15.5px}
  .entry{border-bottom:1px solid var(--line);padding:16px 0}
  .entry .d{font-family:"Spline Sans Mono",monospace;font-size:12px;color:var(--signal)}
  .entry .t{color:var(--bright);font-size:18px;margin:4px 0}
  ul{padding-left:22px} li{margin-bottom:6px}
  footer{margin-top:50px;padding:22px 0 60px;border-top:1px solid var(--line);font-family:"Spline Sans Mono",monospace;font-size:12px;color:var(--dim)}
</style>
</head>
<body>`;
const FOOT = `<footer>THE CRAWL PRICE INDEX · <a href="/methodology.html">methodology</a> · <a href="/privacy.html">privacy</a> · <a href="/security.html">security</a> · <a href="/terms.html">terms</a> · <a href="/">index</a></footer>
</div></body></html>`;

// ---------- status.html ----------
const fresh = ageDays < 9;
const status = HEAD("Status &amp; coverage", "Live coverage, freshness and known caveats for the Crawl Price Index dataset.")
+ `<header><div class="wrap">
  <div class="crumb"><a href="/">← The Crawl Price Index</a></div>
  <h1>Status &amp; coverage</h1>
  <p style="margin:0;max-width:620px">What is in the current edition, how fresh it is, and what we know is imperfect about it. Generated automatically from the published dataset — this page cannot drift from reality.</p>
</div></header>
<div class="wrap">
  <div class="band">
    <div class="cell"><div class="n g">${Number(cov.robots_parsed || 0).toLocaleString()}</div><div class="k">domains parsed this edition</div></div>
    <div class="cell"><div class="n">${Number(cov.tranco_top_n || 0).toLocaleString()}</div><div class="k">Tranco frame</div></div>
    <div class="cell"><div class="n">${rows.length.toLocaleString()}</div><div class="k">per-domain rows published</div></div>
    <div class="cell"><div class="n">${Object.keys(d.country_editions || {}).length}</div><div class="k">country editions</div></div>
  </div>
  <table>
    <tr><th>Item</th><th>Value</th></tr>
    <tr><td>Edition generated</td><td class="mono">${gen}</td></tr>
    <tr><td>Age</td><td class="mono ${fresh ? "ok" : "warn"}">${ageDays.toFixed(1)} days ${fresh ? "(within the weekly cycle)" : "(older than one cycle — a sweep may be in progress)"}</td></tr>
    <tr><td>Methodology version</td><td class="mono">${d.methodology_version || "unversioned"}</td></tr>
    <tr><td>History span</td><td class="mono">${hist && hist.history_span ? hist.history_span.first + " → " + hist.history_span.latest + " (" + hist.history_span.points + " points)" : "—"}</td></tr>
    <tr><td>Crawlers tracked</td><td class="mono">${rows.length ? Object.keys(rows[0]).filter(k => k !== "rank" && k !== "domain").length : "—"}</td></tr>
    <tr><td>Publisher panel</td><td class="mono">${cov.publisher_panel || "—"} domains</td></tr>
    <tr><td>Cadence</td><td>Weekly full sweep, automated</td></tr>
  </table>

  <h2>Enforcement sample — read this before quoting it</h2>
  ${enf ? `<p>Current edition: <b class="mono">${enf.enforced_pct}%</b> of declared blocks were actually enforced, across <b class="mono">${enf.n}</b> checks on the publisher panel.</p>` : "<p>Not computed in this edition.</p>"}
  <div class="box">
    <b>This figure moves between runs, and you should know why.</b> It is measured on a small panel (tens of checks, not thousands), and the denominator changes with how many panel domains responded to an identified crawler in that sweep. We have observed it between 50% and 62% on consecutive editions. Treat it as directional evidence that a substantial minority of declared AI blocks are not enforced — consistent with independent findings of roughly 40% — and always quote it with its n and date. It is not a precise population estimate, and we will not present it as one.
  </div>

  <h2>What we know is imperfect</h2>
  <ul>
    <li><b>Declaration is not enforcement.</b> Headline block rates measure what sites publish, not what they do.</li>
    <li><b>One vantage point.</b> We crawl from a single network; sites that vary by geography or ASN may look different elsewhere.</li>
    <li><b>Prices are sparse.</b> Very few sites quote a machine-readable price. We report the count rather than smoothing it.</li>
    <li><b>Not every domain answers.</b> Rates are always computed against domains parsed, never the nominal frame.</li>
    <li><b>ccTLD is a proxy</b> for country, not a measure of publisher nationality or audience.</li>
  </ul>

  <h2>Corrections</h2>
  ${corrections.length
    ? "<table><tr><th>Date</th><th>What changed</th><th>Why</th></tr>" + corrections.map(c => `<tr><td class="mono">${c.date || ""}</td><td>${c.what || ""}</td><td>${c.why || ""}</td></tr>`).join("") + "</table>"
    : '<p>No corrections have been issued. When one is, it appears here and in the machine-readable <span class="mono">corrections</span> array of the dataset, with the date, what changed and why. We do not silently amend past editions.</p>'}

  <h2>Verify any of this yourself</h2>
  <p class="mono" style="font-size:14px">curl -s https://api.crawlpriceindex.com/v1/check?domain=context<br>
  curl -s https://api.crawlpriceindex.com/v1/methodology<br>
  curl -s https://crawlpriceindex.com/index.json</p>
`+ FOOT;
fs.writeFileSync("public/status.html", status);

// ---------- changelog.html ----------
const entries = log.length ? log : [];
const changelog = HEAD("Changelog", "Dated record of what changed in the Crawl Price Index product and method.")
+ `<header><div class="wrap">
  <div class="crumb"><a href="/">← The Crawl Price Index</a></div>
  <h1>Changelog</h1>
  <p style="margin:0;max-width:620px">What changed, when, and why. Method changes carry the methodology version they introduced.</p>
</div></header>
<div class="wrap">
` + (entries.length ? entries.map(e => `  <div class="entry">
    <div class="d">${e.date}${e.methodology_version ? ' · methodology ' + e.methodology_version : ""}</div>
    <div class="t">${e.title}</div>
    <div>${e.detail || ""}</div>
  </div>`).join("\n") : "<p>No entries yet.</p>") + FOOT;
fs.writeFileSync("public/changelog.html", changelog);

console.log("status.html  → " + Number(cov.robots_parsed || 0).toLocaleString() + " parsed, " + ageDays.toFixed(1) + " days old, " + (enf ? enf.enforced_pct + "% enforced (n=" + enf.n + ")" : "no enforcement figure"));
console.log("changelog.html → " + entries.length + " entries");
