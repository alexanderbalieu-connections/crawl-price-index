#!/usr/bin/env node
/**
 * CPI — clear the rest of what check-pubcss.cjs found
 * ===========================================================================
 * The new guard flagged seven more unstyled classes across four pages. Three
 * are real, four are legitimate scripting hooks.
 *
 * REAL, now styled in theme.css:
 *   .ctrls   about.html, estimate.html — a button row that was rendering as
 *            two inline anchors with no gap and no wrap. Rule copied from
 *            app/dashboard.html, which is where .ctrls means what it says.
 *   .mwrap   methodology.html — the three-column "How it is constructed"
 *            table had no horizontal-scroll wrapper, so on a phone it forced
 *            the page body to scroll sideways.
 *   .dt      methodology.html — copied from the dashboard, where it means
 *            "dense data table". theme.css styles bare table/th/td, so the
 *            table was readable, but the class meant nothing. Given the
 *            meaning it was copied for rather than deleted, so the two
 *            surfaces stay consistent.
 *
 * HOOKS, added to the guard's allowlist rather than given empty rules:
 *   .ppt     estimate.html — SVG points found by querySelectorAll for the
 *            tooltip, styled by inline attributes. Same shape as .tpt.
 *   .preset  estimate.html — the scenario buttons carry .ghost for looks and
 *            .preset only so the click handler can find them.
 *   .n0      why.html — the top row of the nesting strip. .n1/.n2/.n3 each
 *            add an indent; .n0 is the un-indented base and correctly has no
 *            rule. It is written out so the four levels read as a set.
 */
const fs = require("fs");
const T = "public/theme.css", G = "check-pubcss.cjs";
let t = fs.readFileSync(T, "utf8");
if (t.includes("/* --- classes the public pages")) { console.log("already applied"); process.exit(0); }
if (!fs.existsSync(G)) throw new Error("run explore-missing-css.cjs first");
fs.copyFileSync(T, T + ".bak-pubcss");

t += `

/* --- classes the public pages render but theme.css never defined ---------
   Found by check-pubcss.cjs. .ctrls is lifted from app/dashboard.html so a
   button row means the same thing on both surfaces. */
.ctrls{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0 4px;align-items:center}
.mwrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin-top:6px}
table.dt{font-size:13.5px}
table.dt th{padding:10px 12px 10px 0}
table.dt td{padding:10px 12px 10px 0}
`;
fs.writeFileSync(T, t);

/* ---- the three genuine hooks join the allowlist ------------------------- */
let g = fs.readFileSync(G, "utf8");
const from = `  "tpt",   // SVG points on the trend chart: styled by inline attributes,
           // classed only so the tooltip handler can find them
`;
if (!g.includes(from)) throw new Error("HOOKS block not found");
g = g.split(from).join(from + `  "ppt",   // the same thing on /estimate's projection chart
  "preset",// /estimate scenario buttons: .ghost is the look, .preset is the
           // handle the click handler binds to
  "n0",    // /why nesting strip: n1/n2/n3 each add an indent, n0 is the
           // un-indented base. Written out so the four levels read as a set.
`);
fs.writeFileSync(G, g);

/* ---- verify -------------------------------------------------------------- */
require("child_process").execSync("node --check " + G);
const res = require("child_process").spawnSync("node", [G], { encoding: "utf8" });
process.stdout.write(res.stdout);
if (res.status !== 0) throw new Error("check-pubcss still failing");
const ot = fs.readFileSync(T, "utf8");
for (const m of [".ctrls{display:flex", ".mwrap{overflow-x:auto", "table.dt{"])
  if (!ot.includes(m)) throw new Error("rule missing: " + m);
// .ctrls must not now collide with an existing definition
if ((ot.match(/\n\.ctrls\{/g) || []).length !== 1) throw new Error(".ctrls defined more than once in theme.css");

console.log("");
console.log("three real gaps closed in theme.css, three hooks allowlisted");
console.log("  .ctrls  the button rows on /about and /estimate now lay out as rows");
console.log("  .mwrap  the methodology table scrolls in its own box instead of the page");
console.log("  .dt     given the dense-table meaning it was copied for");
