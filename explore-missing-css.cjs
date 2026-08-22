#!/usr/bin/env node
/**
 * CPI — three panels on /explore have been rendering unstyled, and a guard
 *        so the next copied renderer cannot do it again
 * ===========================================================================
 * Found while screenshotting the new suffix card: the panel beside it, "Who
 * gets blocked", renders as "CCBot14.8%" with no bar and no spacing. The
 * renderer was copied from the homepage; its CSS was not. Same for two more:
 *
 *   Who gets blocked      .brow2 .nm .brk (+ .brow2 .pc)   the block ladder
 *   How the door answers  .postgrid .postcell .pn .pt .pd, .tick .ti .tg
 *   The wall is rising    .trend-svg .trend-legend         the chart
 *
 * This is the THIRD time a block copied from index.html has arrived
 * incomplete: first the $$ helper collapsing to $, then .fill missing
 * display:block, now the stylesheet not travelling with the markup. Each was
 * silent — no console error, the panel just looks wrong or empty.
 *
 * So this script does two things:
 *   1. copies the missing rules verbatim from public/index.html, which stays
 *      the single source, rather than retyping them;
 *   2. writes check-pubcss.cjs — every class a public page puts in a
 *      class="..." attribute must be styled in that page, in theme.css, or
 *      listed as a deliberate scripting hook. Wired into sunday-run.command.
 *
 * .tpt is a genuine hook: SVG circles styled by inline attributes and found
 * by querySelectorAll for the tooltip. It goes on the hook list, not in CSS.
 */
const fs = require("fs");
const I = "public/index.html", E = "public/explore.html";
let e = fs.readFileSync(E, "utf8");
const i = fs.readFileSync(I, "utf8");
if (e.includes("/* copied from index.html")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(E, E + ".bak-css");

/* ---- lift the exact rules out of the homepage, do not retype them ------- */
const WANT = [
  ".trend-svg{", ".trend-legend{", ".trend-legend b{",
  ".brow2{", ".brow2 .nm{", ".brk{", ".brk>span{", ".brow2 .pc{",
  ".postgrid{", ".postcell{", ".postcell.hi{", ".postcell .pn{",
  ".postcell.hi .pn{", ".postcell .pt{", ".postcell .pd{",
  ".tick{", ".tick .ti{", ".tick .ti b{", ".tick .ti .tg{", ".tg.PRICED{",
  "@media(max-width:640px){.postgrid{",
];
const rules = WANT.map((sel) => {
  const at = i.indexOf("\n" + sel);
  if (at < 0) throw new Error("rule not found in index.html: " + sel);
  const end = i.indexOf("\n", at + 1);
  return i.slice(at + 1, end);
});
// the .tg colour line carries all four states on one line — sanity-check it
if (!rules.some((r) => /\.tg\.PRICED\{.*\.tg\.GATED\{.*\.tg\.LICENSING\{.*\.tg\.FREE\{/.test(r)))
  throw new Error(".tg state colours did not come across whole");

e = e.replace("</style>", `
/* copied from index.html, which owns these rules: /explore reuses that page's
   block-ladder, posture-grid and trend renderers, and the markup arrived
   without the stylesheet. Change them there, then re-run this. */
${rules.join("\n")}
</style>`);
fs.writeFileSync(E, e);

/* ---- the guard ----------------------------------------------------------- */
fs.writeFileSync("check-pubcss.cjs", `#!/usr/bin/env node
/**
 * CPI guard — every class a public page renders must actually be styled.
 * ===========================================================================
 * Written after "Who gets blocked", "How the door answers" and the trend
 * chart were all found rendering unstyled on /explore: their renderers were
 * copied from index.html without the CSS rules they depend on. No console
 * error, no empty element — the panels simply looked wrong, for days.
 *
 * A class counts as styled if a selector mentioning it exists in the page's
 * own <style> block or in theme.css. HOOKS below are classes deliberately
 * carrying no styling — they exist to be found by querySelectorAll.
 */
const fs = require("fs");
const path = require("path");

const HOOKS = new Set([
  "tpt",   // SVG points on the trend chart: styled by inline attributes,
           // classed only so the tooltip handler can find them
]);

const theme = fs.existsSync("public/theme.css") ? fs.readFileSync("public/theme.css", "utf8") : "";
const pages = fs.readdirSync("public").filter((f) => f.endsWith(".html"));
let bad = 0, checked = 0;

for (const f of pages) {
  const src = fs.readFileSync(path.join("public", f), "utf8");
  // every class="..." literal, in static markup and in JS-emitted strings
  const used = new Set();
  for (const m of src.matchAll(/class="([^"'+]+)"/g))
    m[1].split(/\\s+/).forEach((c) => { if (/^[A-Za-z][\\w-]*$/.test(c)) used.add(c); });
  const styleStart = src.indexOf("<style"), styleEnd = src.lastIndexOf("</style>");
  const css = (styleStart >= 0 ? src.slice(styleStart, styleEnd) : "") + theme;
  const missing = [...used].filter((c) => !HOOKS.has(c) && !new RegExp("\\\\." + c + "(?![\\\\w-])").test(css));
  checked += used.size;
  if (missing.length) {
    bad += missing.length;
    console.log("  FAIL  " + f + " renders " + missing.length + " unstyled class" +
      (missing.length > 1 ? "es" : "") + ": " + missing.sort().join(", "));
  }
}

console.log("-".repeat(74));
if (bad) {
  console.log(bad + " unstyled class(es) across " + pages.length + " public pages.");
  console.log("Either add the rule (usually by copying it from the page the renderer came");
  console.log("from) or, if the class is only a querySelectorAll hook, add it to HOOKS.");
  process.exit(1);
}
console.log("All " + checked + " class uses across " + pages.length + " public pages are styled.");
`);

/* ---- verify -------------------------------------------------------------- */
const out = fs.readFileSync(E, "utf8");
for (const sel of [".brow2{", ".brk>span{", ".postgrid{", ".trend-svg{", ".tick .ti{"])
  if (!out.includes(sel)) throw new Error("rule did not land: " + sel);
// .brow2 legitimately appears twice: the base rule and the 640px override
if ((out.match(/\n\.brow2\{/g) || []).length !== 1) throw new Error(".brow2 base rule defined twice on /explore");
require("child_process").execSync("node --check check-pubcss.cjs");
const res = require("child_process").spawnSync("node", ["check-pubcss.cjs"], { encoding: "utf8" });
process.stdout.write(res.stdout);
if (res.status !== 0) throw new Error("the new guard still fails — the copy is incomplete");

console.log("");
console.log("three /explore panels were rendering unstyled, and now are not");
console.log("  Who gets blocked      the block ladder had no grid and no bars");
console.log("  How the door answers  the posture grid and ticker were unstyled");
console.log("  The wall is rising    the trend svg and its legend were unstyled");
console.log("");
console.log("  rules copied verbatim from index.html, which still owns them");
console.log("  new guard check-pubcss.cjs — add it to sunday-run.command");
