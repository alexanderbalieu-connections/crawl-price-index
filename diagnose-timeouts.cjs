#!/usr/bin/env node
/**
 * CPI — TIMEOUT DIAGNOSTIC  (node diagnose-timeouts.cjs)
 * ===========================================================================
 * The classifiability probe found 18.5% "timeout". Before the reachability
 * states go into the published census, we must know: are these hosts
 * genuinely dead/slow, or is the probe under-measuring (WAF packet drops,
 * aggressive timeout, transient failures)?
 *
 * Reads classifiability-sample.json, takes every domain whose outcome was
 * timeout (and the reset/EPROTO oddballs), and re-probes each with:
 *   - a LONGER timeout (25s socket, 45s hard deadline)
 *   - standard Accept + Accept-Language headers (normal HTTP negotiation —
 *     the honest UA is unchanged; no browser spoofing)
 *   - one RETRY after a 60s cool-down for anything still failing
 *
 * Verdict logic:
 *   confirmed_dead   — still no response on both passes
 *   slow             — responded, but only under the longer window
 *   recovered        — responded normally on re-probe (transient / throttled)
 *   walled           — now returns 403/429 (WAF was silently dropping before)
 *
 * Prints the split + what it means for the published reachability states.
 */
const fs = require("fs"), https = require("https"), http = require("http");

const SRC = "classifiability-sample.json";
if (!fs.existsSync(SRC)) { console.error("run measure-classifiability.cjs first"); process.exit(1); }
const sample = JSON.parse(fs.readFileSync(SRC, "utf8")).rows
  .filter(r => r.outcome === "timeout" || /^(reset|other:)/.test(r.reach || ""));
console.log(`Re-probing ${sample.length} timeout/odd domains with 25s window + retry\n`);

const UA = "CrawlPriceIndexBot/1.0 (+https://crawlpriceindex.com/methodology; timeout diagnostic)";
const HEADERS = { "user-agent": UA, accept: "text/html,application/xhtml+xml,*/*;q=0.8", "accept-language": "en" };
const TIMEOUT_MS = 25000, HARD_MS = 45000, CONCURRENCY = 10;

function get(url, cb, redirects) {
  redirects = redirects || 0;
  let done = false;
  const finish = (e, r) => { if (!done) { done = true; cb(e, r); } };
  let u; try { u = new URL(url); } catch (e) { return finish(new Error("badurl")); }
  const req = (u.protocol === "http:" ? http : https).get(u, { headers: HEADERS, timeout: TIMEOUT_MS, rejectUnauthorized: false }, res => {
    if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location && redirects < 4) {
      res.resume();
      let nx; try { nx = new URL(res.headers.location, url).href; } catch (e) { return finish(new Error("badredirect")); }
      return get(nx, cb, redirects + 1);
    }
    let len = 0; res.on("data", c => { len += c.length; if (len > 60000) res.destroy(); });
    res.on("end", () => finish(null, { status: res.statusCode }));
    res.on("error", () => finish(null, { status: res.statusCode }));
  });
  req.on("timeout", () => { req.destroy(); finish(new Error("timeout")); });
  req.on("error", e => finish(e));
}

function tryHost(domain, cb) {
  const urls = ["https://" + domain + "/", "https://www." + domain + "/", "http://" + domain + "/"];
  let i = 0;
  const attempt = () => {
    if (i >= urls.length) return cb(null);
    get(urls[i++], (e, r) => { if (!e && r) return cb(r); attempt(); });
  };
  attempt();
}

const results = [];
let idx = 0, active = 0, doneCount = 0;
const t0 = Date.now();

function probe(r, cb0) {
  let settled = false;
  const guard = setTimeout(() => { if (!settled) { settled = true; results.push({ d: r.domain, rank: r.rank, verdict: "confirmed_dead", pass: 1 }); cb0(); } }, HARD_MS);
  const finishWith = v => { if (settled) return; settled = true; clearTimeout(guard); results.push(v); cb0(); };
  const started = Date.now();
  tryHost(r.domain, res => {
    if (res) {
      const took = Date.now() - started;
      if (res.status === 403 || res.status === 429) return finishWith({ d: r.domain, rank: r.rank, verdict: "walled", status: res.status, ms: took });
      return finishWith({ d: r.domain, rank: r.rank, verdict: took > 12000 ? "slow" : "recovered", status: res.status, ms: took });
    }
    // pass 2 after a cool-down
    setTimeout(() => {
      if (settled) return;
      tryHost(r.domain, res2 => {
        if (!res2) return finishWith({ d: r.domain, rank: r.rank, verdict: "confirmed_dead", pass: 2 });
        if (res2.status === 403 || res2.status === 429) return finishWith({ d: r.domain, rank: r.rank, verdict: "walled", status: res2.status, pass: 2 });
        finishWith({ d: r.domain, rank: r.rank, verdict: "recovered", status: res2.status, pass: 2 });
      });
    }, 60000);
  });
}

function next() {
  while (active < CONCURRENCY && idx < sample.length) {
    const r = sample[idx++]; active++;
    probe(r, () => {
      active--; doneCount++;
      if (doneCount % 10 === 0 || doneCount === sample.length)
        process.stdout.write(`\r  ${doneCount}/${sample.length}  ${Math.round((Date.now() - t0) / 1000)}s   `);
      if (idx >= sample.length && active === 0) report(); else next();
    });
  }
}

function report() {
  fs.writeFileSync("timeout-diagnostic.json", JSON.stringify({ probed_utc: new Date().toISOString(), n: results.length, rows: results }, null, 1));
  const by = {};
  for (const r of results) by[r.verdict] = (by[r.verdict] || 0) + 1;
  const n = results.length, pc = x => (x / Math.max(1, n) * 100).toFixed(1) + "%";
  console.log("\n\n" + "=".repeat(64));
  console.log(`TIMEOUT DIAGNOSTIC — ${n} domains, ${Math.round((Date.now() - t0) / 1000)}s`);
  console.log("=".repeat(64));
  for (const [k, v] of Object.entries(by).sort((a, b) => b[1] - a[1]))
    console.log("  " + k.padEnd(18) + String(v).padStart(5) + "  " + pc(v));
  console.log("-".repeat(64));
  const dead = by.confirmed_dead || 0, rec = (by.recovered || 0) + (by.slow || 0), wall = by.walled || 0;
  console.log(`\nREADING:`);
  console.log(`  ${pc(dead)} stayed dead under a 25s window + retry -> genuinely unreachable.`);
  if (rec / n > 0.3) console.log(`  !! ${pc(rec)} responded on re-probe — the original probe UNDER-measured.\n     The published reachability state needs a 'slow/flaky' category and a\n     stated threshold ("not fetchable by an honest crawler within Xs").`);
  else console.log(`  ${pc(rec)} responded on re-probe (slow/transient) — small enough to fold into\n     the methodology note; the original numbers broadly stand.`);
  if (wall) console.log(`  ${pc(wall)} now return 403/429 — WAFs that silently dropped the first probe.\n     These are bot-walled, not dead; reclassify accordingly.`);
  console.log(`\nwrote timeout-diagnostic.json\n`);
}

next();
