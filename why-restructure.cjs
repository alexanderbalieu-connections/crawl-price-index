#!/usr/bin/env node
/**
 * CPI — /why restructure  (node why-restructure.cjs)
 * ===========================================================================
 * Feedback, applied:
 *   1. Timeline trimmed from 11 events to 6 — no taller than the prose beside it.
 *   2. "The shift, in public numbers" + "Direction, not just level" merged into
 *      ONE box with ONE graphic: a single chart carrying both level and
 *      direction (the slow-growing pool, the fast-changing composition).
 *   3. The thesis loses the meta-commentary, the broken live-figures block, the
 *      hedging and the falsification essay. It takes a stance in four sentences.
 *   4. The thesis moves to the TOP — everything after it is support.
 *   5. "The legal backdrop" retired: its content is the timeline's job now.
 *   6. "The gap" and "What this is" placed side by side.
 *   7. "What becomes answerable" tightened into a clean three-column block.
 */
const fs = require("fs");
const P = "public/why.html";
let s = fs.readFileSync(P, "utf8");
if (s.includes("thesis-lead")) { console.log("already restructured"); process.exit(0); }
fs.copyFileSync(P, P + ".bak-restructure");

const cut = (marker) => {
  const i = s.indexOf(marker);
  if (i < 0) return null;
  const a = s.lastIndexOf("  <section", i);
  const b = s.indexOf("</section>", i) + "</section>".length;
  const html = s.slice(a, b);
  s = s.slice(0, a) + s.slice(b);
  return html;
};

/* ---- lift every section out so we can re-lay the page ------------------- */
const secShift   = cut('<span class="lead-in">The shift</span>');
const secLevel   = cut('id="evidence-shift"');
const secGrowth  = cut('id="growth-panel"');
const secThesis  = cut('<span class="lead-in">The thesis</span>');
const secEcon    = cut('id="evidence-ratio"');
const secAgainst = cut('id="evidence-against"');
const secGap     = cut('<span class="lead-in">The gap</span>');
const secAnswer  = cut('<span class="lead-in">What becomes answerable</span>');
const secLegal   = cut('<span class="lead-in">The legal backdrop</span>');
const secWhat    = cut('<span class="lead-in">What this is</span>');
for (const [n, v] of Object.entries({ secShift, secLevel, secGrowth, secThesis, secEcon, secAgainst, secGap, secAnswer, secWhat }))
  if (!v) throw new Error("missing section: " + n);

/* ---- 3+4. the thesis, short and up front -------------------------------- */
const thesis = `  <section class="panel wide" id="thesis-lead">
    <div class="ix"><span class="lead-in">The thesis</span></div>
    <h2>Software is becoming the web&rsquo;s primary reader &mdash; and the first reader that can be <em>charged at the door</em>.</h2>
    <p class="lede" style="margin-top:10px">Three things follow. Publishers will stop treating &ldquo;bots&rdquo; as one thing and start pricing the crawler that trains a model differently from the one that sends a reader. Access will become a transaction, denominated in something a machine can settle. And what a site <em>declares</em> will drift away from what its front door actually <em>does</em>, because charging means stopping people at the gate rather than asking them politely not to come in.</p>
    <p style="margin-bottom:0">The rest of this page is the evidence &mdash; including the evidence that cuts against it. The weekly index is how we find out.</p>
  </section>

`;

/* ---- 1. trimmed timeline (6 events, from 11) ---------------------------- */
const ev = (d, t, soon) =>
  `        <div class="tlrow${soon ? " soon" : ""}"><div class="tld">${d}</div><div class="tlt">${t}</div></div>`;
