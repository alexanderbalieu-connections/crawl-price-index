#!/usr/bin/env node
/**
 * x402 BAZAAR SNAPSHOT  (node bazaar-snapshot.cjs   [--reprocess])
 * =========================================================================
 * Weekly capture of the Coinbase x402 "Bazaar" discovery registry — the
 * opt-in universe of endpoints that ADVERTISE a machine-payable price.
 * Coinbase serves it as a live snapshot only; this turns it into a time series.
 *
 * Pure collection + derivation. Never breaks the Sunday edition: exits 0 on
 * partial results, non-zero only if it got literally nothing.
 *
 * Writes:
 *   bazaar/<date>.json.gz          full raw snapshot (ground truth, gzipped)
 *   bazaar/<date>-summary.json     derived weekly summary (aggregate = free tab)
 *   bazaar-index.json              the growing time series (one slim row/week)
 *   bazaar-endpoints.json          id -> {first_seen,last_seen} (the churn/moat index)
 *   private/bazaar-domains.json    per-domain hits in the 50k frame (GATED = paid table)
 *
 * --reprocess : recompute all derivations from the latest raw archive WITHOUT
 *               re-fetching (used to backfill enrichments onto existing weeks).
 *
 * Editorial: everything here is DECLARED/opt-in advertised acceptance — never
 * transactions, volume or revenue. Prices are advertised asks. x402 (stablecoin
 * HTTP 402) is a different rail from Cloudflare pay-per-crawl.
 *
 * Pure Node (global fetch, Node 18+). No dependencies.
 */
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");
const crypto = require("crypto");

const REPROCESS = process.argv.includes("--reprocess");
const URL_BASE = process.env.X402_BAZAAR_URL ||
  "https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources";
const MAX_PAGES = parseInt(process.env.BAZAAR_MAX_PAGES || "2000", 10);
const LIMIT = 100, TIMEOUT_MS = 20000;
const DATE = new Date().toISOString().slice(0, 10);
const headers = { Accept: "application/json" };
if (process.env.X402_BAZAAR_AUTH) headers.Authorization = process.env.X402_BAZAAR_AUTH;

/* ---------- known-asset registry (address lowercased -> meta) -------------- */
/* Only known mainnet stablecoins feed the USD headline. USD = raw / 10^decimals
 * (stablecoin ≈ $1). Everything else is testnet (excluded) or un-normalisable
 * (raw only, badged). Frozen at capture so history doesn't shift later. */
const ASSETS = {
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": { sym: "USDC", dec: 6, chain: "base",     testnet: false, usd: true },
  "epjfwdd5aufqssqem2qn1xzybapc8g4weggkzwytdt1v": { sym: "USDC", dec: 6, chain: "solana",   testnet: false, usd: true },
  "0xaf88d065e77c8cc2239327c5edb3a432268e5831": { sym: "USDC", dec: 6, chain: "arbitrum", testnet: false, usd: true },
  "31566704":                                    { sym: "USDC", dec: 6, chain: "algorand", testnet: false, usd: true },
  "es9vmfrzacermjfrf4h2fyd4kconky11mcce8benwnyb": { sym: "USDT", dec: 6, chain: "solana",   testnet: false, usd: true },
  "0x036cbd53842c5426634e7929541ec2318f3dcf7e": { sym: "USDC", dec: 6, chain: "base-sepolia", testnet: true, usd: false },
};
const TESTNET_NET = new Set(["eip155:84532", "base-sepolia", "solana:devnet", "eip155:4663"]);
function normNet(n) { return (n === "base" ? "eip155:8453" : n) || "unknown"; } // merge label variants
function isTestnetNet(n) { return TESTNET_NET.has(n); }

