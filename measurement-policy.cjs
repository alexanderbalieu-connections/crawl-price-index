#!/usr/bin/env node
/**
 * CPI — a policy for measurement data, and a guard that enforces it
 * ===========================================================================
 * The Pi build identified the top open item: untracked measurement files that
 * existed in exactly one place on earth until an ad-hoc rclone command ran.
 * It concluded that "committed code was always safe on GitHub; the
 * measurement data was not."
 *
 * THAT CONCLUSION IS HALF RIGHT, AND THE MISSING HALF IS WORSE.
 * 14 of the 27 scripts sunday-run.command invokes are NOT in git:
 *
 *   sweep-reachability  bazaar-snapshot  build-bazaar-appdata
 *   build-explore-preview  confirm-changes  clean-public
 *   check-public  check-helpers  check-css  check-pubcss
 *   check-explore  check-gating  check-bazaar  check-deployable
 *
 * Every guard except check-copy. The reachability sweep. The frame builder
 * (adopt-frame.cjs). Until today's manual Drive push, a dead MacBook meant
 * losing all of it.
 *
 * THE POLICY. Three categories, decided by one question: can this be
 * reproduced without a time machine?
 *
 *   CODE        reproducible only by rewriting it -> git, pushed to origin
 *   MEASUREMENT an observation of the outside world at a moment -> backup by
 *               design; NEVER recoverable if lost
 *   DERIVED     computed from measurement + code -> regenerable, do not back up
 *
 * The distinction that matters: `scan-robots.csv` looks like output but it is
 * a measurement — re-running the scan next week does not reproduce what the
 * web said this week. `app/data/dashboard.json` genuinely is derived.
 *
 * WHAT THIS WRITES
 *   measurements.json      the manifest — globs, category, rationale
 *   check-backup.cjs       a guard that FAILS when a file exists that the
 *                          manifest does not classify. New measurement data
 *                          therefore cannot appear silently, which is exactly
 *                          how the original problem happened.
 *
 * Sunday's sweep will create three new measurement files that did not exist
 * when the Pi backup was designed: robots-archive/<date>.ndjson.gz,
 * scan-terms.csv and change-confirmation.json. They are in the manifest.
 */
const fs = require("fs");
const path = require("path");

