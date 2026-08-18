/* CPI dashboard views — reads /data/dashboard.json. Language rules per DASHBOARD-SPEC:
   five states never collapse · "declared policy" not "access" · denominators always shown
   · "ccTLD" never "country" · rank = panel band. */
(function () {
  var D = null, EL = function (id) { return document.getElementById(id); };
  var STATE_COLORS = { blocked:"#A33A2A", partial:"#8A6A1F", allowed:"#1C5D4A", unlisted:"#B8B0A2", no_robots:"#DCD6CB" };
  var STATE_LABELS = { blocked:"Explicitly blocked", partial:"Partial", allowed:"Explicitly allowed", unlisted:"No explicit instruction", no_robots:"No robots.txt" };
  var LINE_COLORS = ["#1C5D4A","#8A6A1F","#1D4E6F","#A33A2A","#5F5B54","#2E7D5B"];
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]); }); };
  var fmt = function (n) { return (n == null ? "—" : Number(n).toLocaleString("en-GB")); };
  var pct = function (n) { return (n == null ? "—" : Number(n).toFixed(2) + "%"); };

  function delta(v) {
    if (v == null) return '<span style="color:var(--dim);font-size:11.5px">—</span>';
    if (Math.abs(v) < 0.005) return '<span style="color:var(--dim);font-size:11.5px">no change</span>';
    var up = v > 0;
    return '<span style="color:' + (up ? "#A33A2A" : "#1C5D4A") + ';font-size:11.5px;font-weight:600">' +
      (up ? "▲" : "▼") + " " + Math.abs(v).toFixed(2) + "pp</span>";
  }

  /* ---------- OVERVIEW ---------- */
  function overview() {
    var c = D.crawlers, top = c[0], low = c[c.length - 1];
    var h = "";
    h += kpiRow();
    // hero leaderboard
    h += '<section class="panel wide"><div class="ix">Crawler leaderboard &middot; declared robots policy</div>' +
      '<p class="sub">Share of the ' + fmt(D.panel.robots_parsed) + ' domains with a readable robots.txt that <b>explicitly block</b> each crawler. ' +
      'Change is versus the previous edition.</p>' +
      '<div class="lb">' + c.map(function (x, i) {
        var w = top.blocked_pct ? (x.blocked_pct / top.blocked_pct * 100) : 0;
        return '<div class="lbrow clickable" data-crawler="' + esc(x.name) + '"><span class="nm">' + esc(x.name) + '</span>' +
          '<span class="bar"><span style="width:' + w.toFixed(1) + '%"></span></span>' +
          '<span class="v">' + x.blocked_pct.toFixed(2) + '%</span>' +
          '<span class="d">' + delta(x.delta_pp) + '</span></div>';
      }).join("") + '</div>' +
      '<p class="foot">Blocked in robots.txt is a declared policy, not proof a crawler was denied. Denominator: ' +
      fmt(D.panel.robots_parsed) + ' parsed domains of the ' + fmt(D.panel.domains) + '-domain index frame &mdash; not "the web".</p></section>';

    // trend + selective side by side
    h += '<section class="panel' + (D.trend && D.trend.length >= 2 ? ' pclick" data-drill="trend' : '') + '"><div class="ix">Trend &middot; block rate by edition</div>' +
      (D.trend && D.trend.length >= 2
        ? '<div style="position:relative"><svg id="sv-trend" viewBox="0 0 620 300" style="width:100%;height:auto"></svg><div id="tt-trend" class="tt"></div></div>' +
          '<div class="legend" id="lg-trend"></div>' +
          (D.trend.length < 6 ? '<p class="foot">Early series (' + D.trend.length + ' editions). Directional only until the history is longer.</p>' : '')
        : '<div class="empty">The trend chart needs at least two editions. Currently ' + ((D.trend||[]).length) + '.</div>') +
      '</section>';

    h += '<section class="panel pclick" data-drill="selective"><div class="ix">Selective treatment</div>' +
      '<div class="big">' + pct(D.selective.pct) + '</div>' +
      '<p class="sub">of indexed domains treat at least one crawler differently from another &mdash; ' +
      fmt(D.selective.count) + ' domains.</p>' +
      '<p class="foot">Definition: ' + esc(D.selective.definition) + '</p>' +
      '<div class="hist">' + histBars(D.restriction_hist, "crawlers blocked per domain") + '</div>' +
      '</section>';

    // changes + wire
    h += '<section class="panel' + (D.changes.available ? ' pclick" data-drill="changes' : '') + '"><div class="ix">Policy changes</div>' +
      (D.changes.available
        ? '<div class="big">' + fmt(D.changes.total_changes) + '</div><p class="sub">domain&times;crawler status changes in ' + esc(D.changes.interval) + '.</p>' +
          '<p class="foot">Domains entering/leaving the index frame are excluded (' + fmt(D.changes.frame_churn.entered) + ' in, ' + fmt(D.changes.frame_churn.left) + ' out).</p>'
        : '<div class="empty">' + esc(D.changes.note) + '</div>') +
      '</section>';

    h += '<section class="panel pclick" data-drill="wire"><div class="ix">Observed wire evidence</div>' +
      '<p class="sub">Exploratory probe sample &mdash; exhibits, not population estimates.</p>' +
      '<div class="exh">' +
        exhibit("Posted prices", (D.wire.prices || []).length) +
        exhibit("HTTP 402 responses", (D.wire.p402 || []).length) +
        exhibit("Token walls", (D.wire.tollbit || []).length) +
        exhibit("Payment headers", (D.wire.payment_headers || []).length) +
      '</div>' +
      ((D.wire.prices || []).length ? '<p class="foot">Observed quote: ' + esc(D.wire.prices[0]) + '</p>' : '') +
      '</section>';

    EL("content").innerHTML = h;
    if (D.trend && D.trend.length >= 2) drawTrend();
    wireDrill();
  }

  function kpiRow() {
    return '<section class="panel wide kpis">' +
      kpi(fmt(D.panel.domains), "domains in index frame") +
      kpi(fmt(D.panel.robots_parsed), "with readable robots.txt") +
      kpi(String(D.panel.crawlers), "named crawlers tracked") +
      kpi(String((D.editions || []).length || 1), "per-domain editions retained") +
      '</section>';
  }
  function kpi(v, l) { return '<div class="kpi"><div class="kv">' + v + '</div><div class="kl">' + l + '</div></div>'; }
  function exhibit(l, n) { return '<div class="ex"><div class="exv">' + n + '</div><div class="exl">' + l + '</div></div>'; }

  var HIST_ORDER = ["0","1-3","4-6","7-12","13-17","18"];
  function histBars(hist, label) {
    var keys = HIST_ORDER.filter(function (k) { return hist[k] !== undefined; });
    Object.keys(hist).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });
    var max = Math.max.apply(null, keys.map(function (k) { return hist[k]; })) || 1;
    return '<div class="hlabel">' + label + '</div>' + keys.map(function (k) {
      return '<div class="hrow"><span class="hk">' + k + '</span><span class="hb"><span style="width:' +
        (hist[k] / max * 100).toFixed(1) + '%"></span></span><span class="hv">' + fmt(hist[k]) + '</span></div>';
    }).join("");
  }

  function drawTrend() {
    var t = D.trend, focus = ["GPTBot","ClaudeBot","CCBot","Google-Extended"].filter(function (f) { return t[0].rates[f] != null; });
    var W = 620, H = 300, pl = 46, pr = 12, pt = 16, pb = 34;
    var vals = []; t.forEach(function (p) { focus.forEach(function (f) { if (p.rates[f] != null) vals.push(p.rates[f]); }); });
    var mx = Math.ceil(Math.max.apply(null, vals) / 5) * 5 || 10, mn = 0;   // always baseline at zero so lines and bars are comparable
    var x = function (i) { return pl + i * (W - pl - pr) / Math.max(1, t.length - 1); };
    var y = function (v) { return H - pb - (v - mn) / (mx - mn) * (H - pt - pb); };
    var g = "";
    for (var gv = mn; gv <= mx; gv += Math.max(1, Math.round((mx - mn) / 4))) {
      g += '<line x1="' + pl + '" y1="' + y(gv) + '" x2="' + (W - pr) + '" y2="' + y(gv) + '" stroke="#E7E1D7"/>' +
      '<text x="' + (pl - 6) + '" y="' + (y(gv) + 4) + '" text-anchor="end" font-size="10.5" fill="#5F5B54" font-family="Archivo">' + gv + '%</text>';
    }
    focus.forEach(function (f, fi) {
      var pts = t.map(function (p, i) { return x(i) + "," + y(p.rates[f] || 0); }).join(" ");
      g += '<polyline points="' + pts + '" fill="none" stroke="' + LINE_COLORS[fi] + '" stroke-width="2.2" stroke-linejoin="round"/>';
      t.forEach(function (p, i) {
        g += '<circle class="tp" data-f="' + f + '" data-d="' + p.date + '" data-v="' + (p.rates[f] || 0) +
          '" cx="' + x(i) + '" cy="' + y(p.rates[f] || 0) + '" r="3.6" fill="' + LINE_COLORS[fi] + '" style="cursor:pointer"/>';
      });
    });
    t.forEach(function (p, i) {
      g += '<text x="' + x(i) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="10.5" fill="#5F5B54" font-family="Archivo">' + p.date.slice(5) + '</text>';
    });
    var svg = EL("sv-trend"); svg.innerHTML = g;
    EL("lg-trend").innerHTML = focus.map(function (f, i) {
      return '<span><b style="background:' + LINE_COLORS[i] + '"></b>' + esc(f) + '</span>';
    }).join("");
    var tip = EL("tt-trend");
    svg.querySelectorAll(".tp").forEach(function (c) {
      c.addEventListener("mouseenter", function () { tip.style.display = "block"; tip.innerHTML = "<b>" + esc(c.dataset.f) + "</b><br>" + c.dataset.d + " &middot; " + Number(c.dataset.v).toFixed(2) + "% blocked"; });
      c.addEventListener("mousemove", function (e) { var r = svg.getBoundingClientRect(); tip.style.left = (e.clientX - r.left + 12) + "px"; tip.style.top = (e.clientY - r.top - 8) + "px"; });
      c.addEventListener("mouseleave", function () { tip.style.display = "none"; });
    });
  }

  /* ---------- CRAWLERS ---------- */
  function crawlers() {
    var h = "";
    h += '<section class="panel wide"><div class="ix">Policy distribution &middot; all five declared states</div>' +
      '<p class="sub">Every state shown separately. <b>No explicit instruction</b> and <b>no robots.txt</b> are <em>not</em> permission &mdash; they mean the crawler was never named.</p>' +
      '<div class="stack">' + D.crawlers.map(function (x) {
        var tot = x.blocked + x.partial + x.allowed + x.unlisted + x.no_robots;
        var seg = ["blocked","partial","allowed","unlisted","no_robots"].map(function (s) {
          var w = tot ? x[s] / tot * 100 : 0;
          return w > 0 ? '<span title="' + STATE_LABELS[s] + ': ' + fmt(x[s]) + '" style="width:' + w.toFixed(2) + '%;background:' + STATE_COLORS[s] + '"></span>' : "";
        }).join("");
        return '<div class="strow clickable" data-crawler="' + esc(x.name) + '"><span class="nm">' + esc(x.name) + '</span><span class="stbar">' + seg + '</span></div>';
      }).join("") + '</div>' +
      '<div class="legend">' + Object.keys(STATE_LABELS).map(function (s) {
        return '<span><b style="background:' + STATE_COLORS[s] + '"></b>' + STATE_LABELS[s] + '</span>';
      }).join("") + '</div></section>';

    h += '<section class="panel wide"><div class="ix">Explicit-policy rate</div>' +
      '<p class="sub">Share of parsed domains that made <em>any</em> crawler-specific decision (blocked, partial, or explicitly allowed) &mdash; the emergence of an AI-policy layer.</p>' +
      '<div class="lb">' + D.crawlers.slice().sort(function (a, b) { return b.explicit_policy_pct - a.explicit_policy_pct; }).map(function (x) {
        var mxv = Math.max.apply(null, D.crawlers.map(function (z) { return z.explicit_policy_pct; })) || 1;
        return '<div class="lbrow clickable" data-crawler="' + esc(x.name) + '"><span class="nm">' + esc(x.name) + '</span><span class="bar"><span style="width:' +
          (x.explicit_policy_pct / mxv * 100).toFixed(1) + '%;background:#1D4E6F"></span></span><span class="v">' +
          x.explicit_policy_pct.toFixed(2) + '%</span><span class="d"></span></div>';
      }).join("") + '</div></section>';

    h += '<section class="panel wide"><div class="ix">Selective exclusion matrix</div>' +
      '<p class="sub">Share of indexed domains where the <b>row</b> crawler is explicitly blocked while the <b>column</b> crawler is explicitly allowed. Who gets singled out.</p>' +
      matrixTable(D.exclusion_matrix, D.matrix_crawlers, function (v) { return v == null ? "—" : v.toFixed(2) + "%"; }, "#A33A2A") +
      '</section>';

    h += '<section class="panel wide"><div class="ix">Co-treatment similarity</div>' +
      '<p class="sub">Among domains with an explicit policy for <em>both</em>, the share where the two crawlers receive the <b>same</b> status. High values mean the web treats them as interchangeable.</p>' +
      matrixTable(D.cotreat_matrix, D.matrix_crawlers, function (v) { return v == null ? "—" : v.toFixed(0) + "%"; }, "#1C5D4A") +
      '<p class="foot">Unlisted and no-robots cells are excluded from this calculation, so it reflects deliberate decisions only. Click any crawler name or cell for detail.</p></section>';

    EL("content").innerHTML = h;
    wireDrill();
  }

  function matrixTable(m, names, fmtv, hue) {
    var mx = 0;
    m.forEach(function (r) { r.forEach(function (v) { if (v != null && v > mx) mx = v; }); });
    var h = '<div class="mwrap"><table class="mx"><thead><tr><th></th>' +
      names.map(function (n) { return '<th><span>' + esc(n) + '</span></th>'; }).join("") + '</tr></thead><tbody>';
    m.forEach(function (row, i) {
      h += '<tr><th class="rh">' + esc(names[i]) + '</th>' + row.map(function (v, j) {
        if (i === j) return '<td class="diag"></td>';
        var a = (v == null || !mx) ? 0 : Math.min(1, v / mx);
        return '<td data-a="' + esc(names[i]) + '" data-b="' + esc(names[j]) + '" style="cursor:pointer;background:' + hue + Math.round(a * 200 + 10).toString(16).padStart(2, "0") + '" title="' +
          esc(names[i]) + ' vs ' + esc(names[j]) + ' — click for ' + esc(names[i]) + ' detail">' + fmtv(v) + '</td>';
      }).join("") + '</tr>';
    });
    return h + '</tbody></table></div>';
  }



  /* ---------- gated per-domain loader ---------- */
  var PD = null, PD_STATE = "idle";
  function loadDomains(cb) {
    if (PD) return cb(PD);
    if (PD_STATE === "loading") return;
    PD_STATE = "loading";
    var go = function (token) {
      fetch("/api/domains", { headers: token ? { Authorization: "Bearer " + token } : {} })
        .then(function (r) {
          if (r.status === 401) throw new Error("Your session expired — reload the page to sign in again.");
          if (!r.ok) throw new Error("Dataset unavailable (" + r.status + ").");
          return r.json();
        })
        .then(function (j) { PD = j; PD_STATE = "ready"; cb(j); })
        .catch(function (e) { PD_STATE = "error"; var el = EL("pd-status"); if (el) el.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
    };
    if (window.Clerk && window.Clerk.session) window.Clerk.session.getToken().then(go).catch(function () { go(null); });
    else go(null);
  }
  var STCODE = { b:"blocked", p:"partial", a:"allowed", u:"unlisted", n:"no_robots" };
  function stPill(code) {
    var lab = STATE_LABELS[STCODE[code]] || code;
    return '<span class="pill" style="background:' + (STATE_COLORS[STCODE[code]] || "#ccc") + '" title="' + lab + '">' + code + '</span>';
  }

  /* ---------- CHANGES ---------- */
  function changes() {
    var h = '<section class="panel wide"><div class="ix">Policy changes &middot; edition over edition</div>';
    if (!D.changes.available) {
      h += '<p class="sub">' + esc(D.changes.note) + ' Each weekly edition is archived per domain, so the first diff appears once two editions exist.</p>' +
        '<div class="empty">No comparison available yet. Editions retained: ' + ((D.editions || []).length || 1) + '.</div></section>';
      EL("content").innerHTML = h; return;
    }
    h += '<p class="sub">Every domain&times;crawler status change between <b>' + esc(D.changes.interval) + '</b>. ' +
      'Domains entering or leaving the index frame are excluded (' + fmt(D.changes.frame_churn.entered) + ' in, ' +
      fmt(D.changes.frame_churn.left) + ' out) so frame churn is never counted as a policy change.</p>' +
      '<div class="dd-kpis">' + kpi(fmt(D.changes.total_changes), "policy changes (domain\u00d7crawler)") +
      kpi(fmt(D.changes.changed_domains != null ? D.changes.changed_domains : "—"), "distinct domains changed") +
      kpi(String(Object.keys(D.changes.transitions).length), "transition types") +
      kpi(esc(D.changes.interval.split(" -> ")[1]), "current edition") + '</div>' +
      (D.changes.availability ? '<p class="foot" style="margin-top:14px">Excluded as measurement noise: ' +
        fmt(D.changes.availability.cells) + ' cells across ' + fmt(D.changes.availability.domains) +
        ' domains moved to or from &ldquo;no robots.txt&rdquo;. ' + esc(D.changes.availability.note) + '</p>' : '');
    // transition matrix
    var tr = D.changes.transitions, keys = Object.keys(tr).sort(function (a, b) { return tr[b] - tr[a]; });
    var tmax = keys.length ? tr[keys[0]] : 1;
    h += '<div class="dd-card" style="margin-top:16px"><div class="dd-h">Transitions, most common first</div>' +
      keys.map(function (k) {
        var parts = k.split("->");
        return '<div class="hrow"><span class="hk" style="width:auto;white-space:nowrap">' +
          (STATE_LABELS[parts[0]] || parts[0]) + ' &rarr; ' + (STATE_LABELS[parts[1]] || parts[1]) + '</span>' +
          '<span class="hb"><span style="width:' + (tr[k] / tmax * 100).toFixed(1) + '%;background:' +
          (parts[1] === "blocked" ? "#A33A2A" : parts[1] === "allowed" ? "#1C5D4A" : "#8A6A1F") + '"></span></span>' +
          '<span class="hv">' + fmt(tr[k]) + '</span></div>';
      }).join("") + '</div>';
    h += '<div id="pd-status" style="margin-top:16px"><div class="empty">Loading the full change list…</div></div>' +
      '<div id="chg-table"></div></section>';
    EL("content").innerHTML = h;
    loadDomains(function (pd) {
      var items = pd.changes || [];
      EL("pd-status").innerHTML = "";
      if (!items.length) { EL("chg-table").innerHTML = '<div class="empty">No per-domain changes in this interval.</div>'; return; }
      var rows = items.slice(0, 400).map(function (c) {
        return '<tr><td class="mono">' + fmt(c[0]) + '</td><td><b>' + esc(c[1]) + '</b></td><td>' + esc(pd.crawlers[c[2]]) + '</td>' +
          '<td>' + stPill(c[3]) + ' &rarr; ' + stPill(c[4]) + '</td><td>' +
          (c[4] === "b" ? '<span style="color:#A33A2A">more restrictive</span>' :
           c[3] === "b" ? '<span style="color:#1C5D4A">less restrictive</span>' : '<span style="color:var(--dim)">reclassified</span>') +
          '</td></tr>';
      }).join("");
      var legend = '<div class="legend" style="margin:10px 0 4px">' + Object.keys(STCODE).map(function (k) {
        return '<span><b style="background:' + STATE_COLORS[STCODE[k]] + '"></b>' + k + ' = ' + STATE_LABELS[STCODE[k]] + '</span>';
      }).join("") + '</div>';
      EL("chg-table").innerHTML = legend + '<div class="dd-h" style="margin-top:16px">Change feed &middot; showing ' +
        Math.min(400, items.length) + ' of ' + fmt(items.length) + ', lowest rank first</div>' +
        '<div class="mwrap"><table class="dt"><thead><tr><th>Rank</th><th>Domain</th><th>Crawler</th><th>Change</th><th>Direction</th></tr></thead><tbody>' +
        rows + '</tbody></table></div>';
    });
  }

  /* ---------- DOMAINS ---------- */
  function domains() {
    var h = '<section class="panel wide"><div class="ix">Domain explorer</div>' +
      '<p class="sub">Search any domain for its declared policy across all ' + D.panel.crawlers + ' crawlers, or filter the index by status. ' +
      'Per-domain data is licensed to your account.</p>' +
      '<div class="ctrls">' +
        '<input id="q" class="inp" placeholder="Search a domain, e.g. wikipedia.org" autocomplete="off">' +
        '<select id="f-crawler" class="inp"><option value="">Any crawler…</option></select>' +
        '<select id="f-status" class="inp">' +
          '<option value="">Any status</option><option value="b">Explicitly blocked</option><option value="p">Partial</option>' +
          '<option value="a">Explicitly allowed</option><option value="u">No explicit instruction</option><option value="n">No robots.txt</option>' +
        '</select>' +
        '<button id="btn-csv" class="btnx">Export CSV</button>' +
      '</div>' +
      '<div id="pd-status"><div class="empty">Loading the per-domain index…</div></div>' +
      '<div id="dom-out"></div></section>';
    EL("content").innerHTML = h;
    loadDomains(function (pd) {
      EL("pd-status").innerHTML = "";
      var sel = EL("f-crawler");
      pd.crawlers.forEach(function (c, i) { var o = document.createElement("option"); o.value = String(i); o.textContent = c; sel.appendChild(o); });
      var render = function () {
        var q = EL("q").value.trim().toLowerCase();
        var ci = EL("f-crawler").value, st = EL("f-status").value;
        var out = [];
        for (var i = 0; i < pd.rows.length && out.length < 300; i++) {
          var r = pd.rows[i];
          if (q && r[1].toLowerCase().indexOf(q) < 0) continue;
          if (st) {
            if (ci !== "") { if (r[2][+ci] !== st) continue; }
            else if (r[2].indexOf(st) < 0) continue;
          } else if (ci !== "" && !q) { /* crawler alone: no filter */ }
          out.push(r);
        }
        var head = '<tr><th>Rank</th><th>Domain</th>' + pd.crawlers.map(function (c) {
          return '<th class="rot"><span>' + esc(c) + '</span></th>'; }).join("") + '</tr>';
        EL("dom-out").innerHTML = '<div class="dd-h" style="margin-top:14px">' + (out.length >= 300 ? "First 300 matches" : fmt(out.length) + " match" + (out.length === 1 ? "" : "es")) + '</div>' +
          (out.length ? '<div class="mwrap"><table class="dt"><thead>' + head + '</thead><tbody>' +
            out.map(function (r) {
              return '<tr><td class="mono">' + fmt(r[0]) + '</td><td><b>' + esc(r[1]) + '</b></td>' +
                r[2].split("").map(function (c) { return '<td class="pc">' + stPill(c) + '</td>'; }).join("") + '</tr>';
            }).join("") + '</tbody></table></div>' +
            '<div class="legend">' + Object.keys(STCODE).map(function (k) {
              return '<span><b style="background:' + STATE_COLORS[STCODE[k]] + '"></b>' + k + " = " + STATE_LABELS[STCODE[k]] + '</span>'; }).join("") + '</div>'
          : '<div class="empty">No domains match those filters.</div>');
        window.__CPI_LAST__ = out;
      };
      EL("q").addEventListener("input", render);
      EL("f-crawler").addEventListener("change", render);
      EL("f-status").addEventListener("change", render);
      EL("btn-csv").addEventListener("click", function () {
        var rows = window.__CPI_LAST__ || [];
        if (!rows.length) return;
        var csv = "rank,domain," + pd.crawlers.join(",") + "\n" + rows.map(function (r) {
          return r[0] + "," + r[1] + "," + r[2].split("").map(function (c) { return STCODE[c]; }).join(",");
        }).join("\n");
        var a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        a.download = "cpi-domains-" + pd.edition + ".csv"; a.click();
      });
      render();
    });
  }


  /* ---------- SEGMENTS ---------- */
  function segments() {
    var sel = window.__CPI_SEG_CRAWLER__ || D.crawlers[0].name;
    var h = '<section class="panel wide"><div class="ix">Segments</div>' +
      '<p class="sub">How declared blocking varies by position in the index frame and by top-level domain. Pick a crawler:</p>' +
      '<div class="ctrls"><select id="seg-crawler" class="inp">' +
      D.crawlers.map(function (c) { return '<option' + (c.name === sel ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join("") +
      '</select></div></section>';

    // rank bands
    var bands = D.rank_bands.map(function (b) { return { band: b.band, n: b.n, v: b.blocked_pct[sel] }; }).filter(function (b) { return b.v != null; });
    var bmax = Math.max.apply(null, bands.map(function (b) { return b.v; })) || 1;
    h += '<section class="panel wide"><div class="ix">By panel rank band &middot; ' + esc(sel) + '</div>' +
      '<p class="sub">Is restriction concentrated among the highest-ranked domains, or spread through the tail?</p>' +
      '<div class="dd-card">' + bands.map(function (b) {
        return '<div class="hrow"><span class="hk">' + b.band + '</span><span class="hb"><span style="width:' +
          (b.v / bmax * 100).toFixed(1) + '%"></span></span><span class="hv">' + b.v.toFixed(1) + '% <span style="opacity:.6">n=' + fmt(b.n) + '</span></span></div>';
      }).join("") + '</div>' +
      '<p class="foot">Rank band is position in the index frame &mdash; a sampling attribute, not traffic, audience size, or commercial importance.</p></section>';

    // ccTLD
    var rows = (D.tld.rows || []).map(function (t) { return { tld: t.tld, n: t.n, v: t.blocked_pct[sel], any: t.any_blocked_pct }; })
      .filter(function (t) { return t.v != null; }).sort(function (a, b) { return b.v - a.v; });
    var tmax = rows.length ? rows[0].v : 1;
    h += '<section class="panel wide"><div class="ix">By top-level domain &middot; ' + esc(sel) + '</div>' +
      '<p class="sub">Minimum ' + D.tld.min_n + ' domains per group. Counts shown so small groups cannot masquerade as strong signals.</p>' +
      '<div class="dd-card" style="max-height:520px;overflow:auto">' + rows.map(function (t) {
        return '<div class="hrow"><span class="hk">' + esc(t.tld) + '</span><span class="hb"><span style="width:' +
          (t.v / tmax * 100).toFixed(1) + '%"></span></span><span class="hv">' + t.v.toFixed(1) + '% <span style="opacity:.6">n=' + fmt(t.n) + '</span></span></div>';
      }).join("") + '</div>' +
      '<p class="foot">' + esc(D.tld.note) + ' A .de domain is not necessarily a German company, and generic suffixes (.com, .org, .io) carry no geographic meaning at all.</p></section>';

    EL("content").innerHTML = h;
    EL("seg-crawler").addEventListener("change", function () { window.__CPI_SEG_CRAWLER__ = this.value; segments(); });
  }

  /* ---------- WIRE EVIDENCE ---------- */
  function wire() {
    var w = D.wire || {};
    var groups = [
      { key: "prices", label: "Posted per-crawl prices", desc: "A machine-readable price named in the response to an identified AI crawler." },
      { key: "p402", label: "HTTP 402 responses", desc: "Payment Required returned to a named crawler on probe." },
      { key: "tollbit", label: "Token walls", desc: "A third-party token/paywall intermediary answered instead of the content." },
      { key: "payment_headers", label: "Payment-related headers", desc: "Headers declaring price, free access, or payment support." },
      { key: "maxprice_flips", label: "Max-price behaviour", desc: "Response changed when a maximum-price signal was supplied." }
    ];
    var total = groups.reduce(function (a, g) { return a + ((w[g.key] || []).length); }, 0);
    var h = '<section class="panel wide"><div class="ix">Observed wire evidence</div>' +
      '<p class="sub">What actually happened on the wire when an identified AI crawler knocked. This is a <b>curated probe sample</b>, not a census: ' +
      'it answers &ldquo;does this behaviour exist, and where&rdquo;, never &ldquo;what share of the web does this&rdquo;.</p>' +
      '<div class="dd-kpis">' + kpi(fmt(total), "observations recorded") +
      kpi(fmt((w.prices || []).length), "posted prices") +
      kpi(fmt((w.p402 || []).length), "402 responses") +
      kpi(fmt((w.tollbit || []).length + (w.payment_headers || []).length), "wall / header signals") + '</div>' +
      '<p class="foot">No percentage of the web is computed from these figures, and none should be. Robots-policy rates elsewhere in this dashboard come from the full index frame; these are hand-probed exhibits.</p></section>';

    groups.forEach(function (g) {
      var list = w[g.key] || [];
      h += '<section class="panel"><div class="ix">' + g.label + ' &middot; ' + list.length + '</div>' +
        '<p class="sub">' + g.desc + '</p>' +
        (list.length
          ? '<div class="mwrap" style="max-height:320px"><table class="dt"><tbody>' + list.map(function (x) {
              return '<tr><td><b>' + esc(String(x)) + '</b></td></tr>'; }).join("") + '</tbody></table></div>'
          : '<div class="empty">None observed in the current probe sample.</div>') +
        '</section>';
    });
    EL("content").innerHTML = h;
  }

  /* ---------- ACCOUNT & DATA ---------- */
  function account() {
    var u = (window.Clerk && window.Clerk.user) || null;
    var email = u && u.primaryEmailAddress ? u.primaryEmailAddress.emailAddress : "—";
    var h = '<section class="panel"><div class="ix">Account</div>' +
      '<div class="hrow" style="grid-template-columns:120px 1fr"><span class="hk">Email</span><span><b>' + esc(email) + '</b></span></div>' +
      '<div class="hrow" style="grid-template-columns:120px 1fr"><span class="hk">Edition</span><span>' + esc(D.edition) + '</span></div>' +
      '<div class="hrow" style="grid-template-columns:120px 1fr"><span class="hk">Access</span><span>Full dashboard &amp; per-domain data</span></div>' +
      '<p class="foot">Profile, password and sign-out are managed from the avatar menu at the top right.</p></section>';

    h += '<section class="panel"><div class="ix">Subscription</div>' +
      '<p class="sub">Billing is handled by Stripe. Plan changes, payment method and invoices will open in Stripe&rsquo;s secure portal.</p>' +
      '<div class="empty">Billing portal connects in the next build step. Your access is unaffected.</div></section>';

    h += '<section class="panel wide"><div class="ix">Data downloads</div>' +
      '<p class="sub">Your licensed extracts of the current edition. Per-domain data is licensed to your account and not for redistribution.</p>' +
      '<div class="ctrls">' +
        '<button class="btnx" id="dl-json">Per-domain JSON (current edition)</button>' +
        '<button class="btnx" id="dl-csv">Per-domain CSV (current edition)</button>' +
        '<button class="btnx" id="dl-agg" style="background:#1D4E6F;border-color:#1D4E6F">Aggregate dashboard JSON</button>' +
      '</div><div id="pd-status"></div>' +
      '<p class="foot">Downloads reflect edition ' + esc(D.edition) + '. Figures are free to cite with attribution to The Crawl Price Index; the per-domain dataset is not.</p></section>';
    EL("content").innerHTML = h;

    var save = function (name, text, type) {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type: type }));
      a.download = name; a.click();
    };
    EL("dl-agg").addEventListener("click", function () { save("cpi-dashboard-" + D.edition + ".json", JSON.stringify(D, null, 2), "application/json"); });
    EL("dl-json").addEventListener("click", function () {
      EL("pd-status").innerHTML = '<div class="empty">Preparing…</div>';
      loadDomains(function (pd) { EL("pd-status").innerHTML = ""; save("cpi-domains-" + pd.edition + ".json", JSON.stringify(pd), "application/json"); });
    });
    EL("dl-csv").addEventListener("click", function () {
      EL("pd-status").innerHTML = '<div class="empty">Preparing…</div>';
      loadDomains(function (pd) {
        EL("pd-status").innerHTML = "";
        var csv = "rank,domain," + pd.crawlers.join(",") + "\n" + pd.rows.map(function (r) {
          return r[0] + "," + r[1] + "," + r[2].split("").map(function (c) { return STCODE[c]; }).join(",");
        }).join("\n");
        save("cpi-domains-" + pd.edition + ".csv", csv, "text/csv");
      });
    });
  }


  /* ---------- DRILL-DOWN: topic panels ---------- */
  function drillOpen(html) {
    var box = EL("drill"); box.innerHTML = html; box.style.display = "block";
    var c = EL("dd-close"); if (c) c.addEventListener("click", function () { box.style.display = "none"; });
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function ddHead(eyebrow, title) {
    return '<div class="dd-head"><div><div class="dd-eyebrow">' + esc(eyebrow) + '</div><div class="dd-title">' + esc(title) +
      '</div></div><button class="dd-close" id="dd-close">Close &times;</button></div>';
  }
  function drillTrend() {
    if (!D.trend || D.trend.length < 2) return;
    var first = D.trend[0], last = D.trend[D.trend.length - 1];
    var names = Object.keys(last.rates).filter(function (k) { return first.rates[k] != null; });
    var movers = names.map(function (n) { return { name: n, from: first.rates[n], to: last.rates[n], d: last.rates[n] - first.rates[n] }; })
      .sort(function (a, b) { return b.d - a.d; });
    var mx = Math.max.apply(null, movers.map(function (m) { return Math.abs(m.d); })) || 1;
    var h = ddHead("Trend detail", "Movement since " + first.date) +
      '<div class="dd-kpis">' + kpi(String(D.trend.length), "editions recorded") +
      kpi(first.date, "first edition") + kpi(last.date, "latest edition") +
      kpi(movers[0].name, "largest increase") + '</div>' +
      '<div class="dd-card"><div class="dd-h">Change in block rate, first to latest edition</div>' +
      movers.map(function (m) {
        var pos = m.d >= 0;
        return '<div class="hrow"><span class="hk">' + esc(m.name) + '</span><span class="hb"><span style="width:' +
          (Math.abs(m.d) / mx * 100).toFixed(1) + '%;background:' + (pos ? "#A33A2A" : "#1C5D4A") + '"></span></span>' +
          '<span class="hv">' + (pos ? "+" : "") + m.d.toFixed(2) + 'pp</span></div>';
      }).join("") +
      '<p class="foot">' + D.trend.length + ' editions is an early series. Direction is meaningful; magnitude is not yet stable, and coverage varies slightly between scans.</p></div>';
    drillOpen(h);
  }
  function drillSelective() {
    var r = D.restriction_hist, dv = D.diversity_hist;
    var h = ddHead("Selective treatment", "How differentiated are policies?") +
      '<div class="dd-kpis">' + kpi(pct(D.selective.pct), "treat crawlers differently") +
      kpi(fmt(D.selective.count), "domains") +
      kpi(fmt(r["0"]), "block none of the 18") +
      kpi(fmt(r["18"]), "block all 18") + '</div>' +
      '<div class="dd-grid">' +
        '<div class="dd-card"><div class="dd-h">Crawlers blocked per domain</div>' + histBars(r, "domains") + '</div>' +
        '<div class="dd-card"><div class="dd-h">Distinct statuses used per domain</div>' + histBars(dv, "domains") +
        '<p class="foot">A domain using one status treats all 18 crawlers identically; more statuses means a more differentiated policy.</p></div>' +
      '</div>' +
      '<div class="dd-card" style="margin-top:14px"><p class="sub" style="margin:0">Definition: ' + esc(D.selective.definition) +
      '. Domains that simply never mention any crawler are not &ldquo;selective&rdquo; &mdash; they have made no declaration at all.</p></div>';
    drillOpen(h);
  }
  function drillChanges() {
    if (!D.changes.available) return;
    var c = D.changes, tr = c.transitions, keys = Object.keys(tr).sort(function (a, b) { return tr[b] - tr[a]; });
    var restrictive = 0, permissive = 0;
    keys.forEach(function (k) { var to = k.split("->")[1]; if (to === "blocked") restrictive += tr[k]; if (to === "allowed") permissive += tr[k]; });
    var h = ddHead("Policy changes", c.interval) +
      '<div class="dd-kpis">' + kpi(fmt(c.total_changes), "policy changes") +
      kpi(fmt(c.changed_domains != null ? c.changed_domains : "—"), "distinct domains") +
      kpi(fmt(restrictive), "became more restrictive") +
      kpi(fmt(permissive), "became explicitly allowed") + '</div>' +
      '<div class="dd-card"><div class="dd-h">What moved</div>' +
      keys.map(function (k) {
        var p = k.split("->"), mx = tr[keys[0]];
        return '<div class="hrow"><span class="hk">' + (STATE_LABELS[p[0]] || p[0]) + ' &rarr; ' + (STATE_LABELS[p[1]] || p[1]) + '</span>' +
          '<span class="hb"><span style="width:' + (tr[k] / mx * 100).toFixed(1) + '%;background:' +
          (p[1] === "blocked" ? "#A33A2A" : p[1] === "allowed" ? "#1C5D4A" : "#8A6A1F") + '"></span></span><span class="hv">' + fmt(tr[k]) + '</span></div>';
      }).join("") +
      (c.availability ? '<p class="foot">' + fmt(c.availability.cells) + ' further cells across ' + fmt(c.availability.domains) +
        ' domains moved to or from &ldquo;no robots.txt&rdquo; and are excluded: that is fetch availability between scans, not a publisher decision.</p>' : '') +
      '</div>' +
      '<p class="foot">Open the Changes tab for the full per-domain feed.</p>';
    drillOpen(h);
  }
  function drillWire() {
    var w = D.wire || {};
    var h = ddHead("Observed wire evidence", "Probe exhibits") +
      '<div class="dd-card"><div class="dd-h">What was observed</div>' +
      [["Posted prices","prices"],["HTTP 402","p402"],["Token walls","tollbit"],["Payment headers","payment_headers"],["Max-price behaviour","maxprice_flips"]]
        .map(function (g) {
          var l = w[g[1]] || [];
          return '<div class="hrow"><span class="hk">' + g[0] + '</span><span class="hb"><span style="width:' +
            Math.min(100, l.length * 3) + '%;background:#8A6A1F"></span></span><span class="hv">' + l.length + '</span></div>';
        }).join("") +
      '<p class="foot">Curated probe sample &mdash; evidence that a behaviour exists and where, never a share of the web. Full list on the Wire evidence tab.</p></div>';
    drillOpen(h);
  }

  /* ---------- DRILL-DOWN: crawler detail ---------- */
  function crawlerDetail(name) {
    var x = null; D.crawlers.forEach(function (c) { if (c.name === name) x = c; });
    if (!x) return;
    var i = D.matrix_crawlers.indexOf(name);
    var tot = x.blocked + x.partial + x.allowed + x.unlisted + x.no_robots;

    // rank bands for this crawler
    var bands = D.rank_bands.map(function (b) { return { band: b.band, n: b.n, v: b.blocked_pct[name] }; })
      .filter(function (b) { return b.v != null; });
    var bmax = Math.max.apply(null, bands.map(function (b) { return b.v; })) || 1;

    // top ccTLDs for this crawler
    var tlds = (D.tld.rows || []).map(function (t) { return { tld: t.tld, n: t.n, v: t.blocked_pct[name] }; })
      .filter(function (t) { return t.v != null; }).sort(function (a, b) { return b.v - a.v; });
    var topT = tlds.slice(0, 6), tmax = topT.length ? topT[0].v : 1;

    // most/least similarly treated peers
    var peers = [];
    if (i >= 0 && D.cotreat_matrix[i]) {
      D.cotreat_matrix[i].forEach(function (v, j) {
        if (j !== i && v != null) peers.push({ name: D.matrix_crawlers[j], v: v });
      });
      peers.sort(function (a, b) { return b.v - a.v; });
    }
    // who is excluded in favour of whom
    var exclOut = [], exclIn = [];
    if (i >= 0) {
      D.exclusion_matrix[i].forEach(function (v, j) { if (j !== i && v > 0) exclOut.push({ name: D.matrix_crawlers[j], v: v }); });
      D.exclusion_matrix.forEach(function (row, j) { if (j !== i && row[i] > 0) exclIn.push({ name: D.matrix_crawlers[j], v: row[i] }); });
      exclOut.sort(function (a, b) { return b.v - a.v; }); exclIn.sort(function (a, b) { return b.v - a.v; });
    }

    var h = '<div class="dd-head"><div><div class="dd-eyebrow">Crawler detail</div><div class="dd-title">' + esc(name) + '</div></div>' +
      '<button class="dd-close" id="dd-close">Close &times;</button></div>' +
      '<div class="dd-kpis">' +
        kpi(x.blocked_pct.toFixed(2) + "%", "explicitly blocked") +
        kpi(x.allowed_pct.toFixed(2) + "%", "explicitly allowed") +
        kpi(x.explicit_policy_pct.toFixed(2) + "%", "any explicit policy") +
        kpi(x.delta_pp == null ? "—" : (x.delta_pp > 0 ? "+" : "") + x.delta_pp.toFixed(2) + "pp", "change vs previous edition") +
      '</div>';

    h += '<div class="dd-grid">';
    // states
    h += '<div class="dd-card"><div class="dd-h">Declared states</div>' +
      ["blocked","partial","allowed","unlisted","no_robots"].map(function (st) {
        return '<div class="hrow"><span class="hk" style="width:auto;white-space:nowrap">' + STATE_LABELS[st] + '</span>' +
          '<span class="hb"><span style="width:' + (tot ? x[st] / tot * 100 : 0).toFixed(1) + '%;background:' + STATE_COLORS[st] + '"></span></span>' +
          '<span class="hv">' + fmt(x[st]) + '</span></div>';
      }).join("") + '</div>';
    // rank bands
    h += '<div class="dd-card"><div class="dd-h">By panel rank band</div>' +
      bands.map(function (b) {
        return '<div class="hrow"><span class="hk" style="width:auto;white-space:nowrap">' + b.band + '</span>' +
          '<span class="hb"><span style="width:' + (b.v / bmax * 100).toFixed(1) + '%"></span></span>' +
          '<span class="hv">' + b.v.toFixed(1) + '%</span></div>';
      }).join("") + '<p class="foot">Rank band is position in the index frame &mdash; not traffic or site size. n per band: ' +
      bands.map(function (b) { return b.n; }).join(" / ") + '</p></div>';
    // ccTLD
    h += '<div class="dd-card"><div class="dd-h">Highest-blocking ccTLD groups</div>' +
      topT.map(function (t) {
        return '<div class="hrow"><span class="hk" style="width:auto">' + esc(t.tld) + '</span>' +
          '<span class="hb"><span style="width:' + (t.v / tmax * 100).toFixed(1) + '%"></span></span>' +
          '<span class="hv">' + t.v.toFixed(1) + '% <span style="opacity:.6">n=' + t.n + '</span></span></div>';
      }).join("") + '<p class="foot">ccTLD is a domain-suffix classification &mdash; not operator location, ownership, or audience. Minimum n=' + D.tld.min_n + '.</p></div>';
    // peers + exclusion
    h += '<div class="dd-card"><div class="dd-h">Treated most alike</div>' +
      peers.slice(0, 4).map(function (p) {
        return '<div class="hrow"><span class="hk" style="width:auto;white-space:nowrap">' + esc(p.name) + '</span>' +
          '<span class="hb"><span style="width:' + p.v.toFixed(0) + '%"></span></span><span class="hv">' + p.v.toFixed(0) + '%</span></div>';
      }).join("") +
      (peers.length ? '<div class="dd-h" style="margin-top:14px">Treated least alike</div>' +
        peers.slice(-3).reverse().map(function (p) {
          return '<div class="hrow"><span class="hk" style="width:auto;white-space:nowrap">' + esc(p.name) + '</span>' +
            '<span class="hb"><span style="width:' + p.v.toFixed(0) + '%;background:#A33A2A"></span></span><span class="hv">' + p.v.toFixed(0) + '%</span></div>';
        }).join("") : "") +
      '<p class="foot">Share of domains with an explicit policy for both that give them the same status.</p></div>';
    h += '</div>';

    if (exclOut.length || exclIn.length) {
      h += '<div class="dd-card" style="margin-top:14px"><div class="dd-h">Selective exclusion</div>' +
        (exclOut.length ? '<p class="sub" style="margin:6px 0">' + esc(name) + ' is blocked while another is explicitly allowed &mdash; most often against <b>' +
          esc(exclOut[0].name) + '</b> (' + exclOut[0].v.toFixed(2) + '% of indexed domains).</p>' : '') +
        (exclIn.length ? '<p class="sub" style="margin:6px 0">Conversely, <b>' + esc(exclIn[0].name) + '</b> is blocked while ' + esc(name) +
          ' is allowed on ' + exclIn[0].v.toFixed(2) + '% of indexed domains.</p>' : '') +
        '</div>';
    }

    var box = EL("drill");
    box.innerHTML = h; box.style.display = "block";
    EL("dd-close").addEventListener("click", function () { box.style.display = "none"; });
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function wireDrill() {
    document.querySelectorAll(".lbrow.clickable").forEach(function (r) {
      r.addEventListener("click", function () { crawlerDetail(r.dataset.crawler); });
    });
    var DRILLS = { trend: drillTrend, selective: drillSelective, changes: drillChanges, wire: drillWire };
    document.querySelectorAll(".panel.pclick").forEach(function (p) {
      p.addEventListener("click", function (e) {
        if (e.target.closest("a,button,input,select,.tp,.ppt")) return;
        var f = DRILLS[p.dataset.drill]; if (f) f();
      });
    });
    document.querySelectorAll(".strow[data-crawler]").forEach(function (r) {
      r.addEventListener("click", function () { crawlerDetail(r.dataset.crawler); });
    });
    document.querySelectorAll("table.mx td[data-a]").forEach(function (td) {
      td.addEventListener("click", function () { crawlerDetail(td.dataset.a); });
    });
  }

  /* ---------- router ---------- */
  var TABS = {
    overview: { title: "Overview", render: overview },
    crawlers: { title: "Crawlers", render: crawlers },
    changes:  { title: "Changes",  render: changes },
    domains:  { title: "Domains",  render: domains },
    segments: { title: "Segments", render: segments },
    wire:     { title: "Wire evidence", render: wire },
    account:  { title: "Account & data", render: account }
  };
  function route(tab) {
    var t = TABS[tab];
    EL("page-title").textContent = t ? t.title : (tab.charAt(0).toUpperCase() + tab.slice(1));
    if (t) { t.render(); }
    else {
      EL("content").innerHTML = '<section class="panel wide"><div class="ix">In build</div>' +
        '<div class="empty">This view is being built this week. Overview and Crawlers are live now.</div></section>';
    }
  }
  window.CPI_BOOT = function () {
    fetch("/data/dashboard.json", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
      D = j; window.CPI_D = j;
      EL("ed").textContent = j.edition + " · generated " + (j.generated_utc || "").slice(0, 10);
      var hash = (location.hash || "#overview").slice(1);
      route(hash);
      document.querySelectorAll("nav.tabs a").forEach(function (a) {
        a.addEventListener("click", function () {
          document.querySelectorAll("nav.tabs a").forEach(function (x) { x.classList.remove("on"); });
          a.classList.add("on"); route(a.dataset.tab);
        });
      });
    }).catch(function (e) {
      EL("content").innerHTML = '<section class="panel wide"><div class="ix">Data unavailable</div>' +
        '<div class="empty">Could not load the edition data. If this persists, the weekly build may not have published yet.</div></section>';
      console.error(e);
    });
  };
})();
