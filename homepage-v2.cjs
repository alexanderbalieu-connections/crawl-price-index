#!/usr/bin/env node
/**
 * CPI — homepage v2  (node homepage-v2.cjs [--dry])
 * ===========================================================================
 * The homepage led with "$0.50 / crawl, n=1" — one observed price, from one
 * domain, via one mechanism — and gave the fold to a speculative calculator,
 * while the census and every strong finding sat below or nowhere. Four
 * independent reviews reached the same verdict. This rebuilds the order.
 *
 *   OUT  "The number" ($0.50, n=1) as the hero credential
 *   OUT  the market-size calculator (moved intact to /estimate)
 *   IN   01 The census        — what we count, with the denominator
 *   IN   02 Training vs traffic — the 14.8:1 asymmetry (was on NO public page)
 *   IN   03 What changed this week — direction of travel, with reversions
 *   IN   04 Declared vs enforced — the 4,902 gap + the ghost frame
 *   IN   05 The machine market — the Bazaar, with $0.50 restored as CONTRAST
 *
 * Every new figure is fetched live from /index.json, so the homepage cannot go
 * stale between editions, and each states its denominator inline. Also fixes a
 * copy-guard violation in the existing trend section ("has trended the same
 * direction: up" is a trend claim on a five-edition series).
 *
 * The inline <script id="data"> payload is left untouched — rebuild.cjs writes
 * into it weekly and the trend chart reads from it.
 */
const fs = require("fs");
const DRY = process.argv.includes("--dry");
const P = "public/index.html";
let s = fs.readFileSync(P, "utf8");
if (s.includes("id=\"v2-census\"")) { console.log("homepage v2 already applied"); process.exit(0); }

const sectionAround = (needle) => {
  const i = s.indexOf(needle);
  if (i < 0) throw new Error("not found: " + needle.slice(0, 50));
  const start = s.lastIndexOf("  <section", i);
  const end = s.indexOf("  </section>", i) + "  </section>".length;
  if (start < 0 || end < 0) throw new Error("section bounds failed for: " + needle.slice(0, 40));
  return { start, end, html: s.slice(start, end) };
};

/* ---------- 1. lift the calculator out ----------------------------------- */
const calc = sectionAround("A sensitivity tool, not a forecast");
// the trailing assume-paragraph section immediately after it
let assumeHtml = "";
const assumeIdx = s.indexOf('<p class="assume" id="assume">', calc.end);
if (assumeIdx > 0 && assumeIdx < s.indexOf("Coverage &amp; method")) {
  const a = sectionAround('<p class="assume" id="assume">');
  assumeHtml = a.html;
}

/* calculator JS: the IIFE that owns PRESETS/calc() */
const jsStart = s.lastIndexOf("(function(){", s.indexOf("var PRESETS="));
const jsEndMark = "})();";
const jsEnd = s.indexOf(jsEndMark, s.indexOf("function apply(name)")) + jsEndMark.length;
if (jsStart < 0 || jsEnd < 0) throw new Error("calculator JS bounds failed");
const calcJs = s.slice(jsStart, jsEnd);

/* ---------- 2. build /estimate.html --------------------------------------- */
const headEnd = s.indexOf("</head>");
const head = s.slice(0, headEnd)
  .replace(/<title>[^<]*<\/title>/, "<title>Estimate the range — The Crawl Price Index</title>")
  .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="A sensitivity tool, not a forecast: explore how a hypothetical annual value for a priced crawl-web depends entirely on assumptions you set. Every number is illustrative.">');
const navStart = s.indexOf('<div class="masthead">');
const navEnd = s.indexOf("</div></div>", navStart) + "</div></div>".length;
const nav = s.slice(navStart, navEnd);
const footStart = s.lastIndexOf("<footer>");
const footEnd = s.indexOf("</footer>", footStart) + "</footer>".length;
const foot = footStart > 0 ? s.slice(footStart, footEnd) : "";
const styleBlock = (s.match(/<style>[\s\S]*?<\/style>/) || [""])[0];

