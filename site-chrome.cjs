#!/usr/bin/env node
/**
 * CPI — shared site chrome  (node site-chrome.cjs [--dry])
 * ===========================================================================
 * One navbar and one footer, generated for every public page.
 *
 * NAV   name hard left · pages centred (active underlined) · right: Sign in
 *       (now a bordered box, matching the primary CTA's weight) + the CTA.
 *       "About" joins the centre nav — a named human is part of the
 *       independence claim, not an afterthought in a footer.
 *
 * FOOT  Previously a single grey line of links. Now the closing pitch, on
 *       every page, built around the line from /why that already does this
 *       job: "The market is being built now. The record starts now too."
 *       Three things a visitor can do — read the free edition, get the weekly
 *       email (with the input right there), or buy the full dataset — then the
 *       link rows and the independence statement.
 *
 * The email form posts to the same endpoint as the homepage box; ids are
 * suffixed per-page so two forms on one page cannot collide.
 */
const fs = require("fs");
const DRY = process.argv.includes("--dry");
const DIR = "public";
const APP = "https://app.crawlpriceindex.com";
const BUY = APP + "/dashboard.html#account";

const NAV = [
  ["/why", "Why it matters", ["why.html"]],
  ["/check", "Check a domain", ["check.html"]],
  ["/explore", "Explore data", ["explore.html"]],
  ["/methodology", "Method", ["methodology.html"]],
  ["/about", "About", ["about.html"]],
];

const navFor = f => '<div class="masthead"><div class="wrap">\n' +
  '  <a class="mark" href="/">The Crawl Price Index<b>.</b></a>\n' +
  '  <nav class="navmid">\n' +
  NAV.map(([h, l, files]) => {
    const on = files.includes(f);
    return '    <a class="lnk' + (on ? " on" : "") + '"' + (on ? ' aria-current="page"' : "") + ' href="' + h + '">' + l + '</a>';
  }).join("\n") +
  '\n  </nav>\n  <div class="navend">\n' +
  '    <a class="btn ghostbox" href="' + APP + '">Sign in</a>\n' +
  '    <a class="btn" href="' + BUY + '">Full dataset &mdash; &euro;49/mo</a>\n' +
  '  </div>\n</div></div>';

const footFor = f => {
  const id = f.replace(/\.html$/, "").replace(/[^a-z0-9]/gi, "") || "home";
  return `<footer class="sitefoot"><div class="wrap">
  <div class="footlede">
    <h2>The market is being built now. The record starts <em>now</em> too.</h2>
    <p>A week that isn&rsquo;t measured is gone &mdash; no one can reconstruct it later, including us. Every edition is archived the day it is taken.</p>
  </div>

  <div class="footgrid">
    <div class="footcard">
      <div class="fk">Free</div>
      <h3>The free edition</h3>
      <p>Headline figures, the aggregate dashboard and every denominator behind them. Free to cite with attribution.</p>
      <a class="btn ghostbox" href="${APP}">Open the free edition</a>
    </div>

    <div class="footcard">
      <div class="fk">Free &middot; weekly</div>
      <h3>The Weekly Crawl</h3>
      <p>One email a week: what changed, which way it moved, and the week&rsquo;s figures with their denominators. No forecasts.</p>
      <form class="footform" onsubmit="return cpiSubFoot(event,'${id}')">
        <input id="fsub-${id}" type="email" required autocomplete="email" placeholder="you@company.com">
        <button class="btn" type="submit">Get it weekly</button>
      </form>
      <p class="fmsg" id="fmsg-${id}"></p>
    </div>

    <div class="footcard">
      <div class="fk">&euro;49/mo</div>
      <h3>The full dataset</h3>
      <p>Every domain &times; every tracked crawler, weekly history, the change feed and CSV export. One-off snapshot &euro;29.</p>
      <a class="btn" href="${BUY}">Full dataset &mdash; &euro;49/mo</a>
    </div>
  </div>

  <div class="footlinks">
    <div><b>Index</b><a href="/">This edition</a><a href="/explore">Explore data</a><a href="/check">Check a domain</a><a href="/world">Suffix groups</a><a href="/estimate">Estimate the range</a></div>
    <div><b>Method</b><a href="/methodology">Methodology</a><a href="/status">Status &amp; coverage</a><a href="/changelog">Changelog</a><a href="/sample">Free sample</a></div>
    <div><b>Project</b><a href="/about">About</a><a href="/why">Why it matters</a><a href="mailto:hello@crawlpriceindex.com">Contact</a></div>
    <div><b>Legal</b><a href="/terms">Terms &amp; data licence</a><a href="/privacy">Privacy</a><a href="/security">Security</a></div>
  </div>

  <div class="footbase">
    <span>THE CRAWL PRICE INDEX &middot; independent observatory of the machine-readable web</span>
    <span>Funded by subscriptions only &mdash; no money from any company in this dataset.</span>
  </div>
</div></footer>
<script>
function cpiSubFoot(e,id){
  e.preventDefault();
  var m=document.getElementById('fmsg-'+id), i=document.getElementById('fsub-'+id);
  var em=(i&&i.value||'').trim(); if(!em) return false;
  m.style.color='var(--dim)'; m.textContent='Signing you up…';
  fetch('https://api.crawlpriceindex.com/v1/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:em})})
    .then(function(r){return r.json();})
    .then(function(j){m.style.color='var(--signal)';m.textContent=(j&&j.message)||'You are in — check your inbox for the free sample.';i.value='';})
    .catch(function(){m.style.color='#A33A2A';m.textContent='Something went wrong — try again in a moment.';});
  return false;
}
</script>`;
};

