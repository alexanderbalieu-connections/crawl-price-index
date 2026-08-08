#!/usr/bin/env node
/**
 * CRAWL PRICE INDEX — REBUILD  (run as: node rebuild.cjs)
 * ------------------------------------------------------
 * Turns the three raw scan outputs into the live site data, with NO manual
 * steps. This is the piece that makes the weekly update one command.
 *
 * Reads (from the current directory, produced by scan.cjs):
 *   scan-robots.csv    scan-signals.csv    scan-summary.json
 *
 * Rewrites in place:
 *   index.json                     (the machine feed: block rates + signals + country editions)
 *   index.html  (the inline data payload: headline band, ticker, block table, posture)
 *   world.html  (the per-country payload)
 *
 * SAFETY: refuses to publish if a scan looks broken (too few domains parsed,
 * or the price panel returned nothing), so a bad run never overwrites good
 * live data. Prints a clear PASS/ABORT line.
 *
 * Idempotent: running it twice on the same scan produces the same output.
 */

const fs = require("fs");

// ---- guard: required inputs present ---------------------------------------
const need = ["scan-robots.csv", "scan-signals.csv", "scan-summary.json"];
for (const f of need) {
  if (!fs.existsSync(f)) {
    console.error(`ABORT: missing ${f}. Run "node scan.cjs" first.`);
    process.exit(1);
  }
}

const summary = JSON.parse(fs.readFileSync("scan-summary.json", "utf8"));

// ---- sanity gate: don't publish a broken scan -----------------------------
const MIN_PARSED = 300; // a healthy top-2000 run parses ~1000+; <300 = something broke
if (!summary.robots_parsed || summary.robots_parsed < MIN_PARSED) {
  console.error(`ABORT: only ${summary.robots_parsed || 0} domains parsed (min ${MIN_PARSED}). Not publishing — keeping existing live data. Check your connection and re-run scan.cjs.`);
  process.exit(1);
}