const estimate = head + "</head>\n<body class=\"prose\">\n" + nav + `

<div class="page-open"><div class="wrap">
  <p class="eyebrow">A sensitivity tool, not a forecast</p>
  <h1>What <em>could</em> a priced crawl-web be worth?</h1>
  <p class="lede">Nothing on this page is a measurement. It is a range explorer with no base case: every output depends entirely on assumptions you set, and it predicts nothing. The measured data lives on <a href="/">the index</a> and in <a href="/explore">the free edition</a>.</p>
</div></div>

<div class="wrap"><div class="panels">

${calc.html}
${assumeHtml}

  <section class="panel wide">
    <div class="ix"><span class="lead-in">Why this is separate</span></div>
    <h2>We keep the estimate away from the record.</h2>
    <p>The Crawl Price Index publishes what it observes: declared crawler policy across a ranked 50,000-domain frame, the prices sites actually post, and the advertised asks in a public machine-payment registry. This page does none of that. It multiplies numbers you choose by other numbers you choose, and it is kept on its own page so it can never be mistaken for the census.</p>
    <div class="ctrls" style="margin-top:12px">
      <a class="btn" href="/">See what we actually measure</a>
      <a class="ghost" href="/methodology">Methodology</a>
    </div>
  </section>

</div></div>

` + foot + `
<script>
function $(s){ return document.querySelector(s); }
function $$(s){ return document.querySelectorAll(s); }
` + calcJs + `
</script>
</body></html>`;

/* ---------- 3. new homepage sections -------------------------------------- */
const newSections = `  <section class="panel wide" id="v2-census">
    <div class="ix"><span class="lead-in">The census</span></div>
    <h2>What we count, and what we count it against.</h2>
    <p>Every edition we read the <code>robots.txt</code> of a ranked 50,000-domain frame and record what each domain declares to <b>18 named AI crawlers</b>: blocked, allowed, partial, no instruction, or no file at all. Rates are quoted against the domains that actually serve a readable file &mdash; never against &ldquo;the web&rdquo;.</p>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:18px" id="v2-census-nums">
      <div style="min-width:0"><div class="bignum" style="font-size:clamp(26px,4vw,42px)"><span id="v2-parsed">&mdash;</span></div><div style="font-size:12.5px;color:var(--dim);margin-top:4px">domains serving a readable robots.txt</div></div>
      <div style="min-width:0"><div class="bignum" style="font-size:clamp(26px,4vw,42px)">18</div><div style="font-size:12.5px;color:var(--dim);margin-top:4px">AI crawlers tracked by name</div></div>
      <div style="min-width:0"><div class="bignum" style="font-size:clamp(26px,4vw,42px)"><span id="v2-frame">&mdash;</span></div><div style="font-size:12.5px;color:var(--dim);margin-top:4px">domains in the ranked frame</div></div>
    </div>
    <p style="font-size:11.5px;color:var(--dim);margin-top:14px" id="v2-frameprov">&nbsp;</p>
  </section>

  <section class="panel wide">
    <div class="ix"><span class="lead-in">Training versus traffic</span></div>
    <h2>Sites treat the crawler that <em>trains</em> differently from the one that <em>sends a reader</em>.</h2>
    <p>This is the most economically loaded thing in the dataset, and it does not show up in a headline block rate. A crawler that ingests your work to train a model and a crawler that might send you a visitor are different propositions &mdash; and domains that draw a line overwhelmingly draw it in one direction.</p>
    <div id="v2-asym" style="margin-top:14px"></div>
    <p style="font-size:11.5px;color:var(--dim);margin-top:12px">Declared robots.txt policy only. Role tags describe each crawler&rsquo;s stated function; this is not evidence of intent, and not proof any crawler was denied.</p>
  </section>

  <section class="panel">
    <div class="ix"><span class="lead-in">What changed this week</span></div>
    <h2>Policy is not settled.</h2>
    <div id="v2-changes"></div>
    <p style="font-size:11.5px;color:var(--dim);margin-top:12px">One edition-over-edition comparison, not a trend. Domains entering or leaving the frame are excluded, so frame churn is never counted as a policy change.</p>
  </section>

  <section class="panel">
    <div class="ix"><span class="lead-in">Declared versus enforced</span></div>
    <h2>What a site says and what its front door does.</h2>
    <div id="v2-reach"></div>
    <p style="font-size:11.5px;color:var(--dim);margin-top:12px">A popularity ranking lists domains, not working websites. We census the frame itself so every rate we publish has an honest denominator &mdash; and we keep declared policy and enforced access as separate measurements.</p>
  </section>

  <section class="panel wide">
    <div class="ix"><span class="lead-in">The machine market</span></div>
    <h2>Machines already pay each other. Almost none of it touches the web you read.</h2>
    <p>Alongside the census we capture a public registry of endpoints advertising a price a machine can pay directly, settled in stablecoin. It is a real, working market &mdash; and it is almost entirely developer APIs and tools rather than the sites people visit.</p>
    <div id="v2-bazaar" style="margin-top:14px"></div>
    <p style="font-size:11.5px;color:var(--dim);margin-top:12px">Advertised, opt-in acceptance in a public registry &mdash; never transactions, volume or revenue. This is a stablecoin rail, distinct from Cloudflare pay-per-crawl, though both return HTTP 402.</p>
  </section>

`;

