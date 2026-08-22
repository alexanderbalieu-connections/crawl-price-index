#!/usr/bin/env node
/**
 * CPI — /why: fill the missing step with an estimate, and fix a label
 * ===========================================================================
 * The containment band said "not published" for crawler activity as a share
 * of automated traffic. Sizing it turned up two things.
 *
 * 1. IT CAN BE ESTIMATED. Cloudflare Radar publishes bot traffic by category.
 *    Search-engine crawlers 26.1% + AI crawlers 19.3% = 45.4% of bot requests;
 *    adding AI-search bots (6.8%) gives 52.2%; adding AI assistants (8.2%)
 *    gives 60.4%. Central estimate 52%, range 45–60%. The spread is
 *    definitional — where you draw "crawler" — not statistical, so it will not
 *    narrow with better measurement.
 *
 * 2. IT EXPOSES A LABELLING ERROR OF OURS. Cloudflare's "52% of crawler
 *    requests are now for AI training" cannot be using ALL crawlers as its
 *    denominator: that would put AI training at ~27% of bot traffic, when
 *    Radar says the entire AI-crawler category is 19.3%. More AI training
 *    traffic than AI crawler traffic is impossible. So the denominator must be
 *    AI-crawler requests, and our chart's label — "AI training share of
 *    crawler activity" — is wrong. It becomes "AI-crawler activity".
 *
 *    The 22% → 52% movement and the two-speeds argument are untouched; only
 *    what the number is a share of changes. Which is exactly the class of
 *    error this index exists not to make, so it is corrected on the page and
 *    the reasoning is published rather than quietly patched.
 *
 * The estimate is marked as an estimate everywhere it appears, in keeping with
 * how the market sizing is handled — modelled figures never dress as measured
 * ones.
 */
const fs = require("fs");
const P = "public/why.html";
let s = fs.readFileSync(P, "utf8");
const whyDone = s.includes("est-badge");
if (whyDone) console.log("/why already updated — doing the methodology half only");
if (!whyDone) fs.copyFileSync(P, P + ".bak-estimate");

const sub = (from, to, label) => {
  if (whyDone) return;
  if (!s.includes(from)) throw new Error("not found: " + label);
  s = s.split(from).join(to);
};

/* ---- the missing step is now an estimate -------------------------------- */
sub(
  '<div class="nrow n2"><span class="nk">of which <b>crawler</b> activity</span><span class="nv nu">not published</span></div>',
  '<div class="nrow n2"><span class="nk">of which <b>crawler</b> activity</span>' +
  '<span class="nv"><span class="est-badge">our estimate</span> ~52%<small>range 45&ndash;60%</small></span></div>',
  "crawler step"
);

/* ---- the label the estimate proved wrong -------------------------------- */
sub(
  '<div class="nrow n3"><span class="nk">of which <b>AI training</b> crawlers</span><span class="nv">52%</span></div>',
  '<div class="nrow n3"><span class="nk">of which <b>AI training</b> crawlers<small>of AI-crawler activity, not of all crawling &mdash; see below</small></span><span class="nv">52%</span></div>',
  "training step"
);
sub('<div class="twl">AI training share of <b>crawler</b> activity</div>',
    '<div class="twl">AI training share of <b>AI-crawler</b> activity</div>',
    "chart label");

/* ---- replace the note with what the sizing actually found --------------- */
sub(
  '<div class="nestnote">So yes &mdash; the two series below are nested, not parallel. But they are shares of <em>different</em> denominators, and nobody publishes the middle step, so the chain cannot be multiplied out. What can honestly be compared is how fast each one moves.</div>',
  '<div class="nestnote">The two series below are nested, not parallel &mdash; but they are shares of <em>different</em> denominators, so the chain still cannot simply be multiplied out.<br><br>' +
  '<b>Nobody publishes the middle step, so we estimated it</b> from Cloudflare Radar&rsquo;s bot categories: search-engine crawlers (26.1% of bot requests) plus AI crawlers (19.3%) gives 45%; adding AI-search bots gives 52%; adding AI assistants gives 60%. The spread is definitional &mdash; where you draw the word &ldquo;crawler&rdquo; &mdash; not statistical.<br><br>' +
  '<b>Doing that arithmetic caught an error of ours.</b> The bottom figure is a share of <em>AI-crawler</em> activity, not of all crawling: read the other way it would make AI training larger than the entire AI-crawler category, which is impossible. The label above is corrected. The 22%&rarr;52% movement is unaffected. ' +
  '<a href="/methodology#crawler-share" style="color:var(--signal)">Full workings and the sources &rarr;</a></div>',
  "nest note"
);

if (!whyDone) fs.writeFileSync(P, s);

