#!/usr/bin/env node
/**
 * CRAWL PRICE INDEX — LARGE-SCALE RESUMABLE RUNNER  (node run-big.cjs)
 * ------------------------------------------------------------------
 * Drives a big scan (default 50,000 domains) in resumable chunks with
 * adaptive backoff, so it survives sleep/wifi blips and doesn't get your
 * home IP flagged. Designed to be launched automatically by launchd.
 *
 * How it protects a big weekly run:
 *   - CHECKPOINTS after every chunk to .scan-progress.json. If the Mac
 *     sleeps or the run is killed, the next launch RESUMES from the last
 *     completed chunk instead of restarting.
 *   - ADAPTIVE BACKOFF: watches the rate of 429/403 responses per chunk.
 *     If sites start pushing back, it widens the spacing automatically and
 *     narrows concurrency — slower but sustainable on a residential IP.
 *   - On completion it hands off to rebuild.cjs (which has its own safety
 *     gate) so a partial/thin run never overwrites good live data.
 *
 * Config (scan-config.json): top_n, chunk_size, base_spacing_ms, etc.
 * Manual:  node run-big.cjs            (fresh or resume)
 *          node run-big.cjs --fresh    (ignore checkpoint, start over)
 *
 * NOTE: this runner reuses the SAME fetch + robots-parse logic as scan.cjs
 * by requiring its exported internals when run with --lib, but to stay
 * self-contained and robust it re-implements the minimal harvest loop here.
 * The signal panel (small, fixed) is delegated to scan.cjs at the end.
 */

const fs = require("fs");
const { execSync } = require("child_process");

const cfg = JSON.parse(fs.existsSync("scan-config.json") ? fs.readFileSync("scan-config.json", "utf8") : "{}");
const TOP_N = cfg.top_n || 50000;
const CHUNK = cfg.chunk_size || 2500;
let concurrency = cfg.concurrency || 10;
let spacing = cfg.base_spacing_ms || 120;
// Daily time budget: scan for about this long, then stop and checkpoint.
// The next daily run resumes where this one left off. A full TOP_N sweep
// completes over several days, then rebuild+publish, then a fresh cycle.
const TIME_BUDGET_MS = (cfg.daily_minutes || 15) * 60 * 1000;
const PROGRESS = ".scan-progress.json";
const OUT = "scan-robots.csv";
const fresh = process.argv.includes("--fresh");

const ROBOTS_BOTS = ["GPTBot","OAI-SearchBot","ChatGPT-User","ClaudeBot","Claude-Web","anthropic-ai","PerplexityBot","Perplexity-User","Google-Extended","CCBot","Bytespider","Amazonbot","Applebot-Extended","meta-externalagent","cohere-ai","AI2Bot","Timpibot","Diffbot"];
const HONEST_UA = "CrawlPriceIndexBot/1.0 (crawl-economy measurement; robots.txt study; contact: hello@crawlpriceindex.com)";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---- domain list (Tranco) --------------------------------------------------
function loadDomains() {
  if (!fs.existsSync("tranco-top-1m.csv")) {
    console.log("Downloading Tranco top-1M…");
    execSync("curl -sL -o tranco.zip https://tranco-list.eu/top-1m.csv.zip && unzip -o -q tranco.zip && mv top-1m.csv tranco-top-1m.csv && rm -f tranco.zip", { stdio: "inherit" });
  }
  const out = [], data = fs.readFileSync("tranco-top-1m.csv", "utf8");
  let start = 0;
  while (out.length < TOP_N && start < data.length) {
    const nl = data.indexOf("\n", start);
    const line = data.slice(start, nl < 0 ? undefined : nl).trim();
    start = nl < 0 ? data.length : nl + 1;
    const c = line.indexOf(","); if (c > 0) out.push(line.slice(c + 1));
  }
  return out;
}