/* ---------- 4. transform the homepage ------------------------------------ */
// remove the calculator + assume sections
s = s.replace(calc.html, "");
if (assumeHtml) s = s.replace(assumeHtml, "");
s = s.replace(calcJs, "");

// replace "The number" hero-credential section with the new block
const num = sectionAround('<span class="lead-in">The number</span>');
s = s.replace(num.html, newSections.trimEnd());

// fix the trend-claim in "The wall is rising"
s = s.replace(
  `<p>Each edition, more of the web disallows AI crawlers in robots.txt. The series is young, but every crawler we track has trended the same direction: up. This accumulating history is the part a competitor who starts later cannot reconstruct.</p>`,
  `<p>Each edition we record the declared block rate for every tracked crawler and archive it. The series is short &mdash; five editions &mdash; so this chart shows movement between editions, not a trend, and we do not describe it as one anywhere on this site. The archive is the part a later entrant cannot reconstruct: a week not measured is gone.</p>`);

// hero lede: lead with the census, keep the observed price as a later contrast
s = s.replace(
  `<p class="lede">Every edition we read the crawler policy of the top <span id="lede-topn">50,000</span> domains and record what they charge, block, or allow. Block rates are widely reported. Observed prices are not &mdash; that is the record we keep.</p>`,
  `<p class="lede">Every edition we read the declared crawler policy of a ranked <span id="lede-topn">50,000</span>-domain frame, one domain at a time, and write down what each tells <b>18 named AI crawlers</b>. Independent, weekly, and denominator-first &mdash; every figure here states what it is a share of.</p>`);

// add a link to the relocated calculator in the footer nav area
s = s.replace(`<a href="/methodology">methodology</a>`, `<a href="/methodology">methodology</a> &middot; <a href="/estimate">estimate the range</a>`);

