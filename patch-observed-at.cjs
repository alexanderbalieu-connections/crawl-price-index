#!/usr/bin/env node
// ROW-LEVEL PROVENANCE — the remaining data-quality hole.
// Adds observed_at to every per_domain row and, crucially, marks rows that
// did NOT respond in the current sweep so a stale row can never be presented
// as a current observation. Also publishes a freshness summary.
const fs = require("fs");
let s = fs.readFileSync("rebuild.cjs", "utf8");
if (s.includes("observed_at")) { console.log("already patched"); process.exit(0); }
const A = "  methodology_version: METHODOLOGY_VERSION,";
if (!s.includes(A)) { console.error("anchor missing - run patch-provenance.cjs first, aborting"); process.exit(1); }
fs.writeFileSync("rebuild.cjs.bak6", s);

// stamp every row + compute freshness, immediately before the payload is assembled
const CALC = [
'// ---- row-level provenance ------------------------------------------------',
'// Each row records WHEN it was observed. A row whose crawlers are all',
'// "no_robots" did not yield a reading in this sweep and is marked stale so',
'// downstream consumers can exclude it rather than mistake it for current.',
'const SWEEP_AT = new Date().toISOString();',
'let freshRows = 0, staleRows = 0;',
'for (const r of robots) {',
'  const vals = Object.keys(r).filter(k => k !== "rank" && k !== "domain").map(k => r[k]);',
'  const answered = vals.some(v => v && v !== "no_robots");',
'  r.observed_at = SWEEP_AT;',
'  r.observed = answered ? "yes" : "no";',
'  if (answered) freshRows++; else staleRows++;',
'}',
'const FRESHNESS = { sweep_at: SWEEP_AT, rows_with_reading: freshRows, rows_without_reading: staleRows, note: "observed=no means the domain did not yield a robots.txt reading in this sweep. Rates are computed over rows_with_reading only." };',
'',
A,
'  freshness: FRESHNESS,',
].join("\n");
s = s.replace(A, CALC);
fs.writeFileSync("rebuild.cjs", s);
console.log("row-level observed_at + freshness summary added (backup rebuild.cjs.bak6)");
