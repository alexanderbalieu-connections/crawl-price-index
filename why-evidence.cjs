#!/usr/bin/env node
/**
 * CPI — /why: cited evidence + charts  (node why-evidence.cjs)
 * ===========================================================================
 * "The shift" and "The thesis" asserted things without showing anyone the
 * evidence. This adds two cited, charted sections built only from public
 * primary sources — and, critically, a section of evidence that CUTS AGAINST
 * the thesis, because a product whose moat is rigour cannot argue one side.
 *
 *   Chart 1  the bot-share disagreement (37% / 53% / 57% — three vendors,
 *            same question, 20-point spread). We publish the spread, not a
 *            cherry-picked headline.
 *   Chart 2  crawl-to-refer ratios (Cloudflare, Jul 2025) — how many pages
 *            taken per visitor returned. Log-scaled, with the news-sector
 *            series shown alongside because it is 1-2 orders smaller.
 *
 * Every figure carries source + date inline. Charts are pure CSS/HTML bars
 * (no libraries, no external requests, prints fine).
 */
const fs = require("fs");
const P = "public/why.html";
let s = fs.readFileSync(P, "utf8");
if (s.includes("evidence-shift")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(P, P + ".bak-evidence");

/* ---------- chart CSS ------------------------------------------------------ */
const CSS = `
/* ---- cited evidence charts on /why ---- */
.evrow{display:grid;grid-template-columns:190px 1fr 92px;gap:12px;align-items:center;padding:7px 0;font-size:13.5px}
.evrow .evk{color:var(--fg);min-width:0;line-height:1.3}
.evrow .evk small{display:block;color:var(--dim);font-size:11px;margin-top:1px}
.evrow .evb{height:14px;background:var(--sand);border:1px solid var(--line);border-radius:2px;overflow:hidden}
.evrow .evb>span{display:block;height:100%;background:var(--signal)}
.evrow .evb>span.alt{background:#8A6A1F}
.evrow .evb>span.warn{background:#A33A2A}
.evrow .evv{text-align:right;font-family:ui-monospace,Menlo,monospace;font-size:12.5px;color:var(--fg);white-space:nowrap}
.evnote{font-size:11.5px;color:var(--dim);line-height:1.55;margin-top:12px;padding-top:10px;border-top:1px solid var(--line)}
.evnote a{color:var(--signal)}
.evsplit{display:grid;grid-template-columns:1fr 1fr;gap:26px}
.evcaution{background:#efe8d7;border-left:3px solid #c9a24b;padding:12px 15px;font-size:13px;color:var(--dim);margin:14px 0 0;line-height:1.55}
@media(max-width:820px){.evsplit{grid-template-columns:1fr}.evrow{grid-template-columns:130px 1fr 78px;font-size:12.5px}}
`;

/* ---------- the two evidence sections -------------------------------------- */
const bar = (label, sub, pct, val, cls) =>
  `      <div class="evrow"><span class="evk">${label}${sub ? `<small>${sub}</small>` : ""}</span>` +
  `<span class="evb"><span class="${cls || ""}" style="width:${pct}%"></span></span>` +
  `<span class="evv">${val}</span></div>`;

const shift = `  <section class="panel wide" id="evidence-shift">
    <div class="ix"><span class="lead-in">The shift, in public numbers</span></div>
    <h2>Software is becoming the web&rsquo;s main reader &mdash; and nobody agrees by how much.</h2>
    <div class="evsplit">
      <div>
        <p>Three infrastructure companies measured the same question in overlapping periods and produced answers <b>twenty points apart</b>. All three sell bot mitigation, which is worth knowing when reading them.</p>
        <p>We show the spread rather than pick a headline. The direction is consistent across all of them; the level is not settled, and anyone quoting a single figure as fact is overstating what is known.</p>
      </div>
      <div>
        <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin-bottom:6px">Automated share of web traffic</div>
${bar("Cloudflare", "network-wide, Jul 2026", 57, "~57%")}
${bar("Thales / Imperva", "protected estate, FY2025", 53, "53%")}
${bar("Fastly", "6.5T req/mo, Apr&ndash;Jul 2025", 37, "37%", "alt")}
        <div class="evnote">Sources: <a href="https://www.cloudflare.com/press/press-releases/2026/cloudflare-introduces-precursor-one-click-behavioral-defense-against-modern-bots/" rel="noopener">Cloudflare</a> (13 Jul 2026) &middot; <a href="https://cpl.thalesgroup.com/about-us/newsroom/ai-driven-bot-attacks-surged-according-to-bad-bot-report" rel="noopener">Thales/Imperva Bad Bot Report 2026</a> &middot; <a href="https://www.fastly.com/press/press-releases/new-fastly-threat-research-reveals-ai-crawlers-make-up-almost-80-of-ai-bot" rel="noopener">Fastly</a>. Different networks, different customer bases, different definitions of &ldquo;bot&rdquo;.</div>
      </div>
    </div>
    <div class="evcaution"><b>One caveat we think matters.</b> In September 2025 Cloudflare wrote that it expected bot traffic to exceed human traffic <em>&ldquo;by the end of 2029&rdquo;</em>. In July 2026 it reported that this had already happened. Either the shift accelerated by three years in nine months, or the measurement basis changed. We cite the figure and the contradiction together.</div>
  </section>

`;

const thesisEvidence = `  <section class="panel wide" id="evidence-ratio">
    <div class="ix"><span class="lead-in">The economics, in public numbers</span></div>
    <h2>How many pages a platform takes, per visitor it sends back.</h2>
    <div class="evsplit">
      <div>
        <p>This is the number that turns a technical question into an economic one. Search crawling was a trade: index my pages, send me readers. For AI crawling the exchange rate has moved by orders of magnitude.</p>
        <p>The second series matters as much as the first. Restricted to <b>news and publications</b>, the same ratios fall by one to two orders of magnitude &mdash; still lopsided, nothing like the headline. Both are shown because quoting only the larger one would be exactly the kind of thing this index exists to avoid.</p>
        <p style="margin-bottom:0">And a reader who arrives via an AI answer mostly does not click through: Pew measured <b>8%</b> click-through on searches showing an AI summary against <b>15%</b> without, with <b>1%</b> clicking a link inside the summary.</p>
      </div>
      <div>
        <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin-bottom:6px">Pages crawled per visitor referred &middot; log scale</div>
${bar("Anthropic", "all industries", 100, "38,065:1", "warn")}
${bar("Anthropic", "news &amp; publications", 66, "2,500:1", "alt")}
${bar("OpenAI", "all industries", 68, "1,091:1", "warn")}
${bar("OpenAI", "news &amp; publications", 47, "152:1", "alt")}
${bar("Perplexity", "all industries", 50, "195:1", "warn")}
${bar("Perplexity", "news &amp; publications", 35, "32.7:1", "alt")}
${bar("Google", "all industries", 14, "5:1")}
${bar("DuckDuckGo", "all industries", 4, "0.3:1")}
        <div class="evnote">Source: Cloudflare, <a href="https://blog.cloudflare.com/crawlers-click-ai-bots-training/" rel="noopener">&ldquo;The crawl-to-click gap&rdquo;</a> (29 Aug 2025, data Jan&ndash;Jul 2025) and <a href="https://blog.cloudflare.com/ai-crawler-traffic-by-purpose-and-industry/" rel="noopener">by purpose and industry</a> (28 Aug 2025). Bars are log-scaled for legibility; read the figures, not the lengths. <b>Cloudflare&rsquo;s own caveat:</b> referrals from native apps carry no <code>Referer</code> header, so these ratios overstate the gap by an unknown amount. Pew: <a href="https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/" rel="noopener">AI summaries and click-through</a> (22 Jul 2025).</div>
      </div>
    </div>
  </section>

  <section class="panel wide" id="evidence-against">
    <div class="ix"><span class="lead-in">Evidence against</span></div>
    <h2>The parts of this thesis the public data does <em>not</em> support.</h2>
    <p>If we only published what agreed with us, none of the rest of this site would be worth reading. Three things cut the other way, and the weakest leg is the one the whole idea depends on.</p>
    <ul>
      <li><b>Machine-to-machine payment is barely real yet.</b> Analysis of the x402 rail found roughly <b>half of transactions were artificial</b> &mdash; self-dealing and wash trading &mdash; with genuine daily volume around <b>$28,000</b>. Visa, a year into its agent-payments programme, reported agent-initiated transactions in the <b>hundreds</b>. The plumbing is being laid; almost nothing is flowing through it. <span style="color:var(--dim)">(<a href="https://www.chainalysis.com/blog/x402-agentic-payments-adoption/" rel="noopener">Chainalysis</a>, Jun 2026; <a href="https://www.coindesk.com/markets/2026/03/11/coinbase-backed-ai-payments-protocol-wants-to-fix-micropayment-but-demand-is-just-not-there-yet" rel="noopener">Artemis via CoinDesk</a>, Mar 2026; <a href="https://investor.visa.com/news/news-details/2025/Visa-and-Partners-Complete-Secure-AI-Transactions-Setting-the-Stage-for-Mainstream-Adoption-in-2026/default.aspx" rel="noopener">Visa</a>, Dec 2025)</span></li>
      <li><b>Blocking is a minority behaviour outside news.</b> Only <b>10.6%</b> of the top million sites fully block GPTBot, and as of mid-2025 only <b>14%</b> of the top ten thousand domains carried any AI-crawler directive at all. The high numbers you read about are a news-sector story, not a web-wide one. <span style="color:var(--dim)">(<a href="https://arxiv.org/pdf/2510.09031" rel="noopener">Bouchaud &amp; Ramaciotti</a>, arXiv 2025; <a href="https://blog.cloudflare.com/from-googlebot-to-gptbot-whos-crawling-your-site-in-2025/" rel="noopener">Cloudflare</a>, Jun 2025)</span></li>
      <li><b>Licensing revenue is real but small, and growing slower than the business it is meant to replace.</b> Reddit&rsquo;s entire data-licensing line &mdash; with the largest AI buyers as customers &mdash; was <b>$43M in Q2 2026</b>, about <b>5%</b> of revenue, growing 24% while the company overall grew 61%. That is the clearest audited price signal in this market, and it is not yet paying anyone&rsquo;s rent. <span style="color:var(--dim)">(<a href="https://www.sec.gov/Archives/edgar/data/1713445/000171344526000098/earningspressreleaseq226.htm" rel="noopener">Reddit Q2 2026, SEC filing</a>)</span></li>
    </ul>
    <p class="evnote" style="border-top:0;padding-top:0;margin-top:16px">Not every crawler is growing either: Bytespider fell <b>85%</b> year over year to May 2025, and training-bot volume on one publisher network <em>declined</em> 15% across the second half of 2025 even as retrieval and search bots grew. The category is expanding; individual crawlers are volatile, and some are shrinking.</p>
  </section>

`;

/* ---------- insert -------------------------------------------------------- */
const shiftAnchor = `  <section class="panel">
    <div class="ix"><span class="lead-in">The gap</span></div>`;
if (!s.includes(shiftAnchor)) throw new Error("shift anchor missing");
s = s.replace(shiftAnchor, shift + shiftAnchor);

const thesisEnd = s.indexOf("What would falsify it");
if (thesisEnd < 0) throw new Error("thesis section end not found");
const after = s.indexOf("</section>", thesisEnd) + "</section>".length;
s = s.slice(0, after) + "\n\n" + thesisEvidence.trimEnd() + s.slice(after);

fs.writeFileSync(P, s);

const T = "public/theme.css";
let t = fs.readFileSync(T, "utf8");
if (!t.includes("cited evidence charts")) fs.writeFileSync(T, t + CSS);

console.log("why.html: added 3 cited sections");
console.log("  · the bot-share disagreement (37/53/57 spread + the Cloudflare self-contradiction)");
console.log("  · crawl-to-refer ratios, all-industry AND news-only, with Cloudflare's own caveat");
console.log("  · evidence AGAINST the thesis — x402 wash trading, blocking is a minority, Reddit's audited $43M");
console.log("theme.css: chart styles added");
