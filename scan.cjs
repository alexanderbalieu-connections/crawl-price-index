#!/usr/bin/env node
/**
 * CRAWL PRICE INDEX — PRODUCTION SCANNER v1  (run as: node scan.cjs)
 * ------------------------------------------------------------------
 * Generates the launch dataset:
 *   1. ROBOTS HARVEST (default top 2000 Tranco domains): robots.txt for every
 *      domain, honest research UA, parsed against 18 AI bots.
 *      → scan-robots.csv  (the AI Block-Rate Index raw data)
 *   2. SIGNAL PANEL (fixed ~50-domain research panel only): the spike's
 *      identity matrix to detect 402s, crawler-price quotes, TollBit gates,
 *      payment headers. Deliberately small & documented — this is a
 *      measurement study, not mass UA-spoofing.
 *      → scan-signals.csv
 *   3. SUMMARY (scan-summary.json): headline stats ready to feed the site.
 *
 * Methodology notes (these become the site's /methodology page):
 *   - Bulk scanning self-identifies: CrawlPriceIndexBot with contact info.
 *   - robots.txt is public by design; we fetch it once per domain.
 *   - Panel probes: max 6 requests/domain, 350ms spacing, no retries.
 *   - We record only status codes, headers and tiny body snippets of
 *     402/403 responses. No content is stored or republished.
 *
 * Usage:
 *   node scan.cjs                 # top 2000 + panel
 *   node scan.cjs --top 5000      # bigger robots harvest
 *   node scan.cjs --no-panel      # robots harvest only
 *   node scan.cjs --domains f.txt # use your own newline-separated list
 *
 * Needs: Node 18+, curl + unzip on PATH (both ship with macOS).
 */

const fs = require("fs");
const { execSync } = require("child_process");

// ----------------------------- config --------------------------------------
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const TOP_N = parseInt(opt("--top", "2000"), 10);
const CONCURRENCY = 12;          // robots harvest parallelism
const PANEL_SPACING_MS = 350;    // panel is sequential + polite
const HONEST_UA =
  "CrawlPriceIndexBot/1.0 (crawl-economy measurement; robots.txt & header study; contact: hello@crawlpriceindex TBD)";

const ROBOTS_BOTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-Web",
  "anthropic-ai", "PerplexityBot", "Perplexity-User", "Google-Extended",
  "CCBot", "Bytespider", "Amazonbot", "Applebot-Extended", "meta-externalagent",
  "cohere-ai", "AI2Bot", "Timpibot", "Diffbot",
];

// The fixed research panel (same 50 as the spike → time-series continuity)
const PANEL = [
  "www.nytimes.com","www.theguardian.com","www.reuters.com","apnews.com",
  "www.wired.com","www.theatlantic.com","www.economist.com","www.ft.com",
  "www.businessinsider.com","www.forbes.com","time.com","fortune.com",
  "www.theverge.com","techcrunch.com","arstechnica.com","www.cnet.com",
  "www.zdnet.com","www.tomshardware.com","www.pcgamer.com","www.polygon.com",
  "www.spiegel.de","www.hardwareluxx.de","www.heise.de","www.golem.de",
  "www.lemonde.fr","www.lefigaro.fr","elpais.com","www.corriere.it",
  "www.telegraph.co.uk","www.independent.co.uk","pressgazette.co.uk",
  "www.howtogeek.com","www.makeuseof.com","www.androidpolice.com",
  "www.xda-developers.com","www.slashgear.com","screenrant.com",
  "www.thespruce.com","www.seriouseats.com","www.investopedia.com",
  "www.healthline.com","www.webmd.com","www.digitaltrends.com",
  "stackoverflow.com","www.reddit.com","medium.com","dev.to",
  "www.digiday.com","niemanlab.org",
];

const IDENTITIES = [
  { key: "browser", ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", extraHeaders: {} },
  { key: "gptbot", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot", extraHeaders: {} },
  { key: "claudebot", ua: "Mozilla/5.0; ClaudeBot/1.0; +claudebot@anthropic.com", extraHeaders: {} },
  { key: "honest_bot", ua: HONEST_UA, extraHeaders: {} },
  { key: "claudebot_maxprice", ua: "Mozilla/5.0; ClaudeBot/1.0; +claudebot@anthropic.com", extraHeaders: { "crawler-max-price": "0.001" } },
];

const SIGNAL_HEADER_RE = /price|crawl|pay|charge|toll|402|license|bot-auth|signature-agent/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ----------------------------- http ----------------------------------------
async function get(url, ua, extraHeaders = {}, readBody = false) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, {
      method: "GET", redirect: "follow", signal: ctrl.signal,
      headers: { "User-Agent": ua, Accept: "*/*", ...extraHeaders },
    });
    const headers = {};
    res.headers.forEach((v, k) => (headers[k] = v));
    let bodySnippet = "";
    if (readBody || res.status === 402 || res.status === 403) {
      try { bodySnippet = (await res.text()).slice(0, readBody ? 500000 : 400); } catch {}
    } else { try { res.body?.cancel(); } catch {} }
    return { ok: true, status: res.status, headers, bodySnippet };
  } catch (e) {
    return { ok: false, status: 0, headers: {}, bodySnippet: "", error: e.name === "AbortError" ? "timeout" : (e.cause?.code || e.message) };
  } finally { clearTimeout(t); }
}

