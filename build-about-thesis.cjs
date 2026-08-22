#!/usr/bin/env node
/**
 * CPI — /about (the person behind it) + the thesis section on /why
 * ===========================================================================
 * Two gaps the review flagged indirectly: nothing on the site says who runs it,
 * and nothing states WHY this data deserves to exist. Independence is claimed
 * but never embodied by a named human; the census is measured but never argued.
 *
 * about.html      — named founder, stated background, LinkedIn, funding model,
 *                   and the conflicts we do and don't have. Photo optional:
 *                   drop public/alex.jpg in and it appears automatically.
 * why.html        — a new "The thesis" section, stated as an ARGUMENT and
 *                   explicitly falsifiable: what we believe, the measured
 *                   evidence, and what would prove us wrong. Numbers are read
 *                   live from /index.json so the thesis cannot go stale.
 *
 * The falsifiability framing is deliberate. A measurement product that states a
 * hypothesis and then publishes the data that could kill it is more credible
 * than one that quietly hopes to be right.
 */
const fs = require("fs");

const LINKEDIN = "https://www.linkedin.com/in/alexander-balieu-24041991/";

/* ---------- shared shell, lifted from why.html ---------------------------- */
const why = fs.readFileSync("public/why.html", "utf8");
const headEnd = why.indexOf("</head>");
const shellHead = why.slice(0, headEnd);
const navStart = why.indexOf('<div class="masthead">');
const navEnd = why.indexOf("</div></div>", navStart) + "</div></div>".length;
const nav = why.slice(navStart, navEnd);
const footStart = why.lastIndexOf("<footer>");
const foot = footStart > 0 ? why.slice(footStart) : "</body></html>";

function page(title, desc, activeHref, body) {
  let h = shellHead
    .replace(/<title>[^<]*<\/title>/, "<title>" + title + "</title>")
    .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + desc + '">');
  let n = nav.replace(/ class="lnk on" aria-current="page"/g, ' class="lnk"');
  if (activeHref) n = n.replace('class="lnk" href="' + activeHref + '"', 'class="lnk on" aria-current="page" href="' + activeHref + '"');
  return h + "</head>\n<body class=\"prose\">\n" + n + "\n\n" + body + "\n\n" + foot;
}

