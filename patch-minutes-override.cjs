#!/usr/bin/env node
// Lets a single run override the daily budget:  CPI_MINUTES=600 node run-big.cjs
// scan-config.json stays the default. Validates and rolls back on failure.
const fs = require("fs");
const { execSync } = require("child_process");
const P = "run-big.cjs";
let s = fs.readFileSync(P, "utf8");

if (s.indexOf("CPI_MINUTES") !== -1) { console.log("override already present — no change"); process.exit(0); }

const anchor = 'const TIME_BUDGET_MS = (cfg.daily_minutes || 15) * 60 * 1000;';
if (s.indexOf(anchor) === -1) { console.error("ABORT: anchor not found"); process.exit(1); }

const repl = 'const TIME_BUDGET_MS = (Number(process.env.CPI_MINUTES) || cfg.daily_minutes || 15) * 60 * 1000;';
fs.copyFileSync(P, P + ".bak-minutes");
fs.writeFileSync(P, s.replace(anchor, repl));

try {
  execSync("node --check " + P, { stdio: "pipe" });
  console.log("CPI_MINUTES override added (backup: run-big.cjs.bak-minutes)");
} catch (e) {
  fs.copyFileSync(P + ".bak-minutes", P);
  console.error("SYNTAX FAILED — rolled back");
  process.exit(1);
}