/* ---- the workings, on the methodology page ------------------------------ */
const M = "public/methodology.html";
let m = fs.readFileSync(M, "utf8");
if (!m.includes('id="crawler-share"')) {
  fs.copyFileSync(M, M + ".bak-crawlershare");
  const SEC = `  <section class="panel wide" id="crawler-share">
    <div class="ix"><span class="lead-in">An estimate, clearly marked</span></div>
    <h2>What share of automated traffic is crawler activity?</h2>
    <p>Every other figure on this site is measured. This one is not &mdash; it is the one link in a chain we quote on <a href="/why">Why it matters</a> that nobody publishes, so we estimated it. The workings are here so they can be attacked.</p>
    <p><b>Central estimate: 52% of automated traffic is crawler activity. Range 45&ndash;60%.</b></p>
    <div class="mwrap"><table class="dt">
      <thead><tr><th>Where you draw &ldquo;crawler&rdquo;</th><th>Categories counted</th><th>Share of bot requests</th></tr></thead>
      <tbody>
        <tr><td>Strict</td><td>search-engine crawlers + AI crawlers</td><td class="mono">45.4%</td></tr>
        <tr><td><b>Central</b></td><td>+ AI-search bots, which also fetch to build an index</td><td class="mono"><b>52.2%</b></td></tr>
        <tr><td>Broad</td><td>+ AI assistants, which fetch on a person&rsquo;s behalf</td><td class="mono">60.4%</td></tr>
      </tbody>
    </table></div>
    <p style="margin-top:14px">Category shares are Cloudflare Radar&rsquo;s, trailing 28 days to 1 August 2026: search-engine crawlers 26.13%, AI crawlers 19.31%, AI assistants 8.23%, AI search 6.76%. The spread above is <em>definitional</em> &mdash; it reflects where the word &ldquo;crawler&rdquo; is drawn, not measurement error, and will not narrow with better data.</p>

    <h3 style="margin-top:22px">What the arithmetic caught</h3>
    <p>Cloudflare reports that <em>&ldquo;52% of crawler requests are now for AI training&rdquo;</em>. Read with <em>all</em> crawlers as the denominator, that puts AI training at roughly 27% of bot traffic &mdash; but Radar puts the entire AI-crawler category at 19.31%. That would make AI training larger than all AI crawling, which cannot be true. The denominator must therefore be AI-crawler requests.</p>
    <p>We had it the other way, and the chart on <a href="/why">Why it matters</a> has been corrected: the series is the AI-training share of <b>AI-crawler</b> activity. The 22%&nbsp;&rarr;&nbsp;52% movement and the argument built on it are unchanged; only what the figure is a share of has changed.</p>

    <h3 style="margin-top:22px">Why this one is weaker than everything else here</h3>
    <ul>
      <li><b>Denominators do not match.</b> Imperva&rsquo;s 53% automated share covers all traffic including APIs and app calls; Cloudflare&rsquo;s category shares cover HTML requests on its own network.</li>
      <li><b>One network is not the web.</b> Cloudflare fronts a large but non-random slice of it.</li>
      <li><b>Both vendors sell bot mitigation.</b> Every input here comes from a company whose product is stopping bots.</li>
      <li><b>The taxonomy moved.</b> Cloudflare introduced and revised its AI bot categories across 2025&ndash;26, so a 2025 figure and a 2026 figure may not count the same thing.</li>
      <li><b>The category shares are secondary.</b> They are quoted from write-ups of Cloudflare Radar rather than a primary Cloudflare publication, and should be verified against Radar directly.</li>
    </ul>
    <p class="foot">This estimate is never folded into the weekly record, never quoted as a finding, and never appears in the newsletter. Where it appears on the site it is labelled as an estimate.</p>
  </section>

`;
  const TAIL = "</div></div>\n<footer class=\"sitefoot\">";
  const at = m.indexOf(TAIL);
  if (at < 0) throw new Error("methodology insert point not found");
  m = m.slice(0, at) + SEC + m.slice(at);
  fs.writeFileSync(M, m);
}

/* ---- style the badge ----------------------------------------------------- */
const T = "public/theme.css";
let t = fs.readFileSync(T, "utf8");
if (!t.includes(".est-badge")) {
  t += `
/* an estimate must never dress as a measurement */
.est-badge{display:inline-block;font-family:var(--sans);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;
  font-weight:600;color:var(--amber);border:1px solid var(--amber);border-radius:2px;padding:1px 5px;margin-right:6px;vertical-align:1px}
.nrow .nv small{display:block;font-family:var(--sans);font-size:10.5px;font-weight:400;color:var(--dim);letter-spacing:0}
.nrow .nk small{display:block;font-size:11px;color:var(--dim);font-weight:400;line-height:1.35;margin-top:1px}
`;
  fs.writeFileSync(T, t);
}

/* ---- verify -------------------------------------------------------------- */
const out = fs.readFileSync(P, "utf8");
for (const x of ["est-badge", "~52%", "AI-crawler</b> activity", "crawler-share"])
  if (!out.includes(x)) throw new Error("missing after patch: " + x);
if (out.includes("not published")) throw new Error("the unfilled step survived");
if (out.includes("AI training share of <b>crawler</b> activity")) throw new Error("the wrong label survived");
const mm = fs.readFileSync(M, "utf8");
if (!mm.includes('id="crawler-share"')) throw new Error("methodology section missing");
if ((mm.match(/<section class="panel/g) || []).length !== (mm.match(/<\/section>/g) || []).length)
  throw new Error("methodology sections unbalanced");

console.log("/why: the missing step is now an estimate — ~52%, range 45-60%, badged as ours");
console.log("");
console.log("  AND IT CAUGHT AN ERROR OF OURS: 'AI training share of crawler activity'");
console.log("  cannot use all crawlers as its denominator — that would make AI training");
console.log("  bigger than the whole AI-crawler category. Relabelled to AI-crawler activity.");
console.log("  The 22%->52% movement and the two-speeds argument are unaffected.");
console.log("");
console.log("  Workings, sources and limitations published at /methodology#crawler-share");
