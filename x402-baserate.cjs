#!/usr/bin/env node
/**
 * x402 / pay-per-crawl BASE-RATE TEST  (node x402-baserate.cjs)
 * =========================================================================
 * A curiosity / decision instrument, not a product. It answers one question
 * with numbers instead of vibes: is there actually a pay-per-crawl PRICE
 * market worth indexing yet, or is it a trickle?
 *
 * Three parts, increasingly expensive:
 *
 *   PART A  (zero network, instant)  — reclassify your EXISTING probe panel
 *     from scan-signals.csv. How many of your curated content domains emit a
 *     machine-readable x402 price, versus a human licensing wall, a TollBit
 *     token wall, a hard block, or nothing? This is your base-rate prior and
 *     it costs nothing — it runs on data you already collected.
 *
 *   PART B  (needs network)  --bazaar  — count the opt-in universe. Hit the
 *     Coinbase x402 "Bazaar" discovery endpoint and count REAL, priced,
 *     content-like resources (excluding demos / tutorials / localhost). Run it
 *     today, run it again after 15 Sept; the delta is the adoption signal.
 *
 *   PART C  (needs network)  --live  — re-probe the panel live right now with
 *     an identified-crawler UA and classify what comes back. Unsigned, so it
 *     will not perfectly match your real signed scan — a rough "today" read.
 *
 * Usage:
 *   node x402-baserate.cjs                 # Part A only
 *   node x402-baserate.cjs --bazaar        # A + B
 *   node x402-baserate.cjs --live          # A + C
 *   node x402-baserate.cjs --bazaar --live # everything
 *
 * Env (optional):
 *   X402_BAZAAR_URL   override the discovery endpoint
 *   X402_BAZAAR_AUTH  value for an Authorization header if the endpoint needs one
 *   PROBE_UA          user-agent for --live (default identifies as CPI)
 *   PANEL_PATH        path probed per domain in --live (default "/")
 *
 * Pure Node (global fetch, Node 18+). No dependencies. Reads scan-signals.csv
 * and panel.json from the current directory. Writes nothing unless you pipe it.
 */
const fs = require("fs");

const ARGS = new Set(process.argv.slice(2));
const wantBazaar = ARGS.has("--bazaar");
const wantLive = ARGS.has("--live");

const C = { reset: "\x1b[0m", dim: "\x1b[2m", b: "\x1b[1m", g: "\x1b[32m", y: "\x1b[33m", r: "\x1b[31m", c: "\x1b[36m" };
const bar = (n) => "-".repeat(n);
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + "%" : "—");