function detectStack(h) {
  const tags = [];
  if (h["cf-ray"] || /cloudflare/i.test(h["server"] || "")) tags.push("cloudflare");
  if (/akamai/i.test(h["server"] || "") || h["x-akamai-transformed"]) tags.push("akamai");
  if (/fastly/i.test((h["x-served-by"] || "") + (h["via"] || ""))) tags.push("fastly");
  return tags.join("+") || "other";
}
const signalHeaders = (h) =>
  Object.entries(h).filter(([k]) => SIGNAL_HEADER_RE.test(k))
    .map(([k, v]) => `${k}=${String(v).slice(0, 160)}`).join(" | ");

// ----------------------------- robots parser --------------------------------
function parseRobots(txt) {
  const result = {};
  if (!txt) return result;
  const lines = txt.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim());
  let currentAgents = [], rules = {}, lastWasAgent = false;
  for (const line of lines) {
    const m = line.match(/^user-agent\s*:\s*(.+)$/i);
    if (m) {
      if (!lastWasAgent) currentAgents = [];
      currentAgents.push(m[1].trim().toLowerCase());
      lastWasAgent = true;
      for (const a of currentAgents) if (!rules[a]) rules[a] = { dis: [], allow: [] };
      continue;
    }
    lastWasAgent = false;
    const d = line.match(/^disallow\s*:\s*(.*)$/i);
    const a = line.match(/^allow\s*:\s*(.*)$/i);
    if (d) for (const ag of currentAgents) rules[ag]?.dis.push(d[1].trim());
    if (a) for (const ag of currentAgents) rules[ag]?.allow.push(a[1].trim());
  }
  for (const bot of ROBOTS_BOTS) {
    const r = rules[bot.toLowerCase()];
    if (!r) { result[bot] = "unlisted"; continue; }
    if (r.dis.includes("/")) result[bot] = "blocked";
    else if (r.dis.length === 0 || r.dis.every((x) => x === "")) result[bot] = "allowed";
    else result[bot] = "partial";
  }
  return result;
}

