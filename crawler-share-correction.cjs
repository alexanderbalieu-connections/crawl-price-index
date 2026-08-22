#!/usr/bin/env node
/**
 * CPI — withdraw the relabel; keep the estimate, reframed
 * ===========================================================================
 * Four reviewers came back on the crawler-share memo. They split 2–2 on the
 * conclusion, but ALL FOUR rejected the argument I used to reach it, and they
 * were right.
 *
 * WHAT I GOT WRONG. I argued Cloudflare's "52% of crawler requests are now for
 * AI training" could not use all crawlers as its denominator, because that
 * would make AI training larger than the whole AI-crawler category — which I
 * called impossible. It is not impossible. Training is a PURPOSE; AI Crawler
 * is a CATEGORY, and they are different dimensions. Cloudflare says plainly
 * that Googlebot — classified Search Engine, not AI Crawler — "crawls for both
 * search engine indexing and AI training", and that "multi-purpose crawlers
 * such as Googlebot, Applebot, and BingBot will be blocked by customers who
 * have selected to block Training." So training traffic legitimately spans
 * categories, and my proof compared a purpose split against a category split
 * as though they nested. They do not.
 *
 * WHAT FOLLOWS. The full quotation is "When looking at the crawlers Cloudflare
 * identifies by purpose … 52% of crawler requests are now for AI training …
 * up from 22% in Spring 2025." The "up from 22%" is what settles it: under an
 * AI-crawler denominator, Cloudflare's own Aug 2025 figure for training was
 * 72–79% of AI crawling, so 52% could not be a rise from 22%. Under an
 * all-crawler denominator the trajectory is coherent — AI crawling grew as a
 * share of all crawling while training held its share within it.
 *
 * So the ORIGINAL label was right and I broke it. Reverted, and sharpened to
 * name the population rather than leaving "crawler activity" vague.
 *
 * WHAT SURVIVES. The 45–60% estimate stands, but not as I framed it. Three
 * reviewers independently made the same better point: it is a DEFINITION
 * range, not a confidence interval, and the chain is not a nested hierarchy —
 * it is an analytical bridge with one estimated layer. Presenting it as clean
 * containment implied a precision the sources do not support.
 *
 * WHAT GOES. The AI-training-share-of-all-traffic figure, in both readings.
 * Three of four reviewers said stop before that multiplication, and they are
 * right: it chains three denominators that do not nest. Neither 5% nor 14%
 * appears anywhere any more.
 */
