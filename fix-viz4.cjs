#!/usr/bin/env node
/**
 * CPI — box 2 as three cards (node fix-viz4.cjs)
 * ===========================================================================
 * Two cards would not balance: the section has three distinct things to say
 * and splitting three into two always left one column 400px short. Three
 * cards, each answering the same question at a different resolution:
 *
 *   1. THE ASYMMETRY      how big is the gap, counted in domains
 *   2. BY ROLE            how big is it across every crawler we track
 *   3. HELD CONSTANT      how big is it when the vendor cannot explain it
 *
 * The role rows lose their one-line glosses, which now sit in the card's
 * own subtitle instead of repeating on every row.
 */
const fs = require("fs");
const P = "public/index.html";
const T = "public/theme.css";

let s = fs.readFileSync(P, "utf8");
if (s.includes("dvtri")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(P, P + ".bak-viz5");

const sub = (from, to, label) => {
  if (!s.includes(from)) throw new Error("not found: " + label);
  s = s.split(from).join(to);
};

/* three-column shell */
sub('<div id="v2-asym" class="dvsplit"></div>',
    '<div id="v2-asym" class="dvtri"></div>', "asym shell");

/* card 1 closes after its own footnote again */
sub(
  "        ' domains serving a readable robots.txt.</div>';",
  "        ' domains serving a readable robots.txt.</div></div>';",
  "card 1 close"
);

/* card 2: role medians become their own card, rows compacted to one line */
sub(
  "      // the role medians finish the LEFT card — same question, wider lens\n" +
  "      left += '<div class=\"dvsub2\">Median declared block rate, by crawler role</div>' +",
  "      // card 2 — the same question asked of every crawler we track\n" +
  "      var mid = '<div class=\"dv\">' + head(\"The gap, by role\", \"crawlers\", \"Crawlers tab\") +\n" +
  "        '<div style=\"font-size:12.5px;color:var(--dim);margin-bottom:6px\">Median share of domains disallowing each crawler, grouped by what that crawler is for: <b>training</b> a model, <b>indexing</b> for search, or <b>fetching</b> because a person asked.</div>' +",
  "role card open"
);
sub(
  "          return bar({ k: x.k + ' <span style=\"color:var(--dim);font-size:11.5px\">&middot; ' + byRole[x.r].length + ' tracked</span>',\n" +
  "                       v: m.toFixed(1) + \"%\", pct: m / roleMax * 100, tone: x.tone, note: x.d });",
  "          return bar({ k: x.k + ' <span style=\"color:var(--dim);font-size:11.5px\">&middot; ' + byRole[x.r].length + ' crawlers</span>',\n" +
  "                       v: m.toFixed(1) + \"%\", pct: m / roleMax * 100, tone: x.tone });",
  "role row compaction"
);
sub(
  "        '<div class=\"dvf\">Median rather than mean, so one unusually walled crawler cannot carry a role. Counts are the crawlers we track in each role.</div></div>';",
  "        '<div class=\"dvf\">Median rather than mean, so one unusually walled crawler cannot carry a whole role.</div></div>';",
  "role card footnote"
);

/* three cards out */
sub("      ae.innerHTML = left + right;", "      ae.innerHTML = left + mid + right;", "asym assembly");

fs.writeFileSync(P, s);

let t = fs.readFileSync(T, "utf8");
if (!t.includes("three preview cards across a wide panel")) {
  t += `
/* ---- three preview cards across a wide panel ---- */
.dvtri{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:14px;align-items:start}
.dvtri .dv{margin-top:0;min-width:0}
/* the vendor-pair label column has to give ground at a third of the width */
.dvtri .dvp{grid-template-columns:92px 1fr 40px;gap:7px}
@media(max-width:1040px){.dvtri{grid-template-columns:1fr 1fr}}
@media(max-width:720px){.dvtri{grid-template-columns:1fr}}
`;
  fs.writeFileSync(T, t);
}

const out = fs.readFileSync(P, "utf8");
for (const m of ['id="v2-asym" class="dvtri"', "left + mid + right", "The gap, by role", "Held constant: the vendor"])
  if (!out.includes(m)) throw new Error("missing after patch: " + m);
if ((out.match(/var mid = /g) || []).length !== 1) throw new Error("mid declared wrong number of times");

console.log("box 2 -> three cards: the asymmetry / the gap by role / held constant: the vendor");
