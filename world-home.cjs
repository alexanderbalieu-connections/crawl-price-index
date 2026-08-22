#!/usr/bin/env node
/**
 * CPI — give /world a home
 * ===========================================================================
 * /world (Suffix groups) is a real page with 54 groups on it, and the only
 * way to reach it is the footer link index. Nothing on any page leads there.
 *
 * Three entrances, each where a reader is already thinking about suffixes:
 *
 *   /explore   a card in the edition cuts, next to "Who gets blocked". Uses
 *              the most/least-blocking suffixes already in the preview feed,
 *              so it refreshes weekly with everything else and hardcodes no
 *              figure. Pairs with "Who gets blocked", which currently sits
 *              alone in its grid row.
 *   /explore   the segments footnote already ends "A suffix is not a
 *              country" — that sentence now links to the page that proves it.
 *   /method    the ccTLD caution bullet links to the same place.
 *
 * NO NEW NUMBERS. The card quotes only tld_most and tld_least, which are
 * already rendered on this page in the segments footnote, so check-copy has
 * nothing new to police and nothing can go stale independently.
 */
const fs = require("fs");

const sub = (file, from, to, label) => {
  let s = fs.readFileSync(file, "utf8");
  if (!s.includes(from)) throw new Error("not found in " + file + ": " + label);
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(label + ": expected 1 match, found " + n);
  fs.writeFileSync(file, s.split(from).join(to));
};

const E = "public/explore.html", M = "public/methodology.html";
if (fs.readFileSync(E, "utf8").includes('id="cut-suffix"')) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(E, E + ".bak-world");
fs.copyFileSync(M, M + ".bak-world");

/* ---- 1. the card, paired with "Who gets blocked" ------------------------ */
sub(E,
`  <section class="panel wide">
    <div class="ix"><span class="lead-in">The wall is rising</span></div>`,
`  <section class="panel" id="cut-suffix">
    <div class="ix"><span class="lead-in">By domain suffix</span></div>
    <h2>The spread is wide. It is not a map.</h2>
    <p style="margin-bottom:12px">Group the frame by domain ending and the block rates run from one extreme to the other. That spread is real and it is worth knowing &mdash; but a suffix is a registration choice, not a country, an owner, an audience or a place where a server sits.</p>
    <div id="v2-suffix"></div>
    <p style="font-size:11.5px;color:var(--dim);margin-top:12px">Groups also differ in rank composition, so part of any gap between them is rank rather than policy. <a href="/world">All suffix groups, and why this is not a map &rarr;</a></p>
  </section>

  <section class="panel wide">
    <div class="ix"><span class="lead-in">The wall is rising</span></div>`,
  "suffix card");

/* ---- 2. render it from the figures the page already loads --------------- */
sub(E,
`      var S = P.segments, B = S.bands || [];`,
`      var S = P.segments, B = S.bands || [];
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
      }`,
  "suffix render");

/* ---- 3. the footnote sentence now leads somewhere ----------------------- */
sub(E,
  `+ S.tld_least.any_ai_block_pct + "%). A suffix is not a country.")`,
  `+ S.tld_least.any_ai_block_pct + "%). <a href=\\"/world\\">A suffix is not a country</a>.")`,
  "segments footnote link");

/* ---- 4. and the methodology caution --------------------------------- */
sub(M,
  `<li><b>ccTLD is a domain suffix, not a country.</b> A <code>.io</code> domain is rarely British Indian Ocean Territory, and <code>.com</code>/<code>.org</code>/<code>.io</code> carry no geography at all.</li>`,
  `<li><b>ccTLD is a domain suffix, not a country.</b> A <code>.io</code> domain is rarely British Indian Ocean Territory, and <code>.com</code>/<code>.org</code>/<code>.io</code> carry no geography at all. Every published group, with the reasons a group&rsquo;s rate moves set out before the numbers: <a href="/world">suffix groups</a>.</li>`,
  "methodology caution link");

/* ---- styles -------------------------------------------------------------- */
let e = fs.readFileSync(E, "utf8");
if (!e.includes(".sfxrow")) {
  e = e.replace("</style>", `
/* the suffix spread on the edition cuts — two rows, most and least blocking */
.sfxrow{display:grid;grid-template-columns:74px 1fr 54px 62px;gap:10px;align-items:center;font-size:13px;padding:5px 0}
.sfxk{font-family:var(--mono,ui-monospace,Menlo,monospace);font-weight:600}
.sfxb{height:9px;background:rgba(0,0,0,.07);border-radius:2px;overflow:hidden}
.sfxb span{display:block;height:100%;background:var(--signal)}
.sfxv{text-align:right;font-weight:600}
.sfxn{text-align:right;font-size:11.5px;color:var(--dim)}
.sfxc{font-size:11.5px;color:var(--dim);margin-top:8px;line-height:1.5}
@media(max-width:700px){.sfxrow{grid-template-columns:64px 1fr 48px 54px}}
</style>`);
  fs.writeFileSync(E, e);
}

/* ---- verify -------------------------------------------------------------- */
const oe = fs.readFileSync(E, "utf8"), om = fs.readFileSync(M, "utf8");
for (const m of ['id="cut-suffix"', 'id="v2-suffix"', ".sfxrow{", ".sfxb span{",
                 'href="/world">All suffix groups', 'A suffix is not a country</a>'])
  if (!oe.includes(m)) throw new Error("missing on /explore: " + m);
if (!om.includes('<a href="/world">suffix groups</a>')) throw new Error("missing on /methodology");
// display:block on the fill — the bug that rendered every bar on this page at 0px
if (!/\.sfxb span\{display:block/.test(oe)) throw new Error(".sfxb span must be display:block or the bars render at 0px");
// the card must not introduce a number the feed does not carry
const body = oe.slice(oe.indexOf('id="cut-suffix"'), oe.indexOf('The wall is rising'));
const lits = body.match(/\b\d+(\.\d+)?%/g);
if (lits) throw new Error("hardcoded percentage in the suffix card: " + lits.join(", "));
// and the page must still be one file with no duplicate helpers
const decls = [...oe.matchAll(/function\s+(\$\$?|[A-Za-z_][\w$]*)\s*\(/g)].map((m) => m[1]);
const dup = decls.filter((d, i) => decls.indexOf(d) !== i);
if (dup.length) throw new Error("duplicate function declarations: " + [...new Set(dup)].join(", "));

console.log("/world now has three ways in");
console.log("  /explore      new 'By domain suffix' card, paired with 'Who gets blocked'");
console.log("  /explore      the segments footnote's 'A suffix is not a country' is now the link");
console.log("  /methodology  the ccTLD caution points at the page that demonstrates it");
console.log("");
console.log("  the card quotes only tld_most / tld_least from the preview feed — no hardcoded");
console.log("  figure, so it refreshes with the edition and check-copy has nothing new to police");
