#!/usr/bin/env node
/**
 * CPI — fix our own machine-readable licence, and say in the methodology
 *       that we measure ourselves
 * ===========================================================================
 * (2) THE METHODOLOGY NOTE. Three of four reviewers said CPI should be
 *     included in its own frame and disclose it, rather than exempting
 *     itself. The argument that won: a measurer that removes itself has
 *     established that the operator decides which observations are
 *     inconvenient — and the next question is what happens when a paying
 *     customer asks for the same treatment.
 *
 * (4) AND A PROBLEM FOUND WHILE ANSWERING THE x402 QUESTION.
 *     Our own /rsl.xml uses field values that are not in RSL 1.0. Checked
 *     against the specification:
 *
 *       usage classes   all · ai-all · ai-train · ai-input · ai-index · search
 *       payment types   purchase · subscription · training · crawl · use ·
 *                       contribution · attribution · free
 *
 *     We published:
 *       permits type="usage">ai-summarize   <-  not a usage class
 *       permits type="usage">train-ai       <-  inverted; it is ai-train
 *       payment type="per-crawl"            <-  not a payment type; it is
 *                                               crawl, or training
 *
 *     So the licence a machine fetches from the site that measures
 *     machine-readable licences would not parse. Three invented tokens on a
 *     product whose entire claim is precision about this exact file.
 *
 *     Also stale: the comment quotes "EUR 79/mo" for the Terminal, which
 *     sells at EUR 49/mo. And robots.txt says "see our pay-per-crawl price
 *     above" when no price appears above it — the price is in rsl.xml.
 *
 * NOTHING HERE CHANGES WHAT WE CHARGE OR WHAT WE PERMIT. The intent is
 * preserved exactly: citation and answer-use free with attribution, training
 * priced at the index-linked rate. Only the tokens become the ones the
 * standard actually defines.
 */
const fs = require("fs");

/* ---------- 1. rsl.xml, in valid RSL 1.0 --------------------------------- */
const R = "public/rsl.xml";
const before = fs.readFileSync(R, "utf8");
if (!before.includes("ai-summarize")) { console.log("rsl.xml: already valid"); }
else {
  fs.copyFileSync(R, R + ".bak-selfdecl");
  fs.writeFileSync(R, `<?xml version="1.0" encoding="UTF-8"?>
<rsl xmlns="https://rslstandard.org/rsl">
  <content url="/">
    <!-- Search, indexing and answer-use: free, with attribution.
         These uses cite us, and citation is our distribution. Field values
         are RSL 1.0 usage classes: search, ai-index, ai-input. -->
    <license>
      <permits type="usage">search</permits>
      <permits type="usage">ai-index</permits>
      <permits type="usage">ai-input</permits>
      <payment type="attribution"/>
    </license>
    <!-- Training: priced. The rate is index-linked — twice the highest
         per-crawl price observed anywhere in our own dataset, which is
         currently USD 0.50 (stackoverflow.com). It is a reserve price set by
         our own benchmark, not a claim about the market clearing rate;
         documented rates elsewhere run far lower. -->
    <license>
      <permits type="usage">ai-train</permits>
      <payment type="training">
        <amount currency="USD">1.00</amount>
        <custom>https://crawlpriceindex.com/#access</custom>
      </payment>
    </license>
  </content>
  <!-- Humans read free. Machines that cite us read free. Machines that train
       on us pay the index rate, or license the full per-domain dataset
       through the Terminal. Prices: https://crawlpriceindex.com/#access -->
</rsl>
`);
  console.log("rsl.xml rewritten in valid RSL 1.0");
  console.log("  ai-summarize -> ai-input (+ ai-index)   train-ai -> ai-train   per-crawl -> training");
  console.log("  dropped the stale EUR 79/mo comment (Terminal is EUR 49/mo)");
}

/* ---------- 2. robots.txt: the cross-reference pointed at nothing -------- */
const B = "public/robots.txt";
let b = fs.readFileSync(B, "utf8");
if (b.includes("price above")) {
  fs.copyFileSync(B, B + ".bak-selfdecl");
  b = b.replace(
    "# Training use is not granted free: see our pay-per-crawl price above.",
    "# Training use is not granted free: the price is in the licence below."
  );
  b = b.replace(
    "# Our machine-readable feed is available to AI agents via pay-per-crawl.",
    "# Our machine-readable feed is available to AI agents under the licence below."
  );
  fs.writeFileSync(B, b);
  console.log("robots.txt: fixed a cross-reference to a price that was not above it");
} else console.log("robots.txt: already fixed");

/* ---------- 3. the methodology note -------------------------------------- */
const M = "public/methodology.html";
let m = fs.readFileSync(M, "utf8");
if (m.includes("does not remove itself")) { console.log("methodology: already states it"); }
else {
  fs.copyFileSync(M, M + ".bak-selfdecl");
  const anchor = `  <li><b>ccTLD is a domain suffix, not a country.</b>`;
  if (!m.includes(anchor)) throw new Error("methodology anchor not found");
  const note = `  <li><b>The index does not remove itself from the frame.</b> crawlpriceindex.com is measured
    under exactly the same rules as every other domain, and so is any customer, partner or
    competitor that appears in the frame. Our own robots.txt carries a hand-written
    <code>Content-Signal</code> line and a <code>License:</code> directive, which places us
    inside the small group of domains that declare terms about AI use &mdash; a group we also
    count. We disclose that rather than exempting ourselves, because a measurer who removes
    inconvenient observations has already conceded the point. No domain is ever excluded on
    request.</li>
`;
  m = m.replace(anchor, note + anchor);
  fs.writeFileSync(M, m);
  console.log("methodology: added the self-inclusion rule");
}

/* ---------- verify -------------------------------------------------------- */
const rsl = fs.readFileSync(R, "utf8");
const VALID_USAGE = ["all", "ai-all", "ai-train", "ai-input", "ai-index", "search"];
const VALID_PAY = ["purchase", "subscription", "training", "crawl", "use", "contribution", "attribution", "free"];
for (const mm of rsl.matchAll(/<permits[^>]*>([^<]+)</g)) {
  const v = mm[1].trim();
  if (!VALID_USAGE.includes(v)) throw new Error("invalid RSL usage class in our own file: " + v);
}
for (const mm of rsl.matchAll(/<payment[^>]*type="([^"]+)"/g)) {
  if (!VALID_PAY.includes(mm[1])) throw new Error("invalid RSL payment type in our own file: " + mm[1]);
}
if (/EUR 79|79\/mo/.test(rsl)) throw new Error("the stale EUR 79 price survived");
if (!fs.readFileSync(B, "utf8").includes("licence below")) throw new Error("robots.txt not fixed");
if (!fs.readFileSync(M, "utf8").includes("does not remove itself")) throw new Error("methodology note missing");

console.log("");
console.log("verified: every usage class and payment type in our own licence is one the");
console.log("standard defines. Checked against RSL 1.0:");
console.log("  usage   " + VALID_USAGE.join(" · "));
console.log("  payment " + VALID_PAY.join(" · "));
