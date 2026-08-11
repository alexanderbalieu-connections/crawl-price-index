#!/usr/bin/env node
// Is the machine actually running? One command, plain answer.
const fs = require("fs");
const H = 36;   // hours: a daily job that hasn't run in this long is a problem
const TZ = "Europe/Brussels";

const fmt = iso => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, 16);
  return d.toLocaleString("sv-SE", { timeZone: TZ }).slice(0, 16);
};

let runs = [];
try {
  runs = fs.readFileSync("runs.log", "utf8").trim().split("\n").filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
} catch (e) {}

const stat = p => { try { return fs.statSync(p).mtime; } catch (e) { return null; } };
const prog = stat(".scan-progress.json");
const full = stat("scan-robots-full.csv");
const paid = stat("paid-dataset.json");
const hrs = d => d ? ((Date.now() - d.getTime()) / 3600000) : null;

console.log("\nCRAWL PRICE INDEX — automation status\n" + "=".repeat(38));

if (runs.length) {
  const last = runs[runs.length - 1];
  const age = (Date.now() - Date.parse(last.ended)) / 3600000;
  console.log("\nLast run      " + fmt(last.ended) + "  (" + age.toFixed(1) + "h ago, local time)");
  console.log("Outcome       " + last.outcome + (last.sweep ? "   · sweep " + last.sweep : ""));
  console.log("\nRecent runs");
  for (const r of runs.slice(-8)) {
    const mark = r.outcome === "scan_failed" ? "FAIL " : (r.outcome === "published" ? "PUB  " : "ok   ");
    console.log("  " + mark + fmt(r.ended) + "  " + r.outcome);
  }
  const pubs = runs.filter(r => r.outcome === "published");
  if (pubs.length) console.log("\nLast publish  " + fmt(pubs[pubs.length - 1].ended));

  const recent = runs.slice(-5);
  const fails = recent.filter(r => r.outcome === "scan_failed").length;
  let verdict;
  if (age > H) {
    verdict = "STALLED — no run in " + age.toFixed(0) + "h. Check: launchctl list | grep -i crawl";
  } else if (last.outcome === "scan_failed") {
    verdict = "DEGRADED — it ran on schedule, but the LAST RUN FAILED. The clock is fine; the scan is not.";
  } else if (fails >= 2) {
    verdict = "DEGRADED — " + fails + " of the last " + recent.length + " runs failed.";
  } else {
    verdict = "HEALTHY — ran within " + H + "h and the last run succeeded.";
  }
  console.log("\nVERDICT       " + verdict);
} else {
  console.log("\nNo runs.log yet — it fills from the next automated run.\nFalling back to file evidence:");
}

console.log("\nFile evidence (independent of the log)");
console.log("  .scan-progress.json    " + (prog ? hrs(prog).toFixed(1) + "h ago  → a sweep is part-way through" : "absent      → last sweep completed"));
console.log("  scan-robots-full.csv   " + (full ? hrs(full).toFixed(1) + "h ago  → last completed sweep" : "absent"));
console.log("  paid-dataset.json      " + (paid ? hrs(paid).toFixed(1) + "h ago  → last publish" : "absent"));

if (prog) {
  try {
    const c = JSON.parse(fs.readFileSync(".scan-progress.json", "utf8"));
    const done = c.index || c.cursor || c.done || null;
    if (done) console.log("\nSweep progress  " + Number(done).toLocaleString() + " domains reached");
  } catch (e) {}
}
console.log("");