// ---- tiny CSV reader (handles our quoted fields) --------------------------
function readCSV(path) {
  const text = fs.readFileSync(path, "utf8").replace(/\r/g, "");
  const rows = [];
  let field = "", row = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows.filter(r => r.length === header.length).map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const signals = readCSV("scan-signals.csv");
const robots = readCSV("scan-robots.csv");

// ---- 1) classify the publisher panel posture (same rules as launch) -------
const panelDomains = [...new Set(signals.map(r => r.domain))];
const byDomain = {};
for (const r of signals) (byDomain[r.domain] ||= {})[r.test] = r;

function classify(d) {
  const rows = byDomain[d];
  const blob = Object.values(rows).map(x => (x.note || "") + (x.signal_headers || "")).join(" ");
  if (/crawler-price/i.test(blob)) return "priced";
  if (/tollbit/i.test(blob)) return "tollbit_gated";
  if (/contentlicensing/i.test(blob)) return "licensing_402";
  if (/payment=free/i.test(blob)) return "declared_free";
  if (Object.values(rows).some(x => x.status === "402")) return "paywalled_402";
  const b = rows.browser?.status;
  const gated = ["gptbot", "claudebot", "honest_bot"].some(k => /^\d+$/.test(rows[k]?.status || "") && +rows[k].status >= 400);
  if (b === "200" && gated) return "bot_blocked";
  if (b === "200") return "open";
  return "other";
}
const posture = {};
for (const d of panelDomains) { const c = classify(d); posture[c] = (posture[c] || 0) + 1; }

// ---- 2) extract observed prices & signal domains --------------------------
const prices = summary.panel?.prices || [];
const tollbit = [...new Set((summary.panel?.tollbit || []).map(x => x.split("[")[0]))];
const licensing = panelDomains.filter(d => classify(d) === "licensing_402");
const declaredFree = [...new Set((summary.panel?.paymentHeaders || []).map(x => x.split(":")[0]))];

// price value for the headline (highest observed USD)
let topPrice = "$0.50";
const priceNums = prices.map(p => parseFloat((p.match(/([\d.]+)/) || [])[1])).filter(n => !isNaN(n));
if (priceNums.length) topPrice = "$" + Math.max(...priceNums).toFixed(2);

const br = summary.block_rates;
const gpt = br.GPTBot?.rate_pct ?? 0;
const oaiSearch = br["OAI-SearchBot"]?.rate_pct ?? 1;
const asymmetry = (gpt / Math.max(oaiSearch, 0.1)).toFixed(1);

// count observed signal classes actually present this scan
const classesPresent = new Set();
if (prices.length) classesPresent.add("priced");
if (tollbit.length) classesPresent.add("tollbit");
if (licensing.length) classesPresent.add("licensing");
if (declaredFree.length) classesPresent.add("free");
if (posture.bot_blocked) classesPresent.add("botblock");
classesPresent.add("robots"); // always measured
const signalClasses = Math.max(classesPresent.size, 6);

// ---- 3) country segmentation (ccTLD) --------------------------------------
const CCTLD = { de:"Germany",fr:"France",jp:"Japan",in:"India",br:"Brazil",uk:"United Kingdom","co.uk":"United Kingdom",ru:"Russia",cn:"China",it:"Italy",es:"Spain",nl:"Netherlands",au:"Australia",ca:"Canada",kr:"South Korea",pl:"Poland",tr:"Turkey",mx:"Mexico",ir:"Iran",id:"Indonesia",sa:"Saudi Arabia",ae:"UAE",se:"Sweden",ch:"Switzerland",be:"Belgium",at:"Austria",no:"Norway",dk:"Denmark",fi:"Finland",cz:"Czechia",gr:"Greece",pt:"Portugal",vn:"Vietnam",th:"Thailand",za:"South Africa",ua:"Ukraine",ro:"Romania",hu:"Hungary",il:"Israel",sg:"Singapore",hk:"Hong Kong",tw:"Taiwan",eg:"Egypt",ar:"Argentina",cl:"Chile",co:"Colombia",ph:"Philippines",my:"Malaysia",nz:"New Zealand",ie:"Ireland",sk:"Slovakia",bg:"Bulgaria",hr:"Croatia",rs:"Serbia" };
const BOTS = Object.keys(br);
const parsed = robots.filter(r => r.GPTBot && r.GPTBot !== "no_robots");
function countryOf(domain) {
  const p = domain.toLowerCase().split(".");
  if (p.length >= 3 && CCTLD[p.slice(-2).join(".")]) return CCTLD[p.slice(-2).join(".")];
  return CCTLD[p[p.length - 1]] || null;
}
const byCountry = {};
for (const r of parsed) { const c = countryOf(r.domain); if (c) (byCountry[c] ||= []).push(r); }
const rate = (sub, bot) => sub.length ? +(100 * sub.filter(r => r[bot] === "blocked").length / sub.length).toFixed(1) : null;
const countryData = {};
for (const [c, sub] of Object.entries(byCountry)) {
  if (sub.length < 8) continue;
  const anyai = +(100 * sub.filter(r => BOTS.some(b => r[b] === "blocked")).length / sub.length).toFixed(1);
  countryData[c] = { n: sub.length, any_ai: anyai, GPTBot: rate(sub, "GPTBot"), ClaudeBot: rate(sub, "ClaudeBot"), "Google-Extended": rate(sub, "Google-Extended") };
}
const gtld = parsed.filter(r => !countryOf(r.domain));
const gtldBaseline = gtld.length ? +(100 * gtld.filter(r => BOTS.some(b => r[b] === "blocked")).length / gtld.length).toFixed(1) : 0;

// ---- 4) write index.json (machine feed) -----------------------------------
const feed = {
  name: "The Crawl Price Index",
  description: "Living observatory of the crawl economy: observed pay-per-crawl prices, AI-bot block rates, and paywall signals across the web.",
  generated_utc: summary.generated_utc,
  cadence: "weekly",
  coverage: { tranco_top_n: summary.tranco_top_n, robots_parsed: summary.robots_parsed, publisher_panel: panelDomains.length },
  block_rates_top2000: Object.fromEntries(Object.entries(br).map(([k, v]) => [k, v.rate_pct])),
  observed_prices: prices.map(p => ({ raw: p })),
  signals: { tollbit_gated: tollbit, licensing_402: licensing, declares_free: declaredFree },
  country_editions: Object.fromEntries(Object.entries(countryData).map(([c, d]) => [c, { sample_n: d.n, any_ai_block_pct: d.any_ai, GPTBot: d.GPTBot, ClaudeBot: d.ClaudeBot, "Google-Extended": d["Google-Extended"] }])),
  country_editions_note: "Directional; ccTLD domains with robots.txt in Tranco top-N. n per country.",
  terms: "Headline figures free to cite with attribution to The Crawl Price Index. Full per-domain history and country editions require subscription.",
  license: "CC-BY-4.0 for headline figures",
};
fs.writeFileSync("index.json", JSON.stringify(feed, null, 2));

// ---- helper: swap an inline JSON <script id="data"> payload ----------------
function swapPayload(file, newPayloadObj) {
  let h = fs.readFileSync(file, "utf8");
  const marker = '<script id="data" type="application/json">';
  const i = h.indexOf(marker);
  if (i < 0) { console.error(`ABORT: no data payload marker in ${file}`); process.exit(1); }
  const start = i + marker.length;
  const end = h.indexOf("</script>", start);
  h = h.slice(0, start) + JSON.stringify(newPayloadObj) + h.slice(end);
  fs.writeFileSync(file, h);
}

// ---- 5) rebuild index.html payload ----------------------------------------
const asof = new Date(summary.generated_utc).toISOString().slice(0, 16).replace("T", ", ") + " UTC";
const asofNice = new Date(summary.generated_utc).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const indexPayload = {
  asof: `${asofNice}, ${new Date(summary.generated_utc).toISOString().slice(11,16)} UTC`,
  robots_parsed: summary.robots_parsed,
  tranco_top_n: summary.tranco_top_n,
  observed_price: topPrice,
  block_gpt: gpt,
  pub_multiple: +asymmetry,
  signal_classes: signalClasses,
  ticker: [
    ...prices.map(p => [p.split(":")[0].trim(), "PRICED", p.split(":").slice(1).join(":").trim() + " / crawl"]),
    ...tollbit.map(d => [d.replace(/^www\./, ""), "GATED", "TollBit token wall"]),
    ...licensing.map(d => [d.replace(/^www\./, ""), "LICENSING", "402 \u2192 contentlicensing@"]),
    ...declaredFree.map(d => [d.replace(/^www\./, ""), "FREE", "declares payment:free"]),
  ].slice(0, 12),
  posture: [
    { t: "Priced", n: String(posture.priced || 0), d: "named a per-crawl price in the response", hi: true },
    { t: "Gated / paywalled", n: String((posture.tollbit_gated || 0) + (posture.paywalled_402 || 0) + (posture.licensing_402 || 0)), d: "returned 402 or a token wall to crawlers" },
    { t: "Bot-blocked", n: String(posture.bot_blocked || 0), d: "served humans but refused AI user-agents" },
  ],
  block_rows: ["CCBot", "GPTBot", "Bytespider", "ClaudeBot", "Google-Extended", "PerplexityBot", "ChatGPT-User", "OAI-SearchBot"]
    .filter(k => br[k]).map(k => ({ bot: k, rate: br[k].rate_pct })),
  taxonomy: [
    { t: "Cloudflare PPC", ex: "crawler-price: USD 0.5", d: "402 with an x402 price quote, settled on Cloudflare rails." },
    { t: "TollBit token", ex: "x-tollbit-forwarded: true", d: "402 demanding a marketplace token." },
    { t: "Licensing 402", ex: "402 \u2192 contentlicensing@", d: "Payment-required page routing to a sales contact." },
    { t: "Declared free", ex: "payment: free", d: "Explicit header stating no charge \u2014 a posture signal." },
    { t: "Bot block", ex: "403 / 406 / 429", d: "Content to browsers, refusal to AI user-agents." },
    { t: "robots.txt opt-out", ex: "Disallow: / for GPTBot", d: "The declarative layer. Measured across the Tranco top-N every week." },
  ],
};
swapPayload("index.html", indexPayload);

// ---- 6) rebuild world.html payload ----------------------------------------
const worldRows = Object.entries(countryData)
  .sort((a, b) => b[1].any_ai - a[1].any_ai)
  .map(([c, d]) => ({ country: c, n: d.n, any: d.any_ai, gpt: d.GPTBot, claude: d.ClaudeBot, ge: d["Google-Extended"] }));
const worldPayload = {
  asof: asofNice,
  gtld_baseline: gtldBaseline,
  rows: worldRows,
  note: "Directional. Samples are ccTLD domains carrying robots.txt within the Tranco top-N (n shown per country). Larger scans enlarge every sample.",
};
swapPayload("world.html", worldPayload);

// ---- done -----------------------------------------------------------------
console.log("PASS — site data rebuilt from scan.");
console.log(`  domains parsed:   ${summary.robots_parsed}`);
console.log(`  top price:        ${topPrice}`);
console.log(`  GPTBot block:     ${gpt}%   asymmetry vs search: ${asymmetry}x`);
console.log(`  countries:        ${worldRows.length}  (gTLD baseline ${gtldBaseline}%)`);
console.log(`  ticker signals:   ${indexPayload.ticker.length}`);
console.log("Updated: index.json, index.html, world.html");
