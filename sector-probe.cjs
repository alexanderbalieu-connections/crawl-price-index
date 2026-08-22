#!/usr/bin/env node
/**
 * CRAWL PRICE INDEX — SECTOR FEASIBILITY PROBE  (node sector-probe.cjs)
 * =========================================================================
 * Answers one question with a number instead of an opinion: if we tried to
 * derive an industry for every domain in the frame from public sources, how
 * many would we actually get, and WHERE would we get them?
 *
 * Method: take a stratified sample across rank bands, ask Wikidata whether it
 * holds an entity whose official website (P856) is that domain, and if so
 * whether that entity carries an industry (P452) or instance-of (P31).
 * Wikidata is the best free, licensed, citable source for this; it is also
 * the one whose coverage is most obviously skewed toward notable companies,
 * which is exactly the bias we need to size before building anything.
 *
 * Writes sector-probe-results.json and prints coverage per rank band.
 *
 * Usage:
 *   node sector-probe.cjs                 # 150 domains per band (~1,050 total)
 *   node sector-probe.cjs 60              # smaller/faster
 *
 * Polite by construction: one request at a time, 1.2s apart, resumable cache.
 * At the default size this takes roughly 20-25 minutes and hits Wikidata about
 * a thousand times, which is well within their published limits.
 */
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

const PER_BAND = parseInt(process.argv[2] || "150", 10);
const BANDS = [[1,100],[101,1000],[1001,5000],[5001,10000],[10001,25000],[25001,50000]];
const CACHE = "sector-probe-cache.json";
const OUT = "sector-probe-results.json";
const ENDPOINT = "https://query.wikidata.org/sparql";
const UA = "CrawlPriceIndex-feasibility-probe/1.0 (https://crawlpriceindex.com; one-off coverage measurement)";

// ---- load the current edition --------------------------------------------
function latestEdition() {
  if (!fs.existsSync("editions")) return null;
  const f = fs.readdirSync("editions").filter(x => /^\d{4}-\d{2}-\d{2}\.csv\.gz$/.test(x)).sort().pop();
  return f ? path.join("editions", f) : null;
}
const file = latestEdition();
if (!file) { console.error("no editions/*.csv.gz found — run this from the repo root"); process.exit(1); }
const lines = zlib.gunzipSync(fs.readFileSync(file)).toString("utf8").trim().split("\n");
const rows = lines.slice(1).map(l => { const p = l.split(","); return { rank: +p[0], domain: p[1] }; });
console.log(`edition ${path.basename(file)}: ${rows.length} domains`);

// ---- deterministic stratified sample -------------------------------------
// Evenly spaced within each band rather than random, so the run is repeatable
// and a second run with a bigger sample is a superset of the first.
const sample = [];
for (const [lo, hi] of BANDS) {
  const inBand = rows.filter(r => r.rank >= lo && r.rank <= hi);
  const take = Math.min(PER_BAND, inBand.length);
  const step = inBand.length / take;
  for (let i = 0; i < take; i++) sample.push({ ...inBand[Math.floor(i * step)], band: `${lo}-${hi}` });
}
console.log(`sampling ${sample.length} domains across ${BANDS.length} rank bands\n`);

let cache = {};
if (fs.existsSync(CACHE)) { try { cache = JSON.parse(fs.readFileSync(CACHE, "utf8")); } catch (e) {} }

const sleep = ms => new Promise(r => setTimeout(r, ms));

function variants(domain) {
  const bare = domain.replace(/^www\./, "");
  const out = [];
  for (const host of [bare, "www." + bare]) {
    for (const scheme of ["https://", "http://"]) {
      out.push(scheme + host + "/", scheme + host);
    }
  }
  return [...new Set(out)];
}

async function lookup(domain) {
  const values = variants(domain).map(u => `<${u}>`).join(" ");
  const q = `SELECT ?item ?itemLabel ?industryLabel ?typeLabel WHERE {
  VALUES ?site { ${values} }
  ?item wdt:P856 ?site .
  OPTIONAL { ?item wdt:P452 ?industry . }
  OPTIONAL { ?item wdt:P31 ?type . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 12`;
  const url = ENDPOINT + "?query=" + encodeURIComponent(q);
  const res = await fetch(url, { headers: { Accept: "application/sparql-results+json", "User-Agent": UA } });
  if (res.status === 429) { await sleep(15000); return lookup(domain); }
  if (!res.ok) throw new Error("HTTP " + res.status);
  const j = await res.json();
  const b = j.results.bindings;
  if (!b.length) return { found: false };
  const industries = [...new Set(b.map(x => x.industryLabel && x.industryLabel.value).filter(Boolean))];
  const types = [...new Set(b.map(x => x.typeLabel && x.typeLabel.value).filter(Boolean))];
  return { found: true, entity: b[0].itemLabel ? b[0].itemLabel.value : null, industries, types };
}