/* ---------- 1. about.html ------------------------------------------------- */
const aboutBody = `<div class="page-open"><div class="wrap">
  <p class="eyebrow">About</p>
  <h1>Who is behind <em>this index</em>.</h1>
  <p class="lede">A reference price is only worth citing if you know who publishes it and how they are paid. So: this is a one-person project, and here is the person.</p>
</div></div>

<div class="wrap"><div class="panels">

  <section class="panel wide">
    <div class="ix"><span class="lead-in">The founder</span></div>
    <div style="display:flex;gap:28px;flex-wrap:wrap;align-items:flex-start">
      <div id="mugwrap" style="flex:0 0 auto"></div>
      <div style="flex:1;min-width:280px">
        <h2 style="margin-top:0">Alexander Balieu</h2>
        <p>I am a business analyst working in data and finance, based in Luxembourg. The Crawl Price Index is mine: I built the crawler, the pipeline, the dashboard and the methodology, and I run the weekly edition myself.</p>
        <p>The project comes out of a working habit rather than a thesis about AI. In finance, the first question about any number is who produced it, against what denominator, and whether it can be reproduced. Almost nothing published about AI and the web survives that question. Block rates get quoted as shares of &ldquo;the web&rdquo; with no frame; prices get cited with no sample size. So I started measuring it properly, weekly, and writing down exactly what the numbers can and cannot support.</p>
        <p style="margin-bottom:0"><a class="lnk" style="color:var(--signal);font-weight:600" href="${LINKEDIN}" rel="noopener">Alexander Balieu on LinkedIn &rarr;</a></p>
      </div>
    </div>
  </section>

  <section class="panel">
    <div class="ix"><span class="lead-in">How it is paid for</span></div>
    <h2>Subscriptions. Nothing else.</h2>
    <p>The index is funded by subscriptions to the full dataset and by one-off snapshot purchases. It takes no money from AI companies, no money from publishers, no advertising, no affiliate revenue, and no sponsorship. Nobody in the market it measures pays for its existence.</p>
    <p>That constraint is the point. A reference price that takes money from a participant stops being a reference price, which is why the free tier &mdash; the headline figures, the aggregate dashboard and the weekly email &mdash; is free to cite with attribution by anyone, including the companies the data covers.</p>
  </section>

  <section class="panel">
    <div class="ix"><span class="lead-in">Conflicts</span></div>
    <h2>What I do and do not have a stake in.</h2>
    <p>I hold no position in any AI company, publisher, CDN or payments provider named anywhere in this dataset. I do not sell consulting to the sites I measure, and the index does not recommend prices to publishers &mdash; it records what they declare.</p>
    <p>One disclosure worth making plainly: the machine-payment registry the index tracks is a market I find genuinely interesting, and I may eventually list an endpoint of my own in it. If that happens it will be labelled as mine in the data, and excluded from any headline figure.</p>
  </section>

  <section class="panel wide">
    <div class="ix"><span class="lead-in">Corrections</span></div>
    <h2>If a number here is wrong, I want to know.</h2>
    <p>Every figure states its denominator and every method is written down so it can be checked. If you can reproduce a different answer, or your domain is recorded incorrectly, write to <a href="mailto:hello@crawlpriceindex.com">hello@crawlpriceindex.com</a>. Corrections are made in the next edition and logged in the <a href="/changelog">changelog</a> &mdash; the archive is never quietly rewritten.</p>
    <div class="ctrls" style="margin-top:14px">
      <a class="btn" href="/methodology">Read the methodology</a>
      <a class="ghost" href="/why">Why this index exists</a>
    </div>
  </section>

</div></div>

<script>
// The photo is optional: drop public/alex.jpg in and it appears. No broken image if absent.
(function(){
  var img = new Image();
  img.onload = function(){
    var w = document.getElementById("mugwrap");
    if (!w) return;
    img.setAttribute("alt", "Alexander Balieu");
    img.setAttribute("style", "width:172px;height:172px;object-fit:cover;border-radius:3px;border:1px solid var(--line);display:block");
    w.appendChild(img);
  };
  img.src = "/alex.jpg";
})();
</script>`;

fs.writeFileSync("public/about.html", page(
  "About — The Crawl Price Index",
  "Who runs the Crawl Price Index, how it is funded, and what conflicts of interest it does and does not have.",
  "/why", aboutBody));

/* ---------- 2. the thesis section on why.html ---------------------------- */
if (why.includes("The thesis")) { console.log("thesis section already present"); }
else {
  const anchor = `  <section class="panel">
    <div class="ix"><span class="lead-in">The gap</span></div>`;
  if (!why.includes(anchor)) throw new Error("why.html anchor missing");

  const thesis = `  <section class="panel wide">
    <div class="ix"><span class="lead-in">The thesis</span></div>
    <h2>What we think is happening &mdash; and what would prove us wrong.</h2>
    <p>Everything else on this site is measurement. This section is an argument, and it is labelled as one. We state it openly because a dataset without a hypothesis is just a spreadsheet, and because stating it lets you hold the data against it every week.</p>

    <p class="pull">Software is becoming the web&rsquo;s primary reader &mdash; and the first reader that can be <em>charged at the door</em>.</p>

    <p>Three things follow from that, and each is testable rather than rhetorical. First, if machines are becoming the audience that matters, publishers should start distinguishing between kinds of machine &mdash; not just blocking &ldquo;bots&rdquo;, but treating a crawler that trains a model differently from one that sends a reader. Second, if access becomes a transaction, some form of machine-payable pricing has to appear and be denominated in something a machine can settle. Third, if payment becomes normal, declared policy and enforced access should begin to diverge, because charging requires actually stopping people at the gate rather than politely asking them not to enter.</p>

    <h3 style="margin-top:22px">What we can already measure</h3>
    <ul id="thesis-ev">
      <li>Loading this week&rsquo;s figures&hellip;</li>
    </ul>
    <p class="source" style="margin-top:6px">Live from the current edition. Every figure states its denominator; none of them is a forecast.</p>

    <h3 style="margin-top:22px">What we do <em>not</em> claim</h3>
    <p>We do not claim to know that this continues, how fast, or how far. We hold roughly five weekly editions &mdash; enough to observe movement between editions, nowhere near enough to assert a trend, and we do not assert one anywhere on this site. We also cannot see money changing hands: a registry of advertised prices is a record of what sellers ask, not of what anyone paid. Nobody outside the payment rails can see the second thing, including us.</p>

    <h3 style="margin-top:22px">What would falsify it</h3>
    <p>The thesis fails if, over successive editions, the training-versus-traffic distinction flattens toward parity; if declared blocking drifts down rather than up as the tooling gets easier; if the machine-payment registry stops growing or stays confined to developer APIs and never reaches sites people read; or if the divergence between what sites declare and what they enforce closes rather than widens. Each of those is visible in the weekly data. If they happen, this page changes &mdash; and the archive that showed it will still be here.</p>
  </section>

`;
  const out = why.replace(anchor, thesis + anchor);
  fs.writeFileSync("public/why.html", out);
}

