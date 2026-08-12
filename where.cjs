#!/usr/bin/env node
// WHERE — one command that answers: where are we, when does the next full
// edition land, and what should I run right now?
//   node where.cjs
const fs = require("fs");
const TZ = "Europe/Brussels";

const read = (p, d) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return d; } };
const mtime = p => { try { return fs.statSync(p).mtime; } catch (e) { return null; } };
const hrs = d => d ? (Date.now() - d.getTime()) / 3600000 : null;
const fmt = d => d ? new Date(d).toLocaleString("sv-SE", { timeZone: TZ }).slice(0, 16) : "—";
const day = d => d ? new Date(d).toLocaleDateString("en-GB", { timeZone: TZ, weekday: "short", day: "2-digit", month: "short" }) : "—";
const n = x => Number(x).toLocaleString("en-GB");
const line = c => console.log(c);

const cfg = read("scan-config.json", {});
const TOP = cfg.top_n || 50000;
const MINUTES = cfg.daily_minutes || null;

const prog = read(".scan-progress.json", null);
const fullCsv = mtime("scan-robots-full.csv");
const paid = mtime("paid-dataset.json");

let runs = [];
try {
  runs = fs.readFileSync("runs.log", "utf8").trim().split("\n").filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
} catch (e) {}
const last = runs.length ? runs[runs.length - 1] : null;

line("");
line("  WHERE WE ARE — Crawl Price Index");
line("  " + "=".repeat(52));
line("");

// ---- last run -------------------------------------------------------------
if (last) {
  const age = (Date.now() - Date.parse(last.ended)) / 3600000;
  const ok = last.outcome !== "scan_failed";
  line("  Last run        " + fmt(last.ended) + "   (" + age.toFixed(1) + "h ago)");
  line("  Outcome         " + last.outcome + (ok ? "" : "   <-- FAILED"));
} else {
  line("  Last run        no runs.log entries yet");
}

// ---- sweep position -------------------------------------------------------
line("");
if (prog && prog.nextIndex != null) {
  const done = prog.nextIndex;
  const pct = 100 * done / TOP;
  const started = prog.startedAt ? new Date(prog.startedAt) : null;
  const elapsedDays = started ? (Date.now() - started.getTime()) / 86400000 : null;
  const perDay = (elapsedDays && elapsedDays > 0.2) ? done / elapsedDays : null;

  const width = 40;
  const filled = Math.max(0, Math.min(width, Math.round(width * done / TOP)));
  line("  SWEEP IN PROGRESS");
  line("  [" + "#".repeat(filled) + ".".repeat(width - filled) + "]  " + pct.toFixed(1) + "%");
  line("  " + n(done) + " of " + n(TOP) + " domains   ·   " + n(TOP - done) + " to go");
  line("  Started         " + fmt(prog.startedAt) + "  (" + (elapsedDays ? elapsedDays.toFixed(1) : "?") + " days ago)");

  if (perDay) {
    const etaDays = (TOP - done) / perDay;
    const eta = new Date(Date.now() + etaDays * 86400000);
    line("  Rate            " + n(Math.round(perDay)) + " domains/day at the current budget");
    line("  Next edition    " + day(eta) + "   (about " + etaDays.toFixed(1) + " days away)");
    const total = TOP / perDay;
    if (total > 7.5) {
      line("");
      line("  !! A full sweep takes about " + total.toFixed(0) + " days at this rate.");
      line("     The index publishes weekly. To close a sweep inside 7 days,");
      line("     raise daily_minutes in scan-config.json" + (MINUTES ? " (now " + MINUTES + ")" : "") +
           " to roughly " + Math.ceil((MINUTES || 15) * total / 7) + ".");
    }
  } else {
    line("  Rate            too early to estimate (needs ~6h of elapsed sweep)");
  }
} else {
  line("  NO SWEEP OPEN — the last one completed.");
}

// ---- last completed edition ----------------------------------------------
line("");
const sinceSweep = hrs(fullCsv);
const sincePub = hrs(paid);
line("  Last full sweep " + fmt(fullCsv) + "   (" + (sinceSweep == null ? "—" : (sinceSweep / 24).toFixed(1) + " days ago") + ")");
line("  Last publish    " + fmt(paid) + "   (" + (sincePub == null ? "—" : (sincePub / 24).toFixed(1) + " days ago") + ")");
if (sinceSweep != null && sinceSweep / 24 > 9) {
  line("");
  line("  !! No completed sweep in " + (sinceSweep / 24).toFixed(0) + " days. The weekly series has a gap.");
}

// ---- what to run ----------------------------------------------------------
line("");
line("  " + "-".repeat(52));
line("  WHAT TO RUN NOW");
line("");
if (prog && prog.nextIndex != null) {
  line("  The autopilot advances this by itself every day at 06:00.");
  line("  To push it along by hand right now:");
  line("");
  line("      node run-big.cjs                 one slice (" + (MINUTES || 15) + " min), then stop");
  line("");
  line("  For a longer push, raise daily_minutes in scan-config.json first —");
  line("  run-big.cjs reads its budget only from that file.");
  line("");
  line("  Nothing publishes until the sweep reaches " + n(TOP) + ".");
} else {
  line("  A sweep is finished and not yet published, or none has started.");
  line("  To publish what is on disk:");
  line("");
  line("      ./run-weekly.command             full chain: rebuild, deploy, email");
  line("");
  line("  To start the next sweep from zero:");
  line("");
  line("      node run-big.cjs --fresh");
}
line("");
