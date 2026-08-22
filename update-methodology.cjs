#!/usr/bin/env node
/**
 * CPI — methodology.html update  (node update-methodology.cjs)
 * ===========================================================================
 * methodology.html is the credibility anchor and the de-facto sales document
 * for policy/legal and data-licensing buyers. As of the frame cutover it is
 * factually wrong: it describes the default Tranco list, says nothing about
 * the measured reachability census, and predates the site-evidence signals.
 *
 * This rewrites three things and adds one section:
 *   1. Frame        -> CPI-50K v1, with the excluded providers and WHY
 *   2. Reached/parsed -> the real measured census, not "about 28,000"
 *   3. NEW: Frame reachability + declared-versus-enforced
 *   4. NEW: Site-evidence signals (observations, never classifications)
 * Every number is measured; each states its denominator.
 */
const fs = require("fs");
const P = "public/methodology.html";
let s = fs.readFileSync(P, "utf8");
if (s.includes("CPI-50K v1")) { console.log("already updated"); process.exit(0); }
fs.copyFileSync(P, P + ".bak-method");

/* ---- 1. Frame bullet ---------------------------------------------------- */
const oldFrame = `  <li><b>Frame:</b> the Tranco top 50,000 (a research ranking that aggregates several sources and resists manipulation), plus an identity-matrix panel of ~90 domains (a fixed spine, plus domains promoted from the wide probe, plus a rotating audit — see above).</li>`;
const newFrame = `  <li><b>Frame &mdash; CPI-50K v1:</b> the top 50,000 domains of a <b>custom Tranco list</b> (<a href="https://tranco-list.eu/list/Y8V2G">tranco-list.eu/list/Y8V2G</a>, generated 21 August 2026; 30-day window, harmonic/Dowdall combination, pay-level domains). It is built from <b>Cisco Umbrella and Majestic only</b>. We deliberately exclude two providers the default Tranco list includes: <b>Cloudflare Radar</b> (CC BY-NC &mdash; a non-commercial licence, and this is a paid dataset) and the <b>Chrome User Experience Report</b> (CC BY-SA &mdash; a share-alike licence that could attach to data we redistribute). Excluding them is a licensing decision, and it also measurably improved the frame: non-website entries in the top 100 fell from 18% to 2%, because Radar ranks by DNS lookups and machines resolve names constantly without anyone visiting a site. We remove reverse-DNS zones (<code>*.in-addr.arpa</code>, 167 rows) and nothing else &mdash; CDN, cloud and parked domains stay in, because how much of a popularity ranking is not a website is a finding, not a defect to hide. Full provenance, including every removed row, is published in <code>frame-cpi50k-v1.json</code>. Alongside the frame we run an identity-matrix panel of ~90 domains (see above).</li>`;

/* ---- 2. Reached vs parsed ---------------------------------------------- */
const oldReach = `  <li><b>Reached vs parsed:</b> the Tranco list ranks registrable domains, not working websites. A large share never answer — no DNS record, refused connections, dead TLS, or a timeout on both the bare domain and its <code>www</code> host. Of the 50,000-domain frame, about 28,000 serve a readable <code>robots.txt</code> — that parsed count is the denominator behind every rate we publish, and it is the same figure the dashboard uses. The rest either never answer (no DNS, refused, dead TLS, timeout) or serve no readable file; each is itemised by reason in a separate census. We never quote a rate as a share of “the web”. One finding falls straight out of it: a meaningful share of the busiest sites return an HTTP error to a crawler simply asking for their public <code>robots.txt</code>.</li>`;
const newReach = `  <li><b>Reached vs parsed:</b> a popularity ranking lists registrable domains, not working websites. <b>27,975</b> of the 50,000-domain frame serve a readable <code>robots.txt</code>; that parsed count is the denominator behind every rate we publish, and it is the same figure the dashboard uses. We never quote a rate as a share of &ldquo;the web&rdquo;. The remainder is not a rounding error and we census it explicitly &mdash; see <b>Frame reachability</b> below.</li>`;

