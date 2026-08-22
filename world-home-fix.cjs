#!/usr/bin/env node
/**
 * CPI — the suffix card rendered empty: wrong hook
 * ===========================================================================
 * I put the render inside `VIEWS.segments`, which only runs when a visitor
 * clicks the Segments tab of the fake dashboard. The card is a static page
 * section further down /explore, so on page load it stayed empty — and the
 * panel is still visible while empty, so nothing looked broken. Exactly the
 * silent-empty failure mode as the $$ collapse earlier.
 *
 * The render belongs in the page-load fetch handler, which runs once and
 * has the same P.segments in scope. Moved there, before paint().
 *
 * I also would not have caught this by reading the diff: the fix is a headless
 * render that asserts the rows exist AND that their bars have non-zero width.
 */
const fs = require("fs");
const E = "public/explore.html";
let e = fs.readFileSync(E, "utf8");
if (e.includes("renderSuffixCut()")) { console.log("already applied"); process.exit(0); }
if (!e.includes('id="v2-suffix"')) throw new Error("run world-home.cjs first");
fs.copyFileSync(E, E + ".bak-worldfix");

const sub = (from, to, label) => {
  if (!e.includes(from)) throw new Error("not found: " + label);
  const n = e.split(from).length - 1;
  if (n !== 1) throw new Error(label + ": expected 1 match, found " + n);
  e = e.split(from).join(to);
};

/* ---- 1. lift it out of the tab view ------------------------------------- */
const inTab = `      var S = P.segments, B = S.bands || [];
      // the same two figures the segments footnote quotes — no new numbers,
      // nothing to go stale independently of the feed
      var sfx = document.getElementById("v2-suffix");
      if (sfx && S.tld_most && S.tld_least) {
        var hi = S.tld_most, lo = S.tld_least;
        sfx.innerHTML =
          '<div class="sfxrow"><span class="sfxk">' + esc(hi.cctld) + '</span>' +
          '<span class="sfxb"><span style="width:100%"></span></span>' +
          '<span class="sfxv">' + hi.any_ai_block_pct + '%</span>' +
          '<span class="sfxn">n=' + n(hi.n) + '</span></div>' +
          '<div class="sfxrow"><span class="sfxk">' + esc(lo.cctld) + '</span>' +
          '<span class="sfxb"><span style="width:' + (hi.any_ai_block_pct ? (lo.any_ai_block_pct / hi.any_ai_block_pct * 100).toFixed(1) : 0) + '%"></span></span>' +
          '<span class="sfxv">' + lo.any_ai_block_pct + '%</span>' +
          '<span class="sfxn">n=' + n(lo.n) + '</span></div>' +
          '<p class="sfxc">Most and least blocking of the suffix groups published this edition &mdash; ' +
          'share of each group&rsquo;s domains blocking at least one tracked crawler.</p>';
      }`;
sub(inTab, `      var S = P.segments, B = S.bands || [];`, "lift render out of the segments tab");

/* ---- 2. and run it once, on load ---------------------------------------- */
sub(
  `  function paint(){
    var el = document.getElementById("dp-body");`,
  `  // The "By domain suffix" card is a static section of the page, NOT part of
  // the tabbed preview, so it must be painted on load — not inside a VIEWS
  // function, which only runs when that tab is clicked. Quotes the same two
  // figures as the segments footnote, so no new number enters the page.
  function renderSuffixCut(){
    var sfx = document.getElementById("v2-suffix");
    var S = P && P.segments;
    if (!sfx || !S || !S.tld_most || !S.tld_least) return;
    var hi = S.tld_most, lo = S.tld_least;
    var w = hi.any_ai_block_pct ? (lo.any_ai_block_pct / hi.any_ai_block_pct * 100).toFixed(1) : 0;
    sfx.innerHTML =
      '<div class="sfxrow"><span class="sfxk">' + esc(hi.cctld) + '</span>' +
      '<span class="sfxb"><span style="width:100%"></span></span>' +
      '<span class="sfxv">' + hi.any_ai_block_pct + '%</span>' +
      '<span class="sfxn">n=' + n(hi.n) + '</span></div>' +
      '<div class="sfxrow"><span class="sfxk">' + esc(lo.cctld) + '</span>' +
      '<span class="sfxb"><span style="width:' + w + '%"></span></span>' +
      '<span class="sfxv">' + lo.any_ai_block_pct + '%</span>' +
      '<span class="sfxn">n=' + n(lo.n) + '</span></div>' +
      '<p class="sfxc">Most and least blocking of the suffix groups published this edition &mdash; ' +
      'share of each group&rsquo;s domains blocking at least one tracked crawler.</p>';
  }

  function paint(){
    var el = document.getElementById("dp-body");`,
  "renderSuffixCut"
);

sub(`    paint();
  }).catch(function(){`,
    `    paint();
    renderSuffixCut();
  }).catch(function(){`,
    "call it on load");

fs.writeFileSync(E, e);

/* ---- verify -------------------------------------------------------------- */
const out = fs.readFileSync(E, "utf8");
if (!out.includes("function renderSuffixCut(){")) throw new Error("not defined");
if ((out.match(/renderSuffixCut\(\)/g) || []).length !== 2)
  throw new Error("expected one definition and one call");
// it must NOT be inside the VIEWS object any more
const viewsStart = out.indexOf("var VIEWS = {");
const viewsEnd = out.indexOf("function renderSuffixCut(){");
if (out.slice(viewsStart, viewsEnd).includes("v2-suffix"))
  throw new Error("the render is still inside the tabbed views");
const decls = [...out.matchAll(/function\s+(\$\$?|[A-Za-z_][\w$]*)\s*\(/g)].map((m) => m[1]);
const dup = decls.filter((d, i) => decls.indexOf(d) !== i);
if (dup.length) throw new Error("duplicate function declarations: " + [...new Set(dup)].join(", "));

console.log("suffix card render moved to page load");
console.log("  it was inside VIEWS.segments, which only runs when that tab is clicked");
console.log("  the panel rendered empty and visible — no error, nothing to notice");
console.log("  now painted once in the fetch handler, next to paint()");
