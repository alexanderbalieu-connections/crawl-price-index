#!/usr/bin/env node
/**
 * CPI — let a run scan a bounded slice of the frame, without editing config
 * ===========================================================================
 * WHY THIS IS NEEDED TONIGHT.
 *
 * A full 50,000-domain sweep takes about five days. That is not an estimate,
 * it is what the logs record: the sweep that produced edition 2026-08-17
 * started fresh on 17 Aug and published on 21 Aug, resuming each morning.
 * The chunk lines show ~2,500 domains per 340s–9,205s depending on pushback,
 * and the whole design — .scan-progress.json, RESUMING, "daily time budget
 * reached" — exists precisely because one sitting cannot finish it.
 *
 * So a 3am–8am window cannot produce a 50,000-domain edition. It can produce
 * a few thousand domains, which is more than enough to prove the Pi runs the
 * pipeline correctly: cell-level parse agreement is the real test, and 5,000
 * domains measures that just as well as 50,000.
 *
 * TOP_N currently comes only from scan-config.json, which is tracked in git —
 * editing it on the Pi would put the two machines on different configs and
 * make every later comparison meaningless. An environment override keeps one
 * config, one commit, and lets the Pi scan a slice on the night.
 *
 *   CPI_TOP=5000 CPI_SHADOW=1 ./sunday-run.command
 *
 * Unset, nothing changes: TOP_N stays whatever scan-config.json says.
 */
const fs = require("fs");
const F = "run-big.cjs";
let s = fs.readFileSync(F, "utf8");
if (s.includes("CPI_TOP")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(F, F + ".bak-frametop");

const from = `const TOP_N = cfg.top_n || 50000;`;
if (s.split(from).length - 1 !== 1) throw new Error("TOP_N line not found exactly once");
const to = `// CPI_TOP bounds the frame for one run without editing scan-config.json —
// the config is tracked in git, and two machines on different configs cannot
// be compared. Unset, this is exactly cfg.top_n as before.
const TOP_N = Number(process.env.CPI_TOP) || cfg.top_n || 50000;
if (process.env.CPI_TOP) {
  console.log("FRAME BOUNDED to " + TOP_N + " domains by CPI_TOP — this is a partial run.");
  console.log("  It is NOT a full edition and must not be published as one.");
}`;
s = s.split(from).join(to);
fs.writeFileSync(F, s);
require("child_process").execSync("node --check " + F);

/* ---- verify -------------------------------------------------------------- */
const out = fs.readFileSync(F, "utf8");
if (!out.includes("Number(process.env.CPI_TOP)")) throw new Error("override missing");
if (!out.includes("FRAME BOUNDED to")) throw new Error("warning missing");

/* exercise the expression itself, both ways */
const expr = (env) => {
  const cfg = { top_n: 50000 };
  const saved = process.env.CPI_TOP;
  if (env === undefined) delete process.env.CPI_TOP; else process.env.CPI_TOP = env;
  const v = Number(process.env.CPI_TOP) || cfg.top_n || 50000;
  if (saved === undefined) delete process.env.CPI_TOP; else process.env.CPI_TOP = saved;
  return v;
};
if (expr(undefined) !== 50000) throw new Error("unset must give 50000, got " + expr(undefined));
if (expr("5000") !== 5000) throw new Error("CPI_TOP=5000 must give 5000, got " + expr("5000"));
if (expr("") !== 50000) throw new Error("empty must fall through to config");
if (expr("nonsense") !== 50000) throw new Error("garbage must fall through to config, not NaN");

console.log("CPI_TOP override added to run-big.cjs");
console.log("  unset       -> 50000   (scan-config.json, unchanged)");
console.log("  CPI_TOP=5000 -> 5000    (and it says loudly that the run is partial)");
console.log("  empty / garbage -> falls through to config rather than NaN");
console.log("");
console.log("  scan-config.json is untouched, so both machines stay on one config");
console.log("  and remain comparable.");