const fs = require("fs");
const P = "public/why.html";
let s = fs.readFileSync(P, "utf8");
if (s.includes("bridge-note")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(P, P + ".bak-correction");

const sub = (from, to, label) => {
  if (!s.includes(from)) throw new Error("not found: " + label);
  s = s.split(from).join(to);
};

/* ---- 1. revert the label I wrongly changed ------------------------------ */
sub('<div class="twl">AI training share of <b>AI-crawler</b> activity</div>',
    '<div class="twl">Training-purpose share of <b>crawler requests</b></div>',
    "chart label");
sub('<div class="nrow n3"><span class="nk">of which <b>AI training</b> crawlers<small>of AI-crawler activity, not of all crawling &mdash; see below</small></span><span class="nv">52%</span></div>',
    '<div class="nrow n3"><span class="nk">of which requests whose <b>purpose is AI training</b><small>a purpose, not a bot category &mdash; dual-purpose crawlers like Googlebot appear here too</small></span><span class="nv">52%</span></div>',
    "training step");

/* ---- 2. the chain becomes a bridge, with the estimated layer marked ----- */
sub('<div class="nrow n2"><span class="nk">of which <b>crawler</b> activity</span>' +
    '<span class="nv"><span class="est-badge">our estimate</span> ~52%<small>range 45&ndash;60%</small></span></div>',
    '<div class="nrow n2"><span class="nk">of which <b>crawler</b> activity<small>no source publishes this &mdash; the layer we estimate</small></span>' +
    '<span class="nv"><span class="est-badge">estimate</span> ~52%<small>45&ndash;60% by definition</small></span></div>',
    "crawler step");

sub('<div class="nbh">How the two measurements fit together <span>which denominator sits inside which</span></div>',
    '<div class="nbh">How the two measurements fit together <span>an analytical bridge, not a clean hierarchy</span></div>',
    "band head");

const NOTE = '<div class="nestnote" id="bridge-note">These are <b>not</b> a tidy set of nested populations, and we no longer draw them as one. ' +
  'The top figure is Imperva measuring all traffic including APIs; the bottom is Cloudflare classifying crawler requests <em>by purpose</em> on its own network. ' +
  'Different companies, different baskets, different dimensions.<br><br>' +
  '<b>The middle layer is ours.</b> Nobody publishes crawler activity as a share of automated traffic, so we estimate it from Cloudflare&rsquo;s bot categories under three readings of the word &ldquo;crawler&rdquo;: ' +
  'search-engine plus dedicated AI crawlers gives ~45%; adding AI-search fetching gives ~52%; adding AI assistants gives ~60%. ' +
  'That spread is a <b>definition range, not a confidence interval</b> &mdash; it reflects where the line is drawn, and better measurement will not narrow it.<br><br>' +
  '<b>We stop before multiplying the chain out.</b> It is tempting to compound these into &ldquo;x% of the web is AI training crawling&rdquo;. We do not publish that number, because the three layers do not share a denominator and the product would be false precision. ' +
  '<a href="/methodology#crawler-share" style="color:var(--signal)">The workings, the sources, and a correction we had to make &rarr;</a></div>';

const a = s.indexOf('<div class="nestnote">');
if (a < 0) throw new Error("nestnote not found");
const b = s.indexOf("</div>", a) + 6;
s = s.slice(0, a) + NOTE + s.slice(b);

fs.writeFileSync(P, s);

/* ---- 3. rewrite the methodology section --------------------------------- */
const M = "public/methodology.html";
let m = fs.readFileSync(M, "utf8");
const ms = m.indexOf('<section class="panel wide" id="crawler-share">');
if (ms < 0) throw new Error("methodology section not found");
const me = m.indexOf("</section>", ms) + "</section>".length;

const SEC = `<section class="panel wide" id="crawler-share">
  <div class="ix"><span class="lead-in">An estimate, clearly marked</span></div>
  <h2>Estimating what share of automated traffic is crawler activity</h2>
  <p>Every other figure on this site is measured. This one is not. It is the one link in a chain we quote on <a href="/why">Why it matters</a> that no source publishes, so we estimate it &mdash; and the workings are here so they can be attacked. They already have been: see the correction at the bottom.</p>
  <p><b>Estimate: crawler activity is roughly half of automated traffic. 45&ndash;60% depending on definition, 52% as the central case.</b></p>

  <h3 style="margin-top:22px">How it is constructed</h3>
  <p>&ldquo;Crawler activity&rdquo; has no agreed definition, so the answer depends where the line is drawn. Three readings, mapped onto Cloudflare&rsquo;s bot categories:</p>
  <div class="mwrap"><table class="dt">
    <thead><tr><th>Reading</th><th>What counts as crawling</th><th>Share of bot traffic</th></tr></thead>
    <tbody>
      <tr><td>Strict</td><td>search-engine crawlers + dedicated AI crawlers</td><td class="mono">~45%</td></tr>
      <tr><td><b>Central</b></td><td>+ AI-search fetching, which retrieves pages to build an index</td><td class="mono"><b>~52%</b></td></tr>
      <tr><td>Broad</td><td>+ AI assistants, which fetch on a person&rsquo;s behalf</td><td class="mono">~60%</td></tr>
    </tbody>
  </table></div>
  <p style="margin-top:14px">We take the central case because it captures systematic machine acquisition of content &mdash; discovery, indexing, retrieval, model consumption &mdash; while excluding fetches a person triggered. That is the activity this index is about.</p>
  <p><b>The 45&ndash;60% spread is a definition range, not a confidence interval.</b> It reflects classification choices, not measurement error, and will not narrow with better data. Applied to Imperva&rsquo;s 53% automated share it implies crawler activity at roughly <b>28% of all web traffic</b>, sensitivity 24&ndash;32%.</p>

  <h3 style="margin-top:22px">Why we stop there</h3>
  <p>The obvious next step is to multiply by Cloudflare&rsquo;s training share and publish &ldquo;x% of the web is AI training crawling&rdquo;. We do not, and will not. The three layers come from different companies measuring different baskets along different dimensions &mdash; Imperva&rsquo;s all-traffic automated share, our derived crawler layer, and Cloudflare&rsquo;s purpose split of crawler requests. Compounding them produces a number with no honest denominator.</p>

  <h3 style="margin-top:22px">How good the inputs are</h3>
  <ul>
    <li><b>The category shares are secondary.</b> The precise figures circulating for 2026 (search-engine ~26%, AI crawlers ~19%, AI assistants ~8%, AI search ~7%) come from write-ups of Cloudflare Radar, not a primary Cloudflare publication &mdash; and different write-ups, and even different sections of the same write-up, give different values. What is primary is Cloudflare&rsquo;s Radar 2025 Year in Review: <b>search-engine crawlers 40%, AI crawlers 20%, SEO bots 13% of verified bot traffic</b>. The estimate should be read as resting on that magnitude, not on the decimals.</li>
    <li><b>Verified bots are not all bots.</b> Cloudflare&rsquo;s category shares describe traffic it has verified; Imperva&rsquo;s 53% includes unverified and malicious automation, much of which also crawls. The two populations do not line up, which is the main reason the range is wide.</li>
    <li><b>One network is not the web.</b> Cloudflare fronts a large but non-random slice of it.</li>
    <li><b>Both vendors sell bot mitigation.</b> Every input comes from a company whose product is stopping bots.</li>
    <li><b>The taxonomy moved.</b> Cloudflare introduced and revised its AI bot categories across 2025&ndash;26; a 2025 figure and a 2026 figure may not count the same thing.</li>
    <li><b>Almost nothing independent exists.</b> The one non-vendor measurement found is a server-log study of a single e-commerce site, which put bots at 22.3% of requests &mdash; far below both vendors, and far too narrow to generalise from.</li>
  </ul>

  <h3 style="margin-top:22px">Correction &middot; 22 August 2026</h3>
  <p>An earlier version of this page argued that Cloudflare&rsquo;s <em>&ldquo;52% of crawler requests are now for AI training&rdquo;</em> must use AI crawlers as its denominator, on the grounds that the literal reading would make AI training larger than the entire AI-crawler category and was therefore impossible. We relabelled the chart on <a href="/why">Why it matters</a> accordingly.</p>
  <p><b>That was wrong, and the chart has been changed back.</b> The argument confused two different dimensions. &ldquo;Training&rdquo; is a <em>purpose</em>; &ldquo;AI Crawler&rdquo; is a <em>bot category</em>. Cloudflare classifies Googlebot as a search-engine crawler while stating that it &ldquo;crawls for both search engine indexing and AI training&rdquo;, and that multi-purpose crawlers including Googlebot, Applebot and Bingbot are caught when a customer blocks Training. Training traffic therefore spans categories, and can exceed any single one of them without contradiction.</p>
  <p>The full sentence also settles the denominator on its own: <em>&ldquo;52% &hellip; up from 22% in Spring 2025.&rdquo;</em> Cloudflare&rsquo;s August 2025 figure for training as a share of <em>AI</em> crawling was 72&ndash;79%. A fall to 52% could not be described as a rise from 22%. Read against all crawler requests, the trajectory is coherent.</p>
  <p>Nothing measured changed. The 22%&nbsp;&rarr;&nbsp;52% movement and the two-speeds argument were never affected &mdash; only what the figure is a share of, and we had that right before we changed it. The estimate above also survived review, but its framing did not: three reviewers independently pointed out that the layers are not a nested hierarchy and that the range is definitional rather than statistical. Both corrections are reflected above.</p>
  <p class="foot">This estimate is never folded into the weekly record, never quoted as a finding, and never appears in the newsletter. Wherever it appears on the site it is labelled as an estimate.</p>
</section>`;

m = m.slice(0, ms) + SEC + m.slice(me);
fs.writeFileSync(M, m);

/* ---- 4. and on the record ------------------------------------------------ */
const C = "public/changelog.html";
let c = fs.readFileSync(C, "utf8");
if (!c.includes("Crawler-share estimate")) {
  fs.copyFileSync(C, C + ".bak-correction");
  const anchor = '  <article style="padding:22px 0;border-bottom:1px solid var(--line)">';
  const i = c.indexOf(anchor);
  if (i < 0) throw new Error("changelog anchor not found");
  const ENTRY = `  <article style="padding:22px 0;border-bottom:1px solid var(--line)">
    <div style="font-family:var(--sans);font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--signal);font-weight:600;margin-bottom:6px">2026-08-22 &middot; correction</div>
    <h3 style="font-family:var(--serif);font-weight:400;font-size:22px;margin:0 0 10px;color:var(--fg)">Crawler-share estimate published; a chart label corrected and then reverted</h3>
    <p style="margin:0;color:var(--dim);max-width:70ch">Published an estimate of the one link in the /why containment chain that no source measures: crawler activity as a share of automated traffic, 45&ndash;60% by definition with 52% as the central case, with the construction and its weaknesses set out at <a href="/methodology#crawler-share">/methodology#crawler-share</a>. In the course of that work we relabelled the training-share chart, arguing Cloudflare&rsquo;s &ldquo;52% of crawler requests&rdquo; could not mean all crawlers. That argument was wrong &mdash; it treated a purpose split and a bot-category split as nested, when Cloudflare classifies dual-purpose crawlers such as Googlebot outside the AI-crawler category while counting their training traffic. The label has been reverted and sharpened. No measured figure changed at any point. We also stopped publishing any compounded &ldquo;share of all web traffic&rdquo; figure for AI training crawling: the layers do not share a denominator and the product would be false precision.</p>
  </article>
`;
  c = c.slice(0, i) + ENTRY + c.slice(i);
  fs.writeFileSync(C, c);
}

/* ---- verify -------------------------------------------------------------- */
const w = fs.readFileSync(P, "utf8");
const mm = fs.readFileSync(M, "utf8");
if (w.includes("AI-crawler</b> activity")) throw new Error("the wrong label survived on /why");
if (!w.includes("Training-purpose share of <b>crawler requests</b>")) throw new Error("reverted label missing");
if (!w.includes("bridge-note")) throw new Error("bridge note missing");
for (const banned of ["5.3%", "14.3%", "14.4%"])
  if (w.includes(banned) || mm.includes(banned)) throw new Error("a compounded all-traffic figure survived: " + banned);
if (!mm.includes("Correction &middot; 22 August 2026")) throw new Error("correction section missing");
if (!mm.includes("definition range, not a confidence interval")) throw new Error("framing fix missing");
for (const f of [P, M, "public/changelog.html"]) {
  const x = fs.readFileSync(f, "utf8");
  if ((x.match(/<section[\s>]/g) || []).length !== (x.match(/<\/section>/g) || []).length)
    throw new Error("sections unbalanced in " + f);
}

console.log("CORRECTION APPLIED");
console.log("  /why      label reverted: 'Training-purpose share of crawler requests'");
console.log("            the chain is now drawn as an analytical bridge, not a hierarchy");
console.log("            the estimate is badged, and the range called definitional");
console.log("            no compounded 'share of all web traffic' figure anywhere");
console.log("  /method   full rewrite + a Correction section that says what I got wrong");
console.log("  /changelog  entry on the public record");
