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

function fmtn(n) { return Number(n).toLocaleString("en-GB"); }

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


// ---- consensus metrics from the design reviews ---------------------------
// crawler role/vendor tags (labels only — never asserts company behaviour)
const CRAWLER_META = {
  "GPTBot":{v:"OpenAI",r:"training"}, "OAI-SearchBot":{v:"OpenAI",r:"search"}, "ChatGPT-User":{v:"OpenAI",r:"user-initiated"},
  "ClaudeBot":{v:"Anthropic",r:"training"}, "Claude-Web":{v:"Anthropic",r:"user-initiated"}, "anthropic-ai":{v:"Anthropic",r:"training"},
  "PerplexityBot":{v:"Perplexity",r:"search"}, "Perplexity-User":{v:"Perplexity",r:"user-initiated"},
  "Google-Extended":{v:"Google",r:"training"}, "CCBot":{v:"Common Crawl",r:"training"},
  "Bytespider":{v:"ByteDance",r:"training"}, "Amazonbot":{v:"Amazon",r:"search"},
  "Applebot-Extended":{v:"Apple",r:"training"}, "meta-externalagent":{v:"Meta",r:"training"},
  "cohere-ai":{v:"Cohere",r:"training"}, "AI2Bot":{v:"AI2",r:"training"},
  "Timpibot":{v:"Timpi",r:"training"}, "Diffbot":{v:"Diffbot",r:"training"},
};

// composite: domains blocking AT LEAST ONE crawler (the headline number
// reviewers said was missing — "is 15% high or low?" needs a frame-level anchor)
let anyBlocked = 0;
const anyByBand = BANDS.map(() => ({ n: 0, blocked: 0 }));
for (const r of cur.rows) {
  const parsed = r.st.some(s => s !== "no_robots");
  if (!parsed) continue;
  const blocks = r.st.some(s => s === "blocked");
  if (blocks) anyBlocked++;
  for (let bi = 0; bi < BANDS.length; bi++) {
    if (r.rank >= BANDS[bi][0] && r.rank <= BANDS[bi][1]) {
      anyByBand[bi].n++; if (blocks) anyByBand[bi].blocked++;
      break;
    }
  }
}

// rank concentration: what share of each crawler's blocked domains sit in the top 10k
const concentration = {};
C.forEach((name, ci) => {
  let tot = 0, top10k = 0;
  for (const r of cur.rows) {
    if (r.st[ci] !== "blocked") continue;
    tot++; if (r.rank <= 10000) top10k++;
  }
  concentration[name] = tot ? +(top10k / tot * 100).toFixed(1) : null;
});

// significance: is this week's move the largest since the index began?
function moverSignificance() {
  const t = buildTrend();
  if (t.length < 2) return {};
  const out = {};
  Object.keys(t[t.length - 1].rates).forEach(name => {
    const deltas = [];
    for (let i = 1; i < t.length; i++) {
      const a = t[i - 1].rates[name], b = t[i].rates[name];
      if (a != null && b != null) deltas.push(+(b - a).toFixed(3));
    }
    if (!deltas.length) return;
    const latest = deltas[deltas.length - 1];
    const maxUp = Math.max(...deltas), maxDown = Math.min(...deltas);
    out[name] = {
      latest, editions: deltas.length + 1,
      is_largest_increase: deltas.length > 1 && latest === maxUp && latest > 0,
      is_largest_decrease: deltas.length > 1 && latest === maxDown && latest < 0,
      avg: +(deltas.reduce((a, b) => a + b, 0) / deltas.length).toFixed(3),
    };
  });
  return out;
}

/* =========================================================================
   POLICY LAYER  —  the denominator ladder + crawler name recognition
   -------------------------------------------------------------------------
   A crawler's block rate conflates two very different things: how often it is
   REFUSED, and how often it is NAMED AT ALL. A crawler nobody has heard of
   looks permissively treated. Splitting the two is the point of this block.

   Three denominators, always stated, never mixed:
     frame     50,000 domains sampled from the Tranco list
     parsed    domains that served a readable robots.txt
     AI-aware  parsed domains that name >=1 of the 18 tracked crawlers
   ========================================================================= */
const EXPLICIT = s => s === "blocked" || s === "partial" || s === "allowed";
const isParsed = r => r.st.some(s => s !== "no_robots");
const parsedRows = cur.rows.filter(isParsed);
const awareRows  = parsedRows.filter(r => r.st.some(EXPLICIT));
const noRobotsDomains = N - PARSED;