/* ---------- 3. thesis evidence loader (live from /index.json) ------------- */
let w = fs.readFileSync("public/why.html", "utf8");
if (!w.includes("thesis-ev-loader")) {
  const script = `
<script id="thesis-ev-loader">
// The thesis is held against live data, so it cannot quietly go stale.
(function(){
  var el = document.getElementById("thesis-ev");
  if (!el) return;
  fetch("/index.json", {cache:"no-store"}).then(function(r){return r.json();}).then(function(d){
    var out = [], n = function(x){ return Number(x).toLocaleString(); };
    var A = d.asymmetry_headline, R = d.reachability_headline, B = d.bazaar_headline, C = d.changes_headline;
    if (A) out.push("<li><b>Publishers do distinguish between kinds of machine.</b> " + n(A.blocks_training_role_only) +
      " domains block a training-role crawler while blocking no search-role crawler; " + n(A.blocks_search_role_only) +
      " do the reverse &mdash; a ratio of " + A.ratio + " to 1, among " + n(A.denominator) +
      " domains serving a readable robots.txt.</li>");
    if (B) out.push("<li><b>Machine-payable pricing exists and is denominated for machines.</b> " + n(B.endpoints_real_priced) +
      " endpoints advertise a price in a public machine-payment registry across " + n(B.distinct_pay_to_addresses) +
      " distinct pay-to addresses, median ask $" + B.median_advertised_usd + ". Advertised acceptance, not observed transactions.</li>");
    if (B && B.in_frame_domains != null) out.push("<li><b>It has barely reached the web people read.</b> Of the 50,000 ranked domains we scan, " +
      n(B.in_frame_domains) + " advertise a machine price" + (B.in_frame_content != null ? " &mdash; " + n(B.in_frame_content) + " of them serving content" : "") +
      ". The registry is still overwhelmingly developer APIs and tools.</li>");
    if (R) out.push("<li><b>Declared policy and enforced access already differ.</b> " + n(R.bot_walled) +
      " domains in the frame serve a robots.txt and then refuse an identified crawler at the homepage (403/429).</li>");
    if (C) out.push("<li><b>Policy is not settled.</b> Between the two most recent editions, " + n(C.more_restrictive) +
      " domain&times;crawler states moved toward restriction and " + n(C.less_restrictive) + " away from it, with " +
      n(C.moved_off_a_block) + " moving off an explicit block. One comparison, not a trend.</li>");
    el.innerHTML = out.length ? out.join("") : "<li>This week&rsquo;s figures are not available right now.</li>";
  }).catch(function(){ el.innerHTML = "<li>This week&rsquo;s figures are not available right now.</li>"; });
})();
</script>
`;
  const at = w.lastIndexOf("<footer>");
  w = at > 0 ? w.slice(0, at) + script + w.slice(at) : w + script;
  fs.writeFileSync("public/why.html", w);
}

console.log("built public/about.html");
console.log("added the thesis section + live evidence loader to public/why.html");
console.log("photo: drop public/alex.jpg (square, >=344px) and it appears automatically");
