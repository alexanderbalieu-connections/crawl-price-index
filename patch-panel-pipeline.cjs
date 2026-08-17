#!/usr/bin/env node
// Replaces run-big.cjs's hardcoded inline panel + .panel.txt write with a call
// to build-panel.cjs (spine + signal + audit). scan.cjs then probes that list.
// Idempotent; validates; rolls back.
const fs = require("fs");
const { execSync } = require("child_process");
const P = "run-big.cjs";
let s = fs.readFileSync(P, "utf8");
if (s.indexOf("build-panel.cjs") !== -1) { console.log("already wired"); process.exit(0); }

// the inline PANEL array + its .panel.txt write, replaced by a build-panel call
const startMark = "  const PANEL = [\"www.nytimes.com\"";
const endMark = "fs.writeFileSync(\".panel.txt\", PANEL.join(\"\\n\"));";
const a = s.indexOf(startMark), b = s.indexOf(endMark);
if (a === -1 || b === -1) { console.error("ABORT: inline panel block not found"); process.exit(1); }
const before = s.slice(0, a);
const after = s.slice(b + endMark.length);
const replacement =
  "  // panel is now assembled by build-panel.cjs: fixed spine + wide-probe\n" +
  "  // signal promotions + rotating audit sample. Writes .panel.txt.\n" +
  "  try { execSync(\"node build-panel.cjs\", { stdio: \"inherit\" }); }\n" +
  "  catch (e) { console.log(\"(build-panel failed — falling back to spine only)\");\n" +
  "    try { fs.copyFileSync(\"panel-spine.txt\", \".panel.txt\"); } catch (e2) {} }";
s = before + replacement + after;

fs.copyFileSync(P, P + ".bak-panelpipe");
fs.writeFileSync(P, s);
try { execSync("node --check " + P, { stdio: "pipe" }); console.log("run-big.cjs wired to build-panel"); }
catch (e) { fs.copyFileSync(P + ".bak-panelpipe", P); console.error("SYNTAX FAILED — rolled back"); process.exit(1); }