const nameRecognition = C.map((name, ci) => {
  let named = 0, blocked = 0, blockedAware = 0;
  for (const r of parsedRows) {
    if (EXPLICIT(r.st[ci])) named++;
    if (r.st[ci] === "blocked") blocked++;
  }
  for (const r of awareRows) if (r.st[ci] === "blocked") blockedAware++;
  return {
    name,
    vendor: (CRAWLER_META[name] || {}).v || "other",
    role: (CRAWLER_META[name] || {}).r || "other",
    named, named_pct: +(named / PARSED * 100).toFixed(2),
    blocked, blocked_pct_parsed: +(blocked / PARSED * 100).toFixed(2),
    blocked_when_named_pct: named ? +(blocked / named * 100).toFixed(1) : null,
    blocked_pct_aware: awareRows.length ? +(blockedAware / awareRows.length * 100).toFixed(2) : null,
  };
}).sort((a, b) => b.named_pct - a.named_pct);

const policy_layer = {
  ladder: {
    frame: N,
    parsed: PARSED,
    ai_aware: awareRows.length,
    no_robots_domains: noRobotsDomains,
    parsed_pct: +(PARSED / N * 100).toFixed(2),
    ai_aware_pct_frame: +(awareRows.length / N * 100).toFixed(2),
    ai_aware_pct_parsed: +(awareRows.length / PARSED * 100).toFixed(2),
    note: "AI-aware = a readable robots.txt that names at least one of the 18 tracked crawlers with an explicit block, partial or allow. It is the honest size of the AI-policy layer; it is not 'the web'.",
  },
  crawlers: nameRecognition,
  note: "'Named' counts explicit mentions only. A crawler left unlisted was never addressed — that is an awareness gap, not consent.",
};

/* =========================================================================
   ARCHETYPES  —  exact 18-cell policy signatures, and the template disclosure
   -------------------------------------------------------------------------
   Every domain's 18 statuses form one categorical fingerprint. Counting them
   exactly reveals how much of the index's "blocking" is independent decisions
   and how much is one widely copy-pasted robots.txt block. That distinction
   is material to every aggregate on this dashboard, so it is published rather
   than left for a reader to discover.
   ========================================================================= */
const SIGCH = { blocked:"B", partial:"P", allowed:"A", unlisted:"u", no_robots:"-" };
const sigOf = r => r.st.map(s => SIGCH[s] || "?").join("");
const sigCount = new Map();
for (const r of parsedRows) { const s = sigOf(r); sigCount.set(s, (sigCount.get(s) || 0) + 1); }
const sigSorted = [...sigCount.entries()].sort((a, b) => b[1] - a[1]);
const decodeSig = s => ({
  blocked:  C.filter((_, i) => s[i] === "B"),
  partial:  C.filter((_, i) => s[i] === "P"),
  allowed:  C.filter((_, i) => s[i] === "A"),
});

let totalBlockedCells = 0;
for (const r of parsedRows) for (const s of r.st) if (s === "blocked") totalBlockedCells++;

// the dominant NON-TRIVIAL signature: the most common one that actually blocks something
const domEntry = sigSorted.find(([s]) => s.indexOf("B") >= 0);
let dominant = null;
if (domEntry) {
  const [dsig, dn] = domEntry;
  const hits = parsedRows.filter(r => sigOf(r) === dsig);
  const ranks = hits.map(r => r.rank).sort((a, b) => a - b);
  const dBlocked = decodeSig(dsig).blocked;
  dominant = {
    signature: dsig,
    n: dn,
    crawlers_blocked: dBlocked,
    pct_of_parsed: +(dn / PARSED * 100).toFixed(2),
    pct_of_aware: awareRows.length ? +(dn / awareRows.length * 100).toFixed(2) : null,
    blocked_cells: dn * dBlocked.length,
    pct_of_all_blocked_cells: +(dn * dBlocked.length / totalBlockedCells * 100).toFixed(1),
    mean_rank: Math.round(ranks.reduce((a, b) => a + b, 0) / ranks.length),
    median_rank: ranks[Math.floor(ranks.length / 2)],
    by_band: BANDS.map(([lo, hi]) => {
      const h = hits.filter(r => r.rank >= lo && r.rank <= hi).length;
      const p = parsedRows.filter(r => r.rank >= lo && r.rank <= hi).length;
      return { band: `${lo}-${hi}`, n: h, parsed_n: p, pct: p ? +(h / p * 100).toFixed(2) : null };
    }),
    examples: hits.slice().sort((a, b) => a.rank - b.rank).slice(0, 10).map(r => ({ domain: r.domain, rank: r.rank })),
    note: "One identical 18-cell signature. Its concentration in the rank tail is the signature of a widely copied default rather than independent editorial decisions. It is disclosed because it materially shapes every block rate on this dashboard.",
  };
}