/* ---------- resource / host / type / price helpers ------------------------ */
function urlOf(r) { return (r && (r.resource?.url || r.resource || r.url)) || ""; }
function hostOf(r) { try { return new URL(urlOf(r)).hostname.toLowerCase(); } catch { return ""; } }
function pathOf(r) { try { return new URL(urlOf(r)).pathname || "/"; } catch { return ""; } }
const DEMO = /localhost|127\.0\.0\.1|example\.|ngrok|vercel\.app|\.repl\.|\bdemo\b|\btest\b|hello|tutorial|x402\.org|x402\.gitbook/;
const isDemo = h => !h || DEMO.test(h);
function accOf(r) { return (r && r.accepts && r.accepts[0]) || {}; }
function priceRawOf(r) { const a = accOf(r); return a.amount ?? a.maxAmountRequired ?? (r && r.price != null ? String(r.price) : null); }
function typeOf(r) {
  const mime = (r && r.resource && r.resource.mimeType) || "";
  const s = (hostOf(r) + " " + urlOf(r) + " " + mime + " " + JSON.stringify((r && r.accepts) || "")).toLowerCase();
  if (/\/mcp(\W|$)|(^|\W)mcp(\W|$)/.test(s)) return "mcp";
  if (/\/api(\W|$)|(^|\W)api\./.test(s)) return "api";
  return "content";
}
function endpointId(r) { return crypto.createHash("sha1").update(urlOf(r) || JSON.stringify(r)).digest("hex").slice(0, 16); }
/* USD value of an endpoint's advertised price, or null if not USD-normalisable */
function usdOf(r) {
  const a = accOf(r), addr = String(a.asset || "").toLowerCase(), meta = ASSETS[addr];
  if (!meta || !meta.usd || meta.testnet) return null;
  const raw = Number(priceRawOf(r));
  if (!Number.isFinite(raw)) return null;
  return raw / Math.pow(10, meta.dec);
}
function priceBucketOf(r) {
  const a = accOf(r), addr = String(a.asset || "").toLowerCase(), meta = ASSETS[addr];
  if (meta && meta.testnet) return "testnet";
  if (isTestnetNet(normNet(a.network))) return "testnet";
  if (meta && meta.usd) return "usd";
  return "unnormalisable";
}

function median(a) { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function pct(a, p) { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))]; }

/* ---------- registrable-domain reduction (wider suffix list, no PSL dep) --- */
const MULTI_SUFFIX = new Set([
  "co.uk","org.uk","gov.uk","ac.uk","me.uk","ltd.uk","plc.uk","net.uk","sch.uk",
  "com.au","net.au","org.au","edu.au","gov.au","id.au",
  "co.jp","or.jp","ne.jp","go.jp","ac.jp","ad.jp","co.nz","org.nz","net.nz","govt.nz",
  "co.za","org.za","com.br","net.br","org.br","gov.br","com.cn","net.cn","org.cn","gov.cn",
  "com.tr","co.in","net.in","org.in","gov.in","co.kr","or.kr","com.mx","com.sg","com.hk",
  "com.tw","com.ar","com.co","com.ua","com.ph","com.my","com.pk","com.sa","com.eg",
  "co.il","co.id","co.th","com.vn","com.ng","co.ke","gov.uk","org.il","net.il",
]);
function registrable(host) {
  host = String(host || "").toLowerCase().replace(/^www\./, "").replace(/:\d+$/, "");
  const p = host.split(".").filter(Boolean);
  if (p.length <= 2) return host;
  const last2 = p.slice(-2).join(".");
  if (MULTI_SUFFIX.has(last2) && p.length >= 3) return p.slice(-3).join(".");
  return last2;
}
/* Hosting / PaaS / cloud suffixes: a Bazaar endpoint on one of these is a third
 * party deploying on shared hosting, NOT the platform itself selling access. So
 * a frame match on these is a false "publisher" signal — count them separately. */
const HOSTING_SUFFIX = new Set([
  "amazonaws.com","on.aws","cloudfront.net","appspot.com","run.app","web.app","firebaseapp.com",
  "cloudfunctions.net","googleusercontent.com","workers.dev","pages.dev","r2.dev","trycloudflare.com",
  "netlify.app","vercel.app","herokuapp.com","github.io","gitlab.io","fly.dev","fly.io","onrender.com",
  "render.com","railway.app","up.railway.app","supabase.co","azurewebsites.net","deno.dev","deno.net",
  "val.run","modal.run","hf.space","pythonanywhere.com","glitch.me","repl.co","replit.dev","replit.app",
  "duckdns.org","sslip.io","nip.io","ngrok.io","ngrok.app","ngrok-free.app","koyeb.app","cyclic.app",
]);
const isHosting = d => HOSTING_SUFFIX.has(d);