// ----------------------------- domain list ----------------------------------
function loadDomains() {
  const custom = opt("--domains", null);
  if (custom) {
    return fs.readFileSync(custom, "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean).slice(0, TOP_N);
  }
  if (!fs.existsSync("tranco-top-1m.csv")) {
    console.log("Downloading Tranco top-1M list (research-standard domain ranking)...");
    execSync("curl -sL -o tranco.zip https://tranco-list.eu/top-1m.csv.zip && unzip -o -q tranco.zip && mv top-1m.csv tranco-top-1m.csv && rm -f tranco.zip", { stdio: "inherit" });
  }
  const out = [];
  const data = fs.readFileSync("tranco-top-1m.csv", "utf8");
  let start = 0;
  while (out.length < TOP_N && start < data.length) {
    const nl = data.indexOf("\n", start);
    const line = data.slice(start, nl < 0 ? undefined : nl).trim();
    start = nl < 0 ? data.length : nl + 1;
    const comma = line.indexOf(",");
    if (comma > 0) out.push(line.slice(comma + 1));
  }
  return out;
}

// ----------------------------- main ----------------------------------------
(async () => {
  const t0 = Date.now();
  const domains = loadDomains();
  console.log(`Robots harvest: ${domains.length} domains, concurrency ${CONCURRENCY}\n`);

  // --- 1) robots harvest ---
  const robotsRows = [["rank", "domain", ...ROBOTS_BOTS]];
  const blockCounts = Object.fromEntries(ROBOTS_BOTS.map((b) => [b, 0]));
  let fetched = 0, done = 0;
  const queue = domains.map((d, i) => ({ d, rank: i + 1 }));

  async function worker() {
    while (queue.length) {
      const { d, rank } = queue.shift();
      const r = await get(`https://${d}/robots.txt`, HONEST_UA, {}, true);
      if (r.ok && r.status === 200 && r.bodySnippet && !/^\s*</.test(r.bodySnippet)) {
        fetched++;
        const v = parseRobots(r.bodySnippet);
        robotsRows.push([rank, d, ...ROBOTS_BOTS.map((b) => v[b] || "unlisted")]);
        for (const b of ROBOTS_BOTS) if (v[b] === "blocked") blockCounts[b]++;
      } else {
        robotsRows.push([rank, d, ...ROBOTS_BOTS.map(() => "no_robots")]);
      }
      done++;
      if (done % 100 === 0) console.log(`  robots: ${done}/${domains.length} (${fetched} parsed) — ${Math.round((Date.now() - t0) / 1000)}s`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  fs.writeFileSync("scan-robots.csv", robotsRows.map((r) => r.join(",")).join("\n"));
  console.log(`\nRobots harvest done: ${fetched}/${domains.length} parsed → scan-robots.csv`);

  // --- 2) signal panel ---
  const signalRows = [["domain", "test", "status", "stack", "signal_headers", "note"]];
  const findings = { p402: [], prices: [], tollbit: [], paymentHeaders: [], maxpriceFlips: [] };
  if (!flag("--no-panel")) {
    console.log(`\nSignal panel: ${PANEL.length} domains x ${IDENTITIES.length} identities (polite, sequential)\n`);
    for (const [i, domain] of PANEL.entries()) {
      const statuses = {};
      for (const id of IDENTITIES) {
        const res = await get(`https://${domain}/`, id.ua, id.extraHeaders, false);
        statuses[id.key] = res.status;
        const sig = signalHeaders(res.headers);
        const note = res.status === 402 ? res.bodySnippet.replace(/[\r\n,]+/g, " ").slice(0, 250) : "";
        signalRows.push([domain, id.key, res.status || res.error, detectStack(res.headers), sig, note]);
        if (res.status === 402) findings.p402.push(`${domain}[${id.key}]`);
        const priceMatch = sig.match(/crawler-price=([^|]+)/i);
        if (priceMatch) findings.prices.push(`${domain}: ${priceMatch[1].trim()}`);
        if (/tollbit/i.test(sig + res.bodySnippet)) findings.tollbit.push(`${domain}[${id.key}]`);
        if (/(^|\| )payment=/i.test(sig)) findings.paymentHeaders.push(`${domain}: ${sig}`);
        await sleep(PANEL_SPACING_MS);
      }
      if (statuses["claudebot"] !== statuses["claudebot_maxprice"])
        findings.maxpriceFlips.push(`${domain}: claudebot=${statuses["claudebot"]} +maxprice=${statuses["claudebot_maxprice"]}`);
      console.log(`  [${i + 1}/${PANEL.length}] ${domain} b:${statuses["browser"]} g:${statuses["gptbot"]} c:${statuses["claudebot"]} h:${statuses["honest_bot"]} c$:${statuses["claudebot_maxprice"]}`);
    }
    fs.writeFileSync("scan-signals.csv", signalRows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n"));
  }

  // --- 3) summary ---
  const summary = {
    generated_utc: new Date().toISOString(),
    tranco_top_n: domains.length,
    robots_parsed: fetched,
    block_rates: Object.fromEntries(
      Object.entries(blockCounts)
        .map(([b, n]) => [b, { blocked: n, rate_pct: +(100 * n / Math.max(fetched, 1)).toFixed(1) }])
        .sort((a, b) => b[1].blocked - a[1].blocked)
    ),
    panel: findings,
    runtime_s: Math.round((Date.now() - t0) / 1000),
  };
  fs.writeFileSync("scan-summary.json", JSON.stringify(summary, null, 2));

  console.log("\n" + "=".repeat(70));
  console.log("SCAN COMPLETE");
  console.log("=".repeat(70));
  console.log(`Domains: ${domains.length} | robots parsed: ${fetched} | runtime: ${summary.runtime_s}s`);
  console.log("\nTop block-rates:");
  Object.entries(summary.block_rates).slice(0, 6).forEach(([b, v]) => console.log(`  ${b.padEnd(20)} ${v.rate_pct}%  (${v.blocked})`));
  console.log(`\nPanel: 402s=${findings.p402.length} | price quotes=${findings.prices.length} | tollbit=${findings.tollbit.length} | maxprice-flips=${findings.maxpriceFlips.length}`);
  findings.prices.forEach((p) => console.log("  PRICE OBSERVED → " + p));
  console.log("\nFiles: scan-robots.csv, scan-signals.csv, scan-summary.json — send all three to Claude.");
})();
