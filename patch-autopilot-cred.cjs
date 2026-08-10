#!/usr/bin/env node
// Status and changelog pages regenerate on every weekly publish, so they
// can never drift from the data.
const fs = require("fs");
const f = "run-weekly.command";
let s = fs.readFileSync(f, "utf8");
if (s.includes("build-status.cjs")) { console.log("autopilot already builds status"); process.exit(0); }
const A = "node rebuild.cjs";
if (!s.includes(A)) { console.error("anchor missing - aborting"); process.exit(1); }
s = s.replace(A, A + ' || { echo "REBUILD GATE ABORTED"; exit 1; }\nnode build-status.cjs || echo "WARN: status page build failed"');
// drop the duplicated guard the original line already had, if present
s = s.replace('node build-status.cjs || echo "WARN: status page build failed" || { echo "REBUILD GATE ABORTED - live data untouched"; exit 1; }', 'node build-status.cjs || echo "WARN: status page build failed"');
fs.writeFileSync(f, s);
console.log("autopilot: status + changelog rebuild weekly");
