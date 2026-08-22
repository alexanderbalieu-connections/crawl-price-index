#!/usr/bin/env node
/**
 * CPI — world.html → suffix-group page  (node reframe-world.cjs)
 * ===========================================================================
 * The page is retired from the nav but still served, and it carried the last
 * country-as-proxy framing on the public site. Retiring the URL would break
 * any inbound link; reframing keeps the link, keeps genuinely interesting
 * data, and removes the claim we cannot support.
 *
 * The substantive fix is not vocabulary, it is ORDER. The page currently
 * ranks suffix groups against each other and buries the confound in a footnote.
 * A .co.uk group at 42.1% and a .cn group at 4.0% is not evidence that one
 * country blocks more: suffix groups differ in rank composition, site type and
 * sample size, and any of those can produce the gap. So the confound now runs
 * FIRST, and the ranking is presented as a distribution to be interpreted with
 * it — not a leaderboard.
 *
 * Changes: title/eyebrow/H1/lede · "The map" → "The distribution" ·
 * "X leads / Y barely bothers" → neutral high-low framing · "global floor" →
 * generic-suffix baseline · "Full country index" → suffix-group detail ·
 * superseded Terminal CTA label · footer version. No data changes.
 */
const fs = require("fs");
const P = "public/world.html";
let s = fs.readFileSync(P, "utf8");
if (s.includes("Suffix groups &mdash; what a domain ending")) { console.log("already reframed"); process.exit(0); }
fs.copyFileSync(P, P + ".bak-world");

const subs = [
  // --- head ---
  [/<title>[^<]*<\/title>/,
   `<title>Suffix groups — The Crawl Price Index</title>`],
  [/<meta name="description" content="[^"]*">/,
   `<meta name="description" content="AI-crawler block rates grouped by domain suffix, from a weekly scan. A suffix is not a country — and suffix groups differ in rank composition, so read the distribution with the confound, not as a league table.">`],

  // --- hero ---
  [`  <div class="eyebrow">World editions</div>
  <h1>Where the web is<br>building its <em>toll booth</em>.</h1>
  <p class="lede">AI-crawler blocking varies sharply by domain suffix. The same scan shows some ccTLD groups gating much of their content from AI while others leave it open. Here is the map, by ccTLD group, refreshed with every edition.</p>
  <div class="asof">Baseline · <span id="asof">—</span> · Tranco frame, segmented by country-code domain suffix</div>`,
   `  <div class="eyebrow">Suffix groups</div>
  <h1>Suffix groups &mdash; what a domain ending<br>does and <em>does not</em> tell you.</h1>
  <p class="lede">Declared AI-crawler blocking varies widely across domain suffixes. It is tempting to read that as a map of national attitudes. It is not one, and this page is built so it cannot be read that way: the reasons a suffix group's rate moves are set out before the numbers, not after them.</p>
  <div class="asof">Edition <span id="asof">&mdash;</span> &middot; grouped by domain suffix within the CPI-50K frame</div>`],

  // --- new: confound panel inserted before the distribution ---
  [`  <section class="panel wide">
    <div class="ix"><span class="lead-in">The map</span></div>
    <h2><span id="hl-top">—</span> leads. <span id="hl-bottom">—</span> barely bothers.</h2>
    <p class="source" style="margin:0 0 18px">Share of sites blocking at least one AI crawler, by ccTLD group.</p>
    <div class="rank" id="rank"></div>
  </section>`,
   `  <section class="panel wide">
    <div class="ix"><span class="lead-in">Read this first</span></div>
    <h2>Three reasons a suffix group&rsquo;s rate moves &mdash; none of them national.</h2>
    <ul style="margin:0 0 4px">
      <li><b>A suffix is not a country.</b> It is a string at the end of a domain name. It does not establish where an operator is, who owns the site, where its audience is, or where it is hosted. Many organisations in a given country never use that country&rsquo;s suffix, and anyone anywhere can register most of them.</li>
      <li><b>Suffix groups differ in rank composition.</b> Rank correlates with declared blocking in our own data. A group weighted toward higher-ranked domains will show a higher rate than one weighted toward the long tail, before any question of policy arises. Part of any gap you see below is rank, not attitude.</li>
      <li><b>Sample sizes differ by an order of magnitude.</b> Groups here range from a few dozen domains to over a thousand. A small group moves several points when a handful of sites change a single line in a file.</li>
    </ul>
    <p class="source" style="margin:14px 0 0">The dashboard&rsquo;s Segments tab compares each group against the whole-index rate and against rank bands, which is the cut that begins to separate these effects. This page shows the raw distribution only.</p>
  </section>

  <section class="panel wide">
    <div class="ix"><span class="lead-in">The distribution</span></div>
    <h2>Declared blocking by suffix group.</h2>
    <p class="source" style="margin:0 0 6px">Share of each group&rsquo;s domains that explicitly block at least one of the 18 tracked AI crawlers, among domains serving a readable robots.txt. Highest observed: <span id="hl-top">&mdash;</span>. Lowest: <span id="hl-bottom">&mdash;</span>. Neither is a ranking of anything but this measurement.</p>
    <p class="source" style="margin:0 0 18px">Sample size (n) is shown for every group. Read it alongside every rate.</p>
    <div class="rank" id="rank"></div>
  </section>`],

  // --- baseline section ---
  [`    <div class="ix"><span class="lead-in">The baseline</span></div>
    <h2>The global floor.</h2>
    <div class="baseline" style="margin-top:4px"><span class="dot"></span> Global baseline (.com/.org and other generic domains): <b id="gtld" style="color:var(--fg)">—</b></div>`,
   `    <div class="ix"><span class="lead-in">The baseline</span></div>
    <h2>The generic-suffix baseline.</h2>
    <div class="baseline" style="margin-top:4px"><span class="dot"></span> Generic suffixes (.com, .org and similar), which carry no geography at all: <b id="gtld" style="color:var(--fg)">&mdash;</b></div>`],

  // --- per-crawler section ---
  [`    <h2>What each suffix group locks out.</h2>
    <p>Block rates by individual crawler tell a sharper story than the headline: some suffix groups gate training bots while leaving search crawlers alone, others block everything or nothing.</p>`,
   `    <h2>Per-crawler detail by suffix group.</h2>
    <p>The headline rate hides which crawler is being blocked. Some groups show a wider gap between training-role and search-role crawlers than others. The same three confounds above apply to every column.</p>`],

  // --- gate copy + stale labels ---
  [`🔒 Full country index is a Terminal feature`,
   `Full suffix-group detail is part of the full dataset`],
  [`  const FREE=3; // free preview: top-blocking country + 2 more; rest is gated`,
   `  const FREE=3; // free preview: highest-rate group + 2 more; the rest is gated`],
  [`  THE CRAWL PRICE INDEX · World editions v1 · <a href="/methodology.html">methodology</a>`,
   `  THE CRAWL PRICE INDEX &middot; suffix groups &middot; <a href="/methodology">methodology</a>`],
];

let n = 0;
for (const [a, b] of subs) {
  if (a instanceof RegExp) { if (a.test(s)) { s = s.replace(a, b); n++; } else console.log("  MISS re: " + a); }
  else if (s.includes(a)) { s = s.split(a).join(b); n++; }
  else console.log("  MISS: " + String(a).slice(0, 70).replace(/\n/g, " "));
}

// any remaining "Terminal — €.." CTA labels on this page
s = s.split("Terminal — €49/mo").join("Full dataset — €49/mo");

fs.writeFileSync(P, s);
console.log(n + "/" + subs.length + " reframes applied to world.html");