// ---- fetch + parse (self-contained) ---------------------------------------
async function getRobots(domain) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`https://${domain}/robots.txt`, { redirect: "follow", signal: ctrl.signal, headers: { "User-Agent": HONEST_UA, Accept: "*/*" } });
    let body = "";
    if (res.status === 200) { try { body = (await res.text()).slice(0, 500000); } catch {} }
    else { try { res.body?.cancel(); } catch {} }
    return { status: res.status, body };
  } catch (e) { return { status: 0, body: "", err: e.name === "AbortError" ? "timeout" : (e.cause?.code || "err") }; }
  finally { clearTimeout(t); }
}
function parseRobots(txt) {
  const result = {}; if (!txt) return result;
  const lines = txt.split(/\r?\n/).map(l => l.replace(/#.*$/, "").trim());
  let cur = [], rules = {}, lastAgent = false;
  for (const line of lines) {
    const m = line.match(/^user-agent\s*:\s*(.+)$/i);
    if (m) { if (!lastAgent) cur = []; cur.push(m[1].trim().toLowerCase()); lastAgent = true; for (const a of cur) if (!rules[a]) rules[a] = { dis: [] }; continue; }
    lastAgent = false;
    const d = line.match(/^disallow\s*:\s*(.*)$/i);
    if (d) for (const a of cur) rules[a]?.dis.push(d[1].trim());
  }
  for (const bot of ROBOTS_BOTS) {
    const r = rules[bot.toLowerCase()];
    if (!r) result[bot] = "unlisted";
    else if (r.dis.includes("/")) result[bot] = "blocked";
    else if (r.dis.every(x => x === "")) result[bot] = "allowed";
    else result[bot] = "partial";
  }
  return result;
}

// ---- checkpoint I/O --------------------------------------------------------
function loadProgress() {
  if (fresh || !fs.existsSync(PROGRESS)) return { nextIndex: 0, fetched: 0, startedAt: new Date().toISOString() };
  try { return JSON.parse(fs.readFileSync(PROGRESS, "utf8")); } catch { return { nextIndex: 0, fetched: 0, startedAt: new Date().toISOString() }; }
}
function saveProgress(p) { fs.writeFileSync(PROGRESS, JSON.stringify(p)); }

// ---- main ------------------------------------------------------------------
(async () => {
  const t0 = Date.now();
  const domains = loadDomains();
  const prog = loadProgress();

  // fresh run: write header; resume: append
  if (prog.nextIndex === 0) {
    fs.writeFileSync(OUT, ["rank", "domain", ...ROBOTS_BOTS].join(",") + "\n");
    console.log(`FRESH big scan: ${domains.length} domains, chunk ${CHUNK}`);
  } else {
    console.log(`RESUMING at ${prog.nextIndex}/${domains.length} (${prog.fetched} parsed so far)`);
  }

  let i = prog.nextIndex, fetched = prog.fetched;
  // block counts: if resuming, recompute from the partial CSV already on disk
  const blockCounts = Object.fromEntries(ROBOTS_BOTS.map(b => [b, 0]));
  if (prog.nextIndex > 0 && fs.existsSync(OUT)) {
    const lines = fs.readFileSync(OUT, "utf8").split("\n").slice(1).filter(Boolean);
    for (const ln of lines) {
      const cells = ln.split(",");
      ROBOTS_BOTS.forEach((b, k) => { if (cells[k + 2] === "blocked") blockCounts[b]++; });
    }
  }

  while (i < domains.length) {
    // Daily time budget reached? Stop, keep checkpoint, resume tomorrow.
    if (Date.now() - t0 >= TIME_BUDGET_MS) {
      saveProgress({ nextIndex: i, fetched, startedAt: prog.startedAt });
      const pct = ((i / domains.length) * 100).toFixed(1);
      console.log(`\n⏸  Daily time budget reached at ${i}/${domains.length} (${pct}%). Checkpointed.`);
      console.log(`   Full sweep not complete yet — will resume on the next daily run.`);
      console.log(`   (Nothing published this run; live site unchanged until the sweep finishes.)`);
      process.exit(0);   // clean exit; NOT a full sweep, so no rebuild/publish
    }

    const end = Math.min(i + CHUNK, domains.length);
    const slice = domains.slice(i, end).map((d, k) => ({ d, rank: i + k + 1 }));
    let pushback = 0, ok = 0;
    const rows = [];

    // run this chunk with current concurrency/spacing
    const q = [...slice];
    async function worker() {
      while (q.length) {
        const { d, rank } = q.shift();
        const r = await getRobots(d);
        if (r.status === 429 || r.status === 403) pushback++;
        if (r.status === 200 && r.body && !/^\s*</.test(r.body)) {
          fetched++; ok++;
          const v = parseRobots(r.body);
          for (const b of ROBOTS_BOTS) if (v[b] === "blocked") blockCounts[b]++;
          rows.push([rank, d, ...ROBOTS_BOTS.map(b => v[b] || "unlisted")].join(","));
        } else {
          rows.push([rank, d, ...ROBOTS_BOTS.map(() => "no_robots")].join(","));
        }
        await sleep(spacing);
      }
    }
    await Promise.all(Array.from({ length: concurrency }, worker));
    fs.appendFileSync(OUT, rows.join("\n") + "\n");

    i = end;
    saveProgress({ nextIndex: i, fetched, startedAt: prog.startedAt });

    // adaptive backoff: if >8% of this chunk pushed back, slow down
    const pushRate = pushback / slice.length;
    if (cfg.adaptive_backoff !== false && pushRate > 0.08) {
      spacing = Math.min(spacing * 1.6, 1200);
      concurrency = Math.max(concurrency - 2, 3);
      console.log(`  ⚠ pushback ${(pushRate*100).toFixed(0)}% → easing off: spacing=${spacing|0}ms concurrency=${concurrency}`);
    } else if (pushRate < 0.01 && spacing > (cfg.base_spacing_ms||120)) {
      spacing = Math.max(spacing * 0.9, cfg.base_spacing_ms||120); // recover slowly when calm
    }

    const pct = ((i / domains.length) * 100).toFixed(1);
    console.log(`  ${i}/${domains.length} (${pct}%) · parsed ${fetched} · ${Math.round((Date.now()-t0)/1000)}s · chunk pushback ${(pushRate*100).toFixed(0)}%`);
  }

  // done with harvest — clear checkpoint
  fs.unlinkSync(PROGRESS);
  console.log(`\nRobots harvest complete: ${fetched}/${domains.length} parsed.`);

  // ---- signal panel: reuse scan.cjs's fixed ~50-domain panel via its own run,
  // but WITHOUT re-harvesting 50k. We run scan.cjs restricted to the panel by
  // pointing --domains at a tiny panel file, so it only does the signal probes.
  const PANEL = ["www.nytimes.com","www.theguardian.com","www.reuters.com","apnews.com","www.wired.com","www.theatlantic.com","www.economist.com","www.ft.com","www.forbes.com","time.com","www.theverge.com","techcrunch.com","arstechnica.com","www.tomshardware.com","www.spiegel.de","www.hardwareluxx.de","www.heise.de","www.lemonde.fr","elpais.com","www.telegraph.co.uk","www.independent.co.uk","www.thespruce.com","www.seriouseats.com","www.investopedia.com","www.healthline.com","stackoverflow.com","www.reddit.com","medium.com","www.digiday.com","niemanlab.org"];
  fs.writeFileSync(".panel.txt", PANEL.join("\n"));
  let panelFindings = { p402: [], prices: [], tollbit: [], paymentHeaders: [], maxpriceFlips: [] };
  try {
    // scan.cjs with --domains runs BOTH robots + panel on just these ~30 domains
    // (fast), and writes scan-signals.csv + scan-summary.json. We keep its
    // scan-signals.csv (the panel) but OVERWRITE its summary below with our
    // full 50k block-rate numbers.
    execSync("node scan.cjs --domains .panel.txt", { stdio: "inherit" });
    if (fs.existsSync("scan-summary.json")) {
      panelFindings = JSON.parse(fs.readFileSync("scan-summary.json", "utf8")).panel || panelFindings;
    }
  } catch (e) {
    console.log("(panel probe step had an issue — block-rate data is still complete)");
  } finally {
    try { fs.unlinkSync(".panel.txt"); } catch {}
  }

  // ---- write the REAL summary from our full 50k harvest ----
  const summary = {
    generated_utc: new Date().toISOString(),
    tranco_top_n: domains.length,
    robots_parsed: fetched,
    block_rates: Object.fromEntries(
      Object.entries(blockCounts)
        .map(([b, n]) => [b, { blocked: n, rate_pct: +(100 * n / Math.max(fetched, 1)).toFixed(1) }])
        .sort((a, b) => b[1].blocked - a[1].blocked)
    ),
    panel: panelFindings,
    runtime_s: Math.round((Date.now() - t0) / 1000),
  };
  fs.writeFileSync("scan-summary.json", JSON.stringify(summary, null, 2));

  console.log(`\nBig scan done: ${fetched}/${domains.length} parsed in ${summary.runtime_s}s.`);
  console.log("Top block rates:");
  Object.entries(summary.block_rates).slice(0, 5).forEach(([b, v]) => console.log(`  ${b.padEnd(18)} ${v.rate_pct}%`));
  console.log("\nNext: node rebuild.cjs   (safely publishes if the scan is healthy)");
})();