/* ---------------------------------------------------------------------------
   THE MANIFEST
   Order matters: the first matching rule wins.
--------------------------------------------------------------------------- */
const MANIFEST = {
  version: 1,
  generated_note: "Edit this file, not the guard. The guard reads it.",
  rules: [
    /* ---- ignore entirely -------------------------------------------------- */
    { glob: "node_modules/**",        category: "ignore", why: "reinstallable from package.json" },
    { glob: ".git/**",                category: "ignore", why: "git internals" },
    { glob: ".wrangler/**",           category: "ignore", why: "miniflare caches and build bundles — regenerable, and excluded from backup by the Pi runbook" },
    { glob: "**/*.bak-*",             category: "ignore", why: "patch-script rollback copies; live in .page-backups/ when they concern public/" },
    { glob: ".page-backups/**",       category: "ignore", why: "moved out of the deployed directory; rollback only" },
    { glob: "_to_delete/**",          category: "ignore", why: "staged for manual deletion" },
    { glob: "backups/**",             category: "ignore", why: "point-in-time repo snapshots" },
    { glob: ".preview/**",            category: "ignore", why: "local render scratch" },
    { glob: ".DS_Store",              category: "ignore", why: "macOS noise" },
    { glob: "**/.DS_Store",           category: "ignore", why: "macOS noise" },

    { glob: "**/*.bak*",              category: "ignore", why: "every rollback-copy naming this repo has used: .bak, .bak2, .bak17, .bak-<label>" },
    { glob: "homepage-backups/**",    category: "ignore", why: "pre-rebuild page snapshots" },
    { glob: "0.49",                   category: "ignore", why: "zero-byte shell-redirect accident, 18 Aug — delete" },
    { glob: "Perplexity-User",        category: "ignore", why: "zero-byte shell-redirect accident, 18 Aug — delete" },
    { glob: "*.log",                  category: "ignore", why: "run logs; useful locally, regenerated each run" },

    /* ---- SECRETS: never in git, and a deliberate backup decision ---------- */
    { glob: ".admin-token",           category: "secret", why: "admin bypass token. gitignored. In the Drive backup — decide deliberately whether it should be" },
    { glob: ".wba-private.pem",       category: "secret", why: "Web Bot Auth signing key. gitignored. Losing it means re-registering with crawler operators, so it arguably SHOULD be backed up — but then the backup holds a key" },
    { glob: ".wba-private.b64",       category: "secret", why: "encoded form of the same key" },

    /* ---- MEASUREMENT: irreplaceable, back up by design -------------------- */
    { glob: "editions/**",            category: "measurement", why: "per-domain edition archive — a week not measured cannot be reconstructed" },
    { glob: "history/**",             category: "measurement", why: "dated aggregate history; the series a later entrant cannot backfill" },
    { glob: "robots-archive/**",      category: "measurement", why: "NEW — raw robots.txt bodies. The whole point is that a field we do not parse today can still be parsed from this week's data later" },
    { glob: "scan-robots.csv",        category: "measurement", why: "this edition's raw scan. Looks like output; is an observation" },
    { glob: "scan-robots-full.csv",   category: "measurement", why: "the full 50k rows before panel restriction" },
    { glob: "scan-terms.csv",         category: "measurement", why: "NEW — declared-use fields observed this edition" },
    { glob: "scan-failures.csv",      category: "measurement", why: "the census of WHY a fetch failed — not reproducible later" },
    { glob: "scan-signals.csv",       category: "measurement", why: "wire-probe panel observations" },
    { glob: "change-confirmation.json", category: "measurement", why: "NEW — re-fetch verdicts; the re-fetch cannot be repeated after the window" },
    { glob: "reachability-*.jsonl",   category: "measurement", why: "frame reachability sweep, dated" },
    { glob: "reachability-*.json",    category: "measurement", why: "reachability summary, dated" },
    { glob: "bazaar/**",              category: "measurement", why: "dated captures of a public registry that changes without notice" },
    { glob: "bazaar-index.json",      category: "measurement", why: "registry capture index" },
    { glob: "bazaar-endpoints.json",  category: "measurement", why: "registry capture" },
    { glob: "app/private/**",         category: "measurement", why: "the per-domain paid dataset, built from the edition" },
    { glob: "private/**",             category: "measurement", why: "the per-domain paid dataset at the repo root, built from the edition" },
    { glob: "dataset.csv",            category: "measurement", why: "the published per-domain dataset for this edition" },
    { glob: "last-sent-robots.csv",   category: "measurement", why: "the state the last newsletter was computed against — needed to reproduce what subscribers were told" },
    { glob: "last-alert-robots.csv",  category: "measurement", why: "the state the last alerts were computed against" },
    { glob: "terms-pilot*.json",      category: "measurement", why: "pilot observations, 22 Aug 2026 — a point-in-time sample" },
    { glob: "rsl-read.json",          category: "measurement", why: "licence-document reads; two of three refused the crawler and may not be readable again" },
    { glob: "classifiability-*.json", category: "measurement", why: "sampled classification observations" },
    { glob: "frame-cpi50k-v1.json",   category: "measurement", why: "frame provenance — defines what every published rate is a rate OF" },
    { glob: "tranco-*.csv",           category: "measurement", why: "the source frame for a dated Tranco release; not re-downloadable for a past date" },
    { glob: "tranco-*.csv.bak-*",     category: "measurement", why: "prior frame versions — provenance for older editions" },

    /* ---- DERIVED: regenerable from measurement + code --------------------- */
    { glob: "paid-dataset.json",      category: "derived", why: "the per-domain dataset pushed to KV; rebuilt each edition from the measurement files" },
    { glob: "sample-dataset.json",    category: "derived", why: "the free sample pushed to KV; rebuilt each edition" },
    { glob: "app/data/**",            category: "derived", why: "computed from the edition by rebuild.cjs" },
    { glob: "public/*.json",          category: "derived", why: "published feeds, rebuilt each edition" },
    { glob: "public/*.html",          category: "derived", why: "generated pages — but the generators are CODE and must be in git" },
    { glob: "public/**",              category: "derived", why: "the deployed site" },
    { glob: "trends-public.json",     category: "derived", why: "rebuilt each edition" },
    { glob: "scan-summary.json",      category: "derived", why: "summary of the scan" },
    { glob: "terms-pilot.json.tmp",   category: "derived", why: "scratch" },

    /* ---- CODE: must be committed and pushed ------------------------------- */
    { glob: "**/*.cjs",               category: "code", why: "pipeline and guards" },
    { glob: "**/*.mjs",               category: "code", why: "test harnesses" },
    { glob: "**/*.js",                category: "code", why: "worker and views" },
    { glob: "*.command",              category: "code", why: "the run script" },
    { glob: "**/*.sh",                category: "code", why: "shell tooling" },
    { glob: "**/*.md",                category: "code", why: "runbooks and decision records" },
    { glob: "*.json",                 category: "code", why: "package manifests and config" },
    { glob: "**/*.html",              category: "code", why: "templates outside public/" },
    { glob: "**/*.css",               category: "code", why: "styles" },
    { glob: "**/*.txt",               category: "code", why: "notes and fixtures" },
    { glob: "**/*.xml",               category: "code", why: "feeds and licences" },
    { glob: "**/*.png",               category: "code", why: "site images" },
    { glob: "**/*.tar.gz",            category: "code", why: "delivered bundles" },
    { glob: ".github/**",             category: "dormant", why: "A scheduled GitHub Action that scans 2,000 domains every Monday 06:00 UTC and COMMITS scan-robots.csv + index.json back to main, triggering a deploy. Committing this file activates it, and it would overwrite the 50,000-domain Sunday edition with a thin one. Left uncommitted on purpose." },
    { glob: "*.plist",                category: "code", why: "launchd schedule for the weekly run on the Mac" },
    { glob: "*.toml",                 category: "code", why: "wrangler config" },
    { glob: ".gitignore",             category: "code", why: "repo config" },
    { glob: "**/.gitignore",          category: "code", why: "repo config" },
  ],
};

