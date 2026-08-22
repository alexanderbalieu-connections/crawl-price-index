#!/usr/bin/env node
/**
 * CPI — /explore becomes a preview of the dashboard  (node rewrite-explore.cjs)
 * ===========================================================================
 * Feedback: /explore repeats what the homepage and /why already say, and does
 * not answer the only question a visitor has there — what does the thing I
 * would be paying for actually look like?
 *
 * So: the asymmetry and reachability cards go (both now render as charts on
 * the homepage), the block-rate ladder and the observed price stay because
 * nothing else does them, and the space goes to a working replica of the
 * dashboard — real tab strip, real components, real numbers, clickable.
 *
 * NOTHING ON THIS PAGE IS ILLUSTRATIVE. The gated material is withheld by
 * masking real rows, not by inventing plausible ones. That matters on a site
 * whose entire pitch is that it never publishes a figure it did not measure —
 * a screenshot of a fake panel is indistinguishable from a screenshot of a
 * real one, and this way the question never arises.
 *
 * Freshness: it reads /explore-preview.json, rebuilt every edition, and the
 * panel prints the edition it is showing. check-explore.cjs fails the build if
 * that file falls behind the published edition.
 */
const fs = require("fs");
const P = "public/explore.html";
let s = fs.readFileSync(P, "utf8");
if (s.includes("dash-preview")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(P, P + ".bak-preview");

/* ---- 1. drop the two duplicated cards ----------------------------------- */
const cut = (startMark, label) => {
  const i = s.indexOf(startMark);
  if (i < 0) throw new Error("not found: " + label);
  const a = s.lastIndexOf('<div class="card"', i);
  if (a < 0) throw new Error("card open not found: " + label);
  // the card ends at the matching close before the next card or the grid end
  let depth = 0, j = a;
  while (j < s.length) {
    if (s.startsWith("<div", j)) depth++;
    else if (s.startsWith("</div>", j)) { depth--; if (depth === 0) { j += 6; break; } }
    j++;
  }
  s = s.slice(0, a) + s.slice(j);
};
cut("<h2>Training versus traffic</h2>", "asymmetry card");
cut("<h2>Is the ranked web even alive?</h2>", "reachability card");

/* the renderers for those two cards become dead code — remove them so the
   page does not carry logic for elements that no longer exist */
const dropBlock = (open, label) => {
  const i = s.indexOf(open);
  if (i < 0) { console.log("  (already gone: " + label + ")"); return; }
  const end = s.indexOf("\n  }\n", i);
  if (end < 0) throw new Error("block end not found: " + label);
  s = s.slice(0, i) + s.slice(end + "\n  }\n".length);
};
dropBlock("  // training vs traffic — the asymmetry", "asym renderer");
dropBlock("  // frame reachability", "reach renderer");

/* ---- 2. the preview panel ----------------------------------------------- */
const PANEL = `
  <section class="dash-preview" id="preview">
    <div class="dpk">
      <div class="dpkl">The dashboard</div>
      <div class="dped" id="dp-edition">&mdash;</div>
    </div>

    <div class="dpshell">
      <div class="dptabs" id="dp-tabs" role="tablist"></div>
      <div class="dpbody" id="dp-body"></div>
    </div>

    <div class="dpcta">
      <div>
        <b>Everything above is in the free edition.</b> What &euro;49 a month adds is the per-domain layer: all
        <span id="dp-total">50,000</span> rows, every crawler column, the week-over-week diff, and the CSV.
      </div>
      <div class="dpbtns">
        <a class="btn" href="https://app.crawlpriceindex.com/dashboard.html#account">Full dataset &mdash; &euro;49/mo</a>
        <a class="ghostbox" href="https://app.crawlpriceindex.com">Open the free edition</a>
      </div>
    </div>
  </section>
`;

const anchor = '<footer class="sitefoot">';
const ai = s.indexOf(anchor);
if (ai < 0) throw new Error("footer anchor not found");
// close the dash-wrap the grid lives in, then open a new one for the panel
s = s.slice(0, ai) + '<div class="dash-wrap">' + PANEL + "</div>\n\n" + s.slice(ai);

/* ---- 3. styles ---------------------------------------------------------- */
const CSS = `
/* ---- dashboard preview ---- */
.dash-preview{padding:10px 0 44px}
.dpk{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;padding-bottom:14px;border-bottom:1px solid var(--line)}
.dpk h2{font-family:var(--serif);font-weight:400;font-size:26px;margin:0 0 4px;border:0;padding:0}
.dpk p{margin:0;font-size:13.5px;color:var(--dim);max-width:62ch}
.dped{font-family:'Spline Sans Mono',ui-monospace,monospace;font-size:11.5px;color:var(--dim);white-space:nowrap}

/* the shell borrows the dashboard's own chrome so the preview reads as the
   product rather than as a marketing mock-up of it */
.dpshell{margin-top:18px;border:1px solid var(--line);border-radius:4px;background:#fff;box-shadow:var(--lift);overflow:hidden}
.dptabs{display:flex;overflow-x:auto;background:var(--sand);border-bottom:1px solid var(--line);scrollbar-width:thin}
.dptabs button{flex:0 0 auto;font-family:var(--sans);font-size:12.5px;padding:11px 15px;background:transparent;border:0;border-right:1px solid var(--line);cursor:pointer;color:var(--dim);white-space:nowrap;position:relative}
.dptabs button:hover{color:var(--fg)}
.dptabs button[aria-selected=true]{background:#fff;color:var(--fg);font-weight:600;box-shadow:inset 0 -2px 0 var(--signal)}
.dptabs button .lk{margin-left:6px;font-size:10px;color:var(--amber)}
.dpbody{padding:20px 22px 22px;min-height:330px}
.dph{font-family:var(--serif);font-size:19px;margin:0 0 3px}
.dpsub{font-size:12.5px;color:var(--dim);margin:0 0 15px;line-height:1.5}
.dpfoot{font-size:11.5px;color:var(--dim);line-height:1.5;margin-top:14px;padding-top:10px;border-top:1px solid var(--line)}

/* rows and bars inside the preview */
.dpr{display:grid;grid-template-columns:1fr auto;gap:4px 12px;padding:7px 0;border-bottom:1px solid var(--line);align-items:baseline}
.dpr:last-of-type{border-bottom:0}
.dpr .kk{font-size:13px;color:var(--fg);min-width:0}
.dpr .kk small{display:block;font-size:11px;color:var(--dim)}
.dpr .vv{font-family:'Spline Sans Mono',ui-monospace,monospace;font-size:13px;font-weight:600;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.dpr .t{grid-column:1/-1;height:10px;background:var(--sand);border:1px solid var(--line);border-radius:2px;overflow:hidden}
.dpr .t>i{display:block;height:100%;background:var(--signal);min-width:2px}
.dpr .t>i.a{background:var(--amber)}
.dpr .t>i.b{background:var(--blue)}
.dpgrid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
@media(max-width:760px){.dpgrid{grid-template-columns:1fr}}
.dpnum{display:flex;gap:26px;flex-wrap:wrap;margin-bottom:16px}
.dpnum div{min-width:0}
.dpnum b{display:block;font-family:var(--serif);font-size:30px;font-weight:400;line-height:1}
.dpnum span{font-size:11.5px;color:var(--dim)}

/* the per-domain table: real rows, then masked ones */
.dptw{overflow-x:auto;border:1px solid var(--line);border-radius:3px}
.dpt{border-collapse:collapse;font-size:12px;width:100%;min-width:640px}
.dpt th{text-align:left;font-weight:600;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);padding:8px 7px;border-bottom:1px solid var(--line);background:var(--sand);white-space:nowrap}
.dpt td{padding:7px;border-bottom:1px solid var(--line);white-space:nowrap}
.dpt tr:last-child td{border-bottom:0}
.dpt .dm{font-family:'Spline Sans Mono',ui-monospace,monospace}
.dpt .rk{color:var(--dim);font-variant-numeric:tabular-nums}
.cell{display:inline-block;width:15px;height:15px;border-radius:2px;border:1px solid rgba(0,0,0,.12)}
.cellrow{display:inline-flex;gap:2px}
.dpt tr.mask td{color:var(--dim)}
.dpt tr.mask .dm,.dpt tr.mask .rk{letter-spacing:.12em;color:#B8B0A2}
.maskcell{display:inline-block;width:15px;height:15px;border-radius:2px;background:repeating-linear-gradient(45deg,#EFEAE1,#EFEAE1 3px,#E4DED3 3px,#E4DED3 6px);border:1px solid var(--line)}
.dpkey{display:flex;flex-wrap:wrap;gap:6px 15px;margin-top:10px;font-size:11.5px;color:var(--dim)}
.dpkey span{display:inline-flex;align-items:center;gap:5px}
.dpkey i{width:10px;height:10px;border-radius:2px;display:inline-block;border:1px solid rgba(0,0,0,.12)}
.dplock{margin-top:12px;padding:12px 14px;border:1px dashed var(--line);border-radius:3px;background:var(--sand);font-size:12.5px;color:var(--fg);display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}
.dplock b{font-family:'Spline Sans Mono',ui-monospace,monospace}
.dplock a{color:var(--signal);font-weight:600;text-decoration:none;white-space:nowrap}
.dplock a:hover{text-decoration:underline}

.dpcta{margin-top:20px;padding:18px 20px;border:1px solid var(--line);border-radius:4px;background:#fff;display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}
.dpcta > div:first-child{font-size:13.5px;color:var(--dim);max-width:60ch;line-height:1.55}
.dpbtns{display:flex;gap:10px;flex-wrap:wrap}
.dpcta .ghostbox{display:inline-block;font-size:13.5px;padding:10px 16px;border:1px solid var(--line);border-radius:2px;text-decoration:none;color:var(--fg);background:#fff}
.dpcta .ghostbox:hover{border-color:var(--signal);color:var(--signal)}
`;
s = s.replace("</style>", function(){ return CSS + "</style>"; });

/* ---- 4. the renderer ---------------------------------------------------- */
const JS = `
<script id="dash-preview-js">
/* The dashboard preview. Reads /explore-preview.json, rebuilt every edition by
   build-explore-preview.cjs, so this panel can never quietly drift a week
   behind the page around it. Real measurements only — the gated per-domain
   layer is masked, never fabricated. */
(function(){
  var P = null, cur = "overview";
  var n = function(x){ return Number(x).toLocaleString(); };
  var esc = function(x){ return String(x).replace(/[&<>]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c]; }); };
  var pct = function(a,b){ return b ? (a/b*100).toFixed(1) : "0.0"; };
  var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var interval = function(raw){
    var p = String(raw||"").split(/\s*->\s*/).map(function(x){
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(x.trim());
      return m ? (+m[3]) + " " + MON[+m[2]-1] : x;
    });
    return p.length === 2 ? p[0] + " &rarr; " + p[1] : esc(raw);
  };
  var STATE = { blocked:"#A33A2A", partial:"#8A6A1F", allowed:"#1C5D4A", unlisted:"#B8B0A2", no_robots:"#DCD6CB" };
  var LABEL = { blocked:"Blocked", partial:"Partial", allowed:"Allowed", unlisted:"No instruction", no_robots:"No robots.txt" };

  function row(k, v, w, tone, note){
    return '<div class="dpr"><span class="kk">' + k + (note?'<small>'+note+'</small>':'') + '</span>' +
      '<span class="vv">' + v + '</span>' +
      (w == null ? '' : '<span class="t"><i class="' + (tone||'') + '" style="width:' + Math.max(0,Math.min(100,w)).toFixed(1) + '%"></i></span>') +
      '</div>';
  }
  function head(h, sub){ return '<div class="dph">' + h + '</div><p class="dpsub">' + sub + '</p>'; }
  function foot(t){ return '<div class="dpfoot">' + t + '</div>'; }

  var VIEWS = {
    overview: function(){
      var o = P.overview, A = o.asymmetry, C = o.changes, R = o.reachability;
      return head("This edition", "The headline state of the frame, and what moved since the last edition.") +
        '<div class="dpnum">' +
          '<div><b>' + n(o.parsed) + '</b><span>serving a readable robots.txt</span></div>' +
          '<div><b>' + n(o.frame) + '</b><span>domains in the ranked frame</span></div>' +
          '<div><b>' + A.ratio + ':1</b><span>training blocked over search</span></div>' +
          '<div><b>' + n(C.total) + '</b><span>policy edits this interval</span></div>' +
        '</div>' +
        '<div class="dpgrid"><div>' +
          row("Moved toward restriction", n(C.more_restrictive), 100, "a") +
          row("Moved away from restriction", n(C.less_restrictive), C.less_restrictive/C.more_restrictive*100, "b") +
        '</div><div>' +
          row("Answered our crawler", n(R.alive) + " &middot; " + pct(R.alive,R.frame) + "%", R.alive/R.frame*100) +
          row("Served robots.txt, then refused the homepage", n(R.bot_walled), R.bot_walled/R.frame*100, "a") +
        '</div></div>' +
        foot("Same figures the free edition opens with. " + interval(C.interval) + ".");
    },

    crawlers: function(){
      var cs = P.crawlers.slice().sort(function(a,b){ return b.blocked_pct - a.blocked_pct; });
      var mx = cs[0] ? cs[0].blocked_pct : 1;
      return head("Crawlers", "All " + cs.length + " tracked crawlers, with the vendor and role tags the dataset carries.") +
        cs.slice(0,8).map(function(c){
          return row(esc(c.name) + ' <span style="color:var(--dim);font-size:11.5px">&middot; ' + esc(c.vendor) + '</span>',
            c.blocked_pct.toFixed(2) + "%", c.blocked_pct/mx*100, c.role === "training" ? "a" : "b");
        }).join("") +
        foot("Showing 8 of " + cs.length + ". Amber is a training crawler, blue is search or user-initiated. Share of the " + n(P.parsed) + " domains serving a readable robots.txt.");
    },

    policy: function(){
      var L = P.policy && P.policy.ladder;
      if (!L) return head("Policy layer","Not in this edition.");
      return head("Policy layer", "How many domains have an AI policy at all &mdash; the honest size of the layer everything else is measured against.") +
        row("In the ranked frame", n(L.frame), 100, "") +
        row("Serve a readable robots.txt", n(L.parsed), L.parsed/L.frame*100, "b", L.parsed_pct + "% of the frame") +
        row("Name at least one tracked AI crawler", n(L.ai_aware), L.ai_aware/L.frame*100, "a", L.ai_aware_pct_parsed + "% of those that serve a file") +
        '<div style="margin-top:14px">' +
        (P.policy.rows||[]).slice(0,4).map(function(r){
          return row(esc(r.name) + ' <span style="color:var(--dim);font-size:11.5px">named by ' + r.named_pct + '% of domains</span>',
            (r.blocked_when_named_pct == null ? "&mdash;" : r.blocked_when_named_pct.toFixed(1) + "%"),
            r.blocked_when_named_pct || 0, "a", "refused this often once a domain does name it");
        }).join("") + '</div>' +
        foot("<b>Blocked once named</b> removes the awareness gap: of the publishers who did address a crawler, how many said no. Showing 4 of " + P.policy.total_rows + " crawlers.");
    },

    changes: function(){
      var C = P.changes;
      return head("Policy changes", "Every domain&times;crawler cell that moved between the last two editions, with both values.") +
        '<div class="dptw"><table class="dpt"><thead><tr><th>Domain</th><th>Rank</th><th>Crawler</th><th>Was</th><th>Now</th></tr></thead><tbody>' +
        C.sample.map(function(c){
          return '<tr><td class="dm">' + esc(c.domain) + '</td><td class="rk">' + n(c.rank) + '</td>' +
            '<td>' + esc(c.crawler) + (c.also ? ' <span style="color:var(--dim)">+' + c.also + ' more</span>' : '') + '</td>' +
            '<td><span class="cell" style="background:' + (STATE[c.prev]||"#eee") + '"></span> ' + esc(LABEL[c.prev]||c.prev) + '</td>' +
            '<td><span class="cell" style="background:' + (STATE[c.cur]||"#eee") + '"></span> ' + esc(LABEL[c.cur]||c.cur) + '</td></tr>';
        }).join("") + '</tbody></table></div>' +
        foot(n(C.total) + " edits across " + n(C.domains) + " domains this interval (" + interval(C.interval) + "). Showing " + C.sample.length + " domains &mdash; one row each.");
    },

    segments: function(){
      var S = P.segments, B = S.bands || [];
      var mx = Math.max.apply(null, B.map(function(b){ return b.pct; }).concat([1]));
      return head("Segments", "The same question asked of different slices of the frame. Popularity band first.") +
        B.map(function(b){
          return row("Rank " + esc(b.label) + ' <span style="color:var(--dim);font-size:11.5px">&middot; ' + n(b.n) + " of " + n(b.n_total) + " parsed</span>",
            b.pct.toFixed(1) + "%", b.pct/mx*100, "a");
        }).join("") +
        (S.tld_most ? foot("Rate shown is <b>" + esc(S.band_metric) + "</b>, the most-blocked crawler. By domain suffix, <b>" + esc(S.tld_most.cctld) + "</b> blocks most (" + S.tld_most.any_ai_block_pct + "% of " + n(S.tld_most.n) + ") and <b>" + esc(S.tld_least.cctld) + "</b> least (" + S.tld_least.any_ai_block_pct + "%). A suffix is not a country.") : "");
    },

    wire: function(){
      var W = P.wire;
      return head("Wire evidence", "What the door actually returns when an identified AI crawler knocks &mdash; measured on the wire, separately from what robots.txt declares.") +
        (W.classes||[]).map(function(c){
          return row(esc(c.k), n(c.n), null, "", esc(c.d));
        }).join("") +
        (W.prices && W.prices.length
          ? '<div style="margin-top:12px;font-size:12.5px;color:var(--dim)">Posted price observed this edition: <b class="dm" style="color:var(--fg)">' + esc(W.prices[0]) + '</b></div>' : "") +
        foot("A hand-probed exhibit set, not a population estimate &mdash; these counts describe the domains we probed, and are never folded into a block rate.");
    },

    bazaar: function(){
      var B = P.bazaar;
      if (!B) return head("The Bazaar","Not in this edition.");
      var T = B.by_type || {}, tot = Object.keys(T).reduce(function(a,k){ return a + T[k]; }, 0) || 1;
      var LBL = { api:"Developer APIs", content:"Content", mcp:"MCP tools" };
      return head("The Bazaar", "A public registry of endpoints advertising a price a machine can pay directly. Advertised acceptance &mdash; never transactions or revenue.") +
        '<div class="dpnum">' +
          '<div><b>' + n(B.endpoints_real_priced) + '</b><span>priced endpoints</span></div>' +
          '<div><b>$' + B.median_advertised_usd + '</b><span>median advertised ask</span></div>' +
          '<div><b>' + n(B.in_frame_domains) + '</b><span>of our ranked domains taking part</span></div>' +
        '</div>' +
        Object.keys(T).sort(function(a,b){ return T[b]-T[a]; }).map(function(k){
          return row(esc(LBL[k]||k), n(T[k]) + " &middot; " + pct(T[k],tot) + "%", T[k]/tot*100, k==="api"?"b":k==="mcp"?"a":"");
        }).join("") +
        foot(B.rail_share_pct + "% of it settles on a single rail, " + B.asset_usdc_share_pct + "% in one stablecoin.");
    },

    domains: function(){
      var D = P.domains, cols = D.columns;
      var th = '<tr><th>Domain</th><th>Rank</th><th>' + cols.length + ' crawler columns</th><th>Summary</th></tr>';
      var real = D.sample_rows.map(function(r){
        var cells = r.sig.split("").map(function(ch, i){
          var st = P.legend[ch] || "unlisted";
          return '<span class="cell" title="' + esc(cols[i]) + ': ' + esc(LABEL[st]||st) + '" style="background:' + (STATE[st]||"#eee") + '"></span>';
        }).join("");
        var sum = Object.keys(r.counts).map(function(k){ return r.counts[k] + " " + (LABEL[k]||k).toLowerCase(); }).join(", ");
        return '<tr><td class="dm">' + esc(r.domain) + '</td><td class="rk">' + n(r.rank) + '</td>' +
          '<td><span class="cellrow">' + cells + '</span></td><td style="color:var(--dim)">' + esc(sum) + '</td></tr>';
      }).join("");
      var maskCells = new Array(cols.length).fill('<span class="maskcell"></span>').join("");
      var mask = new Array(4).fill(0).map(function(){
        return '<tr class="mask"><td class="dm">&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;</td><td class="rk">&bull;&bull;&bull;</td>' +
          '<td><span class="cellrow">' + maskCells + '</span></td><td>&bull;&bull;&bull;&bull;&bull;&bull;</td></tr>';
      }).join("");
      return head("Domains &mdash; the per-domain layer", "One row per domain, one column per crawler. This is the part &euro;49 unlocks.") +
        '<div class="dptw"><table class="dpt"><thead>' + th + '</thead><tbody>' + real + mask + '</tbody></table></div>' +
        '<div class="dpkey">' + Object.keys(LABEL).map(function(k){
          return '<span><i style="background:' + STATE[k] + '"></i>' + LABEL[k] + '</span>';
        }).join("") + '</div>' +
        '<div class="dplock"><span>The rows above are real and current. <b>' + n(D.masked_rows) + '</b> more are behind the wall &mdash; masked here, not invented.</span>' +
        '<a href="https://app.crawlpriceindex.com/dashboard.html#account">Unlock all ' + n(D.total_rows) + ' rows &rarr;</a></div>' +
        foot("Hover a cell to see which crawler it is. The full table adds filtering, the week-over-week diff, and a CSV export of every row.");
    }
  };

  function paint(){
    var el = document.getElementById("dp-body");
    var v = VIEWS[cur];
    el.innerHTML = v ? v() : "";
    Array.prototype.forEach.call(document.querySelectorAll("#dp-tabs button"), function(b){
      b.setAttribute("aria-selected", b.dataset.tab === cur ? "true" : "false");
    });
  }

  fetch("/explore-preview.json", { cache:"no-store" }).then(function(r){ return r.json(); }).then(function(j){
    P = j;
    document.getElementById("dp-edition").textContent = "Edition of " + j.edition + " · rebuilt " + (j.generated_utc||"").slice(0,10);
    var t = document.getElementById("dp-total"); if (t) t.textContent = n(j.domains.total_rows);
    document.getElementById("dp-tabs").innerHTML = j.tabs.map(function(tb){
      return '<button role="tab" data-tab="' + tb.id + '" aria-selected="' + (tb.id===cur) + '">' + esc(tb.title) +
        (tb.access === "terminal" ? '<span class="lk">&euro;49</span>' : '') + '</button>';
    }).join("");
    document.getElementById("dp-tabs").addEventListener("click", function(e){
      var b = e.target.closest("button"); if (!b) return;
      cur = b.dataset.tab; paint();
    });
    paint();
  }).catch(function(){
    document.getElementById("dp-body").innerHTML =
      '<p class="dpsub">The preview could not load this edition. <a href="https://app.crawlpriceindex.com">Open the free edition instead &rarr;</a></p>';
  });
})();
</script>
`;
s = s.replace('<footer class="sitefoot">', function(){ return JS + '<footer class="sitefoot">'; });

fs.writeFileSync(P, s);

/* ---- sanity -------------------------------------------------------------- */
const out = fs.readFileSync(P, "utf8");
for (const m of ["dash-preview", "dp-tabs", "explore-preview.json", "maskcell", "Unlock all "])
  if (!out.includes(m)) throw new Error("missing after patch: " + m);
if (out.includes("Training versus traffic")) throw new Error("asymmetry card survived");
if (out.includes("Is the ranked web even alive?")) throw new Error("reachability card survived");
if (out.includes('getElementById("asym")')) throw new Error("dead asym renderer survived");
if (out.includes('getElementById("reach")')) throw new Error("dead reach renderer survived");

console.log("/explore rebuilt");
console.log("  removed  the asymmetry and reachability cards (both now chart on the homepage)");
console.log("  kept     the 18-crawler ladder and the observed price — nothing else does those");
console.log("  added    a clickable replica of the dashboard, 8 tabs, real numbers");
console.log("  the gated per-domain layer is MASKED, not faked — 6 real rows, the rest dotted");
console.log("  the panel prints the edition it is showing");
