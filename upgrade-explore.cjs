#!/usr/bin/env node
/**
 * CPI — explore.html upgrade  (node upgrade-explore.cjs)
 * ===========================================================================
 * Replaces the "ccTLD extremes" card — the last suffix-as-country framing on
 * a public page, and the weakest content on it — with two cards built from
 * the newly published feed keys:
 *
 *   "Is the ranked web even alive?"   reachability census (measured)
 *   "Training versus traffic"          the 14.8:1 asymmetry (the strongest
 *                                      single finding, previously invisible
 *                                      anywhere on the marketing site)
 *
 * Both read live values from /index.json, so they never go stale, and both
 * state their denominator inline. Suffix-group data keeps a pointer to the
 * dashboard's Segments tab, which carries the full caveat architecture.
 */
const fs = require("fs");
const P = "public/explore.html";
let s = fs.readFileSync(P, "utf8");
if (s.includes("even alive")) { console.log("already upgraded"); process.exit(0); }
fs.copyFileSync(P, P + ".bak-explore");

/* ---- 1. the card markup ------------------------------------------------- */
const oldCard = `      <div class="card" style="margin-top:22px">
        <h2>ccTLD extremes</h2>
        <div class="hint">Share of each ccTLD group's sites blocking at least one AI crawler. A suffix is not a country.</div>
        <div id="cty"></div>
        <div style="margin-top:12px"><a class="lnk" href="/world" style="font-size:13.5px;color:var(--signal)">All ccTLD editions →</a></div>`;
const newCard = `      <div class="card" style="margin-top:22px">
        <h2>Training versus traffic</h2>
        <div class="hint">Crawlers that train a model and crawlers that send a reader are different propositions &mdash; and domains treat them differently.</div>
        <div id="asym"></div>
        <div style="margin-top:12px"><a class="lnk" href="https://app.crawlpriceindex.com" style="font-size:13.5px;color:var(--signal)">Per-vendor breakdown in the dashboard &rarr;</a></div>
      </div>

      <div class="card" style="margin-top:22px">
        <h2>Is the ranked web even alive?</h2>
        <div class="hint">A popularity ranking lists domains, not working websites. We census the frame itself, so every rate we publish has an honest denominator.</div>
        <div id="reach"></div>
        <div style="margin-top:12px"><a class="lnk" href="/methodology" style="font-size:13.5px;color:var(--signal)">How we measure this &rarr;</a></div>
      </div>

      <div class="card" style="margin-top:22px">
        <h2>Suffix groups</h2>
        <div class="hint">Block rates grouped by domain suffix. A suffix is not a country: it does not indicate operator location, ownership, audience or hosting &mdash; so this cut lives in the dashboard, where the caveats travel with the numbers.</div>
        <div style="margin-top:12px"><a class="lnk" href="https://app.crawlpriceindex.com" style="font-size:13.5px;color:var(--signal)">Open Segments in the dashboard &rarr;</a></div>`;
if (!s.includes(oldCard)) throw new Error("ccTLD card markup not found");
s = s.replace(oldCard, newCard);

/* ---- 2. the renderer ---------------------------------------------------- */
const oldJs = `  // country
  const ch = d.cctld_headline || d.country_headline||{};
  const row = (o,label)=> o? '<div class="cty"><span><span class="c">'+o.cctld||o.country+'</span><span class="n">n='+o.n+'</span></span><span class="p">'+o.any_ai_block_pct+'%</span></div>':'';
  document.getElementById("cty").innerHTML = row(ch.most_blocking,"most") + row(ch.least_blocking,"least");`;
const newJs = `  // training vs traffic — the asymmetry
  const A = d.asymmetry_headline;
  if (A && document.getElementById("asym")) {
    document.getElementById("asym").innerHTML =
      '<div class="cty"><span><span class="c">Blocks a training crawler, no search crawler</span></span><span class="p">' + A.blocks_training_role_only.toLocaleString() + '</span></div>' +
      '<div class="cty"><span><span class="c">Blocks a search crawler, no training crawler</span></span><span class="p">' + A.blocks_search_role_only.toLocaleString() + '</span></div>' +
      '<div class="cty"><span><span class="c"><b>Ratio</b></span></span><span class="p"><b>' + A.ratio + ' to 1</b></span></div>' +
      '<div class="hint" style="margin-top:8px">Of ' + A.denominator.toLocaleString() + ' domains with a readable robots.txt in the current frame. Declared policy only &mdash; not evidence of intent, and not proof any crawler was denied.</div>';
  }

  // frame reachability
  const R = d.reachability_headline;
  if (R && document.getElementById("reach")) {
    const pc = n => (n / R.frame * 100).toFixed(1) + '%';
    document.getElementById("reach").innerHTML =
      '<div class="cty"><span><span class="c">Answered our crawler</span></span><span class="p">' + R.alive.toLocaleString() + ' &middot; ' + pc(R.alive) + '</span></div>' +
      '<div class="cty"><span><span class="c">Name does not resolve</span></span><span class="p">' + R.dead_dns.toLocaleString() + ' &middot; ' + pc(R.dead_dns) + '</span></div>' +
      '<div class="cty"><span><span class="c">No response in our window</span></span><span class="p">' + R.timeout.toLocaleString() + ' &middot; ' + pc(R.timeout) + '</span></div>' +
      '<div class="cty"><span><span class="c">Serves robots.txt, refuses the homepage (403/429)</span></span><span class="p">' + R.bot_walled.toLocaleString() + ' &middot; ' + pc(R.bot_walled) + '</span></div>' +
      '<div class="hint" style="margin-top:8px">Of the ' + R.frame.toLocaleString() + '-domain frame. The last row is a declared-versus-enforced divergence, not a robots.txt policy &mdash; it is never folded into a block rate.</div>';
  }`;
if (!s.includes(oldJs)) throw new Error("ccTLD renderer not found");
s = s.replace(oldJs, newJs);

/* ---- 3. page copy that referenced the retired cut ----------------------- */
const copy = [
  [`content="Explore this week's AI-crawler policy data: block rates by crawler, the observed price, and ccTLD extremes. Free headline tier.">`,
   `content="Explore this week's AI-crawler policy data: block rates by crawler, the training-versus-traffic asymmetry, and a census of which ranked domains are still alive. Free headline tier.">`],
  [`This week's headline figures, live from the latest edition. Filter the crawlers, read the one observed price, see the ccTLD extremes. Per-domain detail is in the Terminal.`,
   `This week's headline figures, live from the latest edition. Filter the crawlers, read the one observed price, and see how the frame itself measures up. Per-domain detail is in the full dataset.`],
  [`<p id="gatetext">Every domain × every crawler, every ccTLD group, the full price and wall-behaviour record, and week-over-week history — with JSON/CSV API.</p>`,
   `<p id="gatetext">Every domain &times; every crawler, suffix-group detail, the full price and wall-behaviour record, and week-over-week history &mdash; exportable as CSV.</p>`],
];
let c = 0;
for (const [a, b] of copy) { if (s.includes(a)) { s = s.split(a).join(b); c++; } else console.log("  MISS copy: " + a.slice(0, 60)); }

fs.writeFileSync(P, s);
console.log("explore.html upgraded: ccTLD extremes -> asymmetry + reachability + Segments pointer (" + c + "/" + copy.length + " copy fixes)");
