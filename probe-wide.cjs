#!/usr/bin/env node
/**
 * WIDE HONEST PROBE — one identity, many domains.
 * ------------------------------------------------
 * The 49-domain panel keeps the identity matrix (that is the scientific
 * instrument). This probe scales the HONEST leg only: our own signed UA,
 * never an impersonated one, so it can run at thousands of domains without
 * crossing the line the panel deliberately stays behind.
 *
 * Targets: top RANK_N by rank, plus every domain blocking >=1 tracked
 * crawler (they have made an AI decision; payment walls live there).
 *
 * Per domain, two requests, 8s budget, no retries:
 *   1. GET https://domain/          -> status, payment/price/license headers,
 *      X-Robots-Tag, Cloudflare fronting, TollBit markers, 402 price parse
 *   2. GET https://domain/llms.txt  -> status only (adoption signal)
 *
 * Output: wide-probe.json  (summary + compact per-domain results)
 */
const fs = require("fs");

const RANK_N = Number(process.env.PROBE_RANK_N || 2000);
const CONC = 6, SPACING = 150, TIMEOUT = 8000;
const HONEST_UA = "CrawlPriceIndexBot/1.0 (crawl-economy measurement; robots.txt & header study; contact: hello@crawlpriceindex.com)";
const SIGNAL_RE = /price|crawl|pay|charge|toll|402|license|bot-auth|signature-agent|x-payment/i;
const BOTS_START_COL = 2;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { redirect: "manual", signal: ctrl.signal,
      headers: { "User-Agent": HONEST_UA, Accept: "*/*" } });
    const headers = {};
    res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    let snippet = "";
    if (res.status === 402) { try { snippet = (await res.text()).slice(0, 400); } catch (e) {} }
    else { try { res.body?.cancel(); } catch (e) {} }
    return { status: res.status, headers, snippet };
  } catch (e) {
    return { status: 0, headers: {}, snippet: "", err: e.name === "AbortError" ? "timeout" : (e.cause?.code || "err") };
  } finally { clearTimeout(t); }
}

(async () => {
  const csv = fs.readFileSync("scan-robots-full.csv", "utf8").split("\n");
  const header = csv[0].split(",");
  const targets = [];
  for (let i = 1; i < csv.length; i++) {
    const c = csv[i].split(",");
    if (c.length < header.length) continue;
    const rank = Number(c[0]), domain = c[1];
    const blocksAny = c.slice(BOTS_START_COL).some(v => v === "blocked");
    if (rank <= RANK_N || blocksAny) targets.push({ rank, domain });
  }
  console.log(`Wide honest probe: ${targets.length} targets (top ${RANK_N} + all blockers) · 2 req/domain · honest UA only`);

  const out = [];
  const sum = { probed: 0, reachable: 0, p402: 0, priced: [], tollbit: 0, cf_fronted: 0,
    x_robots_noai: 0, llms_txt: 0, payment_headers: 0, license_header: 0 };
  const t0 = Date.now();
  const q = [...targets];

  async function worker() {
    while (q.length) {
      const { rank, domain } = q.shift();
      const home = await get("https://" + domain + "/");
      const row = { rank, domain, home: home.status || home.err };
      if (home.status > 0) {
        sum.reachable++;
        const h = home.headers;
        if (h["server"] === "cloudflare" || h["cf-ray"]) { row.cf = 1; sum.cf_fronted++; }
        const sig = Object.entries(h).filter(([k]) => SIGNAL_RE.test(k)).map(([k, v]) => k + "=" + v).join("|");
        if (sig) { row.sig = sig.slice(0, 300); sum.payment_headers++; }
        if (h["x-robots-tag"] && /noai|noimageai/i.test(h["x-robots-tag"])) { row.noai = 1; sum.x_robots_noai++; }
        if (h["link"] && /rel="?license"?/i.test(h["link"])) { row.license = 1; sum.license_header++; }
        if (/tollbit/i.test(sig) || /tollbit/i.test(home.snippet) || /tollbit/i.test(h["location"] || "")) { row.tollbit = 1; sum.tollbit++; }
        if (home.status === 402) {
          sum.p402++; row.p402 = 1;
          const m = (sig + " " + home.snippet).match(/crawler-price=\s*((?:USD\s*)?\d[\d.]*(?:\s*\/\s*crawl)?|[A-Z]{3}\s*\d[\d.]*)/i);
          if (m) { row.price = m[1].trim(); sum.priced.push(domain + ": " + row.price); }
        }
        const llms = await get("https://" + domain + "/llms.txt");
        if (llms.status === 200) { row.llms = 1; sum.llms_txt++; }
      }
      out.push(row);
      sum.probed++;
      if (sum.probed % 250 === 0)
        console.log(`  ${sum.probed}/${targets.length} · 402s=${sum.p402} priced=${sum.priced.length} cf=${sum.cf_fronted} llms=${sum.llms_txt} · ${Math.round((Date.now() - t0) / 60000)} min`);
      await sleep(SPACING);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));

  out.sort((a, b) => a.rank - b.rank);
  fs.writeFileSync("wide-probe.json", JSON.stringify({
    generated_utc: new Date().toISOString(),
    method: "single honest-identity GET to / and /llms.txt; no impersonation; " + TIMEOUT + "ms budget; no retries",
    rank_n: RANK_N, targets: targets.length, summary: sum, results: out
  }, null, 1));
  console.log(`\nWide probe done in ${Math.round((Date.now() - t0) / 60000)} min.`);
  console.log(`  reachable ${sum.reachable}/${sum.probed} · 402s ${sum.p402} · PRICED ${sum.priced.length} · tollbit ${sum.tollbit}`);
  console.log(`  cloudflare-fronted ${sum.cf_fronted} · X-Robots-Tag noai ${sum.x_robots_noai} · llms.txt ${sum.llms_txt} · license headers ${sum.license_header}`);
  sum.priced.forEach(p => console.log("  PRICE OBSERVED (honest UA) -> " + p));
})();