/* ---------- 5. the live loader for the new sections ----------------------- */
const loader = `
<script id="v2-loader">
// Homepage v2 sections read the published feed, so they refresh with each edition.
(function(){
  var n = function(x){ return Number(x).toLocaleString(); };
  var row = function(label, value, note){
    return '<div style="display:flex;justify-content:space-between;gap:14px;padding:7px 0;border-bottom:1px solid var(--line)">' +
      '<span style="min-width:0">' + label + (note ? '<br><span style="font-size:11.5px;color:var(--dim)">' + note + '</span>' : '') + '</span>' +
      '<span style="font-family:var(--mono,ui-monospace,monospace);white-space:nowrap;font-weight:600">' + value + '</span></div>';
  };
  fetch("/index.json", {cache:"no-store"}).then(function(r){return r.json();}).then(function(d){
    var set = function(id, v){ var e = document.getElementById(id); if (e) e.textContent = v; };
    if (d.coverage) { set("v2-parsed", n(d.coverage.robots_parsed)); set("v2-frame", n(d.coverage.tranco_top_n)); }

    var F = d.frame_provenance, fp = document.getElementById("v2-frameprov");
    if (F && fp) fp.innerHTML = "Frame: <b>" + F.name + "</b> — a custom " + F.source + " list (" +
      F.inputs.join(" + ") + "), deliberately excluding " + F.excluded_inputs.join(" and ") +
      " so no non-commercial or share-alike source sits under a dataset we sell. " +
      '<a href="' + F.permalink + '" rel="noopener">Permalink</a> · <a href="/methodology">method</a>.';

    var A = d.asymmetry_headline, ae = document.getElementById("v2-asym");
    if (A && ae) ae.innerHTML =
      row("Blocks a <b>training</b> crawler, blocks no search crawler", n(A.blocks_training_role_only)) +
      row("Blocks a <b>search</b> crawler, blocks no training crawler", n(A.blocks_search_role_only)) +
      row("<b>Ratio</b>", "<b>" + A.ratio + " to 1</b>", "of " + n(A.denominator) + " domains serving a readable robots.txt");

    var C = d.changes_headline, ce = document.getElementById("v2-changes");
    if (C && ce) ce.innerHTML =
      row("Moved toward restriction", n(C.more_restrictive)) +
      row("Moved away from restriction", n(C.less_restrictive)) +
      row("Moved <b>off</b> an explicit block", "<b>" + n(C.moved_off_a_block) + "</b>", "deliberate edits — the highest-signal rows") +
      '<p style="font-size:12px;color:var(--dim);margin:10px 0 0">' + n(C.total) + ' domain×crawler changes across ' + n(C.domains_changed) + ' domains, ' + C.interval + '.</p>';

    var R = d.reachability_headline, re = document.getElementById("v2-reach");
    if (R && re) {
      var pc = function(x){ return (x / R.frame * 100).toFixed(1) + "%"; };
      re.innerHTML =
        row("Serves robots.txt, then refuses an identified crawler <br>at the homepage (403/429)", "<b>" + n(R.bot_walled) + "</b>", "declared policy and enforced access diverging — " + pc(R.bot_walled) + " of the frame") +
        row("Name no longer resolves", n(R.dead_dns), pc(R.dead_dns) + " of the ranked frame is gone from the web") +
        row("Disallow our crawler — we obey", n(R.disallowed_our_crawler), "excluded by their own instruction");
    }

    var B = d.bazaar_headline, be = document.getElementById("v2-bazaar");
    if (B && be) {
      var obs = (d.observed_prices_headline && d.observed_prices_headline[0] && d.observed_prices_headline[0].raw) || "";
      be.innerHTML =
        row("Endpoints advertising a machine-payable price", n(B.endpoints_real_priced), "across " + n(B.distinct_pay_to_addresses) + " distinct pay-to addresses") +
        row("Median advertised ask", "$" + B.median_advertised_usd, "the going rate a machine is asked to pay") +
        row("Of our 50,000 ranked domains, how many take part", "<b>" + n(B.in_frame_domains) + "</b>", (B.in_frame_content != null ? n(B.in_frame_content) + " of them serving content" : "")) +
        (obs ? '<p style="font-size:12.5px;color:var(--dim);margin:12px 0 0">For contrast, the human web has produced exactly <b>one</b> posted per-crawl price in our hand-probed exhibit set — <span style="font-family:ui-monospace,monospace">' + obs + '</span>. One posted price, n=1, from a non-random panel; against a machine market with a $' + B.median_advertised_usd + ' median. Different mechanisms, and the gap is the point.</p>' : "");
    }
  }).catch(function(){});
})();
</script>
`;
const bodyClose = s.lastIndexOf("</body>");
s = bodyClose > 0 ? s.slice(0, bodyClose) + loader + s.slice(bodyClose) : s + loader;

/* ---------- write ---------------------------------------------------------- */
if (DRY) {
  console.log("[DRY RUN]");
  console.log("  calculator HTML lifted : " + calc.html.length + " bytes" + (assumeHtml ? " (+ assume block " + assumeHtml.length + ")" : ""));
  console.log("  calculator JS lifted   : " + calcJs.length + " bytes");
  console.log("  /estimate.html would be: " + estimate.length + " bytes");
  console.log("  index.html would be    : " + s.length + " bytes");
  process.exit(0);
}
fs.copyFileSync(P, P + ".bak-v2");
fs.writeFileSync("public/estimate.html", estimate);
fs.writeFileSync(P, s);
console.log("homepage v2 applied");
console.log("  /estimate.html written (" + (estimate.length / 1024).toFixed(1) + " KB) — calculator moved intact");
console.log("  index.html " + (fs.statSync(P).size / 1024).toFixed(1) + " KB");
console.log("  new sections: census · training-vs-traffic · what changed · declared-vs-enforced · machine market");
console.log("  undo: mv public/index.html.bak-v2 public/index.html && rm public/estimate.html");
