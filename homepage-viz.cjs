#!/usr/bin/env node
/**
 * CPI — homepage boxes 2–5: real charts instead of label/value rows
 * ===========================================================================
 * Feedback: "for boxes 2,3,4,5 we surely have a great data visualisation
 * snippet ... A flavour of the dashboard!"
 *
 * Each of the four sections now renders in the dashboard's own visual
 * vocabulary — the shared-scale ladder, the diverging centre-axis bar, the
 * stacked composition bar, the nested subset row — and carries a link to the
 * tab it is a preview OF. Every figure still comes from /index.json, so they
 * all move with the edition; nothing here is hardcoded except the crawler
 * role/vendor labels, which are copied verbatim from compute-dashboard.cjs.
 *
 * Box 2  Training versus traffic  -> shared-scale asymmetry + median-by-role
 *                                    + same-vendor-different-answer pairs
 * Box 3  What changed this week   -> diverging bar, reversions nested as a
 *                                    subset of the less-restrictive side
 * Box 4  Declared versus enforced -> stacked frame composition, bot-walled
 *                                    nested as a subset of "alive"
 * Box 5  The machine market       -> composition stack + price contrast +
 *                                    the participation sliver
 */
const fs = require("fs");
const P = "public/index.html";
const T = "public/theme.css";

