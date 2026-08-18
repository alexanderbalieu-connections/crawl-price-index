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
const MAST = (cur) => `<div class="masthead"><div class="wrap">
  <a class="mark" href="/">The Crawl Price Index<b>.</b></a>
  <nav>
    <a class="lnk" href="/check">Check a domain</a>
    <a class="lnk" href="/world">World editions</a>
    <a class="lnk" href="/methodology"${cur==="method"?' aria-current="page"':""}>Methodology</a>
    <a class="ghost" href="/sample">Weekly email</a>
    <a class="btn" href="/#access">Subscribe</a>
  </nav>
</div></div>`;
// STATUS_THEME_V2: pages inherit palette, type and masthead from theme.css
const HEAD = (title, desc, cur) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — The Crawl Price Index</title>
<meta name="description" content="${desc}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;1,6..72,300&family=Archivo:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/theme.css">
</head>
<body class="prose">
${MAST(cur)}`;
const FOOT = `<footer>THE CRAWL PRICE INDEX · <a href="/methodology.html">methodology</a> · <a href="/privacy.html">privacy</a> · <a href="/security.html">security</a> · <a href="/terms.html">terms</a> · <a href="/">index</a></footer>
</div></body></html>`;

// ---------- status.html ----------
const fresh = ageDays < 9;
const status = HEAD("Status &amp; coverage", "Live coverage, freshness and known caveats for the Crawl Price Index dataset.", "method")
+ `<header><div class="wrap">
  <p class="eyebrow">Status</p>
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
const changelog = HEAD("Changelog", "Dated record of what changed in the Crawl Price Index product and method.", "method")
+ `<header><div class="wrap">
  <p class="eyebrow">Product &amp; method</p>
  <h1>Changelog</h1>
  <p style="margin:0;max-width:620px">What changed, when, and why. Method changes carry the methodology version they introduced.</p>
</div></header>
<div class="wrap">
` + (entries.length ? entries.map(e => `  <article style="padding:22px 0;border-bottom:1px solid var(--line)">
    <div style="font-family:var(--sans);font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--signal);font-weight:600;margin-bottom:6px">${e.date}${e.methodology_version ? ' &middot; methodology ' + e.methodology_version : ""}</div>
    <h3 style="font-family:var(--serif);font-weight:400;font-size:22px;margin:0 0 10px;color:var(--fg)">${e.title}</h3>
    <p style="margin:0;color:var(--dim);max-width:70ch">${e.detail || ""}</p>
  </article>`).join("\n") : "<p>No entries yet.</p>") + FOOT;
fs.writeFileSync("public/changelog.html", changelog);

console.log("status.html  → " + Number(cov.robots_parsed || 0).toLocaleString() + " parsed, " + ageDays.toFixed(1) + " days old, " + (enf ? enf.enforced_pct + "% enforced (n=" + enf.n + ")" : "no enforcement figure"));
console.log("changelog.html → " + entries.length + " entries");