// ---- tiny CSV reader (quoted fields; the scan mangles commas inside notes,
//      so we never JSON.parse a note — only pattern-match it) ----------------
function readCSV(path) {
  const text = fs.readFileSync(path, "utf8").replace(/\r/g, "");
  const rows = []; let f = "", row = [], q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { f += '"'; i++; }
      else if (ch === '"') q = false;
      else f += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(f); f = ""; }
    else if (ch === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else f += ch;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  const head = rows.shift();
  return rows.filter(r => r.length === head.length).map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

// ---- classification of one probe response --------------------------------
// Priority order matters: a machine price beats a human wall beats a block.
const BOT_TESTS = new Set(["gptbot", "claudebot", "honest_bot", "claudebot_maxprice", "anthropic-ai", "bytespider"]);

function classifyRow(hdr, note, status) {
  const s = (hdr + " " + note).toLowerCase();
  // machine-readable x402 price: crawler-price header, or an x402 body with an amount
  if (/crawler-price\s*=/.test(s) || /x402version/.test(s) ||
      (/accepts"?\s*:/.test(s) && /(maxamountrequired|amount)"?\s*:/.test(s))) {
    return "x402_price";
  }
  if (/tollbit/.test(s)) return "tollbit_wall";
  if (/payment\s*=\s*free/.test(s)) return "declared_free";
  if (status === "402") return "licensing_wall";       // 402 with no machine price = human wall
  if (["401", "403", "406", "429"].includes(status)) return "hard_block";
  if (["200", "202"].includes(status)) return "served";
  return "error";
}

function extractPrice(hdr, note) {
  let m = (hdr + " " + note).match(/crawler-price\s*=\s*([a-z]{3})\s*([\d.]+)/i);
  if (m) return `${m[1].toUpperCase()} ${m[2]}`;
  m = note.match(/maxamountrequired"?\s*:?\s*"?([\d.]+)/i);
  const a = note.match(/asset"?\s*:?\s*"?([a-z]{2,5})/i);
  if (m) return `${a ? a[1].toUpperCase() : "?"} ${m[1]}`;
  return null;
}

// ---- PART A --------------------------------------------------------------
function partA() {
  if (!fs.existsSync("scan-signals.csv")) {
    console.log(`${C.r}scan-signals.csv not found — run this from the repo root.${C.reset}`);
    return;
  }
  const rows = readCSV("scan-signals.csv");
  const byDomain = {};
  for (const x of rows) {
    if (!BOT_TESTS.has(x.test)) continue;                // bot-facing view only
    const cls = classifyRow(x.signal_headers || "", x.note || "", x.status || "");
    const price = cls === "x402_price" ? extractPrice(x.signal_headers || "", x.note || "") : null;
    const d = (byDomain[x.domain] ||= { classes: {}, price: null });
    d.classes[cls] = (d.classes[cls] || 0) + 1;
    if (price && !d.price) d.price = price;
  }
  const RANK = ["x402_price", "tollbit_wall", "licensing_wall", "declared_free", "hard_block", "served", "error"];
  const LABEL = {
    x402_price: "machine-readable x402 price", tollbit_wall: "TollBit token wall",
    licensing_wall: "human licensing wall (402, no price)", declared_free: "declares payment:free",
    hard_block: "hard block (401/403/406/429)", served: "served (200)", error: "error / unreachable",
  };
  const strongest = d => RANK.find(c => d.classes[c]) || "error";

  const domains = Object.entries(byDomain);
  const tally = {}; RANK.forEach(c => tally[c] = 0);
  const priced = [];
  for (const [dom, d] of domains) {
    const s = strongest(d);
    tally[s]++;
    if (s === "x402_price") priced.push([dom, d.price]);
  }
  const N = domains.length;

  console.log(`\n${C.b}${C.c}PART A — base rate in your existing probe panel${C.reset}  ${C.dim}(from scan-signals.csv, no network)${C.reset}`);
  console.log(bar(70));
  console.log(`${C.dim}Each domain classified by its strongest bot-facing signal.${C.reset}\n`);
  for (const c of RANK) {
    const n = tally[c];
    const col = c === "x402_price" ? C.g : (c === "tollbit_wall" || c === "licensing_wall") ? C.y : C.dim;
    console.log(`  ${col}${String(n).padStart(3)}${C.reset}  ${pct(n, N).padStart(6)}  ${LABEL[c]}`);
  }
  console.log(bar(70));
  const anyWall = tally.x402_price + tally.tollbit_wall + tally.licensing_wall;
  console.log(`  ${C.b}${N}${C.reset} content domains probed`);
  console.log(`  ${C.b}${tally.x402_price}${C.reset} emit a ${C.g}machine-readable x402 price${C.reset}  (${pct(tally.x402_price, N)}) — the only rows a price index could read`);
  console.log(`  ${C.b}${anyWall}${C.reset} return any payment wall (x402 + TollBit + licensing)  (${pct(anyWall, N)})`);
  if (priced.length) {
    console.log(`\n  ${C.g}The priced ones:${C.reset}`);
    for (const [dom, p] of priced) console.log(`    ${dom}  →  ${p || "(price present, unparsed)"}`);
  }
  console.log(`\n  ${C.dim}Read: the gap between "any wall" and "x402 price" is the signal-integrity${C.reset}`);
  console.log(`  ${C.dim}problem — most walls carry no machine price, so they are un-indexable.${C.reset}`);
  return { N, priced: tally.x402_price, anyWall };
}

// ---- PART B --------------------------------------------------------------
async function partB() {
  const url = process.env.X402_BAZAAR_URL ||
    "https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources";
  console.log(`\n${C.b}${C.c}PART B — the opt-in universe (Coinbase x402 Bazaar)${C.reset}  ${C.dim}(live)${C.reset}`);
  console.log(bar(70));
  console.log(`${C.dim}${url}${C.reset}`);
  const headers = { Accept: "application/json" };
  if (process.env.X402_BAZAAR_AUTH) headers.Authorization = process.env.X402_BAZAAR_AUTH;

  let all = [], offset = 0, limit = 100, pages = 0;
  try {
    while (pages < 100) {
      const u = url + (url.includes("?") ? "&" : "?") + `limit=${limit}&offset=${offset}`;
      const res = await fetch(u, { headers });
      if (!res.ok) {
        console.log(`\n  ${C.y}HTTP ${res.status} from the discovery endpoint.${C.reset}`);
        if (res.status === 401 || res.status === 403)
          console.log(`  ${C.dim}Likely needs CDP credentials — set X402_BAZAAR_AUTH, or check the current\n  endpoint at docs.cdp.coinbase.com and pass X402_BAZAAR_URL.${C.reset}`);
        return;
      }
      const j = await res.json();
      const items = j.resources || j.items || j.data || (Array.isArray(j) ? j : []);
      all.push(...items);
      pages++;
      if (items.length < limit) break;
      offset += limit;
    }
  } catch (e) {
    console.log(`\n  ${C.r}Could not reach the endpoint: ${e.message}${C.reset}`);
    console.log(`  ${C.dim}Check the current discovery URL/auth at docs.cdp.coinbase.com and set\n  X402_BAZAAR_URL / X402_BAZAAR_AUTH, then re-run.${C.reset}`);
    return;
  }

  const host = r => { try { return new URL(r.resource || r.url || r.resource?.url || "").hostname; } catch { return ""; } };
  const isDemo = h => !h || /localhost|127\.0\.0\.1|example\.|ngrok|vercel\.app|\.repl\.|demo|test|hello|tutorial|x402\.org|x402\.gitbook/.test(h);
  const priceOf = r => {
    const acc = (r.accepts || [])[0] || {};
    return acc.amount || acc.maxAmountRequired || (r.price != null ? String(r.price) : null);
  };
  const typeOf = r => {
    const s = (host(r) + " " + JSON.stringify(r.accepts || r.resource || "")).toLowerCase();
    if (/\/mcp|mcp/.test(s)) return "mcp";
    if (/\/api|api\./.test(s)) return "api";
    return "content/other";
  };

  const total = all.length;
  const withPrice = all.filter(priceOf).length;
  const realDomain = all.filter(r => !isDemo(host(r)));
  const realPriced = realDomain.filter(priceOf);
  const byType = {}; realPriced.forEach(r => { const t = typeOf(r); byType[t] = (byType[t] || 0) + 1; });

  console.log(`\n  ${C.b}${total}${C.reset} resources listed in the Bazaar`);
  console.log(`  ${C.b}${withPrice}${C.reset} carry a price  (${pct(withPrice, total)})`);
  console.log(`  ${C.b}${realDomain.length}${C.reset} on a real (non-demo) domain  (${pct(realDomain.length, total)})`);
  console.log(`  ${C.b}${realPriced.length}${C.reset} are real ${C.b}and${C.reset} priced  (${pct(realPriced.length, total)}) — the honest opt-in count`);
  console.log(`\n  ${C.dim}Real+priced by type:${C.reset}`);
  for (const [t, n] of Object.entries(byType).sort((a, b) => b[1] - a[1]))
    console.log(`    ${String(n).padStart(4)}  ${t}${t === "content/other" ? C.g + "  ← the pay-per-crawl-relevant slice" + C.reset : ""}`);
  console.log(`\n  ${C.dim}Re-run after 15 Sept. If content/other barely moves, the curve is flat.${C.reset}`);
}

// ---- PART C --------------------------------------------------------------
async function partC() {
  const panel = JSON.parse(fs.readFileSync("panel.json", "utf8")).domains || [];
  const UA = process.env.PROBE_UA || "CrawlPriceIndexBot/1.0 (+https://crawlpriceindex.com; base-rate probe)";
  const path = process.env.PANEL_PATH || "/";
  console.log(`\n${C.b}${C.c}PART C — live re-probe of the panel${C.reset}  ${C.dim}(unsigned, UA="${UA.split(" ")[0]}", path=${path})${C.reset}`);
  console.log(bar(70));
  console.log(`${C.dim}Unsigned request, so gates that key on a signed identity may differ from your real scan.${C.reset}\n`);
  const tally = {}; let priced = [];
  for (const d of panel) {
    let cls = "error", price = null, code = "";
    try {
      const res = await fetch(`https://${d.replace(/^https?:\/\//, "")}${path}`, {
        headers: { "User-Agent": UA, Accept: "*/*" }, redirect: "manual",
      });
      code = String(res.status);
      const hdr = [...res.headers.entries()].map(([k, v]) => `${k}=${v}`).join(" ");
      let body = "";
      try { body = (await res.text()).slice(0, 2000); } catch {}
      cls = classifyRow(hdr, body, code);
      if (cls === "x402_price") price = extractPrice(hdr, body);
    } catch (e) { code = (e.cause && e.cause.code) || "ERR"; cls = "error"; }
    tally[cls] = (tally[cls] || 0) + 1;
    if (price) priced.push([d, price]);
    const col = cls === "x402_price" ? C.g : cls === "served" ? C.dim : C.y;
    console.log(`  ${col}${cls.padEnd(16)}${C.reset} ${code.padStart(4)}  ${d}${price ? "  → " + price : ""}`);
    await new Promise(r => setTimeout(r, 1200));
  }
  console.log(bar(70));
  console.log(`  ${C.b}${priced.length}${C.reset} of ${panel.length} emit a machine-readable x402 price today` +
    (priced.length ? ": " + priced.map(p => p[0]).join(", ") : ""));
}

(async () => {
  console.log(`${C.b}x402 / pay-per-crawl base-rate test${C.reset}  ${C.dim}${new Date ? "" : ""}${C.reset}`);
  const a = partA();
  if (wantBazaar) await partB();
  if (wantLive) await partC();
  console.log(`\n${C.dim}Decision frame: this is a market you would INDEX only if machine-readable`);
  console.log(`prices are (a) present in numbers and (b) growing. Part A is your prior;`);
  console.log(`Part B today-vs-post-15-Sept is the curve. One price in a 30-domain panel`);
  console.log(`after 13 months of live pay-per-crawl is the null hypothesis to beat.${C.reset}\n`);
})();
