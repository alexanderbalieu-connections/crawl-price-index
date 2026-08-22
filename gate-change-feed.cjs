#!/usr/bin/env node
/**
 * CPI — the change feed becomes a taste free, the full list paid
 * ===========================================================================
 * Decision: free sees the totals plus the biggest websites that changed; the
 * full list is Terminal. That keeps both promises the site already makes — the
 * weekly email says it names domains that changed, the pricing line on all 17
 * pages says the change feed is part of €49 — without rewording either.
 *
 * The happy discovery while wiring it: the dashboard's Changes tab NEVER read
 * the public copy. It renders its table from loadDomains(), the gated
 * per-domain payload, which already carries the full change list. So all 161
 * rows in the public dashboard.json were downloaded by every visitor and
 * rendered to nobody. Pure leak, zero product value. Trimming costs nothing.
 *
 * Four changes:
 *   1. the builder emits a sample, not the whole feed
 *   2. this edition's already-built dashboard.json is trimmed the same way, so
 *      the leak closes on the next deploy rather than the next scan
 *   3. free accounts get the sample and an upsell where they used to get
 *      "Loading the full change list…" followed by a 402 error
 *   4. the Aggregate JSON download carries exactly what the account can see —
 *      sample for free, full feed for Terminal. Not more, not less, per Alex.
 */
const fs = require("fs");
const SAMPLE_DOMAINS = 5;

/* ============ 1. the builder ============================================= */
const B = "compute-dashboard.cjs";
let b = fs.readFileSync(B, "utf8");
if (b.includes("items_sample")) console.log("builder: already applied");
else {
  fs.copyFileSync(B, B + ".bak-changesample");
  const OLD = `  items.sort((x, y) => x.rank - y.rank);
  changes = {
    available: true, interval: \`\${prevDate} -> \${curDate}\`, items, transitions: trans,`;
  const NEW = `  items.sort((x, y) => x.rank - y.rank);
  // The public dashboard.json ships a SAMPLE only: every row for the
  // ${SAMPLE_DOMAINS} highest-ranked domains that changed. The full feed is in the gated
  // per-domain payload, which is where the dashboard's own table reads it from
  // anyway — the full copy here was downloaded by everyone and rendered to
  // nobody. Keeping the totals intact means every headline figure still works.
  const sampleDomains = [];
  for (const it of items) {
    if (sampleDomains.length >= ${SAMPLE_DOMAINS}) break;
    if (!sampleDomains.includes(it.domain)) sampleDomains.push(it.domain);
  }
  const sampleItems = items.filter(it => sampleDomains.includes(it.domain));
  changes = {
    available: true, interval: \`\${prevDate} -> \${curDate}\`,
    items: sampleItems, items_sample: true,
    items_total: items.length, items_domains_total: changed_domains.size,
    transitions: trans,`;
  if (!b.includes(OLD)) throw new Error("builder changes block not found");
  b = b.split(OLD).join(NEW);
  fs.writeFileSync(B, b);
  require("child_process").execSync("node --check " + B);
  console.log("compute-dashboard.cjs: public change feed is now a " + SAMPLE_DOMAINS + "-domain sample");
}

/* ============ 2. trim this edition's built artifact ====================== */
const D = "app/data/dashboard.json";
const d = JSON.parse(fs.readFileSync(D, "utf8"));
if (d.changes && d.changes.items && !d.changes.items_sample) {
  fs.copyFileSync(D, D + ".bak-changesample");
  const items = d.changes.items.slice().sort((x, y) => x.rank - y.rank);
  const doms = [];
  for (const it of items) {
    if (doms.length >= SAMPLE_DOMAINS) break;
    if (!doms.includes(it.domain)) doms.push(it.domain);
  }
  const before = items.length;
  d.changes.items = items.filter(it => doms.includes(it.domain));
  d.changes.items_sample = true;
  d.changes.items_total = before;
  d.changes.items_domains_total = d.changes.changed_domains;
  fs.writeFileSync(D, JSON.stringify(d));
  console.log("app/data/dashboard.json: " + before + " rows -> " + d.changes.items.length +
              " (" + doms.length + " domains: " + doms.join(", ") + ")");
} else {
  console.log("app/data/dashboard.json: already a sample");
}

/* ============ 3 + 4. the dashboard ======================================= */
const V = "app/views.js";
let v = fs.readFileSync(V, "utf8");
if (v.includes("chg-upsell")) { console.log("views: already applied"); process.exit(0); }
fs.copyFileSync(V, V + ".bak-changesample");
const sub = (from, to, label) => {
  if (!v.includes(from)) throw new Error("views: not found — " + label);
  v = v.split(from).join(to);
};

