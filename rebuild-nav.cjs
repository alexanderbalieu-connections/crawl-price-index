#!/usr/bin/env node
/**
 * CPI — NAVBAR v2  (node rebuild-nav.cjs [--dry])
 * ===========================================================================
 * Rebuilds the masthead on every public page to the reviewed spec:
 *
 *   [The Crawl Price Index.]   [Why it matters · Check a domain · Explore · Method]   [Sign in | Full dataset — €49/mo]
 *    ^ hard left                ^ centred, active page underlined                      ^ right, clear separation
 *
 * Naming fixes (4-AI consensus): "Get the Terminal" and "Free dashboard" mean
 * nothing to a first-time visitor. One canonical primary CTA everywhere —
 * "Full dataset — €49/mo" — describing the benefit, not the tier name.
 * "Terminal" survives as the tier name inside the app, never as a button label.
 *
 * Also retires world.html from the nav (ccTLD-as-country framing is
 * inconsistent with the methodology; data lives in the app's Segments tab).
 */
const fs = require("fs");
const DRY = process.argv.includes("--dry");
const DIR = "public";

const APP = "https://app.crawlpriceindex.com";
const BUY = APP + "/dashboard.html#account";

// centre nav: [href, label, matches these filenames]
const NAV = [
  ["/why",         "Why it matters", ["why.html"]],
  ["/check",       "Check a domain", ["check.html"]],
  ["/explore",     "Explore data",   ["explore.html"]],
  ["/methodology", "Method",         ["methodology.html"]],
];

function navFor(file) {
  const links = NAV.map(([href, label, files]) => {
    const active = files.includes(file);
    return '    <a class="lnk' + (active ? " on" : "") + '"' + (active ? ' aria-current="page"' : "") +
           ' href="' + href + '">' + label + '</a>';
  }).join("\n");
  return '<div class="masthead"><div class="wrap">\n' +
    '  <a class="mark" href="/">The Crawl Price Index<b>.</b></a>\n' +
    '  <nav class="navmid">\n' + links + '\n  </nav>\n' +
    '  <div class="navend">\n' +
    '    <a class="lnk signin" href="' + APP + '">Sign in</a>\n' +
    '    <a class="btn" href="' + BUY + '">Full dataset &mdash; &euro;49/mo</a>\n' +
    '  </div>\n' +
    '</div></div>';
}

const files = fs.readdirSync(DIR).filter(f => f.endsWith(".html") && !f.startsWith("_") && f !== "index-v1-backup.html");
let changed = 0, skipped = [];
for (const f of files) {
  const p = DIR + "/" + f;
  let s = fs.readFileSync(p, "utf8");
  const m = s.match(/<div class="masthead"><div class="wrap">[\s\S]*?<\/div><\/div>/);
  if (!m) { skipped.push(f + " (no masthead)"); continue; }
  const next = navFor(f);
  if (m[0] === next) { skipped.push(f + " (already current)"); continue; }
  s = s.replace(m[0], next);
  if (!DRY) { fs.copyFileSync(p, p + ".bak-nav2"); fs.writeFileSync(p, s); }
  changed++;
}

/* CSS for the three-zone layout + active state */
const CSS = `
/* ---- navbar v2: name left · pages centred (active underlined) · actions right ---- */
.masthead .wrap{display:flex;align-items:center;gap:24px}
.masthead .mark{margin-right:auto}
.masthead nav.navmid{display:flex;gap:26px;align-items:center;margin:0 auto}
.masthead .navend{display:flex;gap:18px;align-items:center;margin-left:auto}
.masthead nav.navmid a.lnk.on{color:var(--fg);font-weight:600;box-shadow:inset 0 -2px 0 var(--signal)}
@media(max-width:900px){
  .masthead .wrap{flex-wrap:wrap;gap:12px}
  .masthead nav.navmid{order:3;width:100%;margin:0;gap:18px;overflow-x:auto;padding-bottom:2px;-webkit-overflow-scrolling:touch}
  .masthead nav.navmid a.lnk{white-space:nowrap}
  .masthead .navend{margin-left:auto;gap:12px}
}
@media(max-width:520px){
  .masthead .navend .btn{font-size:12.5px;padding:7px 12px}
}
`;
const T = "public/theme.css";
let t = fs.readFileSync(T, "utf8");
let cssAdded = false;
if (!t.includes("navbar v2")) { if (!DRY) fs.writeFileSync(T, t + CSS); cssAdded = true; }

console.log("NAVBAR v2" + (DRY ? "  [DRY RUN]" : ""));
console.log("  pages rewritten : " + changed + " / " + files.length);
console.log("  theme.css       : " + (cssAdded ? "layout rules added" : "already present"));
if (skipped.length) console.log("  skipped         : " + skipped.join(", "));
console.log("\n  centre nav      : " + NAV.map(n => n[1]).join(" · ") + "   (world.html retired from nav)");
console.log("  right           : Sign in | Full dataset — €49/mo");
if (DRY) console.log("\n  dry run — nothing written. Undo after a real run:");
else console.log("\n  undo:  cd public && for f in *.html.bak-nav2; do mv \"$f\" \"${f%.bak-nav2}\"; done");