// every headline rate recomputed with the dominant-template cohort removed
let ex_template = null;
if (dominant) {
  const rest = parsedRows.filter(r => sigOf(r) !== dominant.signature);
  const per = {};
  C.forEach((c, ci) => {
    let b = 0; for (const r of rest) if (r.st[ci] === "blocked") b++;
    per[c] = +(b / rest.length * 100).toFixed(2);
  });
  let anyB = 0; for (const r of rest) if (r.st.some(s => s === "blocked")) anyB++;
  ex_template = {
    parsed_n: rest.length,
    blocked_pct: per,
    any_blocked_pct: +(anyB / rest.length * 100).toFixed(2),
    note: "Same computation with the dominant-template cohort excluded. Published so a reader can see how much of each rate depends on it.",
  };
}

const archetypes = {
  distinct_parsed: sigCount.size,
  top: sigSorted.slice(0, 12).map(([s, n]) => {
    const d = decodeSig(s);
    return {
      signature: s, n,
      pct_of_parsed: +(n / PARSED * 100).toFixed(2),
      blocked: d.blocked, partial: d.partial, allowed: d.allowed,
      is_silent: d.blocked.length === 0 && d.partial.length === 0 && d.allowed.length === 0,
    };
  }),
  dominant,
  ex_template,
  total_blocked_cells: totalBlockedCells,
  note: "A signature is the exact 18-status string for a domain, in the crawler order shown. Counts are of parsed domains.",
};

/* =========================================================================
   ROLE & VENDOR LAYER
   -------------------------------------------------------------------------
   The role tags already exist but nothing used them. Two questions matter:
   does a domain treat a crawler that TRAINS differently from one that SENDS
   TRAFFIC, and how does a vendor fare once its uneven crawler count is
   controlled for. Vendor rollups are stated with their aggregation rule
   because vendors field between 1 and 3 crawlers.
   ========================================================================= */
const roleIdx = role => C.map((c, i) => [c, i]).filter(([c]) => (CRAWLER_META[c] || {}).r === role).map(([, i]) => i);
const IDX_TRAIN = roleIdx("training");
const IDX_SEARCH = roleIdx("search");
const IDX_USER = roleIdx("user-initiated");
const blocksAny = (r, idxs) => idxs.some(i => r.st[i] === "blocked");

function splitCounts(idxA, idxB) {
  let a = 0, b = 0, both = 0, neither = 0;
  for (const r of parsedRows) {
    const x = blocksAny(r, idxA), y = blocksAny(r, idxB);
    if (x && !y) a++; else if (y && !x) b++; else if (x && y) both++; else neither++;
  }
  const p = v => +(v / PARSED * 100).toFixed(2);
  return { a, b, both, neither, a_pct: p(a), b_pct: p(b), both_pct: p(both), neither_pct: p(neither),
           ratio: b ? +(a / b).toFixed(1) : null };
}

const IDX_NONTRAIN = IDX_SEARCH.concat(IDX_USER);
const asymmetry = {
  denominator: PARSED,
  vs_search: Object.assign(splitCounts(IDX_TRAIN, IDX_SEARCH), {
    a_label: "Blocks a training crawler, blocks no search crawler",
    b_label: "Blocks a search crawler, blocks no training crawler",
    crawlers_a: IDX_TRAIN.map(i => C[i]), crawlers_b: IDX_SEARCH.map(i => C[i]),
  }),
  vs_nontraining: Object.assign(splitCounts(IDX_TRAIN, IDX_NONTRAIN), {
    a_label: "Blocks a training crawler, blocks no search or user-initiated crawler",
    b_label: "Blocks a search or user-initiated crawler, blocks no training crawler",
    crawlers_a: IDX_TRAIN.map(i => C[i]), crawlers_b: IDX_NONTRAIN.map(i => C[i]),
  }),
  definition: "Computed per domain on the parsed set. 'Blocks' means at least one crawler of that role is explicitly blocked; every other state (partial, allowed, unlisted) counts as not blocked. Stated because the choice of denominator changes the answer.",
};