/* ---------- load 50k frame (rank + blocks-any crawler) from latest edition - */
function loadFrame() {
  try {
    if (!fs.existsSync("editions")) return null;
    const f = fs.readdirSync("editions").filter(x => /^\d{4}-\d{2}-\d{2}\.csv\.gz$/.test(x)).sort().pop();
    if (!f) return null;
    const lines = zlib.gunzipSync(fs.readFileSync(path.join("editions", f))).toString("utf8").trim().split("\n");
    const rank = new Map(), blocksAny = new Map();
    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split(",");
      if (c.length < 3) continue;
      const dom = registrable(c[1]);
      rank.set(dom, +c[0]);
      blocksAny.set(dom, c.slice(2).includes("blocked"));
    }
    return { rank, blocksAny, source: f.slice(0, 10), size: rank.size };
  } catch (e) { return null; }
}
/* ---------- fetch a page -------------------------------------------------- */
async function getPage(offset) {
  const u = URL_BASE + (URL_BASE.includes("?") ? "&" : "?") + `limit=${LIMIT}&offset=${offset}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(u, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.status === 429) { await new Promise(r => setTimeout(r, 8000)); continue; }
      if (!res.ok) return { error: `HTTP ${res.status}` };
      const j = await res.json();
      return { items: j.resources || j.items || j.data || (Array.isArray(j) ? j : []) };
    } catch (e) {
      if (attempt === 1) return { error: e.name === "TimeoutError" ? "timeout" : (e.message || String(e)) };
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  return { error: "unreachable" };
}

/* ---------- derive the full summary from a raw resource array ------------- */
function derive(all, hadError, capped) {
  const real = all.filter(r => !isDemo(hostOf(r)));
  const priced = all.filter(priceRawOf);
  const realPriced = real.filter(priceRawOf);
  const count = (arr, keyFn) => arr.reduce((m, r) => { const k = keyFn(r) || "unknown"; m[k] = (m[k] || 0) + 1; return m; }, {});

  const byType = count(realPriced, typeOf);
  const byNetwork = count(realPriced, r => normNet(accOf(r).network));
  const byScheme = count(realPriced, r => accOf(r).scheme);
  const byAsset = count(realPriced, r => String(accOf(r).asset || "unknown").toLowerCase());

  // ---- rail + asset share (two different denominators, stated separately) --
  const baseMainnet = realPriced.filter(r => normNet(accOf(r).network) === "eip155:8453").length;
  const usdcCount = realPriced.filter(r => { const m = ASSETS[String(accOf(r).asset || "").toLowerCase()]; return m && m.sym === "USDC"; }).length;
  const rail_share_pct = realPriced.length ? +(baseMainnet / realPriced.length * 100).toFixed(1) : null;
  const asset_usdc_share_pct = realPriced.length ? +(usdcCount / realPriced.length * 100).toFixed(1) : null;

  // ---- price buckets + USD distribution ------------------------------------
  const buckets = { usd: [], testnet: 0, unnormalisable: 0 };
  const usdVals = [];
  for (const r of realPriced) {
    const b = priceBucketOf(r);
    if (b === "usd") { const v = usdOf(r); if (v != null) { usdVals.push(v); buckets.usd.push(v); } else buckets.unnormalisable++; }
    else if (b === "testnet") buckets.testnet++;
    else buckets.unnormalisable++;
  }
  const band = v => v <= 0.001 ? "<=0.001" : v <= 0.01 ? "0.001-0.01" : v <= 0.1 ? "0.01-0.1" : v <= 1 ? "0.1-1" : ">1";
  const bands = { "<=0.001": 0, "0.001-0.01": 0, "0.01-0.1": 0, "0.1-1": 0, ">1": 0 };
  for (const v of usdVals) bands[band(v)]++;
  const usd = {
    n: usdVals.length, testnet_excluded: buckets.testnet, unnormalisable: buckets.unnormalisable,
    median: median(usdVals), p25: pct(usdVals, 25), p75: pct(usdVals, 75),
    min: usdVals.length ? Math.min(...usdVals) : null, max: usdVals.length ? Math.max(...usdVals) : null,
    bands,
    note: "Advertised ask per listed endpoint request. USD = raw / 10^decimals for known mainnet stablecoins only; testnet and unknown-asset endpoints excluded from USD stats.",
  };

  // ---- sellers (pay-to) — concentration -----------------------------------
  const payto = count(realPriced, r => (accOf(r).payTo || accOf(r).recipient || "").toLowerCase());
  delete payto[""];
  const sellerList = Object.entries(payto).sort((a, b) => b[1] - a[1]);
  const sellers = {
    distinct: sellerList.length,
    top_share_pct: realPriced.length && sellerList.length ? +(sellerList[0][1] / realPriced.length * 100).toFixed(1) : null,
    top10: sellerList.slice(0, 10).map(([addr, n]) => ({ payTo: addr, endpoints: n })),
    note: "Distinct pay-to addresses among real+priced endpoints. Endpoint counts can be concentrated in a few sellers; this states how many.",
  };

  // ---- reach (from OUR own 50k frame — the reliable mainstream measure) ----
  // Classify every distinct real Bazaar domain: a genuine site in our frame, a
  // hosting/PaaS platform (third-party deploys, not a publisher), or beyond the
  // frame (long-tail / developer infrastructure). No external Tranco file — that
  // introduced a snapshot mismatch; our scanned frame is the honest basis.
  const frame = loadFrame();
  let reach = null, intersection = null;
  if (frame) {
    const seen = new Set();
    let inFrameReal = 0, inFrameHosting = 0, beyondFrame = 0, hostingTotal = 0;
    const hits = [];
    for (const r of realPriced) {
      const d = registrable(hostOf(r)); if (!d || seen.has(d)) continue; seen.add(d);
      if (isHosting(d)) { hostingTotal++; if (frame.rank.has(d)) inFrameHosting++; continue; }
      if (frame.rank.has(d)) {
        inFrameReal++;
        hits.push({ domain: d, rank: frame.rank.get(d), type: typeOf(r), price_usd: usdOf(r),
          asset: (accOf(r).asset || null), network: normNet(accOf(r).network), blocks_crawlers: !!frame.blocksAny.get(d) });
      } else beyondFrame++;
    }
    reach = { distinct_domains: seen.size, in_frame_real: inFrameReal, in_frame_hosting: inFrameHosting,
      hosting_total: hostingTotal, beyond_frame: beyondFrame,
      note: "Distinct real Bazaar domains vs CPI's scanned 50k frame. 'hosting' = PaaS/cloud parents (third-party deploys, not publishers), excluded from the publisher cross-reference. 'beyond_frame' = not in the mainstream 50k (developer/API infrastructure)." };
    hits.sort((a, b) => a.rank - b.rank);
    const bandOf = rk => rk <= 100 ? "1-100" : rk <= 1000 ? "101-1k" : rk <= 10000 ? "1k-10k" : "10k-50k";
    const bandSize = { "1-100": 100, "101-1k": 900, "1k-10k": 9000, "10k-50k": 40000 };
    const byBand = {};
    for (const k of Object.keys(bandSize)) byBand[k] = { in: 0, band_size: bandSize[k], pct: 0 };
    for (const h of hits) byBand[bandOf(h.rank)].in++;
    for (const k of Object.keys(byBand)) byBand[k].pct = +(byBand[k].in / byBand[k].band_size * 100).toFixed(3);
    const blockersThatSell = hits.filter(h => h.blocks_crawlers);
    intersection = {
      frame_source: frame.source, frame_size: frame.size,
      in_frame_total: hits.length,                    // genuine (non-hosting) publisher domains
      in_frame_content: hits.filter(h => h.type === "content").length,
      hosting_excluded: reach.in_frame_hosting,       // frame matches that were PaaS/cloud parents, excluded
      by_rank_band: byBand,
      blockers_that_sell: blockersThatSell.length,
      blockers_that_sell_examples: blockersThatSell.slice(0, 15),
      examples: hits.slice(0, 25),
      note: "Genuine (non-hosting) registrable domains in the latest edition's 50k frame that advertise a machine-payable price. PaaS/cloud parent domains are excluded (counted in hosting_excluded). 'blockers_that_sell' = such domains that also block >=1 AI crawler in robots.txt.",
      hits_written_to: "private/bazaar-domains.json",
    };
    // GATED per-domain table (the paid asset)
    try { fs.mkdirSync("private", { recursive: true }); fs.writeFileSync("private/bazaar-domains.json", JSON.stringify({ date: DATE, frame_source: frame.source, count: hits.length, rows: hits }, null, 2)); } catch (e) {}
  }

  // ---- endpoint index: first_seen / last_seen + churn ---------------------
  let idx = {};
  try { if (fs.existsSync("bazaar-endpoints.json")) idx = JSON.parse(fs.readFileSync("bazaar-endpoints.json", "utf8")); } catch {}
  let newEndpoints = 0;
  const curById = new Map();
  for (const r of realPriced) {
    const id = endpointId(r); curById.set(id, r);
    if (!idx[id]) { idx[id] = { first_seen: DATE, last_seen: DATE }; newEndpoints++; }
    else idx[id].last_seen = DATE;
  }
  try { fs.writeFileSync("bazaar-endpoints.json", JSON.stringify(idx)); } catch {}

  // ---- diff vs most recent prior raw snapshot (adds/removes/price-changes) --
  let vsPrior = null;
  const priors = fs.existsSync("bazaar")
    ? fs.readdirSync("bazaar").filter(f => /^\d{4}-\d{2}-\d{2}\.json\.gz$/.test(f) && f.slice(0, 10) !== DATE).sort() : [];
  if (priors.length) {
    try {
      const pf = priors[priors.length - 1];
      const prev = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join("bazaar", pf))).toString("utf8"));
      const prevPriced = prev.filter(priceRawOf);
      const prevPrice = new Map(prevPriced.map(r => [endpointId(r), Number(priceRawOf(r))]));
      let added = 0, priceChanged = 0;
      for (const [id, r] of curById) { if (!prevPrice.has(id)) added++; else if (prevPrice.get(id) !== Number(priceRawOf(r))) priceChanged++; }
      let removed = 0; for (const id of prevPrice.keys()) if (!curById.has(id)) removed++;
      vsPrior = { prior_date: pf.slice(0, 10), prior_total: prev.length, added, removed, price_changed: priceChanged, net: added - removed };
    } catch (e) { vsPrior = { error: "could not read prior snapshot" }; }
  }

  return {
    date: DATE, generated_utc: new Date().toISOString(), endpoint: URL_BASE,
    total: all.length, priced: priced.length, real_domain: real.length, real_priced: realPriced.length,
    by_type: byType, by_network: byNetwork, by_scheme: byScheme, by_asset: byAsset,
    rail_share_pct, asset_usdc_share_pct,
    price_stats_raw_units: (() => { const pbA = {}; for (const r of realPriced) { const a = String(accOf(r).asset || "unknown").toLowerCase(); const v = Number(priceRawOf(r)); if (Number.isFinite(v)) (pbA[a] ||= []).push(v); } const o = {}; for (const [a, vs] of Object.entries(pbA)) o[a] = { n: vs.length, min: Math.min(...vs), median: median(vs), max: Math.max(...vs) }; return o; })(),
    usd, sellers, reach, intersection, vs_prior: vsPrior, new_endpoints: newEndpoints,
    capped: capped || !!hadError,
    capped_note: capped ? `hit page cap ${MAX_PAGES}; real total may be higher` : (hadError ? `stopped early: ${hadError}` : undefined),
  };
}

/* ---------- write summary + slim series ---------------------------------- */
function persist(summary) {
  fs.writeFileSync(path.join("bazaar", `${DATE}-summary.json`), JSON.stringify(summary, null, 2));
  let series = [];
  if (fs.existsSync("bazaar-index.json")) { try { series = JSON.parse(fs.readFileSync("bazaar-index.json", "utf8")); } catch {} }
  series = series.filter(s => s.date !== DATE);
  series.push({
    date: summary.date, total: summary.total, priced: summary.priced, real_priced: summary.real_priced,
    by_type: summary.by_type, rail_share_pct: summary.rail_share_pct, asset_usdc_share_pct: summary.asset_usdc_share_pct,
    usd_median: summary.usd ? summary.usd.median : null, usd_bands: summary.usd ? summary.usd.bands : null,
    sellers: summary.sellers ? summary.sellers.distinct : null,
    reach: summary.reach ? { distinct_domains: summary.reach.distinct_domains, in_frame_real: summary.reach.in_frame_real, hosting: summary.reach.hosting_total, beyond_frame: summary.reach.beyond_frame } : null,
    in_frame: summary.intersection ? { total: summary.intersection.in_frame_total, content: summary.intersection.in_frame_content, blockers_that_sell: summary.intersection.blockers_that_sell, frame_size: summary.intersection.frame_size } : null,
    vs_prior: summary.vs_prior, new_endpoints: summary.new_endpoints, capped: summary.capped,
  });
  series.sort((a, b) => a.date.localeCompare(b.date));
  fs.writeFileSync("bazaar-index.json", JSON.stringify(series, null, 2));
}

(async () => {
  console.log(`bazaar-snapshot ${DATE}${REPROCESS ? " (reprocess, no fetch)" : ""} — ${URL_BASE}`);
  let all = [], hadError = null, capped = false;

  if (REPROCESS) {
    const raw = path.join("bazaar", `${DATE}.json.gz`);
    const latest = fs.existsSync(raw) ? raw
      : (fs.existsSync("bazaar") ? path.join("bazaar", fs.readdirSync("bazaar").filter(f => /\.json\.gz$/.test(f)).sort().pop() || "") : "");
    if (!latest || !fs.existsSync(latest)) { console.error("  no raw archive to reprocess."); process.exit(1); }
    all = JSON.parse(zlib.gunzipSync(fs.readFileSync(latest)).toString("utf8"));
    console.log(`  reprocessing ${all.length} resources from ${path.basename(latest)}`);
  } else {
    let offset = 0, pages = 0;
    while (pages < MAX_PAGES) {
      const { items, error } = await getPage(offset);
      if (error) { hadError = error; break; }
      all.push(...items); pages++;
      if (pages % 10 === 0) process.stdout.write(`  ${all.length} resources...\r`);
      if (items.length < LIMIT) break;
      offset += LIMIT;
    }
    capped = pages >= MAX_PAGES;
    if (!all.length) {
      console.error(`  no resources captured${hadError ? " (" + hadError + ")" : ""}.`);
      if (hadError && /HTTP 40[13]/.test(hadError)) console.error("  endpoint likely needs CDP creds — set X402_BAZAAR_AUTH.");
      process.exit(1);
    }
    if (hadError) console.log(`  stopped early after ${all.length} resources (${hadError}) — saving what we have.`);
    fs.mkdirSync("bazaar", { recursive: true });
    fs.writeFileSync(path.join("bazaar", `${DATE}.json.gz`), zlib.gzipSync(Buffer.from(JSON.stringify(all))));
  }

  const summary = derive(all, hadError, capped);
  persist(summary);

  const t = summary.by_type, i = summary.intersection, u = summary.usd, s = summary.sellers;
  console.log(`  real+priced ${summary.real_priced}  |  api ${t.api||0} · content ${t.content||0} · mcp ${t.mcp||0}`);
  console.log(`  sellers ${s?s.distinct:"?"} (top ${s?s.top_share_pct:"?"}%)  |  USD median $${u&&u.median!=null?u.median:"?"} (n=${u?u.n:0}, testnet excl ${u?u.testnet_excluded:0})`);
  console.log(`  rail Base ${summary.rail_share_pct}%  |  asset USDC ${summary.asset_usdc_share_pct}%`);
  if (summary.reach) console.log(`  distinct domains ${summary.reach.distinct_domains}: real-in-frame ${summary.reach.in_frame_real} · hosting ${summary.reach.hosting_total} · beyond-frame ${summary.reach.beyond_frame}`);
  if (i) console.log(`  publishers in 50k frame: ${i.in_frame_total} (${i.in_frame_content} content, ${i.hosting_excluded} hosting excluded) — blockers-that-sell: ${i.blockers_that_sell}`);
  else console.log(`  (no editions/ frame — intersection skipped)`);
  if (summary.vs_prior && summary.vs_prior.net != null) console.log(`  vs ${summary.vs_prior.prior_date}: +${summary.vs_prior.added} -${summary.vs_prior.removed} (Δprice ${summary.vs_prior.price_changed}) net ${summary.vs_prior.net>=0?"+":""}${summary.vs_prior.net}`);
  else console.log(`  (first snapshot — series starts here)`);
  console.log(`  wrote bazaar/${DATE}-summary.json, bazaar-index.json, bazaar-endpoints.json${i?", private/bazaar-domains.json":""}`);
  process.exit(0);
})();
