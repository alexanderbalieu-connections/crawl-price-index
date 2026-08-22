#!/usr/bin/env node
/**
 * CPI — run the change confirmation as part of the Sunday sweep
 * ===========================================================================
 * Placed with the other quality guards, after rebuild.cjs has produced the
 * edition (so the change list exists) and before the deploys.
 *
 * Follows the house pattern exactly: `|| echo WARN`. It can never abort a
 * sweep. It already refuses to write a verdict when more than half the
 * re-fetches fail, so a network problem produces a warning rather than a
 * false "nothing confirmed".
 *
 * Gap between the two re-fetches is 180s here rather than the 300s default —
 * long enough to catch transient edge variation, short enough not to add
 * meaningfully to a run that already takes hours.
 */
const fs = require("fs");
const F = "sunday-run.command";
let s = fs.readFileSync(F, "utf8");
if (s.includes("confirm-changes.cjs")) { console.log("already wired"); process.exit(0); }
fs.copyFileSync(F, F + ".bak-confirm");

const anchor = `node check-pubcss.cjs || echo "WARN: a PUBLIC page renders a class nothing styles — that panel will look wrong with no error. See the FAIL lines above."\n`;
if (s.split(anchor).length - 1 !== 1) throw new Error("anchor not found exactly once");

s = s.split(anchor).join(anchor + `
# How many of this edition's policy changes survive a re-fetch? Availability
# flips (to/from no_robots) are already partitioned out upstream; this measures
# the residual — changes between domains readable in BOTH scans. Writes
# change-confirmation.json. Never aborts: it refuses to report a verdict when
# more than half the re-fetches fail, which is what a network problem looks like.
node confirm-changes.cjs --gap 180 || echo "WARN: change confirmation did not complete — the edition is unaffected, but this week's changes are unconfirmed"
`);

fs.writeFileSync(F, s);

/* ---- verify -------------------------------------------------------------- */
const out = fs.readFileSync(F, "utf8");
if (!out.includes("node confirm-changes.cjs --gap 180 ||")) throw new Error("not wired");
// it must sit AFTER rebuild (the edition must exist) and BEFORE the deploys
const iRebuild = out.indexOf("node rebuild.cjs");
const iConfirm = out.indexOf("node confirm-changes.cjs");
const iDeploy = out.indexOf("npx wrangler deploy");
if (!(iRebuild > 0 && iConfirm > iRebuild)) throw new Error("confirm runs before the edition is built");
if (!(iDeploy > iConfirm)) throw new Error("confirm runs after the deploy");
// and it must be non-fatal, like every other guard
const line = out.split("\n").find((l) => l.startsWith("node confirm-changes.cjs"));
if (!/\|\| echo "WARN/.test(line)) throw new Error("confirm-changes can abort the sweep");
// no guard may have lost its || echo
const bare = out.split("\n").filter((l) => /^node check-|^node confirm-/.test(l) && !/\|\|/.test(l));
if (bare.length) throw new Error("a guard lost its non-fatal handler: " + bare.join(" / "));

console.log("confirm-changes.cjs wired into sunday-run.command");
console.log("  runs after rebuild.cjs (the edition exists) and before the deploys");
console.log("  --gap 180  ·  non-fatal  ·  refuses to report a verdict on a failed network");
console.log("  every other guard still carries its || echo handler");