const shortTimeline = `      <div>
        <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin-bottom:10px">The gate being built</div>
        <div class="tlwrap">
${ev("Aug 2023", 'OpenAI publishes <b>GPTBot</b> with a robots.txt opt-out. Refusing an AI crawler becomes something a site can do.')}
${ev("Jul 2024", 'A study of 14,000 domains finds terms and robots.txt <b>contradicting each other</b>. <a href="https://arxiv.org/abs/2407.14933" rel="noopener">Source</a>')}
${ev("Jul 2025", 'Cloudflare begins blocking AI crawlers by default for new domains, with a pay-per-crawl toll in the same dashboard.')}
${ev("Sep 2025", 'Cloudflare says it serves <b>over a billion HTTP 402 responses a day</b>, and auto-applies <b>ai-train=no</b> to <b>3.8 million domains</b> at once. <a href="https://blog.cloudflare.com/x402/" rel="noopener">Source</a>')}
${ev("Feb&ndash;Jun 2026", 'Microsoft opens a marketplace paying publishers for content used in answers; Mastercard ships payments built for fractions of a cent at machine speed.')}
${ev("15 Sep 2026", 'Cloudflare blocks training and agent crawlers <b>by default on ad-bearing pages</b>, leaving search crawlers through. It has not happened yet.', true)}
        </div>
        <div class="tlnote">Each is a dated public announcement. Together they describe a gate, a price and a rail to settle on. None of them records <b>what any individual site declares</b>.</div>
      </div>`;

const shiftInner = secShift
  .replace(/<div class="evsplit">[\s\S]*$/, "")
  .replace(/^\s*<section[^>]*>\s*/, "")
  .replace(/<div class="ix">[\s\S]*?<\/div>\s*/, "");
const shiftProse = (secShift.match(/<div class="evsplit">\s*<div>([\s\S]*?)<\/div>\s*<div>/) || [, ""])[1];

const newShift = `  <section class="panel wide">
    <div class="ix"><span class="lead-in">The shift</span></div>
    <div class="evsplit">
      <div>
${shiftProse.trim()}
      </div>
${shortTimeline}
    </div>
  </section>

`;

/* ---- 2. one merged numbers box, one graphic ----------------------------- */
const merged = `  <section class="panel wide">
    <div class="ix"><span class="lead-in">The numbers</span></div>
    <h2>The pool grows slowly. What is <em>in</em> it changes fast.</h2>
    <div class="evsplit">
      <div>
        <p>Three infrastructure companies measured the automated share of web traffic in overlapping periods and landed <b>twenty points apart</b> &mdash; 37%, 53%, ~57%. All three sell bot mitigation. We show the spread rather than pick a headline, because the level is genuinely not settled.</p>
        <p>What <em>is</em> consistent is direction, and there are two speeds in it. Measured by one source with one method across three annual reports, the automated share creeps up about <b>a point and a half a year</b>. Over roughly the same window, AI training crawlers went from <b>22% to 52%</b> of all crawler activity.</p>
        <p style="margin-bottom:0"><b>That gap is the finding.</b> The volume of machine traffic is not exploding. Its composition is changing quickly &mdash; from indexing that sent you readers, to training that does not.</p>
      </div>
      <div>
        <div class="gcap">Automated share of traffic &middot; same question, three networks</div>
        <div style="margin-bottom:4px">
          <div class="evrow"><span class="evk">Fastly<small>Apr&ndash;Jul 2025</small></span><span class="evb"><span class="alt" style="width:37%"></span></span><span class="evv">37%</span></div>
          <div class="evrow"><span class="evk">Thales / Imperva<small>FY2025</small></span><span class="evb"><span style="width:53%"></span></span><span class="evv">53%</span></div>
          <div class="evrow"><span class="evk">Cloudflare<small>Jul 2026</small></span><span class="evb"><span style="width:57%"></span></span><span class="evv">~57%</span></div>
        </div>
        <div class="gcap" style="margin-top:18px">Two speeds &middot; level vs composition</div>
        <div class="gser" style="height:118px">
          <div class="gbar"><span class="gv">49.6%</span><span class="gf" style="height:49.6%"></span><span class="gl">2023</span></div>
          <div class="gbar"><span class="gv">51%</span><span class="gf" style="height:51%"></span><span class="gl">2024</span></div>
          <div class="gbar"><span class="gv">53%</span><span class="gf" style="height:53%"></span><span class="gl">2025</span></div>
          <div class="gbar" style="max-width:14px"><span class="gv">&nbsp;</span><span style="height:100%;width:1px;background:var(--line);display:block;margin:0 auto"></span><span class="gl">&nbsp;</span></div>
          <div class="gbar"><span class="gv">22%</span><span class="gf alt" style="height:22%"></span><span class="gl">Spr&nbsp;2025</span></div>
          <div class="gbar"><span class="gv">52%</span><span class="gf alt" style="height:52%"></span><span class="gl">Jun&nbsp;2026</span></div>
        </div>
        <div class="evnote"><b style="color:var(--signal)">Green</b>: automated share of <em>all</em> traffic (Thales/Imperva, 2024&ndash;2026 reports &mdash; one method, one denominator). <b style="color:#8A6A1F">Gold</b>: AI training crawlers as a share of <em>crawler</em> activity (<a href="https://blog.cloudflare.com/agentic-internet-bot-report/" rel="noopener">Cloudflare</a>, Jul 2026). Different denominators &mdash; the comparison is of <em>rates of change</em>, not of levels. Spread sources: <a href="https://www.cloudflare.com/press/press-releases/2026/cloudflare-introduces-precursor-one-click-behavioral-defense-against-modern-bots/" rel="noopener">Cloudflare</a> &middot; <a href="https://cpl.thalesgroup.com/about-us/newsroom/ai-driven-bot-attacks-surged-according-to-bad-bot-report" rel="noopener">Thales/Imperva</a> &middot; <a href="https://www.fastly.com/press/press-releases/new-fastly-threat-research-reveals-ai-crawlers-make-up-almost-80-of-ai-bot" rel="noopener">Fastly</a>.</div>
      </div>
    </div>
    <div class="evcaution"><b>Two cautions.</b> In September 2025 Cloudflare expected bot traffic to pass human traffic <em>&ldquo;by the end of 2029&rdquo;</em>; in July 2026 it reported this had already happened &mdash; so either the shift accelerated by three years in nine months, or the basis changed. And growth is not uniform: Bytespider fell about <b>85%</b> year on year, and ChatGPT-User volume fell quarter on quarter in 2026. The category grows; individual crawlers rise and fall sharply.</div>
  </section>

`;

