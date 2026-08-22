#!/usr/bin/env node
/**
 * CPI — apply the agreed free/paid line inside the dashboard
 * ===========================================================================
 * Principle Alex chose: HEADLINE NUMBERS FREE AND CITABLE, ANALYSIS PAID.
 * Reach depends on journalists being able to quote the index; nobody pays €49
 * for a number they can already quote.
 *
 * Applied panel by panel:
 *
 *   STAYS FREE   the exhibit-class counts, the any-crawler cuts, rank-band
 *                shape, block rate per crawler, coverage and reachability —
 *                every figure a journalist would lift.
 *   LOCKS        per-crawler filtering, the full suffix table beyond the top
 *                five, the per-crawler targeting matrix, and the named domain
 *                lists in Field notes.
 *
 * In every case the panel keeps its TITLE, its EXPLANATION and its HEADLINE
 * COUNT. Only the row detail blurs. A reader still learns what exists, why it
 * matters and how big it is — they just cannot read it off.
 *
 * The rows under the blur are real. Nothing here is fabricated, so a
 * screenshot of a blurred panel is not a screenshot of invented data. The
 * genuinely confidential layer — per-domain rows — was already behind
 * /api/domains and is untouched by this.
 */
const fs = require("fs");
const V = "app/views.js";
let v = fs.readFileSync(V, "utf8");
if (v.includes("cpiLocked")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(V, V + ".bak-locks");

const sub = (from, to, label) => {
  if (!v.includes(from)) throw new Error("not found: " + label);
  const n = v.split(from).length - 1;
  if (n !== 1) throw new Error(label + ": expected 1 match, found " + n);
  v = v.split(from).join(to);
};

/* ---- the shared helpers ------------------------------------------------- */
sub(
  "  /* ---------- SEGMENTS ---------- */",
  `  /* ---------- the free/paid line ----------
     ME is the server's own entitlement decision, loaded once per session. */
  function entitled() { return !!(ME && ME.entitled); }

  // rows: array of pre-rendered row HTML. freeN of them stay readable.
  function cpiLocked(rows, freeN, what) {
    if (entitled() || rows.length <= freeN) return rows.join("");
    return rows.slice(0, freeN).join("") +
      '<div class="lockwrap"><div class="lockblur" aria-hidden="true">' + rows.slice(freeN).join("") + '</div>' +
      '<div class="lockbar"><span>&#128274; <b>' + fmt(rows.length - freeN) + '</b> more ' + esc(what) +
      ' &mdash; the full cut is in Terminal.</span>' +
      '<a href="#account" class="locklink">Unlock &rarr;</a></div></div>';
  }

  // a whole grid behind the wall, with the panel's title and prose left intact
  function cpiLockedGrid(bodyHtml, what) {
    if (entitled()) return bodyHtml;
    return '<div class="lockwrap"><div class="lockblur" aria-hidden="true">' + bodyHtml + '</div>' +
      '<div class="lockbar"><span>&#128274; ' + esc(what) + ' &mdash; in Terminal.</span>' +
      '<a href="#account" class="locklink">Unlock &rarr;</a></div></div>';
  }

  /* ---------- SEGMENTS ---------- */`,
  "lock helpers"
);

/* ---- 1. per-crawler filtering is the analyst's view --------------------- */
sub(
  `        D.crawlers.map(function (c) { return '<option' + (c.name === sel ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join("") +
        '</select>', segDirty ? "seg-clear" : null) + '</section>';`,
  `        D.crawlers.map(function (c) {
          return '<option' + (c.name === sel ? ' selected' : '') + (entitled() ? '' : ' disabled') + '>' +
            esc(c.name) + (entitled() ? '' : ' \\u2014 Terminal') + '</option>';
        }).join("") +
        '</select>', segDirty ? "seg-clear" : null) +
      (entitled() ? '' :
        '<p class="foot" style="margin-top:10px">&#128274; Filtering these cuts to a <b>single named crawler</b> is part of Terminal. ' +
        'The any-crawler view below is free to read and free to cite. ' +
        '<a href="#account" class="locklink">See what Terminal includes &rarr;</a></p>') +
      '</section>';`,
  "segments filter"
);

/* ---- 2. the suffix table: five real rows, then blur --------------------- */
sub(
  `      '<div class="dd-card" style="max-height:520px;overflow:auto">' + rows.map(function (t) {
        return '<div class="hrow"><span class="hk">' + esc(t.tld) + '</span><span class="hb"><span style="width:' +
          (t.v / tmax * 100).toFixed(1) + '%"></span></span><span class="hv">' + t.v.toFixed(1) + '% <span style="opacity:.6">n=' + fmt(t.n) + '</span></span></div>';
      }).join("") + '</div>' +`,
  `      '<div class="dd-card" style="max-height:520px;overflow:auto">' + cpiLocked(rows.map(function (t) {
        return '<div class="hrow"><span class="hk">' + esc(t.tld) + '</span><span class="hb"><span style="width:' +
          (t.v / tmax * 100).toFixed(1) + '%"></span></span><span class="hv">' + t.v.toFixed(1) + '% <span style="opacity:.6">n=' + fmt(t.n) + '</span></span></div>';
      }), 5, "suffix groups") + '</div>' +`,
  "suffix table"
);

/* ---- 3. the targeting matrix is analysis; title and prose stay ---------- */
sub(
  `        '<div class="dd-card">' + gaps.map(function (g) {
          var half = (Math.abs(g.gap) / gmax * 50).toFixed(1);`,
  `        '<div class="dd-card">' + cpiLockedGrid(gaps.map(function (g) {
          var half = (Math.abs(g.gap) / gmax * 50).toFixed(1);`,
  "targeting matrix open"
);
sub(
  `            '<span class="hv">' + (g.gap >= 0 ? "+" : "") + g.gap.toFixed(2) + 'pp <span style="opacity:.6">(' + g.inGrp.toFixed(1) + '% vs ' + g.all.toFixed(1) + '%)</span></span></div>';
        }).join("") + '</div>' +`,
  `            '<span class="hv">' + (g.gap >= 0 ? "+" : "") + g.gap.toFixed(2) + 'pp <span style="opacity:.6">(' + g.inGrp.toFixed(1) + '% vs ' + g.all.toFixed(1) + '%)</span></span></div>';
        }).join(""), "Per-crawler targeting for this group") + '</div>' +`,
  "targeting matrix close"
);

/* ---- 4. Field notes: the counts stay, the named domains lock ------------ */
sub(
  `          ? '<div class="mwrap" style="max-height:320px"><table class="dt"><thead><tr><th>Domain</th><th>Observed for</th></tr></thead><tbody>' +
            doms.map(function (d) {`,
  `          ? '<div class="mwrap" style="max-height:320px"><table class="dt"><thead><tr><th>Domain</th><th>Observed for</th></tr></thead><tbody>' +
            cpiLocked(doms.map(function (d) {`,
  "field notes open"
);
sub(
  `                : '<span class="rtag" style="margin:1px 3px 1px 0">&mdash;</span>') + '</td></tr>';
            }).join("") + '</tbody></table></div>' +`,
  `                : '<span class="rtag" style="margin:1px 3px 1px 0">&mdash;</span>') + '</td></tr>';
            }), 2, "domains in this exhibit") + '</tbody></table></div>' +`,
  "field notes close"
);

fs.writeFileSync(V, v);
require("child_process").execSync("node --check " + V);

/* ---- styles -------------------------------------------------------------- */
const H = "app/dashboard.html";
let h = fs.readFileSync(H, "utf8");
if (!h.includes(".lockwrap")) {
  fs.copyFileSync(H, H + ".bak-locks");
  h = h.replace("</style>", `
/* ---- the free/paid line: real rows, blurred ---- */
.lockwrap{position:relative}
.lockblur{filter:blur(5px);opacity:.5;pointer-events:none;user-select:none;max-height:170px;overflow:hidden;
  -webkit-mask-image:linear-gradient(#000 25%,transparent);mask-image:linear-gradient(#000 25%,transparent)}
.lockbar{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;
  margin-top:-52px;position:relative;z-index:2;background:#fff;border:1px dashed var(--line);border-radius:3px;
  padding:11px 14px;font-size:12.5px;color:var(--fg)}
.lockbar b{font-family:ui-monospace,Menlo,monospace}
.locklink{color:var(--signal);font-weight:600;text-decoration:none;white-space:nowrap}
.locklink:hover{text-decoration:underline}
select option:disabled{color:var(--dim)}
</style>`);
  fs.writeFileSync(H, h);
}

/* ---- verify -------------------------------------------------------------- */
const out = fs.readFileSync(V, "utf8");
for (const m of ["function cpiLocked(", "function cpiLockedGrid(", "function entitled()",
                 '}), 5, "suffix groups")', '"Per-crawler targeting for this group")',
                 '}), 2, "domains in this exhibit")', "\\u2014 Terminal"])
  if (!out.includes(m)) throw new Error("missing after patch: " + m);
if (!fs.readFileSync(H, "utf8").includes(".lockwrap")) throw new Error("lock styles missing");

console.log("dashboard locks applied — headline free, analysis paid");
console.log("  Segments    per-crawler filter -> Terminal; any-crawler stays free and citable");
console.log("              suffix table shows 5 real rows, blurs the remainder");
console.log("              per-crawler targeting matrix -> blurred, title and prose kept");
console.log("  Field notes exhibit COUNTS stay free; the named domain lists blur after 2");
console.log("");
console.log("  every locked panel keeps its title, its explanation and its headline count,");
console.log("  and the rows under the blur are real — nothing is fabricated");
