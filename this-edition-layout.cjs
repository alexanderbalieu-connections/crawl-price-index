#!/usr/bin/env node
/**
 * CPI — This edition: layout, and a real difference from Full detail
 * ===========================================================================
 * 1. "Shrink 'What changed' and 'Observed weekly block rate' side by side. We
 *    don't need them full width."
 *
 *    Both drop from .panel wide to .panel so the grid pairs them.
 *
 * 2. "How much difference is there between 'This edition' and 'Full detail'?
 *    Is it enough? It looks quite similar."
 *
 *    Not enough, and the cause is concrete: both tabs render the same
 *    by-edition block-rate chart, and both summarise policy changes. The
 *    second tab therefore reads as a longer copy of the first.
 *
 *    They should have distinct jobs:
 *      THIS EDITION  a briefing — what moved this week, in as few numbers as
 *                    possible, with links out. Read it and leave.
 *      FULL DETAIL   a reference — every measure at once, each drillable.
 *                    Open it to look something up.
 *
 *    Made real by: each tab stating its job in one line at the top; This
 *    edition's chart losing its drill-through and saying plainly that the
 *    drillable by-edition series lives on Full detail. Same series, two jobs,
 *    and the page now says which is which.
 *
 * NOT DONE, deliberately: I first wrote a "Movement since last edition" panel
 * to replace the chart here — then found "Biggest movements" directly above it
 * already shows per-crawler edition-over-edition deltas. It would have been a
 * third copy of the same idea. The chart stays, at half width, as asked.
 */
const fs = require("fs");
const V = "app/views.js";
let v = fs.readFileSync(V, "utf8");
if (v.includes("tabjob")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(V, V + ".bak-thisedition");

const sub = (from, to, label) => {
  if (!v.includes(from)) throw new Error("not found: " + label);
  const n = v.split(from).length - 1;
  if (n !== 1) throw new Error(label + ": expected 1 match, found " + n);
  v = v.split(from).join(to);
};

/* ---- 1. each tab states its job ----------------------------------------- */
sub(
  `    // 2. the composite + concentration
    h += '<section class="panel"><div class="ix">The headline number</div>' +`,
  `    h += '<p class="tabjob">The <b>briefing</b>: what moved this edition, and where to go next. ' +
      'Every measure at once, with drill-downs, is on ' + link("detail", "Full detail") + '.</p>';

    // 2. the composite + concentration
    h += '<section class="panel"><div class="ix">The headline number</div>' +`,
  "this-edition job line"
);

sub(
  `    h += kpiRow();
    // hero leaderboard`,
  `    h += kpiRow();
    h += '<p class="tabjob">The <b>reference view</b>: every measure in this edition on one page, each clickable through to its working. ' +
      'The short version of what moved is on ' + link("overview", "This edition") + '.</p>';
    // hero leaderboard`,
  "full-detail job line"
);

/* ---- 2. the two panels pair up at half width ---------------------------- */
sub(`    h += '<section class="panel wide"><div class="ix">What changed</div>';`,
    `    h += '<section class="panel"><div class="ix">What changed</div>';`,
    "what changed width");

sub(
  `    h += '<section class="panel wide' + (D.trend && D.trend.length >= 2 ? ' pclick" data-drill="trend' : '') + '">' +
      '<div class="ix">Observed weekly block rate</div>' +
      (D.trend && D.trend.length >= 2
        ? '<div style="position:relative;max-width:600px"><svg id="sv-trend" viewBox="0 0 620 300" style="width:100%;height:auto"></svg><div id="tt-trend" class="tt"></div></div><div class="legend" id="lg-trend"></div>' +
          (D.trend.length < 6 ? '<p class="foot">Early series: ' + D.trend.length + ' editions. Direction is meaningful; call movements &ldquo;largest since the index began&rdquo;, never a long-run trend.</p>' : '')
        : '<div class="empty">The trend needs at least two editions.</div>') + '</section>';`,
  `    // Half width, and NOT drillable here: the drillable by-edition version is
    // the one on Full detail. Same series, two jobs — a glance and a reference.
    h += '<section class="panel">' +
      '<div class="ix">Observed weekly block rate</div>' +
      (D.trend && D.trend.length >= 2
        ? '<div style="position:relative"><svg id="sv-trend" viewBox="0 0 620 300" style="width:100%;height:auto"></svg><div id="tt-trend" class="tt"></div></div><div class="legend" id="lg-trend"></div>' +
          '<p class="foot">' + D.trend.length + ' editions. Direction is meaningful on a series this short; a long-run trend is not. ' +
          'The drillable by-edition version is on ' + link("detail", "Full detail") + '.</p>'
        : '<div class="empty">The trend needs at least two editions.</div>') + '</section>';`,
  "trend panel"
);

fs.writeFileSync(V, v);
require("child_process").execSync("node --check " + V);

/* ---- styles -------------------------------------------------------------- */
const H = "app/dashboard.html";
let h = fs.readFileSync(H, "utf8");
if (!h.includes(".tabjob")) {
  fs.copyFileSync(H, H + ".bak-thisedition");
  h = h.replace("</style>", `
/* one line saying what each tab is for, so two views of one edition do not
   read as the same page twice */
.tabjob{grid-column:1/-1;margin:-2px 0 6px;font-size:13px;color:var(--dim);line-height:1.55;
  padding-left:11px;border-left:2px solid var(--signal)}
.tabjob b{color:var(--fg)}
</style>`);
  fs.writeFileSync(H, h);
}

/* ---- verify -------------------------------------------------------------- */
const out = fs.readFileSync(V, "utf8");
for (const m of ["tabjob", "The <b>briefing</b>", "The <b>reference view</b>", "drillable by-edition version"])
  if (!out.includes(m)) throw new Error("missing after patch: " + m);
if (out.includes(`'<section class="panel wide"><div class="ix">What changed</div>'`))
  throw new Error("What changed is still full width");
// exactly one drillable trend panel, and it is the Full detail one
const drills = (out.match(/data-drill="trend/g) || []).length;
if (drills !== 1) throw new Error("expected 1 drillable trend panel, found " + drills);
if (!fs.readFileSync(H, "utf8").includes(".tabjob")) throw new Error("tabjob style missing");

console.log("This edition reworked");
console.log("  What changed + Observed weekly block rate now pair at half width");
console.log("  the drill-through on the trend is now ONLY on Full detail (was on both)");
console.log("  each tab states its job: briefing vs reference view");
console.log("");
console.log("  not done on purpose: I drafted a 'Movement since last edition' panel to");
console.log("  replace the chart here, then found 'Biggest movements' directly above it");
console.log("  already shows per-crawler edition-over-edition deltas. Would have been a third copy.");