/* ---- 6. gap + what-this-is, side by side --------------------------------- */
const pair = `  <div class="panels-pair">
${secGap.replace('  <section class="panel wide"', '  <section class="panel"').replace('  <section class="panel"', '  <section class="panel"')}
${secWhat.replace('  <section class="panel wide"', '  <section class="panel"')}
  </div>

`;

/* ---- 7. tighten "what becomes answerable" -------------------------------- */
const answer = secAnswer.replace('<section class="panel"', '<section class="panel wide"');

/* ---- reassemble ---------------------------------------------------------- */
const open = '<div class="wrap"><div class="panels">';
const i = s.indexOf(open) + open.length;
const rebuilt = "\n\n" + thesis + newShift + merged + secEcon + "\n\n" + secAgainst + "\n\n" + answer + "\n\n" + pair;
s = s.slice(0, i) + rebuilt + s.slice(i);

fs.writeFileSync(P, s);

const CSS = `
/* ---- two panels side by side inside the panels grid ---- */
.panels-pair{display:grid;grid-template-columns:1fr 1fr;gap:18px;grid-column:1/-1}
.panels-pair .panel{margin:0}
@media(max-width:860px){.panels-pair{grid-template-columns:1fr}}
`;
const T = "public/theme.css";
let t = fs.readFileSync(T, "utf8");
if (!t.includes("two panels side by side")) fs.writeFileSync(T, t + CSS);

console.log("why.html restructured");
console.log("  01 The thesis      — four sentences, takes a stance, now first");
console.log("  02 The shift       — prose + 6-event timeline (was 11)");
console.log("  03 The numbers     — level AND direction merged into one box, one graphic");
console.log("  04 The economics   — crawl-to-refer");
console.log("  05 Evidence against");
console.log("  06 What becomes answerable");
console.log("  07 The gap  |  What this is   (side by side)");
console.log("  retired: The legal backdrop (its job is the timeline's now)");
