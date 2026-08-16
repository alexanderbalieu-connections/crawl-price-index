#!/usr/bin/env node
/**
 * CRAWL PRICE INDEX — PUBLISH GATE  (node can-publish.cjs)
 * ========================================================
 * Editions must be at least MIN_DAYS apart. A sweep that finishes early is
 * held, NOT discarded and NOT re-scanned, until the interval elapses.
 *
 * Exit codes, read by run-weekly.command:
 *    0  publish now — a completed sweep is pending and the interval has passed
 *   10  hold        — a completed sweep is pending but it is too early
 *   20  keep going  — nothing pending, carry on scanning
 *
 * Override for a deliberate early edition:  node can-publish.cjs --force
 */
const fs = require("fs");

const MIN_DAYS = 7;
const FORCE = process.argv.includes("--force");
const DAY = 86400000;

const mtime = p => { try { return fs.statSync(p).mtimeMs; } catch (e) { return null; } };
const say = m => console.log("  gate: " + m);

// --days : print days since the last edition and exit. Used by cpi.command
// to warn BEFORE a long scan that the result would be held.
if (process.argv.includes("--days")) {
  let le = null;
  try {
    const idx = JSON.parse(fs.readFileSync("history-index.json", "utf8"));
    if (idx.latest_snapshot) le = Date.parse(idx.latest_snapshot + "T12:00:00Z");
  } catch (e) {}
  if (le === null) le = mtime("paid-dataset.json");
  if (le === null) { console.log("999"); process.exit(0); }
  console.log(((Date.now() - le) / DAY).toFixed(1));
  process.exit(0);
}

// A sweep is mid-flight: nothing to decide.
if (fs.existsSync(".scan-progress.json")) { say("sweep still in progress"); process.exit(20); }

const harvest = mtime("scan-robots-full.csv");
if (!harvest) { say("no completed harvest on disk"); process.exit(20); }

// When did the last edition go out? Prefer the history archive; fall back to
// the paid dataset's timestamp.
let lastEdition = null, source = "";
try {
  const idx = JSON.parse(fs.readFileSync("history-index.json", "utf8"));
  if (idx.latest_snapshot) {
    lastEdition = Date.parse(idx.latest_snapshot + "T12:00:00Z");
    source = "history-index (" + idx.latest_snapshot + ")";
  }
} catch (e) {}
if (lastEdition === null) {
  lastEdition = mtime("paid-dataset.json");
  source = "paid-dataset.json mtime";
}

// Never published anything yet — publish.
if (lastEdition === null) { say("no previous edition; publishing the first"); process.exit(0); }

// Harvest older than the last edition means it has already been published.
if (harvest <= lastEdition) { say("harvest already published; nothing pending"); process.exit(20); }

const days = (Date.now() - lastEdition) / DAY;

if (FORCE) {
  fs.writeFileSync(".publish-force", new Date().toISOString());
  say("--force: marker written. The next gate check will publish this harvest.");
  process.exit(0);
}
// a marker from an earlier --force overrides the minimum interval once
if (fs.existsSync(".publish-force")) {
  fs.unlinkSync(".publish-force");
  say("publish-force marker found: publishing " + days.toFixed(1) + " days after the last edition");
  process.exit(0);
}
if (days >= MIN_DAYS) {
  say("last edition " + days.toFixed(1) + " days ago (min " + MIN_DAYS + ") per " + source + " — publishing");
  process.exit(0);
}

const wait = MIN_DAYS - days;
say("completed sweep is HELD. Last edition " + days.toFixed(1) + " days ago, minimum is " + MIN_DAYS + ".");
say("Publishing in about " + wait.toFixed(1) + " days. The harvest is kept; no rescan will start.");
process.exit(10);
