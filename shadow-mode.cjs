#!/usr/bin/env node
/**
 * CPI — shadow mode, and closing a hazard that fires tomorrow
 * ===========================================================================
 * TWO CHANGES.
 *
 * (1) THE URGENT ONE. sunday-run.command line 202 ends the weekly run with
 *
 *         git add -A && git commit -m "weekly edition $TODAY" && git push
 *
 *     `git add -A` stages UNTRACKED files. `.github/workflows/weekly-scan.yml`
 *     is untracked and present. So tomorrow's sweep would commit it — and
 *     committing it ACTIVATES a scheduled GitHub Action that scans 2,000
 *     domains every Monday 06:00 UTC and commits index.json + scan-robots.csv
 *     back to main, triggering a deploy over the 50,000-domain edition.
 *
 *     Fix: `.github/` goes in .gitignore, so `git add -A` cannot reach it.
 *     One line, no behaviour change to anything else. The weekly commit
 *     should also be narrowed to explicit paths, but not the night before a
 *     sweep — noted in the runbook as a post-Sunday task.
 *
 * (2) SHADOW MODE. `CPI_SHADOW=1 ./sunday-run.command` runs the scan, the
 *     rebuild and every guard — and publishes nothing. No wrangler deploy,
 *     no KV push, no newsletter, no alerts, no git commit.
 *
 *     This is what the Pi runs in parallel with the Mac. The Pi produces a
 *     complete edition and proves it can; the Mac remains the only thing that
 *     publishes. Until a local backup drive exists and has been restore-
 *     tested, the Mac is the second copy and cannot be retired — so the Pi
 *     must not be able to publish even by accident.
 *
 *     Implemented as a shell function rather than by deleting lines, so the
 *     shadow and live paths stay one file with no drift between them.
 */
const fs = require("fs");

/* ---------- (1) the hazard ------------------------------------------------ */
const GI = ".gitignore";
let gi = fs.existsSync(GI) ? fs.readFileSync(GI, "utf8") : "";
if (!/^\.github\/?$/m.test(gi)) {
  fs.writeFileSync(GI, gi.replace(/\s*$/, "") + `

# A scheduled GitHub Action that scans 2,000 domains every Monday and commits
# index.json + scan-robots.csv back to main, deploying over the 50,000-domain
# Sunday edition. It is inert only while uncommitted, and the weekly run ends
# with 'git add -A' — which would otherwise commit and activate it.
.github/
`);
  console.log(".gitignore: .github/ excluded — 'git add -A' can no longer activate the dormant workflow");
} else console.log(".gitignore: .github/ already excluded");

/* ---------- (2) shadow mode ----------------------------------------------- */
const S = "sunday-run.command";
let s = fs.readFileSync(S, "utf8");
if (s.includes("CPI_SHADOW")) { console.log("sunday-run.command: shadow mode already present"); }
else {
  fs.copyFileSync(S, S + ".bak-shadow");

  /* the helper, right after the shebang and any leading comment block */
  const firstNode = s.indexOf("node where.cjs");
  if (firstNode < 0) throw new Error("could not find the top of the run script");
  const lineStart = s.lastIndexOf("\n", firstNode) + 1;
  s = s.slice(0, lineStart) + `# ---------------------------------------------------------------------------
# SHADOW MODE.  CPI_SHADOW=1 ./sunday-run.command
# Runs the scan, the rebuild and every guard. Publishes nothing: no deploy,
# no KV push, no newsletter, no alerts, no commit. Used for the Pi parallel
# run, where the Pi must prove it can produce an edition without being able
# to publish one.
# ---------------------------------------------------------------------------
if [ "\${CPI_SHADOW:-0}" = "1" ]; then
  echo ""
  echo "############################################################"
  echo "#  SHADOW RUN — nothing will be published, sent or pushed. #"
  echo "############################################################"
  echo ""
fi
pub() {
  if [ "\${CPI_SHADOW:-0}" = "1" ]; then
    echo "  [shadow] skipped: $*"
    return 0
  fi
  "$@"
}

` + s.slice(lineStart);

  /* every publishing step goes through pub() */
  const wrap = [
    [`npx wrangler deploy || echo "WARN: site deploy failed"`,
     `pub npx wrangler deploy || echo "WARN: site deploy failed"`],
    [`APP_OUT=$(npx wrangler pages deploy app --project-name=cpi-app --commit-dirty=true 2>&1) || echo "WARN: app deploy failed"`,
     `APP_OUT=$(pub npx wrangler pages deploy app --project-name=cpi-app --commit-dirty=true 2>&1) || echo "WARN: app deploy failed"`],
    [`node push-dataset.cjs || echo "WARN: dataset push failed"`,
     `pub node push-dataset.cjs || echo "WARN: dataset push failed"`],
    [`node push-sample.cjs || echo "WARN: sample push failed"`,
     `pub node push-sample.cjs || echo "WARN: sample push failed"`],
    [`node build-lookup.cjs || echo "WARN: lookup push failed"`,
     `pub node build-lookup.cjs || echo "WARN: lookup push failed"`],
    [`node push-snapshot.cjs || echo "WARN: snapshot push failed"`,
     `pub node push-snapshot.cjs || echo "WARN: snapshot push failed"`],
    [`node push-csv.cjs || echo "WARN: csv push failed"`,
     `pub node push-csv.cjs || echo "WARN: csv push failed"`],
    [`node send-weekly.cjs --send || echo "WARN: weekly email failed"`,
     `pub node send-weekly.cjs --send || echo "WARN: weekly email failed"`],
    [`node send-alerts.cjs --send || echo "WARN: alerts failed"`,
     `pub node send-alerts.cjs --send || echo "WARN: alerts failed"`],
  ];
  for (const [from, to] of wrap) {
    if (s.split(from).length - 1 !== 1) throw new Error("expected exactly one: " + from.slice(0, 50));
    s = s.split(from).join(to);
  }

  /* the git commit needs its own shape — pub() cannot wrap a && chain */
  const gitFrom = `git add -A && git commit -m "weekly edition $TODAY" 2>/dev/null && git push || echo "WARN: git push skipped/failed"`;
  if (s.split(gitFrom).length - 1 !== 1) throw new Error("git commit line not found exactly once");
  s = s.split(gitFrom).join(`if [ "\${CPI_SHADOW:-0}" = "1" ]; then
  echo "  [shadow] skipped: git commit + push"
else
  git add -A && git commit -m "weekly edition $TODAY" 2>/dev/null && git push || echo "WARN: git push skipped/failed"
fi`);

  fs.writeFileSync(S, s);
  fs.chmodSync(S, 0o755);
  console.log("sunday-run.command: shadow mode added, exec bit preserved");
}

