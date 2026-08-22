#!/usr/bin/env node
/**
 * CPI — /explore bugs + hero measure across the site
 * ===========================================================================
 * Found by driving the page in a real browser rather than reading the source:
 *
 *  1. EVERY BAR ON /explore RENDERS AT ZERO WIDTH. `.fill` is a <span> inside
 *     `.track`. `.track` is a grid item so the grid blockifies it, but `.fill`
 *     is not — it stays display:inline, where width and height do nothing. The
 *     inline style said width:100%; the measured width was 0px. The page has
 *     been shipping an empty chart.
 *  2. The crawler filter only added a .dim class — the chart did not change,
 *     which is exactly what a user reports as "it does nothing". It now
 *     filters the rows out and rescales to the visible maximum.
 *  3. "Share of the top 2,000 that disallow each crawler" — WRONG DENOMINATOR
 *     on a page whose whole pitch is denominator-first. The real basis is the
 *     domains serving a readable robots.txt, and the header two lines above
 *     already said 27,975 of 50,000. Now read from the feed.
 *  4. "Show:" was printed twice — once as the control label, once again inside
 *     the segmented control.
 *  5. The "Look up a single domain" link sat in a flex:1 container, so it
 *     stretched to fill every pixel the segmented control left over.
 *
 * And the shared hero problem behind items 2 and 4 of the feedback: six pages
 * cap their opening paragraph at 60ch / 620px / 640px while the rule above it
 * and the heading run the full 1140px. The homepage and /why use
 * .lede{max-width:none}. Those six now match.
 */
const fs = require("fs");

