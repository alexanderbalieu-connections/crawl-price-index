#!/usr/bin/env node
/**
 * CPI — homepage: teach before you show
 * ===========================================================================
 * Feedback: "we go into data findings super quickly… I don't think we even
 * define what a crawler is, or a trainer… too deep too fast."
 *
 * Correct, and the jump from box 1 to box 2 was the proof: box 1 said we count
 * five declared states across 18 crawlers, and box 2 immediately drew a
 * conclusion about "training versus traffic" — a distinction the page had
 * never introduced. Someone who does not already know what a crawler is has no
 * way in.
 *
 * The fix is not less data. It is two sections in front of the data:
 *
 *   01  WHAT IS HAPPENING   plain language, no figures, a diagram of the
 *                           actual mechanism: one page, one robots.txt, three
 *                           kinds of reader. This is where "training" and
 *                           "traffic" get defined, so box 04 lands.
 *   02  WHAT WE MEASURE     the census, expanded — because we no longer only
 *                           scan robots.txt on 50k domains, and the page never
 *                           said so.
 *   03  THIS WEEK           three figures in plain English before any analysis
 *
 * Then the existing analysis in increasing depth, with the most intuitive cut
 * (who gets blocked) moved up and the most speculative (the machine market)
 * moved down. Ends with three cards pointing at the sub-pages, which is the
 * hierarchy that was missing.
 *
 * Removed, as asked: "Coverage & method" (its content folds into 02) and "The
 * Weekly Crawl" (the footer already carries the same form).
 */
