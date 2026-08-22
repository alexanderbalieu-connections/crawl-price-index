#!/usr/bin/env node
/**
 * CPI — /why: the growth figures behind the shift  (node why-growth.cjs)
 * ===========================================================================
 * The bot-share panel showed three vendors' LEVELS but no DIRECTION, and
 * direction is what the thesis actually rests on. This adds it — and the
 * honest version is more interesting than "bots are exploding":
 *
 *   Overall bot share creeps    49.6% -> 51% -> 53%   (~1.5pp/yr, one source,
 *                                                      one methodology)
 *   AI's share of crawling runs   22% -> 52%          (in about 14 months)
 *
 * So the pool is growing slowly while its COMPOSITION shifts fast. That is a
 * sharper claim than the headline, and it is the one the data supports.
 * Counter-evidence sits in the same panel: individual crawlers are volatile
 * and several are shrinking.
 */
const fs = require("fs");
const P = "public/why.html";
let s = fs.readFileSync(P, "utf8");
if (s.includes("growth-panel")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(P, P + ".bak-growth");

const CSS = `
/* ---- growth: level vs composition ---- */
.gcols{display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-top:4px}
.gser{display:flex;align-items:flex-end;gap:10px;height:132px;padding:8px 0 0}
.gbar{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:6px;min-width:0}
.gbar .gv{font-family:ui-monospace,Menlo,monospace;font-size:12.5px;color:var(--fg);white-space:nowrap}
.gbar .gf{width:100%;background:var(--signal);border-radius:2px 2px 0 0;min-height:3px}
.gbar .gf.alt{background:#8A6A1F}
.gbar .gl{font-size:11.5px;color:var(--dim);white-space:nowrap}
.gcap{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin-bottom:2px}
.gdelta{font-size:12.5px;color:var(--dim);margin-top:10px;padding-top:8px;border-top:1px solid var(--line)}
@media(max-width:820px){.gcols{grid-template-columns:1fr;gap:22px}}
`;

const gbar = (label, pct, val, alt) =>
  `        <div class="gbar"><span class="gv">${val}</span>` +
  `<span class="gf${alt ? " alt" : ""}" style="height:${pct}%"></span>` +
  `<span class="gl">${label}</span></div>`;

const panel = `  <section class="panel wide" id="growth-panel">
    <div class="ix"><span class="lead-in">Direction, not just level</span></div>
    <h2>The pool grows slowly. What is <em>in</em> it changes fast.</h2>
    <p>A snapshot tells you the level; it does not tell you whether anything is moving. Two different series answer that, and they move at very different speeds &mdash; which is the part most coverage gets wrong.</p>

    <div class="gcols">
      <div>
        <div class="gcap">Automated share of all traffic &middot; one source, one method</div>
        <div class="gser">
${gbar("2023", 49.6, "49.6%")}
${gbar("2024", 51, "51%")}
${gbar("2025", 53, "53%")}
        </div>
        <div class="gdelta"><b>About 1.5 points a year.</b> A steady climb, not a step change. Shown from a single source across three consecutive annual reports so the denominator and method stay constant &mdash; the one thing the cross-vendor comparison above cannot offer.<br><span style="font-size:11.5px">Thales/Imperva <em>Bad Bot Report</em>, 2024&ndash;2026 editions. The publisher sells bot mitigation.</span></div>
      </div>

      <div>
        <div class="gcap">AI training crawlers as a share of crawler activity</div>
        <div class="gser">
${gbar("Spring 2025", 22, "22%", true)}
${gbar("Jun 2026", 52, "52%", true)}
        </div>
        <div class="gdelta"><b>Better than doubled in about fourteen months.</b> The overall pool of automated traffic barely moved over the same window. What changed is its composition: crawling is increasingly for training rather than for indexing.<br><span style="font-size:11.5px">Cloudflare, <a href="https://blog.cloudflare.com/agentic-internet-bot-report/" rel="noopener">&ldquo;Content Independence Day, one year on&rdquo;</a> (1 Jul 2026), measured across its network.</span></div>
      </div>
    </div>

    <div class="evcaution"><b>And the growth is not uniform.</b> Bytespider fell about <b>85%</b> year on year to May 2025. One publisher network recorded training-bot volume <em>declining</em> roughly 15% across the second half of 2025 while retrieval and search bots grew. ChatGPT-User volume fell about 6% quarter on quarter in Q2 2026. The category is expanding; individual crawlers rise and fall sharply, so any chart of &ldquo;who crawls most&rdquo; is largely an artefact of whose network was measured.</div>
  </section>

`;

const anchor = `  <section class="panel wide" id="evidence-shift">`;
if (!s.includes(anchor)) throw new Error("evidence-shift anchor missing");
// place the growth panel immediately AFTER the level panel
const a = s.indexOf(anchor);
const b = s.indexOf("</section>", a) + "</section>".length;
s = s.slice(0, b) + "\n\n" + panel.trimEnd() + s.slice(b);
fs.writeFileSync(P, s);

const T = "public/theme.css";
let t = fs.readFileSync(T, "utf8");
if (!t.includes("growth: level vs composition")) fs.writeFileSync(T, t + CSS);

console.log("why.html: growth panel added after the level panel");
console.log("  left  — bot share 49.6% -> 51% -> 53% (one source, ~1.5pp/yr)");
console.log("  right — AI training share of crawling 22% -> 52% in ~14 months");
console.log("  plus  — the non-uniform-growth caution (Bytespider -85%, ChatGPT-User -6% QoQ)");
