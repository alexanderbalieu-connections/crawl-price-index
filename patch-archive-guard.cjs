#!/usr/bin/env node
// Adds a same-day overwrite guard to archive.cjs, then validates and rolls
// back on failure. Safe to run twice.
const fs = require("fs");
const { execSync } = require("child_process");

const P = "archive.cjs";
let s = fs.readFileSync(P, "utf8");

if (s.indexOf("SAME-DAY GUARD") !== -1) { console.log("guard already present — no change"); process.exit(0); }

const anchor = 'fs.mkdirSync("history", { recursive: true });';
if (s.indexOf(anchor) === -1) { console.error("ABORT: anchor not found in archive.cjs"); process.exit(1); }

const guard = [
  'fs.mkdirSync("history", { recursive: true });',
  '',
  '// ---- SAME-DAY GUARD -------------------------------------------------------',
  '// A history point cannot be backfilled, so overwriting one silently is the',
  '// worst failure this project has. Refuse to replace an existing point unless',
  '// it is explicitly asked for:  node archive.cjs --force',
  'const snapPath = path.join("history", date + ".json");',
  'if (fs.existsSync(snapPath) && !process.argv.includes("--force")) {',
  '  console.error("REFUSING to overwrite the existing history point for " + date + ".");',
  '  console.error("A dated point already exists and cannot be reconstructed if lost.");',
  '  console.error("If this really is a corrected re-scan:  node archive.cjs --force");',
  '  process.exit(3);',
  '}',
  'if (fs.existsSync(snapPath)) {',
  '  fs.copyFileSync(snapPath, snapPath + ".replaced-" + Date.now());',
  '  console.log("--force: previous point for " + date + " kept as a .replaced- backup");',
  '}'
].join("\n");

fs.copyFileSync(P, P + ".bak-guard");
fs.writeFileSync(P, s.replace(anchor, guard));

try {
  execSync("node --check " + P, { stdio: "pipe" });
  console.log("guard added to archive.cjs — syntax OK (backup: archive.cjs.bak-guard)");
} catch (e) {
  fs.copyFileSync(P + ".bak-guard", P);
  console.error("SYNTAX FAILED — archive.cjs rolled back, nothing changed");
  process.exit(1);
}
