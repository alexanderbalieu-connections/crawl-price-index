#!/usr/bin/env node
// FIX: the previous patch inserted statements inside an object literal.
// Restores rebuild.cjs from the backup, then inserts the row-stamping code
// at STATEMENT level (before the enforcement block, where `robots` exists)
// and only adds the freshness field inside the payload object.
const fs = require("fs");
if (!fs.existsSync("rebuild.cjs.bak6")) { console.error("rebuild.cjs.bak6 missing - cannot restore, aborting"); process.exit(1); }
let s = fs.readFileSync("rebuild.cjs.bak6", "utf8");
if (s.includes("observed_at")) { console.error("backup already contains the patch - aborting"); process.exit(1); }

// statement-level anchor (added by the enforcement patch, sits after `robots` is built)
const A = "// ---- 2b) enforcement vs declaration (research panel only) -----------------";
const B = "  methodology_version: METHODOLOGY_VERSION,";
if (!s.includes(A)) { console.error("statement anchor missing - aborting, nothing written"); process.exit(1); }
if (!s.includes(B)) { console.error("payload anchor missing - aborting, nothing written"); process.exit(1); }

const stamp = [
'// ---- row-level provenance ------------------------------------------------',
'// Each row records WHEN it was observed. A row that yielded no robots.txt',
'// reading in this sweep is flagged so it can never be mistaken for current.',
'const SWEEP_AT = new Date().toISOString();',
'let freshRows = 0, staleRows = 0;',
'for (const r of robots) {',
'  const vals = Object.keys(r).filter(k => k !== "rank" && k !== "domain" && k !== "observed_at" && k !== "observed").map(k => r[k]);',
'  const answered = vals.some(v => v && v !== "no_robots");',
'  r.observed_at = SWEEP_AT;',
'  r.observed = answered ? "yes" : "no";',
'  if (answered) freshRows++; else staleRows++;',
'}',
'const FRESHNESS = { sweep_at: SWEEP_AT, rows_with_reading: freshRows, rows_without_reading: staleRows, note: "observed=no means the domain did not yield a robots.txt reading in this sweep. Rates are computed over rows_with_reading only." };',
'',
A,
].join("\n");

s = s.replace(A, stamp);
s = s.replace(B, B + "\n  freshness: FRESHNESS,");
fs.writeFileSync("rebuild.cjs", s);

// prove it parses before we hand it back
const { execSync } = require("child_process");
try { execSync("node --check rebuild.cjs", { stdio: "pipe" }); }
catch (e) {
  fs.writeFileSync("rebuild.cjs", fs.readFileSync("rebuild.cjs.bak6"));
  console.error("patched file failed syntax check - rebuild.cjs restored to backup, nothing changed");
  process.exit(1);
}
console.log("row-level observed_at + freshness added correctly (syntax verified)");
