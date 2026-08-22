#!/usr/bin/env node
/**
 * CPI — /why: answer the three questions the page was leaving open
 * ===========================================================================
 * 1. "Is the 53% in the left chart the same value as the 53% in Two speeds?"
 *    Yes — same source, same series. Nothing said so. Both are now marked with
 *    the same diamond and the caption names the tie.
 *
 * 2. "How are the two sub-graphs of Two speeds linked? Is one a subset?"
 *    Yes, nested — AI training crawlers sit inside crawler activity, which
 *    sits inside automated traffic — but the two percentages are shares of
 *    DIFFERENT denominators, which is exactly why the panel was confusing. A
 *    nesting strip now shows the containment explicitly, and says plainly that
 *    the middle step (crawler activity as a share of automated traffic) is not
 *    published by anyone. Better to draw the gap than to imply a chain that
 *    the sources do not support.
 *
 * 3. "Text full width, graphs side by side." Done — the prose runs the full
 *    measure above, and the two charts sit beside each other beneath it.
 *
 * Also: "How does 'The economics' support the narrative?" It is the strongest
 * panel on the page and its heading was hiding that. Search crawling was
 * barter — you index me, you send me readers, I am paid in traffic. Google
 * still returns a visitor for every 5 pages; Anthropic's crawler takes 38,065.
 * That collapse is the MOTIVE for a gate: when the implicit payment stops
 * arriving, sites start asking for an explicit one. The section is retitled
 * and reframed to say so, and to hand off to the panels that follow.
 *
 * And: the duplicate "The market is being built now" pull quote above the
 * footer is removed; the page-agnostic footer keeps its copy.
 */
