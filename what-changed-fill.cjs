#!/usr/bin/env node
/**
 * CPI — "What changed" earns its half of the row
 * ===========================================================================
 * After pairing the two panels at half width, "What changed" held one
 * sentence and two buttons in a box as tall as a 300px chart. Two fixes.
 *
 * 1. PANELS STOP STRETCHING. .grid gains align-items:start, so a short card
 *    is short instead of padding itself out to match its neighbour. Row
 *    positions are unaffected — the grid still starts each row below the
 *    tallest card in the one above. This is what actually removes the white.
 *
 * 2. THE PANEL SAYS SOMETHING A BRIEFING SHOULD SAY. Not the full transition
 *    matrix — the Policy changes tab already renders that, colour-coded and
 *    clickable, and copying it here would recreate the exact duplication
 *    Alex flagged between This edition and Full detail. Instead: the one
 *    derived figure the matrix does not state outright — cells moving INTO
 *    explicit blocking versus OUT of it, and the net — with a link through
 *    to the matrix for anyone who wants the breakdown.
 *
 *    I deliberately did NOT write a "tightened vs loosened" split, which is
 *    the tempting version: it would have to rank "no explicit instruction"
 *    as more restrictive than "explicitly allowed", and in robots.txt those
 *    two permit exactly the same crawling. Into-blocked and out-of-blocked
 *    need no such judgement call.
 *
 * And the free reader is now told what they are not seeing: the named
 * domains behind the counts are the paid layer, and the panel says so
 * rather than leaving an empty div where the table would be.
 *
 * NOTE ON THE CLASS NAME: my first draft called these rows .trrow. That
 * class already exists — it is the clickable transition row on Policy
 * changes, and its click handler binds by class, so my rows would have
 * become fake drill-throughs. Same family as the .k collision earlier.
 * Grep before naming.
 */
