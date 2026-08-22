#!/usr/bin/env node
/**
 * CPI — /explore becomes the dashboard preview, and only that
 * ===========================================================================
 * Feedback: bring the dashboard to the top, drop the leftover cards, kill the
 * "In the Terminal" gate, and rethink a title that no longer describes the
 * page.
 *
 * All correct. Once the preview exists, the three cards below it are the third
 * telling of the same figures:
 *   - the block-rate ladder  -> the preview's Crawlers tab, from the same feed
 *   - the observed price     -> the preview's Wire tab, and the homepage
 *   - suffix groups          -> already reduced to a stub link; the preview's
 *                               Segments tab does it with the caveats attached
 * and the gate block duplicated the preview's own call to action.
 *
 * The one thing worth rescuing is the crawler filter, so it moves INTO the
 * Crawlers tab — and improves on the way, because explore-preview.json carries
 * the real role tag for every crawler. The old page filtered against two
 * hardcoded name lists that had to be kept in step with the dataset by hand;
 * the roles are now read from the data, and the tab shows all 18 rather than
 * the first 8.
 *
 * Title: "Explore what the web charges AI" described a headline-figures page.
 * It is now a preview of the product, so it says so.
 */
const fs = require("fs");
const P = "public/explore.html";
let s = fs.readFileSync(P, "utf8");
if (s.includes("preview-first")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(P, P + ".bak-previewfirst");

/* ---- 1. lift the preview section out of its current position ------------ */
const secStart = s.indexOf('<div class="dash-wrap">\n  <section class="dash-preview" id="preview">');
if (secStart < 0) throw new Error("preview section not found");
// the gap before the script tag is not a fixed number of blank lines, so
// anchor on the script and take the last </div> that closes the section
const jsAt = s.indexOf('<script id="dash-preview-js">', secStart);
if (jsAt < 0) throw new Error("preview script not found");
const closeAt = s.lastIndexOf("</div>", jsAt);
if (closeAt < 0 || closeAt < secStart) throw new Error("preview section end not found");
const secEnd = closeAt + "</div>".length;
const preview = s.slice(secStart, secEnd) + "\n";
s = s.slice(0, secStart) + s.slice(secEnd);

/* ---- 2. replace hero + everything down to the old loader ---------------- */
const bodyStart = s.indexOf('<div class="dash-hero">');
const bodyEnd = s.indexOf("</script>", s.indexOf("<script>\nconst TRAINING"));
if (bodyStart < 0 || bodyEnd < 0) throw new Error("body bounds not found");

const HERO = `<div class="dash-hero" id="preview-first"><div class="dash-wrap">
  <p class="dash-eyebrow">Free preview &middot; this week&rsquo;s edition</p>
  <h1>Look inside the <em>dashboard</em></h1>
  <p class="dash-sub">This is the real thing, carrying this week&rsquo;s real numbers &mdash; the same panels a subscriber opens. Eight tabs, all clickable. Every figure below was measured; the per-domain rows are masked rather than invented, because we do not publish numbers we did not take.</p>
  <a class="lookup-link herolink" href="/check">Check a single domain &mdash; free &rarr;</a>
</div></div>

`;

s = s.slice(0, bodyStart) + HERO + preview + s.slice(bodyEnd + "</script>".length + 1);

/* ---- 3. the crawler filter moves into the Crawlers tab ------------------ */
const OLD_CRAWLERS = `    crawlers: function(){
      var cs = P.crawlers.slice().sort(function(a,b){ return b.blocked_pct - a.blocked_pct; });
      var mx = cs[0] ? cs[0].blocked_pct : 1;
      return head("Crawlers", "All " + cs.length + " tracked crawlers, with the vendor and role tags the dataset carries.") +
        cs.slice(0,8).map(function(c){
          return row(esc(c.name) + ' <span style="color:var(--dim);font-size:11.5px">&middot; ' + esc(c.vendor) + '</span>',
            c.blocked_pct.toFixed(2) + "%", c.blocked_pct/mx*100, c.role === "training" ? "a" : "b");
        }).join("") +
        foot("Showing 8 of " + cs.length + ". Amber is a training crawler, blue is search or user-initiated. Share of the " + n(P.parsed) + " domains serving a readable robots.txt.");
    },`;
if (!s.includes(OLD_CRAWLERS)) throw new Error("crawlers view not found");

const NEW_CRAWLERS = `    crawlers: function(){
      // roles come from the feed, so this can never drift from the dataset the
      // way the page's two hardcoded name lists used to
      var all = P.crawlers.slice().sort(function(a,b){ return b.blocked_pct - a.blocked_pct; });
      var count = function(r){ return all.filter(function(c){ return c.role === r; }).length; };
      var FILTERS = [
        { id:"all", label:"All " + all.length },
        { id:"training", label:"Training (" + count("training") + ")" },
        { id:"search", label:"Search (" + count("search") + ")" },
        { id:"user-initiated", label:"User-initiated (" + count("user-initiated") + ")" }
      ].filter(function(f){ return f.id === "all" || count(f.id); });
      var cs = crawlerFilter === "all" ? all : all.filter(function(c){ return c.role === crawlerFilter; });
      var mx = Math.max.apply(null, cs.map(function(c){ return c.blocked_pct; }).concat([1]));
      var TONE = { training:"a", search:"b", "user-initiated":"" };
      return head("Crawlers", "All " + all.length + " tracked crawlers, with the vendor and role tags the dataset carries. Filter by what a crawler is <em>for</em>.") +
        '<div class="dpseg" role="group" aria-label="Filter crawlers">' + FILTERS.map(function(f){
          return '<button data-cf="' + f.id + '" aria-pressed="' + (f.id === crawlerFilter) + '">' + f.label + '</button>';
        }).join("") + '</div>' +
        cs.map(function(c){
          return row(esc(c.name) + ' <span style="color:var(--dim);font-size:11.5px">&middot; ' + esc(c.vendor) + '</span>',
            c.blocked_pct.toFixed(2) + "%", c.blocked_pct/mx*100, TONE[c.role] || "");
        }).join("") +
        foot("Showing " + cs.length + " of " + all.length + ". Amber is a training crawler, blue indexes for search, grey fetches because a person asked. Share of the " + n(P.parsed) + " domains serving a readable robots.txt.");
    },`;
s = s.split(OLD_CRAWLERS).join(NEW_CRAWLERS);

/* filter state + its click handler */
s = s.replace('  var P = null, cur = "overview";',
  '  var P = null, cur = "overview", crawlerFilter = "all";');
s = s.replace(
  '    document.getElementById("dp-tabs").addEventListener("click", function(e){',
  '    // the crawler filter lives inside the tab body, which is re-rendered on\n' +
  '    // every paint, so the listener is delegated to the body rather than bound\n' +
  '    // to buttons that stop existing\n' +
  '    document.getElementById("dp-body").addEventListener("click", function(e){\n' +
  '      var f = e.target.closest("[data-cf]"); if (!f) return;\n' +
  '      crawlerFilter = f.getAttribute("data-cf"); paint();\n' +
  '    });\n' +
  '    document.getElementById("dp-tabs").addEventListener("click", function(e){');

/* ---- 4. styles: the in-tab filter, and the hero link -------------------- */
s = s.replace("</style>", function () {
  return `
/* filter buttons inside a preview tab */
.dpseg{display:inline-flex;flex-wrap:wrap;border:1px solid var(--line);border-radius:3px;overflow:hidden;margin-bottom:14px}
.dpseg button{font-family:var(--sans);font-size:12px;padding:6px 12px;background:#fff;border:0;border-right:1px solid var(--line);cursor:pointer;color:var(--dim);white-space:nowrap}
.dpseg button:last-child{border-right:0}
.dpseg button:hover{color:var(--fg)}
.dpseg button[aria-pressed=true]{background:var(--signal);color:#fff;font-weight:500}
.herolink{display:inline-block;margin:16px 0 0}
.dash-preview{padding:26px 0 44px}
</style>`;
});

/* ---- 5. strip the CSS the removed cards owned -------------------------- */
const DEAD = [
  ".controls{", ".controls label{", ".lookup-link{", ".lookup-link:hover{",
  ".seg{", ".seg button{", ".seg button:last-child{", ".seg button[aria-pressed=true]{",
  ".search{", ".search input{", ".search input:focus{",
  ".grid{", ".card{", ".card h2{", ".card .hint{",
  ".bars{", ".brow{", ".brow .nm{", ".track{", ".fill{", ".brow .pc{", ".brow.dim{",
  ".price-num{", ".price-unit{", ".price-src{", ".divider{", ".stat{", ".stat .k{", ".stat .v{",
  ".cty{", ".cty:last-child{", ".cty .c{", ".cty .n{", ".cty .p{",
  ".gate{", ".gate .lk{", ".gate p{", ".gate a{", ".gate a:hover{",
  ".searchresult{", ".searchresult b{", ".asof{",
];
let stripped = 0;
for (const sel of DEAD) {
  // .lookup-link is still used by the hero link — keep it
  if (sel.startsWith(".lookup-link")) continue;
  const i = s.indexOf("\n" + sel);
  if (i < 0) continue;
  const j = s.indexOf("}", i);
  if (j < 0) continue;
  s = s.slice(0, i) + s.slice(j + 1);
  stripped++;
}
/* tidy the comment headers those rules sat under, and the leftover media query */
s = s.replace("/* bar chart — see the blockified note on .fill */\n", "")
     .replace("/* price */\n", "")
     .replace("/* ccTLD */\n", "")
     .replace("/* gated teaser */\n", "")
     .replace("@media (max-width:820px){.grid{grid-template-columns:1fr}.dash-wrap{padding:0 18px}.brow{grid-template-columns:120px 1fr 42px}}",
              "@media (max-width:820px){.dash-wrap{padding:0 18px}}")
     .replace("@media (prefers-reduced-motion:reduce){.fill{transition:none}}\n", "");

fs.writeFileSync(P, s);

/* ---- sanity -------------------------------------------------------------- */
const out = fs.readFileSync(P, "utf8");
const must = ["preview-first", "Look inside the", "dpseg", 'data-cf', "dash-preview", "explore-preview.json"];
for (const m of must) if (!out.includes(m)) throw new Error("missing after patch: " + m);
const gone = ["In the Terminal", "Robots.txt block rates", "The observed price", "Suffix groups",
              "const TRAINING", 'id="gate"', 'class="grid"', 'id="asof"'];
// scope the removal checks to the page body — the shared footer links to
// /world under the label "Suffix groups", which is not what we deleted
const body = out.slice(0, out.indexOf('<footer class="sitefoot">'));
for (const g of gone) if (body.includes(g)) throw new Error("should have been removed: " + g);
if ((out.match(/<section class="dash-preview"/g) || []).length !== 1) throw new Error("preview duplicated or lost");

/* the preview script must still parse */
const k = '<script id="dash-preview-js">';
const a = out.indexOf(k) + k.length;
const b = out.indexOf("</scr" + "ipt>", a);
fs.writeFileSync("/tmp/dp3.js", out.slice(a, b));
require("child_process").execSync("node --check /tmp/dp3.js");

console.log("/explore is now the dashboard preview, first thing on the page");
console.log("  removed  block-rate ladder, observed price, suffix groups, the 'In the Terminal' gate");
console.log("           (all three cards were the third telling of the same figures)");
console.log("  moved    the crawler filter into the Crawlers tab, now showing all 18 not 8");
console.log("           and filtering on the role tag in the feed, not two hardcoded name lists");
console.log("  title    'Explore what the web charges AI' -> 'Look inside the dashboard'");
console.log("  stripped " + stripped + " now-dead CSS rules");
