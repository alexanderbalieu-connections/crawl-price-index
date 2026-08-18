#!/usr/bin/env node
/**
 * CRAWL PRICE INDEX — DASHBOARD METRIC ENGINE  (node compute-dashboard.cjs)
 * =========================================================================
 * Reads per-domain editions (editions/<date>.csv.gz) and computes every
 * aggregate the customer dashboard needs, per DASHBOARD-SPEC.md:
 *   - per-crawler 5-state distribution + block rate + WoW delta + explicit-policy rate
 *   - selective-treatment share (>=1 blocked AND >=1 allowed/partial)
 *   - restriction-share + policy-diversity histograms
 *   - crawler x crawler exclusion matrix (A blocked AND B allowed)
 *   - pairwise co-treatment (strict: explicit statuses only)
 *   - rank-band breakdown, ccTLD breakdown (min-n)
 *   - policy-change feed + transition counts (needs >=2 editions; degrades gracefully)
 *   - wire-evidence exhibits (from scan-summary.json panel)
 * Writes: app/data/dashboard.json  (aggregates only — per-domain stays gated)
 * Language rules baked in: 5 states never collapse; "ccTLD" not country; counts shown.
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const STATES = ["blocked", "partial", "allowed", "unlisted", "no_robots"];
const BANDS = [[1,100],[101,500],[501,1000],[1001,5000],[5001,10000],[10001,25000],[25001,50000]];
const MIN_TLD_N = 100;
const CHANGE_FEED_CAP = 500;

function readEdition(file) {
  const raw = file.endsWith(".gz")
    ? zlib.gunzipSync(fs.readFileSync(file)).toString("utf8")
    : fs.readFileSync(file, "utf8");
  const lines = raw.trim().split("\n");
  const header = lines[0].split(",");
  const crawlers = header.slice(2);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].split(",");
    if (p.length !== header.length) continue;
    rows.push({ rank: +p[0], domain: p[1], st: p.slice(2) });
  }
  return { crawlers, rows };
}

function tldOf(domain) {
  const m = domain.toLowerCase().match(/\.([a-z0-9-]+)$/);
  return m ? "." + m[1] : "(none)";
}

// ---- load editions -------------------------------------------------------
const edDir = "editions";
let edFiles = fs.existsSync(edDir)
  ? fs.readdirSync(edDir).filter(f => /^\d{4}-\d{2}-\d{2}\.csv\.gz$/.test(f)).sort()
  : [];
let curFile, curDate;
if (edFiles.length) {
  curFile = path.join(edDir, edFiles[edFiles.length - 1]);
  curDate = edFiles[edFiles.length - 1].slice(0, 10);
} else if (fs.existsSync("scan-robots-full.csv")) {
  curFile = "scan-robots-full.csv";
  curDate = new Date().toISOString().slice(0, 10);
  console.log("(no editions/ yet — computing from scan-robots-full.csv)");
} else {
  console.error("no editions/*.csv.gz and no scan-robots-full.csv"); process.exit(1);
}
const cur = readEdition(curFile);
const N = cur.rows.length;
const C = cur.crawlers;
console.log(`edition ${curDate}: ${N} domains x ${C.length} crawlers`);

let prev = null, prevDate = null;
if (edFiles.length >= 2) {
  prevDate = edFiles[edFiles.length - 2].slice(0, 10);
  prev = readEdition(path.join(edDir, edFiles[edFiles.length - 2]));
  console.log(`diffing against ${prevDate} (${prev.rows.length} domains)`);
}

// ---- per-crawler distribution -------------------------------------------
const dist = C.map(() => ({ blocked:0, partial:0, allowed:0, unlisted:0, no_robots:0 }));
for (const r of cur.rows) r.st.forEach((s, ci) => { if (dist[ci][s] !== undefined) dist[ci][s]++; });

let prevRates = null;
if (prev) {
  const pd = prev.crawlers.map(() => 0);
  for (const r of prev.rows) r.st.forEach((s, ci) => { if (s === "blocked") pd[ci]++; });
  prevRates = {};
  prev.crawlers.forEach((c, ci) => prevRates[c] = pd[ci] / prev.rows.length * 100);
}

// parsed = domains where a robots.txt was readable (status != no_robots for that row)
let PARSED = 0;
for (const r of cur.rows) if (r.st.some(s => s !== "no_robots")) PARSED++;

let prevRatesParsed = null;
if (prev) {
  let pp = 0; for (const r of prev.rows) if (r.st.some(s => s !== "no_robots")) pp++;
  const pd = prev.crawlers.map(() => 0);
  for (const r of prev.rows) r.st.forEach((s, ci) => { if (s === "blocked") pd[ci]++; });
  prevRatesParsed = {};
  prev.crawlers.forEach((c, ci) => prevRatesParsed[c] = pd[ci] / pp * 100);
}

const crawlers = C.map((name, ci) => {
  const d = dist[ci];
  const rateParsed = d.blocked / PARSED * 100;       // PRIMARY: matches published site figures
  const ratePanel  = d.blocked / N * 100;            // secondary: whole 50k frame
  const explicit = (d.blocked + d.allowed + d.partial) / PARSED * 100;
  return {
    name, ...d,
    blocked_pct: +rateParsed.toFixed(2),
    blocked_pct_panel: +ratePanel.toFixed(2),
    allowed_pct: +(d.allowed / PARSED * 100).toFixed(2),
    explicit_policy_pct: +explicit.toFixed(2),
    delta_pp: prevRatesParsed && prevRatesParsed[name] !== undefined ? +(rateParsed - prevRatesParsed[name]).toFixed(2) : null,
  };
}).sort((a, b) => b.blocked_pct - a.blocked_pct);

// ---- domain-level derived metrics ---------------------------------------
let selective = 0;
const restrictionHist = { "0":0, "1-3":0, "4-6":0, "7-12":0, "13-17":0, "18":0 };
const diversityHist = { "1":0, "2":0, "3":0, "4":0, "5":0 };
for (const r of cur.rows) {
  let b = 0, aOrP = 0; const seen = new Set();
  for (const s of r.st) { if (s === "blocked") b++; if (s === "allowed" || s === "partial") aOrP++; seen.add(s); }
  if (b >= 1 && aOrP >= 1) selective++;
  restrictionHist[b === 0 ? "0" : b <= 3 ? "1-3" : b <= 6 ? "4-6" : b <= 12 ? "7-12" : b <= 17 ? "13-17" : "18"]++;
  diversityHist[String(Math.min(seen.size, 5))]++;
}

// ---- crawler x crawler matrices -----------------------------------------
const nC = C.length;
const excl = Array.from({ length: nC }, () => new Array(nC).fill(0)); // A blocked & B allowed
const same = Array.from({ length: nC }, () => new Array(nC).fill(0)); // same explicit status
const bothExplicit = Array.from({ length: nC }, () => new Array(nC).fill(0));
for (const r of cur.rows) {
  for (let a = 0; a < nC; a++) {
    const sa = r.st[a];
    for (let b = 0; b < nC; b++) {
      if (a === b) continue;
      const sb = r.st[b];
      if (sa === "blocked" && sb === "allowed") excl[a][b]++;
      const aExp = sa === "blocked" || sa === "allowed" || sa === "partial";
      const bExp = sb === "blocked" || sb === "allowed" || sb === "partial";
      if (aExp && bExp) { bothExplicit[a][b]++; if (sa === sb) same[a][b]++; }
    }
  }
}
const exclusion_matrix = excl.map(row => row.map(v => +(v / N * 100).toFixed(2)));
const cotreat_matrix = same.map((row, a) => row.map((v, b) =>
  bothExplicit[a][b] ? +(v / bothExplicit[a][b] * 100).toFixed(1) : null));

// ---- rank bands ----------------------------------------------------------
const rank_bands = BANDS.map(([lo, hi]) => {
  const rows = cur.rows.filter(r => r.rank >= lo && r.rank <= hi);
  const per = {};
  C.forEach((c, ci) => {
    let b = 0; for (const r of rows) if (r.st[ci] === "blocked") b++;
    per[c] = rows.length ? +(b / rows.length * 100).toFixed(2) : null;
  });
  return { band: `${lo}-${hi}`, n: rows.length, blocked_pct: per };
});

// ---- ccTLD (min-n) -------------------------------------------------------
const tldMap = {};
for (const r of cur.rows) {
  const t = tldOf(r.domain);
  (tldMap[t] = tldMap[t] || []).push(r);
}
// Rates use the PARSED denominator (domains in the group with a readable
// robots.txt) so they match the published site figures exactly. n_total is
// kept so the group's full size stays visible.
const tld = Object.entries(tldMap)
  .filter(([, rows]) => rows.length >= MIN_TLD_N)
  .map(([t, rows]) => {
    const parsedRows = rows.filter(r => r.st.some(s => s !== "no_robots"));
    const den = parsedRows.length || 1;
    const per = {};
    C.forEach((c, ci) => {
      let b = 0; for (const r of parsedRows) if (r.st[ci] === "blocked") b++;
      per[c] = +(b / den * 100).toFixed(2);
    });
    let anyB = 0; for (const r of parsedRows) if (r.st.some(s => s === "blocked")) anyB++;
    return { tld: t, n: den, n_total: rows.length,
             any_blocked_pct: +(anyB / den * 100).toFixed(2), blocked_pct: per };
  })
  .filter(r => r.n >= MIN_TLD_N)
  .sort((a, b) => b.any_blocked_pct - a.any_blocked_pct);

// ---- change feed + transitions (needs prev) ------------------------------
let changes = { available: false, note: "Change detection begins once two editions exist.", interval: null, items: [], transitions: {}, total_changes: 0, frame_churn: { entered: 0, left: 0 } };
if (prev) {
  const prevMap = new Map(prev.rows.map(r => [r.domain, r]));
  const curDomains = new Set(cur.rows.map(r => r.domain));
  let entered = 0; for (const r of cur.rows) if (!prevMap.has(r.domain)) entered++;
  let left = 0; for (const r of prev.rows) if (!curDomains.has(r.domain)) left++;
  const items = []; const trans = {}; let total = 0;
  // A domain whose robots.txt was unreachable in one edition flips ALL 18 cells
  // to/from no_robots. That is fetch availability, not a policy decision, so it
  // is counted and reported SEPARATELY and never called a policy change.
  let availability_cells = 0; const availability_domains = new Set();
  const changed_domains = new Set();
  for (const r of cur.rows) {
    const p = prevMap.get(r.domain);
    if (!p) continue; // frame churn is NOT a policy change
    for (let ci = 0; ci < nC; ci++) {
      const a = p.st[ci], b = r.st[ci];
      if (a === b) continue;
      if (a === "no_robots" || b === "no_robots") {
        availability_cells++; availability_domains.add(r.domain);
        continue;                                   // excluded from the policy feed
      }
      total++;
      changed_domains.add(r.domain);
      const key = `${a}->${b}`;
      trans[key] = (trans[key] || 0) + 1;
      if (items.length < CHANGE_FEED_CAP)
        items.push({ domain: r.domain, rank: r.rank, crawler: C[ci], prev: a, cur: b });
    }
  }
  items.sort((x, y) => x.rank - y.rank);
  changes = {
    available: true, interval: `${prevDate} -> ${curDate}`, items, transitions: trans,
    total_changes: total, changed_domains: changed_domains.size,
    capped_at: CHANGE_FEED_CAP, frame_churn: { entered, left },
    availability: { cells: availability_cells, domains: availability_domains.size,
      note: "Cells that moved to or from 'no robots.txt' — the file became reachable or unreachable between scans. Counted separately because it reflects fetch availability, not a publisher decision." },
  };
}

// ---- wire evidence (exhibits, from summary) ------------------------------
let wire = { note: "Exploratory probe sample — exhibits, not population estimates.", prices: [], p402: [], tollbit: [], payment_headers: [], maxprice_flips: [], sample: null };
if (fs.existsSync("scan-summary.json")) {
  const s = JSON.parse(fs.readFileSync("scan-summary.json", "utf8"));
  if (s.panel) {
    wire.prices = s.panel.prices || [];
    wire.p402 = s.panel.p402 || [];
    wire.tollbit = s.panel.tollbit || [];
    wire.payment_headers = s.panel.paymentHeaders || [];
    wire.maxprice_flips = s.panel.maxpriceFlips || [];
  }
}


// ---- trend series from aggregate history (history/<date>.json) -----------
function buildTrend() {
  if (!fs.existsSync("history")) return [];
  return fs.readdirSync("history").filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().map(f => {
    try {
      const h = JSON.parse(fs.readFileSync(path.join("history", f), "utf8"));
      const br = h.block_rates || {};
      const rates = {};
      Object.keys(br).forEach(k => { rates[k] = typeof br[k] === "object" ? br[k].rate_pct : br[k]; });
      return { date: f.slice(0, 10), rates };
    } catch (e) { return null; }
  }).filter(Boolean);
}

// ---- assemble ------------------------------------------------------------
const out = {
  generated_utc: new Date().toISOString(),
  edition: curDate,
  editions: edFiles.map(f => f.slice(0, 10)),
  panel: { domains: N, robots_parsed: PARSED, crawlers: C.length, denominator_note: `Primary rates are % of the ${PARSED.toLocaleString("en-GB")} domains with a readable robots.txt (matches published index figures); blocked_pct_panel is % of the full ${N.toLocaleString("en-GB")}-domain frame. Neither is "the web".` },
  crawlers,
  selective: { count: selective, pct: +(selective / N * 100).toFixed(2), definition: ">=1 crawler explicitly blocked AND >=1 explicitly allowed or partial" },
  restriction_hist: restrictionHist,
  diversity_hist: diversityHist,
  matrix_crawlers: C,
  exclusion_matrix,
  cotreat_matrix,
  rank_bands,
  tld: { min_n: MIN_TLD_N, note: "ccTLD is a domain-suffix classification, not operator location, ownership, audience, or hosting. Rates use the same parsed-robots.txt denominator as the published world editions, so the two agree.", rows: tld },
  changes,
  wire,
  trend: buildTrend(),
  history_aggregate: fs.existsSync("history-index.json") ? JSON.parse(fs.readFileSync("history-index.json", "utf8")) : null,
};
fs.mkdirSync("app/data", { recursive: true });
fs.writeFileSync("app/data/dashboard.json", JSON.stringify(out));
const kb = (fs.statSync("app/data/dashboard.json").size / 1024).toFixed(0);
console.log(`app/data/dashboard.json written (${kb} KB)`);
console.log(`  crawler leaderboard: ${crawlers[0].name} ${crawlers[0].blocked_pct}% -> ${crawlers[crawlers.length-1].name} ${crawlers[crawlers.length-1].blocked_pct}%`);
console.log(`  selective treatment: ${out.selective.pct}% of domains`);
console.log(`  tld rows (n>=${MIN_TLD_N}): ${tld.length} | changes: ${changes.available ? changes.total_changes : "pending 2nd edition"}`);