(async () => {
  let done = 0, errors = 0;
  for (const s of sample) {
    if (cache[s.domain]) { done++; continue; }
    try {
      cache[s.domain] = await lookup(s.domain);
    } catch (e) {
      errors++;
      cache[s.domain] = { found: false, error: String(e.message || e) };
    }
    done++;
    if (done % 25 === 0) {
      fs.writeFileSync(CACHE, JSON.stringify(cache));
      process.stdout.write(`  ${done}/${sample.length} probed\r`);
    }
    await sleep(1200);
  }
  fs.writeFileSync(CACHE, JSON.stringify(cache));

  // ---- report ------------------------------------------------------------
  const byBand = {};
  for (const s of sample) {
    const r = cache[s.domain] || { found: false };
    const b = (byBand[s.band] ||= { n: 0, entity: 0, industry: 0, type: 0 });
    b.n++;
    if (r.found) b.entity++;
    if (r.found && r.industries && r.industries.length) b.industry++;
    if (r.found && r.types && r.types.length) b.type++;
  }
  const industryCounts = {};
  for (const s of sample) {
    const r = cache[s.domain];
    if (r && r.industries) for (const i of r.industries) industryCounts[i] = (industryCounts[i] || 0) + 1;
  }

  console.log("\n\nCOVERAGE BY RANK BAND");
  console.log("-".repeat(72));
  console.log("band".padEnd(14) + "sampled".padStart(8) + "in wikidata".padStart(13) + "has industry".padStart(14) + "has type".padStart(10));
  let tn = 0, te = 0, ti = 0;
  for (const [band, b] of Object.entries(byBand)) {
    tn += b.n; te += b.entity; ti += b.industry;
    console.log(band.padEnd(14) + String(b.n).padStart(8) +
      `${b.entity} (${(100*b.entity/b.n).toFixed(0)}%)`.padStart(13) +
      `${b.industry} (${(100*b.industry/b.n).toFixed(0)}%)`.padStart(14) +
      `${b.type} (${(100*b.type/b.n).toFixed(0)}%)`.padStart(10));
  }
  console.log("-".repeat(72));
  console.log("OVERALL".padEnd(14) + String(tn).padStart(8) +
    `${te} (${(100*te/tn).toFixed(1)}%)`.padStart(13) +
    `${ti} (${(100*ti/tn).toFixed(1)}%)`.padStart(14));
  if (errors) {
    const why = Object.values(cache).map(r => r && r.error).filter(Boolean)[0];
    console.log(`\n${errors} lookup errors (counted as not found). First error: ${why}`);
    if (errors >= sample.length * 0.5) {
      console.log("\n  !! MOST OR ALL LOOKUPS FAILED. This is a connectivity or rate-limit problem,");
      console.log("     not a coverage result. Do not read the table above as evidence of anything.");
      console.log("     Check you can reach query.wikidata.org, delete sector-probe-cache.json, retry.");
    }
  }

  const top = Object.entries(industryCounts).sort((a, b) => b[1] - a[1]).slice(0, 25);
  console.log("\nMOST COMMON WIKIDATA INDUSTRY VALUES FOUND");
  console.log("-".repeat(72));
  for (const [k, v] of top) console.log(`  ${String(v).padStart(4)}  ${k}`);
  console.log(`\n  ${Object.keys(industryCounts).length} distinct industry values across ${ti} classified domains`);
  console.log("  (a controlled vocabulary would have to map these down to ~15 sectors)");

  fs.writeFileSync(OUT, JSON.stringify({
    edition: path.basename(file), per_band: PER_BAND, sampled: tn,
    coverage: byBand, overall: { sampled: tn, in_wikidata: te, with_industry: ti },
    industry_values: industryCounts,
  }, null, 2));
  console.log(`\nwrote ${OUT}`);
  console.log("\nRead the per-band column, not the overall figure. If coverage collapses in the");
  console.log("tail bands, an industry cut across the whole frame is not available at any price —");
  console.log("but a hand-verified panel of the head may be, and that is a different product.");
})();
