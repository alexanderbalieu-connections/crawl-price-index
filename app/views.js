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
        return '<div class="lbrow"><span class="nm">' + esc(x.name) + '</span>' +
          '<span class="bar"><span style="width:' + w.toFixed(1) + '%"></span></span>' +
          '<span class="v">' + x.blocked_pct.toFixed(2) + '%</span>' +
          '<span class="d">' + delta(x.delta_pp) + '</span></div>';
      }).join("") + '</div>' +
      '<p class="foot">Blocked in robots.txt is a declared policy, not proof a crawler was denied. Denominator: ' +
      fmt(D.panel.robots_parsed) + ' parsed domains of the ' + fmt(D.panel.domains) + '-domain index frame &mdash; not "the web".</p></section>';

    // trend + selective side by side
    h += '<section class="panel"><div class="ix">Trend &middot; block rate by edition</div>' +
      (D.trend && D.trend.length >= 2
        ? '<div style="position:relative"><svg id="sv-trend" viewBox="0 0 620 300" style="width:100%;height:auto"></svg><div id="tt-trend" class="tt"></div></div>' +
          '<div class="legend" id="lg-trend"></div>' +
          (D.trend.length < 6 ? '<p class="foot">Early series (' + D.trend.length + ' editions). Directional only until the history is longer.</p>' : '')
        : '<div class="empty">The trend chart needs at least two editions. Currently ' + ((D.trend||[]).length) + '.</div>') +
      '</section>';

    h += '<section class="panel"><div class="ix">Selective treatment</div>' +
      '<div class="big">' + pct(D.selective.pct) + '</div>' +
      '<p class="sub">of indexed domains treat at least one crawler differently from another &mdash; ' +
      fmt(D.selective.count) + ' domains.</p>' +
      '<p class="foot">Definition: ' + esc(D.selective.definition) + '</p>' +
      '<div class="hist">' + histBars(D.restriction_hist, "crawlers blocked per domain") + '</div>' +
      '</section>';

    // changes + wire
    h += '<section class="panel"><div class="ix">Policy changes</div>' +
      (D.changes.available
        ? '<div class="big">' + fmt(D.changes.total_changes) + '</div><p class="sub">domain&times;crawler status changes in ' + esc(D.changes.interval) + '.</p>' +
          '<p class="foot">Domains entering/leaving the index frame are excluded (' + fmt(D.changes.frame_churn.entered) + ' in, ' + fmt(D.changes.frame_churn.left) + ' out).</p>'
        : '<div class="empty">' + esc(D.changes.note) + '</div>') +
      '</section>';

    h += '<section class="panel"><div class="ix">Observed wire evidence</div>' +
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
    var mx = Math.ceil(Math.max.apply(null, vals) / 5) * 5 || 10, mn = Math.max(0, Math.floor(Math.min.apply(null, vals) / 5) * 5 - 5);
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
        return '<div class="strow"><span class="nm">' + esc(x.name) + '</span><span class="stbar">' + seg + '</span></div>';
      }).join("") + '</div>' +
      '<div class="legend">' + Object.keys(STATE_LABELS).map(function (s) {
        return '<span><b style="background:' + STATE_COLORS[s] + '"></b>' + STATE_LABELS[s] + '</span>';
      }).join("") + '</div></section>';

    h += '<section class="panel wide"><div class="ix">Explicit-policy rate</div>' +
      '<p class="sub">Share of parsed domains that made <em>any</em> crawler-specific decision (blocked, partial, or explicitly allowed) &mdash; the emergence of an AI-policy layer.</p>' +
      '<div class="lb">' + D.crawlers.slice().sort(function (a, b) { return b.explicit_policy_pct - a.explicit_policy_pct; }).map(function (x) {
        var mxv = Math.max.apply(null, D.crawlers.map(function (z) { return z.explicit_policy_pct; })) || 1;
        return '<div class="lbrow"><span class="nm">' + esc(x.name) + '</span><span class="bar"><span style="width:' +
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
      '<p class="foot">Unlisted and no-robots cells are excluded from this calculation, so it reflects deliberate decisions only.</p></section>';

    EL("content").innerHTML = h;
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
        return '<td style="background:' + hue + Math.round(a * 200 + 10).toString(16).padStart(2, "0") + '" title="' +
          esc(names[i]) + ' vs ' + esc(names[j]) + '">' + fmtv(v) + '</td>';
      }).join("") + '</tr>';
    });
    return h + '</tbody></table></div>';
  }

  /* ---------- router ---------- */
  var TABS = {
    overview: { title: "Overview", render: overview },
    crawlers: { title: "Crawlers", render: crawlers }
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
