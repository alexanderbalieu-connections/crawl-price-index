#!/usr/bin/env node
/**
 * CPI guard — nothing irreplaceable may exist without a backup policy.
 * ===========================================================================
 * Reads measurements.json and classifies every file in the working tree.
 *
 * FAILS when a file matches no rule. That is the case that caused the
 * original problem: measurement data appeared, nobody decided what it was,
 * and it sat in one place on earth until someone happened to run rclone.
 *
 * Also REPORTS, without failing:
 *   - measurement files (what the backup must cover, and their total size)
 *   - code files not committed to git (a dead laptop loses them)
 *
 * Editing policy means editing measurements.json, not this file.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const M = JSON.parse(fs.readFileSync("measurements.json", "utf8"));

function toRe(glob) {
  // Supported: * (within a segment), ** (across segments), ? (one char).
  // Character classes are NOT supported — a bracket glob was silently escaped
  // to a literal here and matched nothing, which is precisely the quiet
  // failure this whole guard exists to prevent. Reject rather than pretend.
  if (/[[]{}]/.test(glob)) throw new Error("unsupported glob syntax in measurements.json: " + glob);
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      if (glob[i + 2] === "/") { re += "(?:.*/)?"; i += 2; } else { re += ".*"; i += 1; }
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp("^" + re + "$");
}
const rules = M.rules.map((r) => ({ ...r, re: toRe(r.glob) }));
const classify = (p) => rules.find((r) => r.re.test(p)) || null;

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.posix.join(dir === "." ? "" : dir, e.name);
    if (e.isDirectory()) {
      if (["node_modules", ".git", ".wrangler", ".page-backups", "backups", "_to_delete", ".preview"].includes(e.name)) continue;
      walk(p, acc);
    } else acc.push(p);
  }
  return acc;
}

let tracked = new Set();
try {
  tracked = new Set(execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean));
} catch (e) { console.log("  (git unavailable — the code-commit check is skipped)"); }

const files = walk(".");
const unclassified = [], measurement = [], uncommittedCode = [], secrets = [];
for (const f of files) {
  const r = classify(f);
  if (!r) { unclassified.push(f); continue; }
  if (r.category === "measurement") measurement.push(f);
  if (r.category === "secret") secrets.push(f);
  if (r.category === "code" && tracked.size && !tracked.has(f)) uncommittedCode.push(f);
}

const mb = (n) => (n / 1048576).toFixed(1) + " MB";
const size = (list) => list.reduce((s, f) => { try { return s + fs.statSync(f).size; } catch { return s; } }, 0);

console.log("-".repeat(74));
console.log("  measurement files      " + String(measurement.length).padStart(5) + "   " + mb(size(measurement)) + "   irreplaceable — the backup must cover these");
console.log("  code not in git        " + String(uncommittedCode.length).padStart(5) + "   " + mb(size(uncommittedCode)) + "   a dead laptop loses these");
console.log("  unclassified           " + String(unclassified.length).padStart(5));

if (uncommittedCode.length) {
  console.log("");
  console.log("  UNCOMMITTED CODE — git has an offsite copy of everything else, not these:");
  uncommittedCode.slice(0, 30).forEach((f) => console.log("     " + f));
  if (uncommittedCode.length > 30) console.log("     …and " + (uncommittedCode.length - 30) + " more");
  console.log("     Fix:  git add -A && git commit -m 'pipeline scripts and guards' && git push");
}

console.log("-".repeat(74));
if (unclassified.length) {
  console.log("  FAIL  " + unclassified.length + " file(s) that measurements.json does not classify:");
  unclassified.slice(0, 25).forEach((f) => console.log("        " + f));
  if (unclassified.length > 25) console.log("        …and " + (unclassified.length - 25) + " more");
  console.log("");
  console.log("  Every file must be code, measurement, derived, or explicitly ignored.");
  console.log("  An unclassified file is one nobody has decided how to protect — which is");
  console.log("  exactly how measurement data came to exist in one place on earth.");
  console.log("  Add a rule to measurements.json.");
  process.exit(1);
}
console.log("  All " + files.length + " files classified. Nothing irreplaceable is unaccounted for.");