let s = fs.readFileSync(P, "utf8");
if (s.includes("dv-render")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(P, P + ".bak-viz");

/* ------------------------------------------------------------------ CSS -- */
const CSS = `
/* ---- homepage: dashboard-flavoured preview charts ---- */
.dv{background:#fff;border:1px solid var(--line);border-radius:4px;padding:13px 15px 12px;margin-top:14px}
.dvsplit .dv{margin-top:0}
.dvh{display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);padding-bottom:9px;margin-bottom:9px;border-bottom:1px solid var(--line)}
.dvh b{color:var(--fg);font-weight:600;letter-spacing:.12em}
.dvh a{color:var(--signal);text-decoration:none;white-space:nowrap;font-size:10px;letter-spacing:.08em}
.dvh a:hover{text-decoration:underline}
.dvsplit{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}
.dvf{font-size:11px;color:var(--dim);line-height:1.5;margin-top:9px;padding-top:8px;border-top:1px solid var(--line)}
.dvsub2{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);margin:14px 0 6px;padding-top:11px;border-top:1px solid var(--line)}
.dvsub2:first-child{margin-top:0;padding-top:0;border-top:0}

/* label / value / bar — the dashboard ladder idiom */
.dvr{display:grid;grid-template-columns:1fr auto;gap:5px 12px;align-items:baseline;padding:8px 0;border-bottom:1px solid var(--line)}
.dvr:last-child{border-bottom:0}
.dvr .dvk{font-size:12.5px;color:var(--fg);line-height:1.35;min-width:0}
.dvr .dvk small{display:block;font-size:11px;color:var(--dim);line-height:1.4;margin-top:1px}
.dvr .dvv{font-family:ui-monospace,Menlo,monospace;font-size:13px;font-weight:600;color:var(--fg);text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.dvr .dvt{grid-column:1/-1;height:12px;background:var(--sand);border:1px solid var(--line);border-radius:2px;overflow:hidden}
.dvr .dvt>i{display:block;height:100%;background:var(--signal);min-width:2px}
.dvr .dvt>i.a{background:var(--amber)}
.dvr .dvt>i.b{background:var(--blue)}
.dvr .dvt>i.r{background:var(--red)}
.dvr .dvt>i.n{background:#B8B0A2}

/* nested subset row — reads as "of which" under the row above */
.dvr.dvsub .dvk{padding-left:16px;position:relative;color:var(--dim);font-size:12px}
.dvr.dvsub .dvk:before{content:"";position:absolute;left:4px;top:-11px;bottom:8px;width:1px;background:var(--line)}
.dvr.dvsub .dvk:after{content:"";position:absolute;left:4px;top:8px;width:7px;height:1px;background:var(--line)}
.dvr.dvsub .dvt{margin-left:16px}
.dvr.dvsub .dvv{font-weight:600;font-size:12.5px}

/* diverging centre-axis bar */
.dvdl{display:flex;justify-content:space-between;gap:10px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim)}
.dvdl b{display:block;font-family:ui-monospace,Menlo,monospace;font-size:17px;letter-spacing:0;text-transform:none;color:var(--fg);margin-top:1px}
.dvdl span.rt{text-align:right}
.dvdiv{position:relative;height:26px;margin:8px 0 2px;background:var(--sand);border:1px solid var(--line);border-radius:2px}
.dvdiv i{position:absolute;top:0;bottom:0;display:block}
.dvdiv i.l{right:50%;background:var(--blue)}
.dvdiv i.r{left:50%;background:var(--amber)}
.dvax{position:absolute;left:50%;top:-4px;bottom:-4px;width:1px;background:var(--fg);opacity:.45;z-index:2}

/* stacked composition */
.dvstack{display:flex;height:26px;border:1px solid var(--line);border-radius:2px;overflow:hidden;background:var(--sand)}
.dvstack i{display:block;height:100%;min-width:1px}
.dvkey{display:flex;flex-wrap:wrap;gap:5px 16px;margin-top:9px;font-size:11.5px;color:var(--dim)}
.dvkey span{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.dvkey b{width:9px;height:9px;border-radius:2px;display:inline-block;flex:0 0 auto}
.dvkey em{font-style:normal;font-family:ui-monospace,Menlo,monospace;color:var(--fg);font-variant-numeric:tabular-nums}

/* vendor pair group */
.dvg{padding:9px 0;border-bottom:1px solid var(--line)}
.dvg:last-child{border-bottom:0}
.dvgh{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:12px;color:var(--dim);margin-bottom:6px}
.dvgh b{color:var(--fg);font-weight:600;font-size:12.5px}
.dvgh em{font-style:normal;font-family:ui-monospace,Menlo,monospace;color:var(--amber);font-weight:600}
.dvp{display:grid;grid-template-columns:106px 1fr 42px;gap:8px;align-items:center;font-size:11.5px;padding:2px 0}
.dvp .pk{color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dvp .pt{height:10px;background:var(--sand);border:1px solid var(--line);border-radius:2px;overflow:hidden}
.dvp .pt>i{display:block;height:100%;min-width:2px}
.dvp .pv{text-align:right;font-family:ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums;color:var(--fg)}

/* headline readout */
.dvbig{font-family:ui-monospace,Menlo,monospace;font-size:clamp(26px,3.6vw,36px);font-weight:600;color:var(--fg);letter-spacing:-.01em;line-height:1}
.dvbigl{font-size:11.5px;color:var(--dim);margin-top:6px;line-height:1.45}
.dvpair{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:2px}
.dvpair .pc{background:var(--sand);border:1px solid var(--line);border-radius:2px;padding:8px 10px}
.dvpair .pc .pn{font-family:ui-monospace,Menlo,monospace;font-size:15px;font-weight:600;color:var(--fg)}
.dvpair .pc .pl{font-size:11px;color:var(--dim);line-height:1.4;margin-top:2px}
@media(max-width:860px){.dvsplit{grid-template-columns:1fr}}
`;

let t = fs.readFileSync(T, "utf8");
if (!t.includes("dashboard-flavoured preview charts")) fs.writeFileSync(T, t + CSS);

/* ------------------------------------------------------- markup: box 2/5 -- */
/* the two wide boxes get a two-column shell; the narrow two stay single */
s = s.replace(
  '<div id="v2-asym" style="margin-top:14px"></div>',
  '<div id="v2-asym" class="dvsplit"></div>'
);
s = s.replace(
  '<div id="v2-bazaar" style="margin-top:14px"></div>',
  '<div id="v2-bazaar" class="dvsplit"></div>'
);

/* ----------------------------------------------------------------- JS ---- */
const OLD_START = "    var A = d.asymmetry_headline, ae = document.getElementById(\"v2-asym\");";
const OLD_END = "  }).catch(function(){});";
const a = s.indexOf(OLD_START);
const b = s.indexOf(OLD_END, a);
if (a < 0 || b < 0) throw new Error("v2-loader render block not found");

const JS = `    /* --- dv-render: the four homepage sections, drawn the way the dashboard
       draws them. Every number is read from the feed above. ------------- */
    var APP = "https://app.crawlpriceindex.com/dashboard.html";
    var esc = function(x){ return String(x).replace(/[&<>]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c]; }); };
    var pct1 = function(x, of){ return of ? (x / of * 100).toFixed(1) : "0.0"; };

    var head = function(title, hash, linkText){
      return '<div class="dvh"><b>' + title + '</b>' +
        (hash ? '<a href="' + APP + '#' + hash + '">' + linkText + ' &rarr;</a>' : '') + '</div>';
    };
    // one ladder row: label, value, and a bar on a scale the caller controls
    var bar = function(o){
      return '<div class="dvr' + (o.sub ? ' dvsub' : '') + '">' +
        '<span class="dvk">' + o.k + (o.note ? '<small>' + o.note + '</small>' : '') + '</span>' +
        '<span class="dvv">' + o.v + '</span>' +
        '<span class="dvt"><i class="' + (o.tone || '') + '" style="width:' +
          Math.max(0, Math.min(100, o.pct)).toFixed(2) + '%"></i></span></div>';
    };
    var stack = function(parts){
      var tot = parts.reduce(function(x, p){ return x + p.n; }, 0) || 1;
      return '<div class="dvstack">' + parts.map(function(p){
          return '<i style="width:' + (p.n / tot * 100).toFixed(3) + '%;background:' + p.c + '"></i>';
        }).join('') + '</div><div class="dvkey">' + parts.map(function(p){
          return '<span><b style="background:' + p.c + '"></b>' + p.k +
            ' <em>' + n(p.n) + '</em> <span style="color:var(--dim)">&middot; ' + pct1(p.n, tot) + '%</span></span>';
        }).join('') + '</div>';
    };

    /* ---- 2. Training versus traffic ---------------------------------- */
    // role and vendor labels, copied from compute-dashboard.cjs. Labels only:
    // they describe a crawler's stated function, never a company's behaviour.
    var META = {
      "GPTBot":["OpenAI","training"], "OAI-SearchBot":["OpenAI","search"], "ChatGPT-User":["OpenAI","user-initiated"],
      "ClaudeBot":["Anthropic","training"], "Claude-Web":["Anthropic","user-initiated"], "anthropic-ai":["Anthropic","training"],
      "PerplexityBot":["Perplexity","search"], "Perplexity-User":["Perplexity","user-initiated"],
      "Google-Extended":["Google","training"], "CCBot":["Common Crawl","training"],
      "Bytespider":["ByteDance","training"], "Amazonbot":["Amazon","search"],
      "Applebot-Extended":["Apple","training"], "meta-externalagent":["Meta","training"],
      "cohere-ai":["Cohere","training"], "AI2Bot":["AI2","training"],
      "Timpibot":["Timpi","training"], "Diffbot":["Diffbot","training"]
    };
    var median = function(xs){
      if (!xs.length) return 0;
      var v = xs.slice().sort(function(p, q){ return p - q; }), m = v.length >> 1;
      return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
    };

    var A = d.asymmetry_headline, ae = document.getElementById("v2-asym");
    if (A && ae) {
      var top = Math.max(A.blocks_training_role_only, A.blocks_search_role_only) || 1;
      var left = '<div class="dv">' + head("The asymmetry", "crawlers", "Crawlers tab") +
        '<div class="dvbig">' + A.ratio + ' : 1</div>' +
        '<div class="dvbigl">Domains that draw a line between the two roles draw it against <b>training</b> this many times more often.</div>' +
        '<div style="margin-top:12px">' +
        bar({ k: 'Blocks a <b>training</b> crawler,<br>and no search crawler', v: n(A.blocks_training_role_only),
              pct: A.blocks_training_role_only / top * 100, tone: 'a' }) +
        bar({ k: 'Blocks a <b>search</b> crawler,<br>and no training crawler', v: n(A.blocks_search_role_only),
              pct: A.blocks_search_role_only / top * 100, tone: 'b' }) +
        '</div>' +
        '<div class="dvf">Both bars on one scale, so the sliver is the finding. Of ' + n(A.denominator) +
        ' domains serving a readable robots.txt.</div></div>';

      var rates = (d.block_rates && d.block_rates.pct) || {};
      var byRole = { "training": [], "search": [], "user-initiated": [] };
      Object.keys(rates).forEach(function(c){
        var m = META[c]; if (m && byRole[m[1]]) byRole[m[1]].push(rates[c]);
      });
      var roleRows = [
        { k: "Training", r: "training", tone: "a", d: "ingests the page to train a model" },
        { k: "Search", r: "search", tone: "b", d: "indexes it, and may send a reader back" },
        { k: "User-initiated", r: "user-initiated", tone: "n", d: "fetches it because a person asked" }
      ].filter(function(x){ return byRole[x.r].length; });
      var roleMax = Math.max.apply(null, roleRows.map(function(x){ return median(byRole[x.r]); }).concat([1]));

      // vendors that field BOTH a training and a non-training crawler: the
      // comparison that controls for who is doing the crawling
      var vend = {};
      Object.keys(rates).forEach(function(c){
        var m = META[c]; if (!m) return;
        (vend[m[0]] = vend[m[0]] || []).push({ c: c, role: m[1], v: rates[c] });
      });
      var pairs = Object.keys(vend).filter(function(v){
        var g = vend[v];
        return g.some(function(x){ return x.role === "training"; }) &&
               g.some(function(x){ return x.role !== "training"; });
      }).sort(function(p, q){
        var mx = function(g){ return Math.max.apply(null, vend[g].map(function(x){ return x.v; })); };
        return mx(q) - mx(p);
      });
      var vmax = Math.max.apply(null, Object.keys(rates).map(function(c){ return rates[c]; }).concat([1]));
      var mean = function(xs){ return xs.reduce(function(p, q){ return p + q; }, 0) / (xs.length || 1); };

      var right = '<div class="dv">' + head("How the roles differ", "crawlers", "Crawlers tab") +
        '<div class="dvsub2">Median declared block rate, by crawler role</div>' +
        roleRows.map(function(x){
          var m = median(byRole[x.r]);
          return bar({ k: x.k + ' <span style="color:var(--dim);font-size:11.5px">&middot; ' + byRole[x.r].length + ' tracked</span>',
                       v: m.toFixed(1) + "%", pct: m / roleMax * 100, tone: x.tone, note: x.d });
        }).join('') +
        '<div class="dvsub2">Same vendor, same robots.txt, different answer</div>' +
        pairs.map(function(v){
          var g = vend[v].slice().sort(function(p, q){ return q.v - p.v; });
          var tr = g.filter(function(x){ return x.role === "training"; });
          var ot = g.filter(function(x){ return x.role !== "training"; });
          var ratio = mean(ot.map(function(x){ return x.v; })) ?
            (mean(tr.map(function(x){ return x.v; })) / mean(ot.map(function(x){ return x.v; }))).toFixed(1) : null;
          return '<div class="dvg"><div class="dvgh"><b>' + esc(v) + '</b>' +
            (ratio ? '<em>' + ratio + '&times; harder on training</em>' : '') + '</div>' +
            g.map(function(x){
              return '<div class="dvp"><span class="pk">' + esc(x.c) + '</span>' +
                '<span class="pt"><i class="' + (x.role === "training" ? "" : "b") +
                  '" style="width:' + (x.v / vmax * 100).toFixed(1) + '%;background:' +
                  (x.role === "training" ? "var(--amber)" : "var(--blue)") + '"></i></span>' +
                '<span class="pv">' + x.v + '%</span></div>';
            }).join('') + '</div>';
        }).join('') +
        '<div class="dvf">Share of domains with a readable robots.txt that disallow each named crawler. Role tags are labels for a crawler&rsquo;s stated function &mdash; not a claim about any company.</div></div>';

      ae.innerHTML = left + right;
    }

    /* ---- 3. What changed this week ----------------------------------- */
    var C = d.changes_headline, ce = document.getElementById("v2-changes");
    if (C && ce) {
      var cmax = Math.max(C.more_restrictive, C.less_restrictive) || 1;
      ce.innerHTML = '<div class="dv">' + head("Policy changes &middot; " + esc(C.interval), "changes", "Policy changes tab") +
        '<div class="dvdl"><span>&larr; Away from restriction<b>' + n(C.less_restrictive) + '</b></span>' +
        '<span class="rt">Toward restriction &rarr;<b>' + n(C.more_restrictive) + '</b></span></div>' +
        '<div class="dvdiv"><i class="l" style="width:' + (C.less_restrictive / cmax * 50).toFixed(2) + '%"></i>' +
        '<i class="r" style="width:' + (C.more_restrictive / cmax * 50).toFixed(2) + '%"></i>' +
        '<span class="dvax"></span></div>' +
        '<div style="margin-top:10px">' +
        bar({ k: 'of the ' + n(C.less_restrictive) + ' that loosened, moved <b>off</b> an explicit block',
              v: n(C.moved_off_a_block), pct: C.moved_off_a_block / (C.less_restrictive || 1) * 100,
              tone: '', sub: true,
              note: 'deliberate edits &mdash; the highest-signal rows in the file' }) +
        '</div>' +
        '<div class="dvf">' + n(C.total) + ' domain&times;crawler changes across ' + n(C.domains_changed) +
        ' domains. Both directions on one scale, either side of a common axis.</div></div>';
    }

    /* ---- 4. Declared versus enforced --------------------------------- */
    var R = d.reachability_headline, re = document.getElementById("v2-reach");
    if (R && re) {
      var other = Math.max(0, R.frame - R.alive - R.dead_dns - R.timeout);
      re.innerHTML = '<div class="dv">' + head("Frame reachability &middot; " + n(R.frame) + " domains", "detail", "Full detail tab") +
        stack([
          { k: "Answered", n: R.alive, c: "var(--signal)" },
          { k: "Timed out", n: R.timeout, c: "var(--amber)" },
          { k: "Name gone", n: R.dead_dns, c: "#B8B0A2" },
          { k: "Other", n: other, c: "#E0DACF" }
        ]) +
        '<div style="margin-top:12px">' +
        bar({ k: 'of the ' + n(R.alive) + ' that answered, served robots.txt <b>then refused</b> an identified crawler at the homepage',
              v: n(R.bot_walled), pct: R.bot_walled / (R.alive || 1) * 100, tone: 'r', sub: true,
              note: 'declared policy and enforced access diverging &mdash; ' + pct1(R.bot_walled, R.alive) + '% of the domains that answered' }) +
        bar({ k: 'Disallow our crawler &mdash; we obey', v: n(R.disallowed_our_crawler),
              pct: R.disallowed_our_crawler / R.frame * 100, tone: 'n',
              note: 'excluded by their own instruction, ' + pct1(R.disallowed_our_crawler, R.frame) + '% of the frame' }) +
        '</div>' +
        '<div class="dvf">A popularity ranking lists domains, not working websites. ' +
        pct1(R.dead_dns + R.timeout, R.frame) + '% of the ranked frame never answered at all.</div></div>';
    }

    /* ---- 5. The machine market --------------------------------------- */
    var B = d.bazaar_headline, be = document.getElementById("v2-bazaar");
    if (B && be) {
      var TY = B.by_type || {};
      var lbl = { api: "Developer APIs", content: "Content", mcp: "MCP tools" };
      var col = { api: "var(--blue)", content: "var(--signal)", mcp: "var(--amber)" };
      var parts = Object.keys(TY).sort(function(p, q){ return TY[q] - TY[p]; })
        .map(function(k){ return { k: lbl[k] || k, n: TY[k], c: col[k] || "#B8B0A2" }; });

      var bleft = '<div class="dv">' + head("What the market is made of", "bazaar", "The Bazaar tab") +
        '<div style="font-size:12.5px;color:var(--dim);margin-bottom:9px">' + n(B.endpoints_real_priced) +
        ' endpoints advertising a machine-payable price, across ' + n(B.distinct_pay_to_addresses) +
        ' distinct pay-to addresses.</div>' +
        stack(parts) +
        '<div class="dvpair" style="margin-top:12px">' +
        '<div class="pc"><div class="pn">' + B.rail_share_pct + '%</div><div class="pl">on a single rail</div></div>' +
        '<div class="pc"><div class="pn">' + B.asset_usdc_share_pct + '%</div><div class="pl">settled in one stablecoin</div></div>' +
        '</div>' +
        '<div class="dvf">Advertised, opt-in acceptance in a public registry &mdash; never transactions, volume or revenue.</div></div>';

      var obsRaw = (d.observed_prices_headline && d.observed_prices_headline[0] && d.observed_prices_headline[0].raw) || "";
      var obsNum = parseFloat((obsRaw.match(/([0-9]*\\.?[0-9]+)\\s*$/) || [])[1]);
      var pmax = Math.max(B.median_advertised_usd, obsNum || 0) || 1;

      var bright = '<div class="dv">' + head("The price, and who is in it", "bazaar", "The Bazaar tab") +
        (obsNum ? bar({ k: 'Highest posted per-crawl price on the <b>human</b> web',
                        v: "$" + obsNum.toFixed(2), pct: obsNum / pmax * 100, tone: 'a',
                        note: esc(obsRaw) + ' &mdash; n=1, from a hand-probed panel' }) : '') +
        bar({ k: 'Median ask in the <b>machine</b> market', v: "$" + B.median_advertised_usd,
              pct: B.median_advertised_usd / pmax * 100, tone: 'b',
              note: 'across ' + n(B.endpoints_real_priced) + ' priced endpoints' }) +
        bar({ k: 'Of our ' + n(R && R.frame ? R.frame : 50000) + ' ranked domains, how many take part',
              v: n(B.in_frame_domains), pct: 1.2, tone: '',
              note: pct1(B.in_frame_domains, (R && R.frame) || 50000) + '% of the frame &mdash; bar drawn at minimum width, the true share is too small to see' }) +
        (B.in_frame_content != null ? bar({ k: 'of those, serving <b>content</b> rather than an API',
              v: n(B.in_frame_content), pct: B.in_frame_content / (B.in_frame_domains || 1) * 100,
              tone: 'b', sub: true }) : '') +
        '<div class="dvf">Two different mechanisms, and the gap is the point: machines have a working market with a going rate, and it barely touches the web people read. Different rail from Cloudflare pay-per-crawl, though both return HTTP 402.</div></div>';

      be.innerHTML = bleft + bright;
    }
`;

s = s.slice(0, a) + JS + s.slice(b);
fs.writeFileSync(P, s);

/* ---------------------------------------------------------- sanity ------- */
const out = fs.readFileSync(P, "utf8");
const must = ["dv-render", 'id="v2-asym" class="dvsplit"', 'id="v2-bazaar" class="dvsplit"',
              "Same vendor, same robots.txt", "dvax", "dvstack"];
for (const m of must) if (!out.includes(m)) throw new Error("missing after patch: " + m);
if ((out.match(/<script id="v2-loader">/g) || []).length !== 1) throw new Error("loader duplicated");

console.log("homepage boxes 2-5 -> dashboard-flavoured charts");
console.log("  2 Training versus traffic  shared-scale asymmetry + role medians + vendor pairs");
console.log("  3 What changed this week   diverging centre-axis bar + nested reversions");
console.log("  4 Declared versus enforced stacked frame composition + nested bot-walled");
console.log("  5 The machine market       type composition + price contrast + participation sliver");
console.log("  every figure still read live from /index.json");
