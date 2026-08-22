#!/usr/bin/env node
/**
 * CPI — remove the revenue estimator from check.html
 * ===========================================================================
 * "Step 2 · the honest revenue estimate" returned a SUGGESTED PRICE BAND for a
 * named domain ("our judgment") plus projected monthly revenue. However careful
 * its disclaimers, it made CPI an advisor to the domains it measures — and
 * check.html is the first surface a publisher touches. An observatory does not
 * tell the observed what to charge.
 *
 * Removes the #est card outright, renumbers the remaining steps, strips the now
 * orphaned JS (price band, revenue projection, the tier-band table), and fixes
 * the stale "53 country editions" upsell line in the same pass.
 *
 * Kept: the policy fingerprint (Step 1), the change-watch signup, and the setup
 * files — those are measurement and tooling, not advice. The setup step keeps a
 * price INPUT, because the user chooses their own number; we no longer suggest one.
 */
const fs = require("fs");
const P = "public/check.html";
let s = fs.readFileSync(P, "utf8");
if (!s.includes('id="est"')) { console.log("already removed"); process.exit(0); }
fs.copyFileSync(P, P + ".bak-revenue");
const before = s.length;

/* ---- 1. remove the whole #est card -------------------------------------- */
const start = s.indexOf('  <div class="card" id="est">');
if (start < 0) throw new Error("#est card not found");
const endMarker = '  <div class="card hide" id="watch">';
const end = s.indexOf(endMarker, start);
if (end < 0) throw new Error("end boundary (#watch) not found");
s = s.slice(0, start) + s.slice(end);

/* ---- 2. renumber the remaining steps ------------------------------------ */
s = s.split('<div class="k">Step 3 · get told when this changes</div>')
     .join('<div class="k">Step 2 &middot; get told when this changes</div>');
s = s.split('<div class="k">Step 3 · start charging in one afternoon</div>')
     .join('<div class="k">Step 3 &middot; publish your own terms</div>');

/* ---- 3. strip orphaned JS ------------------------------------------------ */
const jsKills = [
  /\n\s*function tierBand\([\s\S]*?\n\s*\}\n/,          // the suggested-band table
  /\n\s*var band = tierBand\([^)]*\);[\s\S]*?\$\("pr"\)\.value = band\.def;\n/g,
  /\n\s*\$\("bandtxt"\)\.textContent = band\.txt;[^\n]*\n/g,
];
for (const re of jsKills) s = s.replace(re, "\n");

/* ---- 4. copy fixes ------------------------------------------------------- */
const copy = [
  // stale + banned framing in the upsell
  [`Want every domain's row, 53 country editions and the API? <a href="https://app.crawlpriceindex.com/dashboard.html#account">Terminal — €49/mo</a>.`,
   `Want every domain&rsquo;s row, suffix-group detail and weekly history? <a href="https://app.crawlpriceindex.com/dashboard.html#account">Full dataset &mdash; &euro;49/mo</a>.`],
  // the setup step framing: from "start charging" to "declare your terms"
  [`<li><b>Everyone</b>: declare machine-readable terms with <a href="https://rslstandard.org" rel="noopener">RSL</a> and robots.txt so your price and policy are visible to every compliant crawler. Paste the two files below — generated for <span class="mono" id="setdom">your domain</span> at your chosen price.</li>`,
   `<li><b>Everyone</b>: declare machine-readable terms with <a href="https://rslstandard.org" rel="noopener">RSL</a> and robots.txt so your policy is visible to every compliant crawler. Paste the two files below &mdash; generated for <span class="mono" id="setdom">your domain</span> at whatever price <em>you</em> choose. We do not suggest a number: we measure what sites declare, we do not advise what they should charge.</li>`],
];
let c = 0;
for (const [a, b] of copy) { if (s.includes(a)) { s = s.split(a).join(b); c++; } else console.log("  MISS copy: " + a.slice(0, 60)); }

fs.writeFileSync(P, s);
console.log("revenue estimator removed from check.html");
console.log("  bytes: " + before + " -> " + s.length + "  (-" + (before - s.length) + ")");
console.log("  steps renumbered; orphaned band/projection JS stripped; " + c + "/" + copy.length + " copy fixes");
console.log("  remaining ids: " + ["est", "watch", "setup"].map(id => id + "=" + s.includes('id="' + id + '"')).join(" "));
