#!/usr/bin/env node
// Adds the lookup-index publish to the weekly autopilot chain.
const fs = require("fs");
const f = "run-weekly.command";
let s = fs.readFileSync(f, "utf8");
if (s.includes("build-lookup.cjs")) { console.log("autopilot already publishes lookup index"); process.exit(0); }
const A = 'node push-sample.cjs || echo "WARN: sample push failed"';
const A2 = "node push-sample.cjs || echo csv-push-failed"; // fallback if the WARN text differs
if (s.includes(A)) s = s.replace(A, A + '\nnode build-lookup.cjs || echo "WARN: lookup push failed"\nnode push-snapshot.cjs || echo "WARN: snapshot push failed"');
else if (s.includes("node push-sample.cjs")) s = s.replace("node push-sample.cjs", 'node build-lookup.cjs || echo "WARN: lookup push failed"\nnode push-snapshot.cjs || echo "WARN: snapshot push failed"\nnode push-sample.cjs');
else { console.error("anchor missing - aborting"); process.exit(1); }
fs.writeFileSync(f, s);
console.log("autopilot: lookup index + snapshot edition now publish weekly", s.includes(A2) ? "" : "");