/* ---------------------------------------------------------- /explore ----- */
const E = "public/explore.html";
let s = fs.readFileSync(E, "utf8");
if (s.includes("blockified")) { console.log("explore: already applied"); }
else {
  fs.copyFileSync(E, E + ".bak-explorefix");
  const sub = (from, to, label) => {
    if (!s.includes(from)) throw new Error("explore: not found — " + label);
    s = s.split(from).join(to);
  };

  /* 1. the bug: an inline span cannot take a width */
  sub(
    ".fill{height:100%;background:var(--signal);width:0;transition:width .6s cubic-bezier(.2,.7,.2,1)}",
    "/* display:block matters — .track is blockified by the grid, .fill is not,\n" +
    "   and an inline span ignores width, so every bar rendered at 0px */\n" +
    ".fill{display:block;height:100%;background:var(--signal);width:0;transition:width .6s cubic-bezier(.2,.7,.2,1)}",
    "fill display"
  );

  /* 4. one label, not two */
  sub(
    '<span style="font-size:12.5px;color:var(--dim);align-self:center;margin-right:10px">Show:</span><button data-filter="all"',
    '<button data-filter="all"',
    "duplicate Show label"
  );

  /* 5. the lookup link stops stretching */
  sub(
    '    <div class="search lookup-cta">\n' +
    '      <a class="btn" href="/check" style="white-space:nowrap">Look up a single domain &mdash; free &rarr;</a>\n' +
    '    </div>',
    '    <a class="lookup-link" href="/check">Look up a single domain &mdash; free &rarr;</a>',
    "lookup cta"
  );
  sub(
    ".controls label{font-size:12.5px;color:var(--dim);margin-right:2px}",
    ".controls label{font-size:12.5px;color:var(--dim);margin-right:2px}\n" +
    "/* sits at the end of the row at its own size, rather than flexing to fill\n" +
    "   whatever the segmented control leaves over */\n" +
    ".lookup-link{margin-left:auto;font-size:13.5px;color:var(--signal);text-decoration:none;white-space:nowrap;border-bottom:1px solid rgba(28,93,74,.35);padding-bottom:1px}\n" +
    ".lookup-link:hover{border-bottom-color:var(--signal)}",
    "lookup link css"
  );

  /* 2 + 3. the filter filters, and the basis is the real one */
  sub(
    '  const inFilter = b => filter==="all" || (filter==="training"?TRAINING:SEARCH).includes(b);\n' +
    '  document.getElementById("brhint").textContent =\n' +
    '    filter==="all" ? "Share of the top 2,000 that disallow each crawler, in robots.txt."\n' +
    '    : filter==="training" ? "Training & data-collection crawlers only."\n' +
    '    : "Search and answer crawlers only — the ones that send traffic back.";\n' +
    '  document.getElementById("bars").innerHTML = entries.map(([b,v])=>\n' +
    '    \'<div class="brow\'+(inFilter(b)?\'\':\' dim\')+\'"><span class="nm">\'+b+\'</span>\'+\n' +
    '    \'<span class="track"><span class="fill" data-w="\'+Math.round(v/max*100)+\'"></span></span>\'+\n' +
    '    \'<span class="pc">\'+v+\'%</span></div>\').join("");',
    '  const inFilter = b => filter==="all" || (filter==="training"?TRAINING:SEARCH).includes(b);\n' +
    '  // filter, do not dim: dimming looks like the control is broken\n' +
    '  const shown = entries.filter(([b])=>inFilter(b)).sort((a,b)=>b[1]-a[1]);\n' +
    '  const smax = Math.max(...shown.map(([,v])=>v), 1);\n' +
    '  const basis = (d.block_rates && d.block_rates.denominator) || d.coverage.robots_parsed;\n' +
    '  document.getElementById("brhint").textContent =\n' +
    '    (filter==="all" ? "Share of the " + basis.toLocaleString() + " domains serving a readable robots.txt that disallow each crawler."\n' +
    '     : filter==="training" ? "Training and data-collection crawlers only — " + shown.length + " of " + entries.length + ", against the same " + basis.toLocaleString() + " domains."\n' +
    '     : "Search and answer crawlers only — the ones that can send a reader back. " + shown.length + " of " + entries.length + ", against the same " + basis.toLocaleString() + " domains.");\n' +
    '  document.getElementById("bars").innerHTML = shown.map(([b,v])=>\n' +
    '    \'<div class="brow"><span class="nm">\'+b+\'</span>\'+\n' +
    '    \'<span class="track"><span class="fill" data-w="\'+Math.round(v/smax*100)+\'"></span></span>\'+\n' +
    '    \'<span class="pc">\'+v.toFixed(1)+\'%</span></div>\').join("");',
    "filter behaviour"
  );

  /* the hero paragraph runs the full measure, like the homepage */
  sub(".dash-sub{color:var(--dim);max-width:60ch;font-size:16.5px}",
      ".dash-sub{color:var(--dim);max-width:none;font-size:16.5px}",
      "dash-sub measure");

  /* leave a marker so this script is idempotent */
  s = s.replace("/* bar chart */", "/* bar chart — see the blockified note on .fill */");

  fs.writeFileSync(E, s);
  console.log("explore.html");
  console.log("  BUG  every bar rendered at 0px — .fill was inline, so width did nothing");
  console.log("  BUG  the crawler filter only dimmed rows; it now filters and rescales");
  console.log("  BUG  block rates were labelled 'top 2,000'; the basis is the readable-robots.txt count");
  console.log("  'Show:' printed twice — one label now");
  console.log("  the lookup link no longer stretches across the row");
}

/* ------------------------------------------------- hero measure, sitewide */
const HEROES = [
  ["public/methodology.html", '<p style="max-width:640px;margin:0">'],
  ["public/changelog.html", '<p style="margin:0;max-width:620px">'],
  ["public/privacy.html", '<p style="margin:0;max-width:620px">'],
  ["public/security.html", '<p style="margin:0;max-width:620px">'],
  ["public/status.html", '<p style="margin:0;max-width:620px">'],
];
let fixed = 0;
for (const [f, open] of HEROES) {
  let t = fs.readFileSync(f, "utf8");
  if (!t.includes(open)) { console.log("  hero already full width: " + f); continue; }
  fs.copyFileSync(f, f + ".bak-hero");
  t = t.replace(open, '<p class="lede" style="margin:0">');
  fs.writeFileSync(f, t);
  fixed++;
}
console.log(fixed + " hero paragraphs now run the full measure, matching the homepage and /why");
