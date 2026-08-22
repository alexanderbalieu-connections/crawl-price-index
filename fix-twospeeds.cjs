#!/usr/bin/env node
/**
 * CPI — /why "The numbers": fix and split the right column
 * ===========================================================================
 * BUG: the "two speeds" bars rendered as flat lines. `.gser` sets
 * align-items:flex-end, which leaves each `.gbar` at auto height — so the
 * percentage heights on the fills had no definite parent to resolve against
 * and collapsed to their 3px min-height. Fixed by giving the bars a definite
 * track height of their own rather than depending on the flex parent.
 *
 * ALSO, per feedback:
 *   - the right column becomes TWO clearly separated sub-boxes
 *   - the composition series gets its own real bar chart, not just labels
 *   - each series states its CHANGE explicitly (+3.4pp vs +30pp), which is
 *     the whole point of showing them together
 */
const fs = require("fs");
const P = "public/why.html";
let s = fs.readFileSync(P, "utf8");
if (s.includes('class="nbox"')) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(P, P + ".bak-twospeeds");

/* ---- locate the right column of "The numbers" --------------------------- */
const startMark = '        <div class="gcap">Automated share of traffic';
const endMark = '      </div>\n    </div>\n    <div class="evcaution"><b>Two cautions.</b>';
const a = s.indexOf(startMark);
const b = s.indexOf(endMark);
if (a < 0 || b < 0) throw new Error("right-column bounds not found");

const col = `        <div class="nbox">
          <div class="nbh">Automated share of traffic <span>same question, three networks</span></div>
          <div class="evrow"><span class="evk">Fastly<small>Apr&ndash;Jul 2025</small></span><span class="evb"><span class="alt" style="width:37%"></span></span><span class="evv">37%</span></div>
          <div class="evrow"><span class="evk">Thales / Imperva<small>FY2025</small></span><span class="evb"><span style="width:53%"></span></span><span class="evv">53%</span></div>
          <div class="evrow"><span class="evk">Cloudflare<small>Jul 2026</small></span><span class="evb"><span style="width:57%"></span></span><span class="evv">~57%</span></div>
          <div class="nbf">A twenty-point spread on the same question. All three sell bot mitigation.</div>
        </div>

        <div class="nbox">
          <div class="nbh">Two speeds <span>level vs composition</span></div>
          <div class="twin">
            <div class="tw">
              <div class="twl">Automated share of <b>all</b> traffic</div>
              <div class="cser">
                <div class="cbar"><span class="cv">49.6%</span><span class="ct"><i style="height:49.6%"></i></span><span class="cl">2023</span></div>
                <div class="cbar"><span class="cv">51%</span><span class="ct"><i style="height:51%"></i></span><span class="cl">2024</span></div>
                <div class="cbar"><span class="cv">53%</span><span class="ct"><i style="height:53%"></i></span><span class="cl">2025</span></div>
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
          <div class="nbf">Both axes run 0&ndash;100%, so the bar heights are comparable even though the denominators are not: the left is a share of <em>all</em> traffic, the right a share of <em>crawler</em> activity. What is being compared is the <b>rate of change</b>.<br>Left: Thales/Imperva, 2024&ndash;2026 reports (one method, one denominator). Right: <a href="https://blog.cloudflare.com/agentic-internet-bot-report/" rel="noopener">Cloudflare</a>, Jul 2026. Spread sources: <a href="https://www.cloudflare.com/press/press-releases/2026/cloudflare-introduces-precursor-one-click-behavioral-defense-against-modern-bots/" rel="noopener">Cloudflare</a> &middot; <a href="https://cpl.thalesgroup.com/about-us/newsroom/ai-driven-bot-attacks-surged-according-to-bad-bot-report" rel="noopener">Thales/Imperva</a> &middot; <a href="https://www.fastly.com/press/press-releases/new-fastly-threat-research-reveals-ai-crawlers-make-up-almost-80-of-ai-bot" rel="noopener">Fastly</a>.</div>
        </div>
`;

s = s.slice(0, a) + col + s.slice(b);
fs.writeFileSync(P, s);

const CSS = `
/* ---- /why "The numbers": sub-boxes + working column charts ---- */
.nbox{background:#fff;border:1px solid var(--line);border-radius:4px;padding:14px 16px 12px;margin-bottom:14px}
.nbox:last-child{margin-bottom:0}
.nbh{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--fg);font-weight:600;padding-bottom:8px;margin-bottom:10px;border-bottom:1px solid var(--line)}
.nbh span{display:block;font-weight:400;letter-spacing:.06em;color:var(--dim);margin-top:2px}
.nbf{font-size:11px;color:var(--dim);line-height:1.5;margin-top:10px;padding-top:8px;border-top:1px solid var(--line)}
.nbf a{color:var(--signal)}
.twin{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.tw{min-width:0}
.twl{font-size:11.5px;color:var(--dim);line-height:1.35;margin-bottom:8px;min-height:2.7em}
/* The bar TRACK carries the definite height, so percentage fills resolve
   against it. Relying on the flex parent left the fills at min-height. */
.cser{display:flex;gap:8px;align-items:flex-end}
.cbar{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:5px}
.cbar .cv{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;color:var(--fg);white-space:nowrap}
.cbar .ct{display:block;width:100%;height:92px;background:var(--sand);border:1px solid var(--line);border-radius:2px;position:relative}
.cbar .ct>i{position:absolute;left:0;right:0;bottom:0;display:block;background:var(--signal);border-radius:0 0 1px 1px}
.cbar .ct>i.alt{background:#8A6A1F}
.cbar .cl{font-size:10.5px;color:var(--dim);white-space:nowrap}
.twd{margin-top:9px;font-family:ui-monospace,Menlo,monospace;font-size:14px;font-weight:600;color:var(--signal)}
.twd.alt{color:#8A6A1F}
.twd span{font-family:var(--sans);font-size:11px;font-weight:400;color:var(--dim);margin-left:5px}
@media(max-width:820px){.twin{grid-template-columns:1fr;gap:20px}.twl{min-height:0}}
`;
const T = "public/theme.css";
let t = fs.readFileSync(T, "utf8");
if (!t.includes('"The numbers": sub-boxes')) fs.writeFileSync(T, t + CSS);

console.log("why.html: right column split into two sub-boxes");
console.log("  BUG FIXED — bars had no definite parent height, so % fills collapsed to 3px");
console.log("  composition series now a real bar chart, not labels");
console.log("  each series states its change: +3.4pp in two years  vs  +30pp in ~14 months");
