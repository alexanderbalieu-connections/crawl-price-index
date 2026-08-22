#!/usr/bin/env node
/**
 * CPI — /about: the founder box in Alex's own voice
 * ===========================================================================
 * Feedback: "Make it more personal", with the raw material supplied. Also: add
 * the LinkedIn logo under the photo, and "Subscriptions. Nothing else." is not
 * quite true when the sentence underneath mentions snapshots.
 *
 * The placeholder bio was written in a careful third-person register that read
 * like an About page and nothing like him. What he sent is enthusiastic, and
 * that is the useful part — a solo index run by someone visibly interested in
 * the subject is more credible than one run by an anonymous professional
 * voice, not less. Kept his phrasing where it carries ("I love getting lost in
 * data", the nerd line), tightened the joins, and left the one sentence that
 * establishes standing — ten years analysing for financial institutions —
 * doing that job plainly.
 *
 * The claim that the project "will change everything" is his about the shift,
 * not about the index, so it is attributed to the thesis and linked to /why
 * rather than left as a founder boast on a page about impartiality.
 */
const fs = require("fs");
const P = "public/about.html";
let s = fs.readFileSync(P, "utf8");
if (s.includes("li-badge")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(P, P + ".bak-personal");

const sub = (from, to, label) => {
  if (!s.includes(from)) throw new Error("not found: " + label);
  s = s.split(from).join(to);
};

/* ---- the founder box ---------------------------------------------------- */
const OLD_START = '        <h2 style="margin-top:0">Alexander Balieu</h2>';
const OLD_END = '        <p style="margin-bottom:0"><a class="lnk" style="color:var(--signal);font-weight:600" href="https://www.linkedin.com/in/alexander-balieu-24041991/" rel="noopener">Alexander Balieu on LinkedIn &rarr;</a></p>';
const a = s.indexOf(OLD_START);
const b = s.indexOf(OLD_END);
if (a < 0 || b < 0) throw new Error("founder box bounds not found");

const BIO = `        <h2 style="margin-top:0">Alexander Balieu</h2>
        <p class="lede" style="font-size:17px;margin:-2px 0 14px">I love getting lost in data. This project is the intersection of the three things I find hardest to put down: analysis, spotting a pattern before anyone has named it, and watching what AI is actually doing rather than what it is said to be doing.</p>
        <p>By trade I am a freelance consultant and analyst for financial institutions &mdash; banks, funds &mdash; with ten years of it behind me. That work is where the habit comes from: the first question about any number is who produced it, against what denominator, and whether anyone else could reproduce it. Almost nothing published about AI and the web survives that question. Block rates get quoted as shares of &ldquo;the web&rdquo; with no frame; prices get cited with no sample size.</p>
        <p>Data and AI started as the hobby I disappeared into at the weekend. The Crawl Price Index is what happened when it stopped staying in the weekend. I built the crawler, the pipeline, the dashboard and the methodology, and I take the weekly edition myself. I get carried away in the detail, which for this particular job turns out to be the right defect &mdash; and <a class="lnk" style="color:var(--signal)" href="/why">what is being measured here</a> is going to change a great deal about how the web works.</p>
        <p style="margin-bottom:0">I am happy to talk about any of it &mdash; the method, the numbers, where they are weak. <a class="lnk" style="color:var(--signal);font-weight:600" href="mailto:hello@crawlpriceindex.com">Email me</a> or connect on LinkedIn.</p>`;

s = s.slice(0, a) + BIO + s.slice(b + OLD_END.length);

/* ---- LinkedIn badge under the photo ------------------------------------- */
sub(
  '      <div id="mugwrap" style="flex:0 0 auto"></div>',
  '      <div style="flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:10px">\n' +
  '        <div id="mugwrap"></div>\n' +
  '        <a class="li-badge" href="https://www.linkedin.com/in/alexander-balieu-24041991/" rel="noopener" aria-label="Alexander Balieu on LinkedIn">\n' +
  '          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z"/></svg>\n' +
  '          <span>LinkedIn</span>\n' +
  '        </a>\n' +
  '      </div>',
  "mug wrapper"
);

/* ---- "Subscriptions. Nothing else." was not quite true ------------------ */
sub(
  '    <h2>Subscriptions. Nothing else.</h2>\n' +
  '    <p>The index is funded by subscriptions to the full dataset and by one-off snapshot purchases.',
  '    <h2>Readers. Nobody in the market.</h2>\n' +
  '    <p>The index is funded by subscriptions to the full dataset and by one-off snapshot purchases &mdash; that is the whole of it.',
  "funding heading"
);

fs.writeFileSync(P, s);

/* ---- the badge style ---------------------------------------------------- */
const T = "public/theme.css";
let t = fs.readFileSync(T, "utf8");
if (!t.includes(".li-badge")) {
  t += `
/* ---- LinkedIn badge under the founder photo ---- */
.li-badge{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:var(--signal);
  text-decoration:none;border:1px solid var(--line);border-radius:3px;padding:6px 12px;background:#fff}
.li-badge:hover{border-color:var(--signal);background:var(--sand)}
.li-badge svg{flex:0 0 auto}
`;
  fs.writeFileSync(T, t);
}

const out = fs.readFileSync(P, "utf8");
for (const m of ["li-badge", "I love getting lost in data", "Readers. Nobody in the market."])
  if (!out.includes(m)) throw new Error("missing after patch: " + m);
if (out.includes("PLACEHOLDER BIO")) throw new Error("placeholder bio survived");
if (out.includes("Draft biography")) throw new Error("draft notice survived");
if (out.includes("Subscriptions. Nothing else.")) throw new Error("old heading survived");

console.log("/about founder box rewritten in his own voice");
console.log("  placeholder bio and the 'draft biography' notice removed");
console.log("  LinkedIn badge with the logo sits under the photo");
console.log("  'Subscriptions. Nothing else.' -> 'Readers. Nobody in the market.'");
console.log("    (the old heading was contradicted by the sentence below it)");