fs.writeFileSync("measurements.json", JSON.stringify(MANIFEST, null, 1) + "\n");
console.log("wrote measurements.json — " + MANIFEST.rules.length + " rules");

/* ---------------------------------------------------------------------------
   THE GUARD
--------------------------------------------------------------------------- */
fs.writeFileSync("check-backup.cjs", `#!/usr/bin/env node
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
  if (/[\[\]{}]/.test(glob)) throw new Error("unsupported glob syntax in measurements.json: " + glob);
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      if (glob[i + 2] === "/") { re += "(?:.*/)?"; i += 2; } else { re += ".*"; i += 1; }
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^\${}()|[\\]\\\\]/g, "\\\\$&");
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
  tracked = new Set(execSync("git ls-files", { encoding: "utf8" }).split("\\n").filter(Boolean));
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
const RUNNABLE = files.filter((f) => /\.(command|sh)$/.test(f));
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
`);
require("child_process").execSync("node --check check-backup.cjs");

/* ---- run it ------------------------------------------------------------- */
const res = require("child_process").spawnSync("node", ["check-backup.cjs"], { encoding: "utf8" });
process.stdout.write(res.stdout);
if (res.status !== 0) {
  console.log("");
  console.log("(the guard is working — it found files with no policy. Add rules and re-run.)");
}