const fs = require("fs");
const P = "public/why.html";
let s = fs.readFileSync(P, "utf8");
if (s.includes("nest-strip")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(P, P + ".bak-v3");

const sub = (from, to, label) => {
  if (!s.includes(from)) throw new Error("not found: " + label);
  s = s.split(from).join(to);
};

/* ---- 1. THE NUMBERS: prose full width, charts side by side -------------- */
const numStart = '    <div class="ix"><span class="lead-in">The numbers</span></div>';
const numEnd = '    <div class="evcaution"><b>Two cautions.</b>';
const a = s.indexOf(numStart), b = s.indexOf(numEnd);
if (a < 0 || b < 0) throw new Error("numbers section bounds not found");

const TIE = '<span class="tie" title="the same measurement, from the same source">&#9670;</span>';

const NUMBERS = `    <div class="ix"><span class="lead-in">The numbers</span></div>
    <h2>The pool grows slowly. What is <em>in</em> it changes fast.</h2>
    <p>Three infrastructure companies measured the automated share of web traffic in overlapping periods and landed <b>twenty points apart</b> &mdash; 37%, 53%, ~57%. All three sell bot mitigation. We show the spread rather than pick a headline, because the level is genuinely not settled.</p>
    <p>What <em>is</em> consistent is direction, and there are two speeds in it. Measured by one source with one method across three annual reports, the automated share creeps up about <b>a point and a half a year</b>. Over roughly the same window, AI training crawlers went from <b>22% to 52%</b> of all crawler activity.</p>
    <p><b>That gap is the finding.</b> The volume of machine traffic is not exploding. Its composition is changing quickly &mdash; from indexing that sent you readers, to training that does not.</p>

    <div class="nsplit">
      <div class="nbox">
        <div class="nbh">Automated share of traffic <span>same question, three networks</span></div>
        <div class="evrow"><span class="evk">Fastly<small>Apr&ndash;Jul 2025</small></span><span class="evb"><span class="alt" style="width:37%"></span></span><span class="evv">37%</span></div>
        <div class="evrow tied"><span class="evk">Thales / Imperva<small>FY2025</small></span><span class="evb"><span style="width:53%"></span></span><span class="evv">53%${TIE}</span></div>
        <div class="evrow"><span class="evk">Cloudflare<small>Jul 2026</small></span><span class="evb"><span style="width:57%"></span></span><span class="evv">~57%</span></div>
        <div class="nbf">A twenty-point spread on the same question. All three sell bot mitigation.<br>
        ${TIE} <b>This one figure also appears in the panel beside it</b> &mdash; it is the last point of the Thales/Imperva series, the only series measured the same way three years running.</div>
      </div>

      <div class="nbox">
        <div class="nbh">Two speeds <span>and how the two halves fit together</span></div>

        <div class="nest-strip">
          <div class="nrow n0"><span class="nk">All web traffic</span><span class="nv">100%</span></div>
          <div class="nrow n1 tied"><span class="nk">of which <b>automated</b></span><span class="nv">53%${TIE}</span></div>
          <div class="nrow n2"><span class="nk">of which <b>crawler</b> activity</span><span class="nv nu">not published</span></div>
          <div class="nrow n3"><span class="nk">of which <b>AI training</b> crawlers</span><span class="nv">52%</span></div>
        </div>
        <div class="nestnote">So yes &mdash; the two series below are nested, not parallel. But they are shares of <em>different</em> denominators, and nobody publishes the middle step, so the chain cannot be multiplied out. What can honestly be compared is how fast each one moves.</div>

        <div class="twin">
          <div class="tw">
            <div class="twl">Automated share of <b>all</b> traffic</div>
            <div class="cser">
              <div class="cbar"><span class="cv">49.6%</span><span class="ct"><i style="height:49.6%"></i></span><span class="cl">2023</span></div>
              <div class="cbar"><span class="cv">51%</span><span class="ct"><i style="height:51%"></i></span><span class="cl">2024</span></div>
              <div class="cbar tiedbar"><span class="cv">53%${TIE}</span><span class="ct"><i style="height:53%"></i></span><span class="cl">2025</span></div>
            </div>
            <div class="twd">+3.4pp <span>in two years</span></div>
          </div>
          <div class="tw">
            <div class="twl">AI training share of <b>crawler</b> activity</div>
            <div class="cser">
              <div class="cbar"><span class="cv">22%</span><span class="ct"><i class="alt" style="height:22%"></i></span><span class="cl">Spr 2025</span></div>
              <div class="cbar"><span class="cv">52%</span><span class="ct"><i class="alt" style="height:52%"></i></span><span class="cl">Jun 2026</span></div>
            </div>
            <div class="twd alt">+30pp <span>in ~14 months</span></div>
          </div>
        </div>
        <div class="nbf">Both axes run 0&ndash;100%, so the heights are comparable even though the denominators are not. Left: Thales/Imperva, 2024&ndash;2026 reports. Right: <a href="https://blog.cloudflare.com/agentic-internet-bot-report/" rel="noopener">Cloudflare</a>, Jul 2026. Spread sources: <a href="https://www.cloudflare.com/press/press-releases/2026/cloudflare-introduces-precursor-one-click-behavioral-defense-against-modern-bots/" rel="noopener">Cloudflare</a> &middot; <a href="https://cpl.thalesgroup.com/about-us/newsroom/ai-driven-bot-attacks-surged-according-to-bad-bot-report" rel="noopener">Thales/Imperva</a> &middot; <a href="https://www.fastly.com/press/press-releases/new-fastly-threat-research-reveals-ai-crawlers-make-up-almost-80-of-ai-bot" rel="noopener">Fastly</a>.</div>
      </div>
    </div>
`;
s = s.slice(0, a) + NUMBERS + s.slice(b);

/* ---- 2. THE ECONOMICS: say what it is actually arguing ------------------ */
sub(
  '    <div class="ix"><span class="lead-in">The economics, in public numbers</span></div>\n' +
  '    <h2>How many pages a platform takes, per visitor it sends back.</h2>',
  '    <div class="ix"><span class="lead-in">The motive</span></div>\n' +
  '    <h2>The trade that paid for the open web has stopped paying.</h2>',
  "economics heading"
);
sub(
  '        <p>This is the number that turns a technical question into an economic one. Search crawling was a trade: index my pages, send me readers. For AI crawling the exchange rate has moved by orders of magnitude.</p>',
  '        <p>Everything above describes a gate being built. This is <em>why anyone would want one</em>. Search crawling was barter: you index my pages, you send me readers, I am paid in traffic. Nobody signed anything, but the exchange rate held for twenty years &mdash; Google still returns a visitor for roughly every <b>5</b> pages it takes.</p>\n' +
  '        <p>Anthropic&rsquo;s crawler takes <b>38,065</b>. That is not a shifted exchange rate, it is a collapsed one. When the implicit payment stops arriving, a publisher has two options left: refuse, or charge. <b>Both of those are decisions written into robots.txt</b> &mdash; which is the behaviour this index counts, every week.</p>',
  "economics lede"
);

/* ---- 3. the duplicated pull quote --------------------------------------- */
sub(
  '    <p class="pull">The market is being built now. The record starts now too.</p>\n',
  '',
  "duplicate pull quote"
);

/* ---- 4. the market sizing gets a home ----------------------------------- */
const ANCHOR = '  <div class="panels-pair">';
if (!s.includes(ANCHOR)) throw new Error("panels-pair anchor not found");
const SIZING = `  <section class="panel wide" id="what-its-worth">
    <div class="ix"><span class="lead-in">What it could be worth</span></div>
    <h2>The honest answer is a range, so we publish the range and not a number.</h2>
    <div class="evsplit">
      <div>
        <p>The obvious next question is what a priced crawl-web adds up to. We will not put a figure on it here, because a single number would be a forecast dressed as a measurement, and the whole point of this index is the difference between those two things.</p>
        <p>What we will do is show the arithmetic and let you move the inputs: how many domains charge, what they charge, how often a crawler comes back. The output is a range that moves as you disagree with us &mdash; which is the only honest form this question has.</p>
        <p style="margin-bottom:0"><a class="btn" href="/estimate">Open the sensitivity tool &rarr;</a></p>
      </div>
      <div>
        <div class="nbox">
          <div class="nbh">Kept deliberately separate <span>estimate, not record</span></div>
          <div class="evrow"><span class="evk">The index<small>every figure measured</small></span><span class="evb"><span style="width:100%"></span></span><span class="evv">observed</span></div>
          <div class="evrow"><span class="evk">The estimate<small>your inputs, our arithmetic</small></span><span class="evb"><span class="alt" style="width:34%"></span></span><span class="evv">modelled</span></div>
          <div class="nbf">The estimate lives on its own page and is never folded into the weekly record, cited as a finding, or quoted in the newsletter. If the two ever appear together, the modelled one says so.</div>
        </div>
      </div>
    </div>
  </section>

${ANCHOR}`;
s = s.replace(ANCHOR, SIZING);

fs.writeFileSync(P, s);

/* ---- styles -------------------------------------------------------------- */
const T = "public/theme.css";
let t = fs.readFileSync(T, "utf8");
if (!t.includes("nest-strip")) {
  t += `
/* ---- /why "The numbers": charts side by side under full-width prose ---- */
.nsplit{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px;align-items:start}
.nsplit .nbox{margin-bottom:0}
@media(max-width:900px){.nsplit{grid-template-columns:1fr}}

/* the same figure appearing in two charts, marked so the reader can see it */
.tie{color:var(--amber);font-size:10px;vertical-align:super;margin-left:3px;letter-spacing:0}
.evrow.tied .evk,.nrow.tied .nk{font-weight:600}
.evrow.tied .evb{outline:1px solid rgba(138,106,31,.45);outline-offset:1px;border-radius:2px}
.cbar.tiedbar .ct{outline:1px solid rgba(138,106,31,.45);outline-offset:1px}

/* containment: which denominator sits inside which */
.nest-strip{margin:2px 0 8px}
.nrow{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:12.5px;padding:4px 0;position:relative}
.nrow .nk{color:var(--fg)}
.nrow .nv{font-family:ui-monospace,Menlo,monospace;font-size:12.5px;font-weight:600;white-space:nowrap}
.nrow .nv.nu{font-weight:400;color:var(--dim);font-style:italic}
.nrow.n1{padding-left:14px}.nrow.n2{padding-left:28px}.nrow.n3{padding-left:42px}
.nrow.n1 .nk,.nrow.n2 .nk,.nrow.n3 .nk{position:relative}
.nrow.n1 .nk:before,.nrow.n2 .nk:before,.nrow.n3 .nk:before{content:"";position:absolute;left:-10px;top:-6px;bottom:8px;width:1px;background:var(--line)}
.nrow.n1 .nk:after,.nrow.n2 .nk:after,.nrow.n3 .nk:after{content:"";position:absolute;left:-10px;top:8px;width:6px;height:1px;background:var(--line)}
.nrow.n2 .nv.nu{font-size:11.5px}
.nestnote{font-size:11.5px;color:var(--dim);line-height:1.5;padding:8px 0 10px;margin-bottom:6px;border-bottom:1px solid var(--line)}
`;
  fs.writeFileSync(T, t);
}

/* ---- verify -------------------------------------------------------------- */
const out = fs.readFileSync(P, "utf8");
for (const m of ["nest-strip", "nsplit", "The trade that paid for the open web", "what-its-worth", "38,065"])
  if (!out.includes(m)) throw new Error("missing after patch: " + m);
if (out.includes('<p class="pull">The market is being built now')) throw new Error("duplicate pull quote survived");
if (out.includes("How many pages a platform takes, per visitor it sends back")) throw new Error("old economics heading survived");
if ((out.match(/<section class="panel/g) || []).length !== (out.match(/<\/section>/g) || []).length)
  throw new Error("section tags unbalanced");

console.log("/why rebuilt");
console.log("  The numbers  — prose full width, the two charts side by side");
console.log("               — the 53% is marked in BOTH charts as the same measurement");
console.log("               — a nesting strip answers 'is one a subset of the other': yes,");
console.log("                 and it says plainly that the middle step is not published");
console.log("  The motive   — was 'The economics'; now states the argument: the barter");
console.log("                 collapsed (5:1 vs 38,065:1), so sites refuse or charge");
console.log("  Market sizing has a home again, as a panel linking to /estimate");
console.log("  duplicate 'The market is being built now' pull quote removed");
