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
const unclassified = [], measurement = [], uncommittedCode = [], secrets = [], dormant = [];
for (const f of files) {
  const r = classify(f);
  if (!r) { unclassified.push(f); continue; }
  if (r.category === "measurement") measurement.push(f);
  if (r.category === "secret") secrets.push(f);
  if (r.category === "dormant") dormant.push(f);
  if (r.category === "code" && tracked.size && !tracked.has(f)) uncommittedCode.push(f);
}

const mb = (n) => (n / 1048576).toFixed(1) + " MB";
const size = (list) => list.reduce((s, f) => { try { return s + fs.statSync(f).size; } catch { return s; } }, 0);

console.log("-".repeat(74));
console.log("  measurement files      " + String(measurement.length).padStart(5) + "   " + mb(size(measurement)) + "   irreplaceable — the backup must cover these");
console.log("  code not in git        " + String(uncommittedCode.length).padStart(5) + "   " + mb(size(uncommittedCode)) + "   a dead laptop loses these");
console.log("  unclassified           " + String(unclassified.length).padStart(5));

if (dormant.length) {
  const live = dormant.filter((f) => tracked.has(f));
  console.log("");
  console.log("  DORMANT — inert only while UNcommitted. Committing one changes behaviour:");
  for (const f of dormant) {
    const r = classify(f);
    console.log("     " + f + (live.includes(f) ? "   !! COMMITTED — IT IS LIVE" : "   (uncommitted, inert)"));
    console.log("        " + r.why);
  }
  if (live.length) {
    console.log("");
    console.log("  FAIL  a dormant file is committed and therefore active.");
    process.exit(1);
  }
}

if (uncommittedCode.length) {
  console.log("");
  console.log("  UNCOMMITTED CODE — git has an offsite copy of everything else, not these:");
  uncommittedCode.slice(0, 30).forEach((f) => console.log("     " + f));
  if (uncommittedCode.length > 30) console.log("     …and " + (uncommittedCode.length - 30) + " more");
  console.log("     Commit these deliberately, file by file. Do NOT use 'git add -A':");
  console.log("     some files in this tree are dormant on purpose and committing them");
  console.log("     changes behaviour — see the 'dormant' category in measurements.json.");
}

/* Executable bits do not survive every filesystem this repo touches. A
   .command file without +x does not run when double-clicked, which is how the
   weekly sweep is started — and the failure is silent: nothing happens. */
const RUNNABLE = files.filter((f) => /.(command|sh)$/.test(f));
const notExec = RUNNABLE.filter((f) => { try { fs.accessSync(f, fs.constants.X_OK); return false; } catch { return true; } });
if (notExec.length) {
  console.log("");
  console.log("  FAIL  runnable script(s) without the executable bit:");
  notExec.forEach((f) => console.log("        " + f + "   ->  chmod +x " + f));
  console.log("        A .command without +x does not launch when double-clicked.");
  console.log("        Nothing happens, and nothing says why.");
  process.exit(1);
}
console.log("  runnable scripts       " + String(RUNNABLE.length).padStart(5) + "   all executable");

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
