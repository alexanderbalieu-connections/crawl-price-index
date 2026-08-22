#!/usr/bin/env node
/**
 * CPI — stop the two change-direction counts from looking like a contradiction
 * ===========================================================================
 * This edition now says:   69 into explicit blocking / 46 out / net +23
 * Full detail already says: 92 more restrictive / 69 less restrictive,
 *                           and "46 moved off an explicit block"
 *
 * Both are correct, and they measure different things:
 *
 *   INTO / OUT OF BLOCKING   counts only moves whose destination or origin is
 *                            "explicitly blocked". No judgement call.
 *   MORE / LESS RESTRICTIVE  scores every transition on RESTRICTION_RANK,
 *                            which deliberately ranks "no explicit
 *                            instruction" above "explicitly allowed" (losing
 *                            an allow is treated as a step toward
 *                            restriction). A wider, editorially-scored test.
 *
 * The hazard is arithmetic coincidence, not error: this edition's "69 into
 * blocking" and "69 less restrictive" are the same digits for two unrelated
 * measures, on two tabs Alex has already told me look too alike. A reader who
 * spots that concludes one of them is wrong.
 *
 * Fix: This edition reconciles the two in one sentence, with Full detail's own
 * numbers computed by Full detail's own helper — so the sentence cannot drift
 * if the ranking is ever revised.
 *
 * I am NOT changing RESTRICTION_RANK. I looked at it closely, because ranking
 * "no explicit instruction" as more restrictive than "explicitly allowed" is
 * arguable — a robots.txt with no Disallow permits exactly what an explicit
 * Allow permits. But the ranking is a deliberate, commented, disclosed
 * editorial choice about DECLARED status, the drill-down states it in prose,
 * and it is not my call to reverse a published definition mid-week. Flagged
 * for Alex instead.
 */
const fs = require("fs");
const V = "app/views.js";
let v = fs.readFileSync(V, "utf8");
if (v.includes("scores the same")) { console.log("already applied"); process.exit(0); }
if (!v.includes("mvpair")) throw new Error("run what-changed-fill.cjs first");
fs.copyFileSync(V, V + ".bak-reconcile");

const from = `        '<p class="foot">Counts are crawler&ndash;domain cells, not domains: one site changing its line for eight crawlers is eight changes. ' +
        'The full transition breakdown is on ' + link("changes", "Policy changes") + '.</p>' +`;
if (v.split(from).length - 1 !== 1) throw new Error("footnote anchor not found exactly once");

const to = `        '<p class="foot">Counts are crawler&ndash;domain cells, not domains: one site changing its line for eight crawlers is eight changes. ' +
        (dir3 ? link("detail", "Full detail") + ' scores the same ' + fmt(D.changes.total_changes) +
          ' changes a second way &mdash; <b>' + fmt(dir3.more) + '</b> more restrictive, <b>' + fmt(dir3.less) +
          '</b> less &mdash; on a wider test that also counts moves between &ldquo;explicitly allowed&rdquo; and ' +
          '&ldquo;no explicit instruction&rdquo;. Different question, not a different answer. ' : '') +
        'The full transition breakdown is on ' + link("changes", "Policy changes") + '.</p>' +`;
v = v.split(from).join(to);

/* dir3 comes from the same helper Full detail uses, so the two can never drift */
const anchor = `      var net = intoB - outB;`;
if (v.split(anchor).length - 1 !== 1) throw new Error("net anchor not found exactly once");
v = v.split(anchor).join(`      var net = intoB - outB;
      // Full detail's own scoring, via Full detail's own helper — quoted here
      // so a reader who meets both numbers is not left guessing which is wrong
      var dir3 = changeDirections(D.changes.transitions);`);

fs.writeFileSync(V, v);
require("child_process").execSync("node --check " + V);

/* ---- verify -------------------------------------------------------------- */
const out = fs.readFileSync(V, "utf8");
if (!out.includes("var dir3 = changeDirections(")) throw new Error("dir3 missing");
if (!out.includes("scores the same")) throw new Error("reconciliation sentence missing");
if (!/function changeDirections/.test(out)) throw new Error("changeDirections is not defined in this file");
// it must be defined before brief() can call it — both are function declarations
// in the same IIFE, so hoisting covers it; assert it is a declaration, not a var
if (!/\n\s*function changeDirections\s*\(/.test(out))
  throw new Error("changeDirections is not a hoisted function declaration");

/* the arithmetic both ways, against this edition's own feed */
const D = JSON.parse(fs.readFileSync("app/data/dashboard.json", "utf8"));
const tr = D.changes.transitions, RANK = { allowed: 0, unlisted: 1, partial: 2, blocked: 3 };
let into = 0, outof = 0, more = 0, less = 0, other = 0;
for (const k of Object.keys(tr)) {
  const [a, b] = k.split("->");
  if (b === "blocked" && a !== "blocked") into += tr[k];
  if (a === "blocked" && b !== "blocked") outof += tr[k];
  if (RANK[b] > RANK[a]) more += tr[k]; else if (RANK[b] < RANK[a]) less += tr[k]; else other += tr[k];
}
console.log("both measures reconciled on This edition");
console.log("  into / out of explicit blocking : " + into + " / " + outof + "  (net " + (into - outof >= 0 ? "+" : "") + (into - outof) + ")");
console.log("  more / less restrictive         : " + more + " / " + less + (other ? " / " + other + " other" : ""));
console.log("  they share the digits " + [into, outof].filter(x => x === more || x === less).join(",") +
            " this edition purely by coincidence — which is exactly why the sentence is there");
console.log("");
console.log("  FOR ALEX: RESTRICTION_RANK ranks 'no explicit instruction' as MORE restrictive");
console.log("  than 'explicitly allowed'. Defensible for declared status, and disclosed in the");
console.log("  drill-down — but a robots.txt with no Disallow permits what an explicit Allow");
console.log("  permits, so " + (tr["allowed->unlisted"] || 0) + " cells count as tightening and " +
            (tr["unlisted->allowed"] || 0) + " as loosening on effect-neutral moves.");
console.log("  Left as published. Your call whether to revise the definition.");