const CSS = `
/* ---- sign-in as a bordered box, matching the CTA's weight ---- */
.masthead .navend .btn.ghostbox{background:#fff;color:var(--fg);border:1px solid var(--line)}
.masthead .navend .btn.ghostbox:hover{border-color:var(--signal);color:var(--signal)}

/* ---- shared site footer ---- */
.sitefoot{border-top:1px solid var(--line);background:var(--sand);margin-top:56px;padding:48px 0 28px;font-family:var(--sans)}
.sitefoot .footlede{max-width:760px;margin-bottom:30px}
.sitefoot .footlede h2{font-family:var(--serif);font-weight:400;font-size:clamp(24px,3.4vw,36px);line-height:1.15;margin:0 0 10px;color:var(--fg)}
.sitefoot .footlede h2 em{font-style:italic;color:var(--signal)}
.sitefoot .footlede p{margin:0;color:var(--dim);font-size:14px;max-width:60ch}
.footgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:34px}
.footcard{background:#fff;border:1px solid var(--line);border-radius:4px;padding:20px;display:flex;flex-direction:column;min-width:0}
.footcard .fk{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--signal);font-weight:600;margin-bottom:8px}
.footcard h3{font-family:var(--serif);font-weight:400;font-size:19px;margin:0 0 8px;color:var(--fg)}
.footcard p{font-size:13px;color:var(--dim);margin:0 0 14px;line-height:1.5;flex:1}
.footcard .btn,.footcard .btn.ghostbox{align-self:flex-start}
.footform{display:flex;gap:8px;flex-wrap:wrap}
.footform input{flex:1;min-width:150px;padding:9px 11px;border:1px solid var(--line);border-radius:2px;background:#fff;font-size:13.5px;color:var(--fg)}
.footform input:focus{outline:none;border-color:var(--signal);box-shadow:0 0 0 3px rgba(28,93,74,.12)}
.fmsg{font-size:12px;color:var(--dim);margin:8px 0 0;min-height:1em}
.footlinks{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;padding-top:26px;border-top:1px solid var(--line)}
.footlinks div{display:flex;flex-direction:column;gap:6px;min-width:0}
.footlinks b{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--fg);margin-bottom:2px}
.footlinks a{font-size:13px;color:var(--dim);text-decoration:none}
.footlinks a:hover{color:var(--signal)}
.footbase{display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-top:26px;padding-top:16px;border-top:1px solid var(--line);font-size:11.5px;color:var(--dim);letter-spacing:.02em}
@media(max-width:860px){.footgrid{grid-template-columns:1fr}.footlinks{grid-template-columns:1fr 1fr}}
`;

/* ---------- apply ---------------------------------------------------------- */
const files = fs.readdirSync(DIR).filter(f => f.endsWith(".html") && !f.startsWith("_"));
let navN = 0, footN = 0;
for (const f of files) {
  const p = DIR + "/" + f;
  let s = fs.readFileSync(p, "utf8");
  const before = s;

  const m = s.match(/<div class="masthead"><div class="wrap">[\s\S]*?<\/div><\/div>/);
  if (m) { const n = navFor(f); if (m[0] !== n) { s = s.replace(m[0], n); navN++; } }

  // replace any existing footer (old one-liner or a previous generated one)
  const fm = s.match(/<footer[\s\S]*?<\/footer>\s*(?:<script>\s*function cpiSubFoot[\s\S]*?<\/script>)?/);
  const nf = footFor(f);
  if (fm) { s = s.replace(fm[0], nf); footN++; }
  else { const bc = s.lastIndexOf("</body>"); if (bc > 0) { s = s.slice(0, bc) + nf + "\n" + s.slice(bc); footN++; } }

  if (s !== before && !DRY) { fs.copyFileSync(p, p + ".bak-chrome"); fs.writeFileSync(p, s); }
}

const T = DIR + "/theme.css";
let t = fs.readFileSync(T, "utf8");
let cssAdded = false;
if (!t.includes("shared site footer")) { if (!DRY) fs.writeFileSync(T, t + CSS); cssAdded = true; }

console.log("SITE CHROME" + (DRY ? "  [DRY RUN]" : ""));
console.log("  pages           : " + files.length);
console.log("  navs rewritten  : " + navN + "   (Sign in now a bordered box; About added to centre nav)");
console.log("  footers applied : " + footN + "   (3-card closing block + link columns + independence line)");
console.log("  theme.css       : " + (cssAdded ? "chrome styles added" : "already present"));
if (!DRY) console.log("\n  undo: cd public && for f in *.html.bak-chrome; do mv \"$f\" \"${f%.bak-chrome}\"; done");
