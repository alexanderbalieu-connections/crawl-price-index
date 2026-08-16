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
 * --force : writes a single-use .publish-force marker. The NEXT gate check
 *           (whoever runs it — cpi.command, run-weekly, autopilot) consumes
 *           the marker and publishes. This is what makes "publish early"
 *           actually work across separate processes.
 * --days  : print days since the last edition and exit (used by cpi.command).
 */
const fs = require("fs");

const MIN_DAYS = 7;
const FORCE = process.argv.includes("--force");
const DAY = 86400000;

const mtime = p => { try { return fs.statSync(p).mtimeMs; } catch (e) { return null; } };
const say = m => console.log("  gate: " + m);

function lastEdition() {
  try {
    const idx = JSON.parse(fs.readFileSync("history-index.json", "utf8"));
    if (idx.latest_snapshot) return [Date.parse(idx.latest_snapshot + "T12:00:00Z"), "history-index (" + idx.latest_snapshot + ")"];
  } catch (e) {}
  return [mtime("paid-dataset.json"), "paid-dataset.json mtime"];
}

if (process.argv.includes("--days")) {
  const [le] = lastEdition();
  console.log(le === null ? "999" : ((Date.now() - le) / DAY).toFixed(1));
  process.exit(0);
}

if (FORCE) {
  fs.writeFileSync(".publish-force", new Date().toISOString());
  say("--force: single-use marker written. The next gate check will publish.");
  process.exit(0);
}

// A sweep is mid-flight: nothing to decide.
if (fs.existsSync(".scan-progress.json")) { say("sweep still in progress"); process.exit(20); }

const harvest = mtime("scan-robots-full.csv");
if (!harvest) { say("no completed harvest on disk"); process.exit(20); }

const [le, source] = lastEdition();
if (le === null) { say("no previous edition; publishing the first"); process.exit(0); }
if (harvest <= le) { say("harvest already published; nothing pending"); process.exit(20); }

// a marker from an earlier --force overrides the minimum interval, once
if (fs.existsSync(".publish-force")) {
  fs.unlinkSync(".publish-force");
  say("publish-force marker found and consumed — publishing early by explicit choice");
  process.exit(0);
}

const days = (Date.now() - le) / DAY;
if (days >= MIN_DAYS) {
  say("last edition " + days.toFixed(1) + " days ago (min " + MIN_DAYS + ") per " + source + " — publishing");
  process.exit(0);
}
say("completed sweep is HELD. Last edition " + days.toFixed(1) + " days ago, minimum is " + MIN_DAYS + ".");
say("Publishing in about " + (MIN_DAYS - days).toFixed(1) + " days. The harvest is kept; no rescan will start.");
process.exit(10);