const vendorNames = [...new Set(C.map(c => (CRAWLER_META[c] || {}).v || "other"))];
const vendors = vendorNames.map(v => {
  const idxs = C.map((c, i) => [c, i]).filter(([c]) => ((CRAWLER_META[c] || {}).v) === v).map(([, i]) => i);
  const tIdx = idxs.filter(i => (CRAWLER_META[C[i]] || {}).r === "training");
  const sIdx = idxs.filter(i => (CRAWLER_META[C[i]] || {}).r !== "training");
  let any = 0, shareSum = 0, tOnly = 0, sOnly = 0;
  for (const r of parsedRows) {
    const blocked = idxs.filter(i => r.st[i] === "blocked").length;
    if (blocked) any++;
    shareSum += blocked / idxs.length;
    if (tIdx.length && sIdx.length) {
      const t = blocksAny(r, tIdx), s = blocksAny(r, sIdx);
      if (t && !s) tOnly++; else if (s && !t) sOnly++;
    }
  }
  const pctOf = idxs2 => {
    if (!idxs2.length) return null;
    let n = 0; for (const r of parsedRows) if (blocksAny(r, idxs2)) n++;
    return +(n / PARSED * 100).toFixed(2);
  };
  return {
    vendor: v,
    crawlers: idxs.map(i => C[i]),
    n_crawlers: idxs.length,
    roles: [...new Set(idxs.map(i => (CRAWLER_META[C[i]] || {}).r))],
    any_blocked_pct: +(any / PARSED * 100).toFixed(2),
    mean_share_blocked_pct: +(shareSum / PARSED * 100).toFixed(2),
    training_any_pct: pctOf(tIdx),
    nontraining_any_pct: pctOf(sIdx),
    splits_by_role: (tIdx.length && sIdx.length)
      ? { training_only: tOnly, training_only_pct: +(tOnly / PARSED * 100).toFixed(2),
          nontraining_only: sOnly, nontraining_only_pct: +(sOnly / PARSED * 100).toFixed(2) }
      : null,
  };
}).sort((a, b) => b.any_blocked_pct - a.any_blocked_pct);

const roles = {
  asymmetry,
  vendors,
  aggregation_rule: "any_blocked_pct = share of parsed domains explicitly blocking AT LEAST ONE crawler operated by that vendor. Vendors field between 1 and 3 tracked crawlers, so a vendor with more crawlers has more ways to score. mean_share_blocked_pct (average fraction of the vendor's own crawlers blocked) and the training-only column are given because they do not carry that bias. Crawler identity is as measured in robots.txt; the vendor label is ours.",
};

// ---- assemble ------------------------------------------------------------
const out = {
  generated_utc: new Date().toISOString(),
  edition: curDate,
  editions: edFiles.map(f => f.slice(0, 10)),
  panel: { domains: N, robots_parsed: PARSED, crawlers: C.length, denominator_note: `Primary rates are % of the ${PARSED.toLocaleString("en-GB")} domains with a readable robots.txt (matches published index figures); blocked_pct_panel is % of the full ${N.toLocaleString("en-GB")}-domain frame. Neither is "the web".` },
  crawlers: crawlers.map(c => Object.assign({}, c, {
    vendor: (CRAWLER_META[c.name] || {}).v || "other",
    role: (CRAWLER_META[c.name] || {}).r || "other",
    top10k_share_of_blocks: concentration[c.name],
  })),
  any_ai: {
    pct: +(anyBlocked / PARSED * 100).toFixed(2), count: anyBlocked, denominator: PARSED,
    by_band: BANDS.map((b, i) => ({ band: `${b[0]}-${b[1]}`, n: anyByBand[i].n,
      pct: anyByBand[i].n ? +(anyByBand[i].blocked / anyByBand[i].n * 100).toFixed(2) : null })),
    definition: "Share of parsed domains that explicitly block at least one of the 18 tracked crawlers in robots.txt.",
  },
  significance: moverSignificance(),
  selective: { count: selective, pct: +(selective / N * 100).toFixed(2), definition: ">=1 crawler explicitly blocked AND >=1 explicitly allowed or partial" },
  restriction_hist: restrictionHist,
  diversity_hist: diversityHist,
  matrix_crawlers: C,
  exclusion_matrix,
  cotreat_matrix,
  rank_bands,
  tld: { min_n: MIN_TLD_N, note: "ccTLD is a domain-suffix classification, not operator location, ownership, audience, or hosting. Rates use the same parsed-robots.txt denominator as the published world editions, so the two agree.", rows: tld },
  policy_layer,
  archetypes,
  roles,
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
console.log(`  policy layer: ${fmtn(policy_layer.ladder.ai_aware)} AI-aware domains (${policy_layer.ladder.ai_aware_pct_frame}% of frame, ${policy_layer.ladder.ai_aware_pct_parsed}% of parsed)`);
console.log(`  archetypes: ${fmtn(archetypes.distinct_parsed)} distinct signatures` +
  (dominant ? ` | dominant template ${fmtn(dominant.n)} domains = ${dominant.pct_of_all_blocked_cells}% of all blocked cells` : ""));
console.log(`  role split: ${fmtn(asymmetry.vs_search.a)} training-only vs ${fmtn(asymmetry.vs_search.b)} search-only (${asymmetry.vs_search.ratio}:1)`);
