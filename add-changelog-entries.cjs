#!/usr/bin/env node
// Adds the methodology-change entries (Q1) to changelog.json — the record that
// explains why coverage and behaviour shifted between the early editions.
// Idempotent: skips any entry whose title already exists. Rebuilds the page.
const fs = require("fs");
const { execSync } = require("child_process");

const NEW = [
  {
    date: "2026-08-18",
    title: "Wide honest probe + three-tier panel",
    methodology_version: "2026-08-18.1",
    detail: "Added a wide, honest-identity probe covering the top-ranked domains plus every domain observed blocking a crawler — one signed request each, never impersonating — recording payment headers, 402 walls, Cloudflare fronting, X-Robots-Tag and llms.txt. The identity-matrix panel (which does probe under other crawlers' names, and is deliberately capped) is now assembled from three tiers: a fixed continuity spine, domains auto-promoted from the honest probe when they show payment or blocking behaviour, and a rotating random audit that samples the full scan so AI-only walls invisible to honest probing are still measured. Panel composition is published at /panel.json."
  },
  {
    date: "2026-08-16",
    title: "www fallback + reachability census (coverage restated)",
    methodology_version: "2026-08-16.1",
    detail: "The scanner now retries on www.<domain> when a bare domain fails at the network level, recovering roughly a thousand sites that only answer on their www host. Because this changes what counts as 'reached', coverage steps up between the 15 Aug and 16 Aug editions for methodological reasons, not because the web changed. Every unreachable domain is now itemised by reason (no DNS, refused, timeout, broken TLS, HTTP error) in a separate census, so coverage is reported against the reachable web rather than the raw 50,000. A late-sweep retry pass, capped in time, recovers transient failures."
  },
  {
    date: "2026-08-16",
    title: "Observed-price series corrected",
    methodology_version: "2026-08-16.2",
    detail: "Fixed a parsing error that stored a null price for the first two editions; the observed top price is now recorded as a continuous series from the 8 Aug baseline, with the early points backfilled from the value observed at the time and marked as such. The price shown has been a flat $0.50 (stackoverflow.com, via Cloudflare pay-per-crawl) at every observation to date."
  }
];

let log = [];
try { log = JSON.parse(fs.readFileSync("changelog.json", "utf8")); } catch (e) {}
const have = new Set(log.map(e => e.title));
let added = 0;
for (const e of NEW) { if (!have.has(e.title)) { log.push(e); added++; } }
// newest first
log.sort((a, b) => (b.date + b.title).localeCompare(a.date + a.title));
fs.writeFileSync("changelog.json", JSON.stringify(log, null, 2));
console.log("added " + added + " methodology entries (total " + log.length + ")");

try { execSync("node build-status.cjs", { stdio: "inherit" }); }
catch (e) { console.log("(build-status.cjs not run here — will regenerate on next publish)"); }
