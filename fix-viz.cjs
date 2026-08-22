#!/usr/bin/env node
/**
 * CPI — corrections to the homepage preview charts (node fix-viz.cjs)
 * ===========================================================================
 * Caught by rendering the page headlessly and reading it back:
 *
 *  1. 23 of 50,000 printed as "0.0% of the frame". A percentage formatter with
 *     one fixed decimal is wrong for the exact figure the section exists to
 *     show — the participation share is 0.046%, and rounding it to zero
 *     destroys the point. Now adaptive: more decimals as the share gets small.
 *  2. OAI-SearchBot printed "3%" next to "15.2%" and "4.7%" — ragged column.
 *  3. The dangling elbow: a nested subset row that is FIRST in its container
 *     drew a connector line reaching up into nothing. It now starts at the row
 *     edge, branching off the chart above it instead of off empty space.
 *  4. Two panel footnotes repeated, near-verbatim, the grey caveat paragraph
 *     already sitting directly beneath the panel.
 *  5. The left card in each two-column pair stretched to the height of the
 *     taller right card, leaving a large empty white box.
 *  6. The changes interval rendered as the raw "2026-08-15 -> 2026-08-17".
 */
const fs = require("fs");
const P = "public/index.html";
const T = "public/theme.css";

let s = fs.readFileSync(P, "utf8");
if (s.includes("pctS")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(P, P + ".bak-viz2");

const sub = (from, to, label) => {
  if (!s.includes(from)) throw new Error("not found: " + label);
  s = s.split(from).join(to);
};

/* 1. adaptive percentage — a share of 0.046% must not print as 0.0% -------- */
sub(
  '    var pct1 = function(x, of){ return of ? (x / of * 100).toFixed(1) : "0.0"; };',
  '    // adaptive: keeps significant digits as the share gets small, so the\n' +
  '    // participation figure (23 of 50,000) reads 0.046% and not 0.0%\n' +
  '    var pctS = function(x, of){\n' +
  '      if (!of) return "0";\n' +
  '      var v = x / of * 100;\n' +
  '      return v >= 1 ? v.toFixed(1) : v >= 0.1 ? v.toFixed(2) : v.toFixed(3);\n' +
  '    };\n' +
  '    var pct1 = pctS;',
  "pct1 definition"
);

/* 2. one decimal on every crawler rate ------------------------------------ */
sub(
  "'<span class=\"pv\">' + x.v + '%</span></div>';",
  "'<span class=\"pv\">' + x.v.toFixed(1) + '%</span></div>';",
  "vendor pair value"
);

/* 6. readable interval ----------------------------------------------------- */
sub(
  '    var C = d.changes_headline, ce = document.getElementById("v2-changes");',
  '    // "2026-08-15 -> 2026-08-17" is a machine string; show it as dates\n' +
  '    var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];\n' +
  '    var dshort = function(iso){\n' +
  '      var m = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(String(iso).trim());\n' +
  '      return m ? (+m[3]) + " " + MON[+m[2] - 1] : iso;\n' +
  '    };\n' +
  '    var interval = function(raw){\n' +
  '      var p = String(raw).split(/\\s*->\\s*/);\n' +
  '      return p.length === 2 ? dshort(p[0]) + " &rarr; " + dshort(p[1]) : esc(raw);\n' +
  '    };\n' +
  '    var C = d.changes_headline, ce = document.getElementById("v2-changes");',
  "changes block head"
);
sub(
  'head("Policy changes &middot; " + esc(C.interval), "changes", "Policy changes tab")',
  'head("Policy changes &middot; " + interval(C.interval), "changes", "Policy changes tab")',
  "interval usage"
);

/* 3+4. fill the changes card, drop the duplicated footnote ---------------- */
sub(
  "        '<div class=\"dvf\">' + n(C.total) + ' domain&times;crawler changes across ' + n(C.domains_changed) +\n" +
  "        ' domains. Both directions on one scale, either side of a common axis.</div></div>';",
  "        '<div class=\"dvpair\" style=\"margin-top:14px\">' +\n" +
  "        '<div class=\"pc\"><div class=\"pn\">' + n(C.total) + '</div><div class=\"pl\">domain&times;crawler edits</div></div>' +\n" +
  "        '<div class=\"pc\"><div class=\"pn\">' + n(C.domains_changed) + '</div><div class=\"pl\">separate domains behind them</div></div>' +\n" +
  "        '</div>' +\n" +
  "        '<div class=\"dvf\">Both directions on one scale, either side of a common axis. A domain can move both ways at once &mdash; loosening for one crawler while tightening for another &mdash; which is why there are more edits than domains.</div></div>';",
  "changes footnote"
);

/* 4. reachability footnote no longer repeats the paragraph below it -------- */
sub(
  "        '<div class=\"dvf\">A popularity ranking lists domains, not working websites. ' +\n" +
  "        pct1(R.dead_dns + R.timeout, R.frame) + '% of the ranked frame never answered at all.</div></div>';",
  "        '<div class=\"dvf\">' + pct1(R.dead_dns + R.timeout, R.frame) +\n" +
  "        '% of the ranked frame never answered at all &mdash; which is why the block rates on this page are quoted against the domains that did.</div></div>';",
  "reach footnote"
);

/* 4b. bazaar left-card footnote likewise ---------------------------------- */
sub(
  "        '<div class=\"dvf\">Advertised, opt-in acceptance in a public registry &mdash; never transactions, volume or revenue.</div></div>';",
  "        '<div class=\"dvf\">Endpoint type is the registry&rsquo;s own declaration. &ldquo;Content&rdquo; here still means machine-readable feeds and datasets far more often than it means a page a person would read.</div></div>';",
  "bazaar left footnote"
);

/* 1b. the observed-price note reads better as a price -------------------- */
sub(
  "note: esc(obsRaw) + ' &mdash; n=1, from a hand-probed panel' }) : '') +",
  "note: esc(String(obsRaw).split(\":\")[0]) + ' &mdash; the only posted price in our hand-probed exhibit set' }) : '') +",
  "observed price note"
);

fs.writeFileSync(P, s);

/* 3+5. CSS ---------------------------------------------------------------- */
let t = fs.readFileSync(T, "utf8");
if (!t.includes("dvsplit cards size to their own content")) {
  t += `
/* ---- homepage preview charts: corrections ---- */
/* dvsplit cards size to their own content — a short card next to a tall one
   was stretching into a large empty box */
.dvsplit{align-items:start}
/* a subset row that is FIRST in its container branches off the chart above it,
   so its connector starts at the row edge rather than reaching up into nothing */
.dvr.dvsub:first-child .dvk:before{top:0}
`;
  fs.writeFileSync(T, t);
}

/* ---- sanity -------------------------------------------------------------- */
const out = fs.readFileSync(P, "utf8");
for (const m of ["pctS", "interval(C.interval)", "separate domains behind them", "x.v.toFixed(1)"])
  if (!out.includes(m)) throw new Error("missing after patch: " + m);
if (out.includes("A popularity ranking lists domains, not working websites. ' +"))
  throw new Error("duplicated reach footnote survived");

console.log("homepage preview charts corrected");
console.log("  0.0%  -> 0.046%   adaptive precision for small shares");
console.log("  3%    -> 3.0%     one decimal on every crawler rate");
console.log("  dangling connector on a first-child subset row anchored");
console.log("  two panel footnotes no longer repeat the caveat below them");
console.log("  short card no longer stretches to the tall card's height");
console.log("  interval '2026-08-15 -> 2026-08-17' -> '15 Aug -> 17 Aug'");