/* free accounts get the sample instead of a spinner that ends in an error */
sub(
  `    h += '<div id="pd-status" style="margin-top:16px"><div class="empty">Loading the full change list…</div></div>' +
      '<div id="chg-table"></div></section>';
    EL("content").innerHTML = h;
    loadDomains(function (pd) {`,
  `    h += '<div id="pd-status" style="margin-top:16px"><div class="empty">Loading the full change list…</div></div>' +
      '<div id="chg-table"></div></section>';
    EL("content").innerHTML = h;
    // the totals above are free; the full feed is Terminal. Free accounts see
    // the sample the public file ships rather than a spinner that ends in 402.
    loadMe(function (me) {
      if (!me || !me.entitled) { changesSample(); return; }
      changesFull();
    });
  }

  function changesSample() {
    var C = D.changes, s = C.items || [];
    EL("pd-status").innerHTML = "";
    var rows = s.map(function (c) {
      return '<tr><td class="mono">' + fmt(c.rank) + '</td><td><b>' + esc(c.domain) + '</b></td>' +
        '<td>' + esc(c.crawler) + '</td><td>' + stPill(c.prev.charAt(0)) + ' &rarr; ' + stPill(c.cur.charAt(0)) + '</td></tr>';
    }).join("");
    var shownDomains = {};
    s.forEach(function (c) { shownDomains[c.domain] = 1; });
    var nShown = Object.keys(shownDomains).length;
    var nTotal = C.items_domains_total != null ? C.items_domains_total : C.changed_domains;
    EL("chg-table").innerHTML =
      '<div class="dd-h" style="margin-top:12px">Change feed &middot; the ' + nShown + ' highest-ranked domains that changed</div>' +
      '<div class="mwrap"><table class="dt"><thead><tr><th>Rank</th><th>Domain</th><th>Crawler</th><th>Change</th></tr></thead><tbody>' +
      rows + '</tbody></table></div>' +
      '<div id="chg-upsell" style="margin-top:14px;padding:14px 16px;border:1px dashed var(--line);border-radius:3px;background:#efe8d7;' +
      'display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap">' +
      '<span style="font-size:13px">The totals above cover every change. <b>' + fmt(Math.max(0, nTotal - nShown)) +
      ' more domains</b> changed this interval &mdash; the full feed, filterable and exportable, is in Terminal.</span>' +
      '<a href="#account" style="color:var(--signal);font-weight:600;text-decoration:none;white-space:nowrap">See the full change feed &rarr;</a></div>';
    var up = EL("chg-upsell");
    if (up) up.querySelector("a").addEventListener("click", function (e) {
      e.preventDefault(); location.hash = "#account"; account();
    });
  }

  function changesFull() {
    loadDomains(function (pd) {`,
  "changes split"
);

/* the aggregate download carries exactly what the account can see */
sub(
  `    EL("dl-agg").addEventListener("click", function () { save("cpi-dashboard-" + D.edition + ".json", JSON.stringify(D, null, 2), "application/json"); });`,
  `    // "Not more, not less": the file must match what this account sees on
    // screen. Free gets the shipped sample; Terminal gets the full change feed
    // folded back in, in the same shape, so their download matches their view.
    EL("dl-agg").addEventListener("click", function () {
      var btn = this;
      var emit = function (obj) { save("cpi-dashboard-" + D.edition + ".json", JSON.stringify(obj, null, 2), "application/json"); };
      loadMe(function (me) {
        if (!me || !me.entitled) return emit(D);
        btn.disabled = true; var was = btn.textContent; btn.textContent = "Preparing…";
        loadDomains(function (pd) {
          var full = JSON.parse(JSON.stringify(D));
          full.changes.items = (pd.changes || []).map(function (c) {
            return { domain: c[1], rank: c[0], crawler: pd.crawlers[c[2]],
                     prev: STCODE[c[3]] || c[3], cur: STCODE[c[4]] || c[4] };
          });
          full.changes.items_sample = false;
          emit(full);
          btn.disabled = false; btn.textContent = was;
        });
      });
    });`,
  "aggregate download"
);

fs.writeFileSync(V, v);
require("child_process").execSync("node --check " + V);

/* ---- verify -------------------------------------------------------------- */
const out = fs.readFileSync(V, "utf8");
for (const m of ["changesSample", "changesFull", "chg-upsell", "items_sample = false"])
  if (!out.includes(m)) throw new Error("missing after patch: " + m);
const dd = JSON.parse(fs.readFileSync(D, "utf8"));
if (!dd.changes.items_sample) throw new Error("artifact not trimmed");
if (dd.changes.total_changes !== 161) throw new Error("totals must survive the trim");

console.log("");
console.log("views.js: free -> sample + upsell, Terminal -> full feed (unchanged)");
console.log("aggregate JSON download now matches what the account sees, both ways");
