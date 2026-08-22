#!/usr/bin/env node
/**
 * CPI — two redundancies in the rebuilt "What changed"
 * ===========================================================================
 * Reading the rendered panel back:
 *
 * 1. The lead says "Most common: 69 moved No explicit instruction ->
 *    Explicitly blocked" and the figure directly below says "69 / into
 *    explicit blocking". Identical this edition, because unlisted->blocked
 *    is the only route into blocking — so the panel states one number twice
 *    and looks like it is double-counting. The figure block is the better
 *    version of the two (it also gives the other direction and the net), so
 *    the clause goes.
 *
 *    Note this is only a coincidence of the current edition, not a rule: a
 *    week with partial->blocked moves would separate them. Cutting the
 *    clause is right either way — the full breakdown is one click away and
 *    the briefing does not need the largest single cell.
 *
 * 2. The footnote ended "The full transition breakdown is on Policy changes"
 *    immediately above a green button reading "See the 161 changes" that
 *    goes to the same tab. One of them is enough; the button is louder.
 */
const fs = require("fs");
const V = "app/views.js";
let v = fs.readFileSync(V, "utf8");
if (!v.includes("scores the same")) throw new Error("run reconcile-changes.cjs first");
if (!v.includes("Most common: <b>")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(V, V + ".bak-trim");

const sub = (from, to, label) => {
  if (!v.includes(from)) throw new Error("not found: " + label);
  const n = v.split(from).length - 1;
  if (n !== 1) throw new Error(label + ": expected 1 match, found " + n);
  v = v.split(from).join(to);
};

sub(
  `        fmt(D.changes.changed_domains) + '</b> domains between ' + esc(D.changes.interval) + '. ' +
        (keys.length ? 'Most common: <b>' + fmt(tr[keys[0]]) + '</b> moved ' +
          (STATE_LABELS[keys[0].split("->")[0]] || "") + ' &rarr; ' + (STATE_LABELS[keys[0].split("->")[1]] || "") + '.' : '') + '</p>' +`,
  `        fmt(D.changes.changed_domains) + '</b> domains between ' + esc(D.changes.interval) + '.</p>' +`,
  "drop the largest-single-transition clause"
);

sub(
  `          '&ldquo;no explicit instruction&rdquo;. Different question, not a different answer. ' : '') +
        'The full transition breakdown is on ' + link("changes", "Policy changes") + '.</p>' +`,
  `          '&ldquo;no explicit instruction&rdquo;. Different question, not a different answer.' : '') + '</p>' +`,
  "drop the duplicate link to Policy changes"
);

fs.writeFileSync(V, v);
require("child_process").execSync("node --check " + V);

const out = fs.readFileSync(V, "utf8");
if (out.includes("Most common: <b>")) throw new Error("the clause survived");
if (out.includes("The full transition breakdown is on ")) throw new Error("the duplicate link survived");
for (const m of ["into explicit blocking", "out of explicit blocking", "scores the same",
                 'data-goto="changes">See the '])
  if (!out.includes(m)) throw new Error("lost in the trim: " + m);
// the keys variable is still used by the into/out loop — make sure it is
if (!/keys\.forEach\(function \(k\) \{\s*\n\s*var p = k\.split\("->"\);/.test(out))
  throw new Error("the transitions loop was disturbed");

console.log("What changed trimmed");
console.log("  dropped the largest-single-transition clause (it restated the 'into blocking' figure)");
console.log("  dropped the footnote link that duplicated the button below it");