/* ---------- verify -------------------------------------------------------- */
const out = fs.readFileSync(S, "utf8");
const PUBLISHERS = ["wrangler deploy", "wrangler pages deploy", "push-dataset", "push-sample",
                    "build-lookup", "push-snapshot", "push-csv", "send-weekly", "send-alerts"];
for (const p of PUBLISHERS) {
  const line = out.split("\n").find((l) => l.includes(p) && !l.trim().startsWith("#"));
  if (!line) throw new Error("publisher vanished: " + p);
  if (!/\bpub\b/.test(line)) throw new Error("NOT guarded by pub(): " + p + "  ->  " + line.trim());
}
if (!/if \[ "\$\{CPI_SHADOW:-0\}" = "1" \]; then\n  echo "  \[shadow\] skipped: git commit \+ push"/.test(out))
  throw new Error("the git commit is not shadow-guarded");
// Owner-execute is what matters. The bridge filesystem will not set group or
// other bits, so the mode lands at 700 rather than 755 — functionally identical
// for a script its owner runs. Assert the capability, not the octal.
try { fs.accessSync(S, fs.constants.X_OK); } catch { throw new Error("exec bit lost"); }
if (!/^\.github\/$/m.test(fs.readFileSync(GI, "utf8"))) throw new Error(".github/ not gitignored");

/* Test pub() AS IT IS DEFINED IN THE REAL FILE, not a synthetic copy —
   extract the function from sunday-run.command and exercise both paths. */
const { execSync } = require("child_process");
const fnStart = out.indexOf("pub() {");
const fnEnd = out.indexOf("\n}", fnStart) + 2;
if (fnStart < 0 || fnEnd < 2) throw new Error("pub() not found in the patched file");
const realFn = out.slice(fnStart, fnEnd);
const run = (env) => execSync("bash", {
  input: realFn + "\n" + env + " pub echo MARKER\n", encoding: "utf8",
}).trim();
const live = run("");
const shadow = run("CPI_SHADOW=1");
if (live !== "MARKER") throw new Error("live path did not execute: " + JSON.stringify(live));
if (!/\[shadow\] skipped/.test(shadow)) throw new Error("shadow path did not skip: " + JSON.stringify(shadow));
if (/MARKER/.test(shadow.replace(/skipped: echo MARKER/, ""))) throw new Error("shadow path executed the command");

console.log("");
console.log("verified");
console.log("  all 9 publishing steps routed through pub()");
console.log("  the git commit is shadow-guarded separately (pub cannot wrap a && chain)");
console.log("  pub() self-test: runs when CPI_SHADOW unset, skips when 1");
console.log("  exec bit intact  ·  .github/ gitignored");
console.log("");
console.log("  live:    ./sunday-run.command");
console.log("  shadow:  CPI_SHADOW=1 ./sunday-run.command");
