#!/usr/bin/env node
/**
 * CPI — /why "The shift": a timeline  (node why-timeline.cjs)
 * ===========================================================================
 * "The shift" was a half-width column of prose with dead space beside it. The
 * claim it makes — that reading the web is becoming a transaction — is a claim
 * about a SEQUENCE, so it should be shown as one.
 *
 * Every entry is a dated, public, verifiable event with a source. The last
 * entry has not happened yet, which is the point of the section: the deadline
 * is on the calendar, and the record needs to exist before it arrives.
 *
 * Widens the section to two columns: prose left, timeline right.
 */
const fs = require("fs");
const P = "public/why.html";
let s = fs.readFileSync(P, "utf8");
if (s.includes("shift-timeline")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(P, P + ".bak-timeline");

const CSS = `
/* ---- the shift: dated sequence ---- */
.tlwrap{position:relative;padding-left:20px}
.tlwrap:before{content:"";position:absolute;left:4px;top:6px;bottom:10px;width:1px;background:var(--line)}
.tlrow{position:relative;padding:0 0 15px}
.tlrow:before{content:"";position:absolute;left:-20px;top:5px;width:9px;height:9px;border-radius:50%;background:#fff;border:2px solid var(--signal)}
.tlrow.soon:before{background:var(--signal)}
.tlrow .tld{font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.04em;color:var(--signal);text-transform:uppercase}
.tlrow .tlt{font-size:13.5px;color:var(--fg);line-height:1.45;margin-top:2px}
.tlrow .tlt a{color:var(--dim);text-decoration:underline;text-underline-offset:2px}
.tlrow .tlt a:hover{color:var(--signal)}
.tlrow.soon .tlt{font-weight:600}
.tlnote{font-size:11.5px;color:var(--dim);line-height:1.55;margin-top:6px;padding-top:10px;border-top:1px solid var(--line)}
@media(max-width:820px){.evsplit .tlwrap{margin-top:10px}}
`;

const ev = (date, text, soon) =>
  `        <div class="tlrow${soon ? " soon" : ""}"><div class="tld">${date}</div><div class="tlt">${text}</div></div>`;

const timeline = `      <div>
        <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin-bottom:10px">The gate being built &middot; dated, public events</div>
        <div class="tlwrap" id="shift-timeline">
${ev("Aug 2023", 'OpenAI publishes <b>GPTBot</b> and a robots.txt opt-out. Refusing an AI crawler becomes a thing a site can do.')}
${ev("Feb 2024", 'Reuters Institute finds <b>48%</b> of top news sites blocking OpenAI’s crawler by end-2023 &mdash; and not one reversing it. <a href="https://reutersinstitute.politics.ox.ac.uk/sites/default/files/2024-02/Fletcher_How_Many_News_Websites_Block_AI_Crawlers.pdf" rel="noopener">Source</a>')}
${ev("Jul 2024", 'The Data Provenance Initiative documents terms and robots.txt <b>contradicting each other</b> across 14,000 domains. <a href="https://arxiv.org/abs/2407.14933" rel="noopener">Source</a>')}
${ev("Jul 2025", 'Cloudflare begins blocking AI crawlers by default for new domains and offers a pay-per-crawl toll in the same dashboard.')}
${ev("Sep 2025", 'The <b>RSL</b> standard launches: machine-readable licensing terms, including pay-per-crawl and pay-per-inference, expressed in robots.txt. <a href="https://rslstandard.org/press/rsl-standard" rel="noopener">Source</a>')}
${ev("Sep 2025", 'Cloudflare and Coinbase launch the <b>x402 Foundation</b>, and Cloudflare states it serves <b>over a billion HTTP 402 responses a day</b> to crawlers. <a href="https://blog.cloudflare.com/x402/" rel="noopener">Source</a>')}
${ev("Sep 2025", 'A Content Signals Policy auto-applies <b>ai-train=no</b> to <b>3.8 million domains</b> at once &mdash; consent expressed by infrastructure, not by publishers. <a href="https://blog.cloudflare.com/content-signals-policy" rel="noopener">Source</a>')}
${ev("Sep 2025", 'Google announces <b>AP2</b> for agent payments with 60+ partners; Stripe and OpenAI ship agentic checkout the same month.')}
${ev("Feb 2026", 'Microsoft opens a <b>Publisher Content Marketplace</b>, paying publishers for content used in Copilot answers. <a href="https://about.ads.microsoft.com/en/blog/post/february-2026/building-toward-a-sustainable-content-economy-for-the-agentic-web" rel="noopener">Source</a>')}
${ev("Jun 2026", 'Mastercard launches <b>Agent Pay for Machines</b>, built explicitly for fractions-of-a-cent payments at machine speed. <a href="https://www.mastercard.com/global/en/news-and-trends/press/2026/june/mastercard-launches-agent-pay-for-machines.html" rel="noopener">Source</a>')}
${ev("15 Sep 2026", 'Cloudflare blocks training and agent crawlers <b>by default on ad-bearing pages</b>, while leaving search crawlers through. The largest single change to the web’s default posture toward AI &mdash; and it has not happened yet.', true)}
        </div>
        <div class="tlnote">Each entry is a dated public announcement or a published study, not an interpretation. Together they describe infrastructure: a gate, a price, a standard for expressing terms, and rails to settle on. What none of them record is <b>what any individual site actually declares</b> &mdash; which is the gap this index exists to fill.</div>
      </div>`;

/* ---- rebuild "The shift" as a two-column section ------------------------- */
const open = `  <section class="panel">
    <div class="ix"><span class="lead-in">The shift</span></div>`;
if (!s.includes(open)) throw new Error("The shift section not found");
const a = s.indexOf(open);
const b = s.indexOf("</section>", a) + "</section>".length;
const orig = s.slice(a, b);

// pull the existing prose (heading + paragraphs) out of the original section
const inner = orig.replace(open, "").replace(/\s*<\/section>\s*$/, "").trim();

const rebuilt = `  <section class="panel wide">
    <div class="ix"><span class="lead-in">The shift</span></div>
    <div class="evsplit">
      <div>
${inner.split("\n").map(l => "  " + l).join("\n")}
      </div>
${timeline}
    </div>
  </section>`;

s = s.slice(0, a) + rebuilt + s.slice(b);
fs.writeFileSync(P, s);

const T = "public/theme.css";
let t = fs.readFileSync(T, "utf8");
if (!t.includes("the shift: dated sequence")) fs.writeFileSync(T, t + CSS);

console.log("why.html: 'The shift' rebuilt as two columns — prose left, dated timeline right");
console.log("  11 dated public events, 8 with source links");
console.log("  final entry (15 Sep 2026) highlighted: it hasn't happened yet");