const fs = require("fs");
const P = "public/index.html";
let s = fs.readFileSync(P, "utf8");
if (s.includes("v3-explainer")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(P, P + ".bak-v3");

/* ---------- helpers ------------------------------------------------------ */
const cutSection = (marker, label) => {
  const i = s.indexOf(marker);
  if (i < 0) throw new Error("not found: " + label);
  const a = s.lastIndexOf("  <section", i);
  const b = s.indexOf("</section>", i) + "</section>".length;
  const html = s.slice(a, b);
  s = s.slice(0, a) + s.slice(b);
  return html;
};

/* lift every analysis panel out so the page can be re-laid in order */
const secCensus  = cutSection('<span class="lead-in">The census</span>', "census");
const secAsym    = cutSection('<span class="lead-in">Training versus traffic</span>', "asymmetry");
const secChanges = cutSection('<span class="lead-in">What changed this week</span>', "changes");
const secReach   = cutSection('<span class="lead-in">Declared versus enforced</span>', "reachability");
const secBazaar  = cutSection('<span class="lead-in">The machine market</span>', "bazaar");
const secTrend   = cutSection('<span class="lead-in">The wall is rising</span>', "trend");
const secLadder  = cutSection('<span class="lead-in">Who gets blocked</span>', "ladder");
const secDoor    = cutSection('<span class="lead-in">How the door answers</span>', "door");
cutSection('<span class="lead-in">Coverage &amp; method</span>', "coverage");   // removed
cutSection('<span class="lead-in">The Weekly Crawl &mdash; free</span>', "weekly"); // removed

/* ---------- 01 what is actually happening -------------------------------- */
const EXPLAINER = `  <section class="panel wide" id="v3-explainer">
    <div class="ix"><span class="lead-in">Start here</span></div>
    <h2>Most of what reads your website now is software. It does not all want the same thing.</h2>
    <div class="exsplit">
      <div>
        <p>A <b>crawler</b> is a program that fetches web pages automatically. There have always been crawlers &mdash; that is how search engines find anything &mdash; but what they are <em>for</em> has split in two, and the split is the whole reason this site exists.</p>
        <p>A <b>training crawler</b> copies your page into the material a model is built from. You are not paid, and no reader arrives. A <b>search crawler</b> indexes your page so a person can find it, and sends that person to you. Same request, same protocol, completely different bargain.</p>
        <p>A site answers both of them in one plain text file at its root, called <code>robots.txt</code>. It can name a crawler and say no. Almost nothing else on the web is as consequential and as little recorded.</p>
        <p style="margin-bottom:0"><b>Nobody was writing the answers down.</b> So every week we ask 50,000 sites what they have said, one at a time, and keep the record. That record is this index.</p>
      </div>
      <div>
        <div class="gcap">One page, one gate, three kinds of reader</div>
        <div class="mech">
          <div class="mrow">
            <span class="mwho">A person</span>
            <span class="marr" aria-hidden="true">&rarr;</span>
            <span class="mgate">robots.txt<small>does not apply</small></span>
            <span class="marr" aria-hidden="true">&rarr;</span>
            <span class="mpage">your page</span>
          </div>
          <div class="mrow">
            <span class="mwho">A <b>search</b> crawler<small>indexes it, may send a reader</small></span>
            <span class="marr" aria-hidden="true">&rarr;</span>
            <span class="mgate">robots.txt<small>allow or refuse</small></span>
            <span class="marr" aria-hidden="true">&rarr;</span>
            <span class="mpage">your page</span>
          </div>
          <div class="mrow hi">
            <span class="mwho">A <b>training</b> crawler<small>copies it into a model</small></span>
            <span class="marr" aria-hidden="true">&rarr;</span>
            <span class="mgate">robots.txt<small>allow or refuse</small></span>
            <span class="marr" aria-hidden="true">&rarr;</span>
            <span class="mpage">your page</span>
          </div>
        </div>
        <div class="mechnote"><b>robots.txt is a request, not a lock.</b> It states a policy; it does not enforce one. Whether the door behaves the same way is a separate measurement, and we keep the two apart everywhere on this site.</div>
      </div>
    </div>
  </section>

`;

/* ---------- 02 what we measure: the census, expanded ---------------------- */
const censusInner = secCensus
  .replace(/^\s*<section[^>]*>\s*/, "")
  .replace(/\s*<\/section>\s*$/, "")
  .replace('<div class="ix"><span class="lead-in">The census</span></div>', '')
  .replace('<h2>What we count, and what we count it against.</h2>', '');

const CENSUS = `  <section class="panel wide" id="v2-census">
    <div class="ix"><span class="lead-in">What we measure</span></div>
    <h2>What we count, and what we count it against.</h2>
${censusInner.trim()}
    <div class="alsogrid">
      <div class="alsoc"><b>The declared layer</b><span>Every edition: 50,000 ranked domains &times; 18 named AI crawlers, read one domain at a time from <code>robots.txt</code>. Five states, never collapsed into &ldquo;blocked or not&rdquo;.</span></div>
      <div class="alsoc"><b>Is the domain even there</b><span>The same frame is swept for whether it answers at all &mdash; alive, dead name, timeout, or serving a file then refusing an identified crawler at the door.</span></div>
      <div class="alsoc"><b>What the door actually does</b><span>A hand-probed exhibit set, knocked on as an identified AI crawler, to see what comes back: a price, a payment wall, a token demand, or a refusal.</span></div>
      <div class="alsoc"><b>The machine-payment registry</b><span>A public registry of endpoints advertising a price a machine can pay directly &mdash; captured alongside, because it is the same question asked from the other side.</span></div>
    </div>
    <p style="font-size:11.5px;color:var(--dim);margin-top:14px">Every rate on this site is quoted against the domains that actually served a readable file &mdash; never against &ldquo;the web&rdquo;. <a class="lnk" href="/methodology" style="color:var(--signal)">Full methodology &rarr;</a></p>
  </section>

`;

/* ---------- 03 this week, in three numbers -------------------------------- */
const THISWEEK = `  <section class="panel wide" id="v3-thisweek">
    <div class="ix"><span class="lead-in">This week</span></div>
    <h2>Three figures, in plain English.</h2>
    <div class="twk" id="v3-twk"></div>
    <p style="font-size:11.5px;color:var(--dim);margin-top:14px">Declared policy only. These are the figures the rest of this page unpacks &mdash; and they are free to cite with attribution.</p>
  </section>

`;

/* ---------- 10 where to go next ------------------------------------------- */
const NEXT = `  <section class="panel wide" id="v3-next">
    <div class="ix"><span class="lead-in">Where to go next</span></div>
    <h2>Three ways in, depending on what you came for.</h2>
    <div class="nextgrid">
      <a class="nextc" href="/why">
        <span class="nk">The argument</span>
        <b>Why it matters</b>
        <span class="nd">What we think is happening to the web, the public evidence for it, and the evidence against it. Start here if you want the thesis rather than the numbers.</span>
        <span class="ng">Read the case &rarr;</span>
      </a>
      <a class="nextc" href="/explore">
        <span class="nk">The data</span>
        <b>Explore the index</b>
        <span class="nd">This edition&rsquo;s figures, every tracked crawler, and a look inside the full dashboard before you sign up for anything.</span>
        <span class="ng">Open the data &rarr;</span>
      </a>
      <a class="nextc" href="/check">
        <span class="nk">Your site</span>
        <b>Check a domain</b>
        <span class="nd">What one domain declares to all 18 crawlers, how that compares with its rank band, and how to publish your own terms. Free, no account.</span>
        <span class="ng">Look up a domain &rarr;</span>
      </a>
    </div>
  </section>

`;

/* ---------- re-lay the page ----------------------------------------------- */
const open = '<div class="wrap"><div class="panels">';
const i = s.indexOf(open) + open.length;
const body = "\n\n" + EXPLAINER + CENSUS + THISWEEK +
  secAsym + "\n\n" + secChanges + "\n\n" + secReach + "\n\n" +
  secLadder + "\n\n" + secTrend + "\n\n" + secDoor + "\n\n" + secBazaar + "\n\n" + NEXT;
s = s.slice(0, i) + body + s.slice(i);

/* the removed Coverage panel owned the four #f-* spans the old loader filled */
s = s.replace(
  `set('f-parsed', (D.robots_parsed||0).toLocaleString());
set('f-topn', (D.tranco_top_n||50000).toLocaleString());
set('f-gpt', D.block_gpt!=null?D.block_gpt:'\\u2014');`,
  `/* the Coverage & method panel was removed; its figures live in "What we
   measure" and "This week" now, so these setters have nothing to fill. */`
);
s = s.replace(`set('f-price', D.observed_price!=null?D.observed_price:'\\u2014');\n`, "");

/* ---------- the three-number renderer ------------------------------------- */
const TWK = `
    /* --- 03 This week: the headline figures, said in words first --------- */
    var tw = document.getElementById("v3-twk");
    if (tw && d.block_rates && d.asymmetry_headline && d.changes_headline) {
      var gpt = d.block_rates.pct && d.block_rates.pct.GPTBot;
      var A = d.asymmetry_headline, C = d.changes_headline;
      var card = function (fig, head, body) {
        return '<div class="twkc"><div class="twkf">' + fig + '</div>' +
          '<div class="twkh">' + head + '</div><div class="twkb">' + body + '</div></div>';
      };
      tw.innerHTML =
        card(gpt != null ? gpt + "%" : "&mdash;",
             "of sites refuse OpenAI&rsquo;s training crawler",
             "Out of " + n(A.denominator) + " domains that serve a readable robots.txt. The most-refused crawler we track, and the one most people have heard of.") +
        card(A.ratio + " : 1",
             "they say no to training far more than to search",
             n(A.blocks_training_role_only) + " domains block a training crawler while blocking no search crawler. Only " + n(A.blocks_search_role_only) + " do the reverse. Sites are not anti-robot; they are drawing a line about what the robot is for.") +
        card(n(C.total),
             "policy edits since the last edition",
             "Across " + n(C.domains_changed) + " domains, " + n(C.more_restrictive) + " toward refusal and " + n(C.less_restrictive) + " away from it. A week that is not measured cannot be reconstructed later.");
    }
`;
s = s.replace(
  '    var A = d.asymmetry_headline, ae = document.getElementById("v2-asym");',
  TWK + '\n    var A = d.asymmetry_headline, ae = document.getElementById("v2-asym");'
);

fs.writeFileSync(P, s);

/* ---------- styles --------------------------------------------------------- */
const T = "public/theme.css";
let t = fs.readFileSync(T, "utf8");
if (!t.includes("homepage v3")) {
  t += `
/* ---- homepage v3: the on-ramp ---- */
.exsplit{display:grid;grid-template-columns:1.05fr .95fr;gap:34px;align-items:start;margin-top:6px}
@media(max-width:900px){.exsplit{grid-template-columns:1fr;gap:24px}}

/* the mechanism, drawn rather than described */
.mech{border:1px solid var(--line);border-radius:4px;background:#fff;padding:4px 14px}
.mrow{display:grid;grid-template-columns:1fr auto 1fr auto auto;gap:10px;align-items:center;padding:13px 0;border-bottom:1px solid var(--line)}
.mrow:last-child{border-bottom:0}
.mrow>span{min-width:0}
.mwho{font-size:12.5px;color:var(--fg);line-height:1.3}
.mwho small,.mgate small{display:block;font-size:11px;color:var(--dim);line-height:1.35;margin-top:2px}
.marr{color:var(--line);font-size:15px}
.mgate{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;color:var(--dim);background:var(--sand);border:1px solid var(--line);border-radius:2px;padding:5px 8px;text-align:center;line-height:1.25}
.mgate small{font-family:var(--sans)}
.mpage{font-size:12px;color:var(--dim);white-space:nowrap}
.mrow.hi .mwho{font-weight:600}
.mrow.hi .mgate{border-color:var(--amber);color:var(--amber)}
.mechnote{font-size:11.5px;color:var(--dim);line-height:1.55;margin-top:10px;padding-top:9px;border-top:1px solid var(--line)}
@media(max-width:560px){.mrow{grid-template-columns:1fr;gap:4px}.marr{display:none}.mgate{text-align:left}}

/* what else we capture */
.alsogrid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:20px}
.alsoc{border-top:2px solid var(--signal);padding-top:10px;min-width:0}
.alsoc b{display:block;font-size:12.5px;margin-bottom:4px}
.alsoc span{font-size:12px;color:var(--dim);line-height:1.5}
@media(max-width:900px){.alsogrid{grid-template-columns:1fr 1fr}}
@media(max-width:560px){.alsogrid{grid-template-columns:1fr}}

/* three figures, in words */
.twk{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:16px}
.twkc{min-width:0;border-left:2px solid var(--signal);padding-left:14px}
.twkf{font-family:var(--serif);font-size:clamp(28px,4vw,40px);line-height:1;color:var(--fg)}
.twkh{font-size:14px;color:var(--fg);margin-top:8px;line-height:1.35;font-weight:600}
.twkb{font-size:12.5px;color:var(--dim);margin-top:7px;line-height:1.55}
@media(max-width:820px){.twk{grid-template-columns:1fr;gap:18px}}

/* where next */
.nextgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:16px}
.nextc{display:flex;flex-direction:column;gap:5px;border:1px solid var(--line);border-radius:4px;background:#fff;padding:16px 18px;text-decoration:none;min-width:0}
.nextc:hover{border-color:var(--signal)}
.nextc .nk{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--signal);font-weight:600}
.nextc b{font-family:var(--serif);font-size:19px;font-weight:400;color:var(--fg)}
.nextc .nd{font-size:12.5px;color:var(--dim);line-height:1.55;flex:1}
.nextc .ng{font-size:12.5px;color:var(--signal);font-weight:600;margin-top:6px}
@media(max-width:820px){.nextgrid{grid-template-columns:1fr}}
`;
  fs.writeFileSync(T, t);
}

/* ---------- verify --------------------------------------------------------- */
const out = fs.readFileSync(P, "utf8");
for (const m of ["v3-explainer", "v3-thisweek", "v3-next", "v3-twk", "mechnote", "alsogrid"])
  if (!out.includes(m)) throw new Error("missing after patch: " + m);
// scope to the page body: the shared footer keeps its own Weekly Crawl card,
// which is exactly what makes the panel version redundant
const body = out.slice(0, out.indexOf('<footer class="sitefoot">'));
for (const g of ["Coverage &amp; method", "The Weekly Crawl", "f-parsed", "f-topn", "f-gpt", "f-price"])
  if (body.includes(g)) throw new Error("should have been removed: " + g);
if ((out.match(/<section class="panel/g) || []).length !== (out.match(/<\/section>/g) || []).length)
  throw new Error("section tags unbalanced");

const order = ["Start here", "What we measure", "This week", "Training versus traffic",
               "What changed this week", "Declared versus enforced", "Who gets blocked",
               "The wall is rising", "How the door answers", "The machine market", "Where to go next"];
let at = 0;
for (const o of order) {
  const k = out.indexOf(">" + o + "<", at);
  if (k < 0) throw new Error("panel out of order or missing: " + o);
  at = k;
}

console.log("homepage rebuilt — teaches before it shows");
console.log("  01 Start here        NEW · what a crawler is, training vs search, robots.txt");
console.log("                       with a diagram of the actual mechanism, no figures");
console.log("  02 What we measure   census + the three things we capture beyond the 50k scan");
console.log("  03 This week         NEW · three figures explained in a sentence each");
console.log("  04-10                the analysis, easiest cut first, most speculative last");
console.log("  11 Where to go next  three cards → /why, /explore, /check");
console.log("  removed: Coverage & method (folded into 02), The Weekly Crawl (footer has it)");
console.log("  order asserted by the guard, so a later edit cannot silently shuffle it");