/* ---- 3+4. new sections, inserted before Known limitations --------------- */
const anchor = `<section class="panel wide">
  <div class="ix"><span class="lead-in">Known limitations</span></div>`;
const newSections = `<section class="panel wide">
  <div class="ix"><span class="lead-in">Frame reachability</span></div>
  <h2>Frame reachability &mdash; and declared versus enforced</h2>
<p>A ranked list keeps domains long after the website behind them stops answering. Because every rate we publish carries a denominator, we measure that directly rather than assume it. Each week we attempt <code>robots.txt</code> and the homepage for all 50,000 domains, trying the apex over HTTPS, then <code>www</code>, then HTTP, and record the outcome by reason. Measured 20 August 2026 across the full frame:</p>
<ul>
  <li><b>40,272 (80.5%) alive</b> &mdash; answered an identified crawler.</li>
  <li><b>6,318 (12.6%) dead</b> &mdash; the name does not resolve at all.</li>
  <li><b>3,046 (6.1%) no response</b> within our window. We re-probed a random sample of 337 of these with a window tripled to 25 seconds plus a retry after a cool-down: <b>93.8% stayed silent</b>, so this bucket is overwhelmingly genuinely unreachable rather than an artefact of an impatient crawler. 3.0% turned out to be servers that silently drop a first request and return 403/429 on a second; they are reclassified as refused rather than dead.</li>
  <li><b>~360</b> refused connections, connection resets or TLS failures.</li>
</ul>
<p><b>Declared policy and enforced access are different measurements, and we keep them apart.</b> <b>4,902 domains (9.8% of the frame)</b> serve a <code>robots.txt</code> and then return <b>403 or 429</b> to the same identified crawler at the homepage. That is a divergence between what a site declares to crawlers and what its edge actually does. It is not a robots.txt policy, it is not evidence of intent, and it is never folded into a block rate. A further <b>1,286 domains disallow our crawler in robots.txt</b>; we obey, we do not fetch their homepage, and they are recorded as excluded by their own instruction &mdash; a publisher of a compliance index does not get to make exceptions for itself.</p>
<p class="foot">Timeout is defined as no response within 8 seconds, with a 22-second absolute ceiling per domain. Thresholds are stated because the choice changes the answer.</p>

</section>
<section class="panel wide">
  <div class="ix"><span class="lead-in">Site-evidence signals</span></div>
  <h2>Site-evidence signals &mdash; observations, not classifications</h2>
<p>Alongside <code>robots.txt</code> we record a small set of <b>self-declared</b> signals a domain serves publicly on its own homepage. These are facts about observable artefacts, dated and attributable, in the same spirit as reading a <code>robots.txt</code>. Measured across the full frame on 20 August 2026:</p>
<ul>
  <li><b>10,326</b> serve schema.org JSON-LD type declarations.</li>
  <li><b>9,637</b> publish an <code>ads.txt</code> file &mdash; an IAB standard declaring authorised digital sellers.</li>
  <li><b>7,515</b> carry an identifiable platform or CMS fingerprint.</li>
  <li><b>4,498</b> advertise an RSS or Atom feed.</li>
  <li>In total, <b>39.4%</b> of the frame carries at least one such signal.</li>
</ul>
<p><b>What we do not do with them.</b> We publish what a domain declared and when we observed it &mdash; never an inferred label about what kind of organisation it is. We do not publish machine-generated category guesses. We do not publish inferred labels in sensitive categories. Where a site declares an adult content rating (RTA or an equivalent meta tag), that is reported only in aggregate, never as a per-domain field. Absence of a signal means we did not observe one; it is not evidence that the thing is absent.</p>

` + anchor;

const subs = [[oldFrame, newFrame], [oldReach, newReach], [anchor, newSections]];
let n = 0;
for (const [a, b] of subs) {
  if (s.includes(a)) { s = s.replace(a, b); n++; }
  else console.log("  MISS: " + a.slice(0, 70).replace(/\n/g, " "));
}
fs.writeFileSync(P, s);
console.log(n + "/" + subs.length + " methodology updates applied");