const fs = require("fs");
const V = "app/views.js";
let v = fs.readFileSync(V, "utf8");
if (v.includes("mvpair")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(V, V + ".bak-whatchanged");

const sub = (from, to, label) => {
  if (!v.includes(from)) throw new Error("not found: " + label);
  const n = v.split(from).length - 1;
  if (n !== 1) throw new Error(label + ": expected 1 match, found " + n);
  v = v.split(from).join(to);
};

/* ---- 1. into / out of explicit blocking --------------------------------- */
sub(
  `      var tr = D.changes.transitions, keys = Object.keys(tr).sort(function (a, b) { return tr[b] - tr[a]; });
      h += '<p class="sub"><b>' + fmt(D.changes.total_changes) + '</b> policy changes across <b>' +
        fmt(D.changes.changed_domains) + '</b> domains between ' + esc(D.changes.interval) + '. ' +
        (keys.length ? 'Most common: <b>' + fmt(tr[keys[0]]) + '</b> moved ' +
          (STATE_LABELS[keys[0].split("->")[0]] || "") + ' &rarr; ' + (STATE_LABELS[keys[0].split("->")[1]] || "") + '.' : '') + '</p>' +
        '<div class="ctrls"><button class="btnx" data-goto="changes">See the ' + fmt(D.changes.total_changes) + ' changes</button>' +
        '<button class="btnx" data-goto="domains" style="background:#1D4E6F;border-color:#1D4E6F">Look up a domain</button></div>' +
        '<div id="notable"></div>';`,
  `      var tr = D.changes.transitions, keys = Object.keys(tr).sort(function (a, b) { return tr[b] - tr[a]; });
      // Direction of travel. NOT "tightened vs loosened": that would have to
      // rank "no explicit instruction" against "explicitly allowed", and
      // robots.txt treats the two identically. Into/out of blocked does not
      // need that judgement call.
      var intoB = 0, outB = 0;
      keys.forEach(function (k) {
        var p = k.split("->");
        if (p[1] === "blocked" && p[0] !== "blocked") intoB += tr[k];
        if (p[0] === "blocked" && p[1] !== "blocked") outB += tr[k];
      });
      var net = intoB - outB;
      h += '<p class="sub"><b>' + fmt(D.changes.total_changes) + '</b> policy changes across <b>' +
        fmt(D.changes.changed_domains) + '</b> domains between ' + esc(D.changes.interval) + '. ' +
        (keys.length ? 'Most common: <b>' + fmt(tr[keys[0]]) + '</b> moved ' +
          (STATE_LABELS[keys[0].split("->")[0]] || "") + ' &rarr; ' + (STATE_LABELS[keys[0].split("->")[1]] || "") + '.' : '') + '</p>' +
        '<div class="mvpair">' +
          '<div><div class="mvfig">' + fmt(intoB) + '</div><div class="mvlab">into explicit blocking</div></div>' +
          '<div><div class="mvfig">' + fmt(outB) + '</div><div class="mvlab">out of explicit blocking</div></div>' +
          '<div><div class="mvfig mvnet">' + (net >= 0 ? "+" : "") + fmt(net) + '</div><div class="mvlab">net this edition</div></div>' +
        '</div>' +
        '<p class="foot">Counts are crawler&ndash;domain cells, not domains: one site changing its line for eight crawlers is eight changes. ' +
        'The full transition breakdown is on ' + link("changes", "Policy changes") + '.</p>' +
        '<div class="ctrls"><button class="btnx" data-goto="changes">See the ' + fmt(D.changes.total_changes) + ' changes</button>' +
        '<button class="btnx" data-goto="domains" style="background:#1D4E6F;border-color:#1D4E6F">Look up a domain</button></div>' +
        '<div id="notable"></div>';`,
  "direction of travel"
);

/* ---- 2. say what the free reader is not seeing -------------------------- */
sub(
  `    // notable named examples, highest-ranked movers first
    if (D.changes.available) loadDomains(function (pd) {`,
  `    // notable named examples, highest-ranked movers first — the named layer
    // is paid, so say so rather than leaving the div silently empty
    if (D.changes.available && !entitled()) {
      var nb = EL("notable");
      if (nb) nb.innerHTML = '<p class="foot" style="margin-top:12px">&#128274; <b>Which</b> domains moved, and for which crawlers, ' +
        'is the per-domain layer &mdash; part of Terminal. The counts above are free to read and free to cite. ' +
        '<a href="#account" class="locklink">See what Terminal includes &rarr;</a></p>';
    }
    if (D.changes.available && entitled()) loadDomains(function (pd) {`,
  "notable lock note"
);

fs.writeFileSync(V, v);
require("child_process").execSync("node --check " + V);

/* ---- styles -------------------------------------------------------------- */
const H = "app/dashboard.html";
let h = fs.readFileSync(H, "utf8");
if (!h.includes(".mvpair")) {
  fs.copyFileSync(H, H + ".bak-whatchanged");
  // panels size to their content; the grid still starts each row below the
  // tallest card above it, so nothing moves — the white padding just goes
  const G = ".grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}";
  if (!h.includes(G)) throw new Error("grid rule not found");
  h = h.replace(G, ".grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start}");
  h = h.replace("</style>", `
/* direction of travel in "What changed" — three figures, no matrix: the
   matrix itself lives on Policy changes and must not be duplicated here */
.mvpair{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:14px 0 4px;
  border:1px solid var(--line);border-radius:3px;background:var(--paper);padding:14px 16px}
.mvfig{font-size:26px;line-height:1.1;font-weight:600;font-family:ui-monospace,Menlo,monospace}
.mvnet{color:var(--signal)}
.mvlab{font-size:11px;color:var(--dim);margin-top:4px;line-height:1.35}
@media(max-width:800px){.mvfig{font-size:21px}}
</style>`);
  fs.writeFileSync(H, h);
}

/* ---- verify -------------------------------------------------------------- */
const out = fs.readFileSync(V, "utf8");
for (const m of ["mvpair", "into explicit blocking", "out of explicit blocking",
                 "is the per-domain layer", "if (D.changes.available && entitled()) loadDomains"])
  if (!out.includes(m)) throw new Error("missing after patch: " + m);
const oh = fs.readFileSync(H, "utf8");
for (const m of [".mvpair{", ".mvfig{", ".mvlab{", ".mvnet{", "gap:18px;align-items:start}"])
  if (!oh.includes(m)) throw new Error("style missing: " + m);
// the Policy changes matrix must survive untouched — it is the thing this
// panel deliberately does NOT copy
if ((out.match(/class="hrow trrow"/g) || []).length !== 1)
  throw new Error("the Policy changes transition matrix was disturbed");

/* the arithmetic, against this edition's own feed */
const D = JSON.parse(fs.readFileSync("app/data/dashboard.json", "utf8"));
const tr = D.changes.transitions || {};
let into = 0, outof = 0, sum = 0;
for (const k of Object.keys(tr)) {
  const [a, b] = k.split("->"); sum += tr[k];
  if (b === "blocked" && a !== "blocked") into += tr[k];
  if (a === "blocked" && b !== "blocked") outof += tr[k];
}
if (sum !== D.changes.total_changes)
  throw new Error("transitions sum to " + sum + " but total_changes is " + D.changes.total_changes);
console.log("What changed: direction of travel added");
console.log("  " + Object.keys(tr).length + " transitions in the feed, summing to " + sum + " = total_changes");
console.log("  into explicit blocking " + into + ", out of it " + outof + ", net " + (into - outof >= 0 ? "+" : "") + (into - outof));
console.log("  the transition MATRIX stays on Policy changes only — not copied here");
console.log("  panels no longer stretch: .grid align-items:start");
console.log("  free readers are told the named domains are the paid layer, instead of an empty div");
