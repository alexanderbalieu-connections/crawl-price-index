#!/usr/bin/env node
/**
 * CPI — CLASSIFIABILITY PROBE v3  (node measure-classifiability.cjs [N])
 * ===========================================================================
 * Two jobs:
 *  1. How much of the 50k frame is CLASSIFIABLE from its own homepage?
 *  2. Split the ambiguous `no_robots` state into real reachability states
 *     (dns_failure / refused / tls_error / timeout / alive) — a fix to CPI's
 *     core denominator, independent of the sector project.
 *
 * v3 fixes three undercount bugs in v2:
 *   - tries https://domain, then https://www.domain, then http://domain
 *     (a large share of sites serve only on www, or only on http)
 *   - captures the ERROR CODE (ENOTFOUND vs ECONNREFUSED vs TLS vs timeout)
 *     so "unreachable" stops being one opaque bucket
 *   - oversamples the head, which proportional sampling barely touched
 *
 * Obeys robots.txt for our own UA. One host at a time, honest identification,
 * hard per-domain deadline so nothing can wedge. Read-only; no paid API.
 */
const zlib = require("zlib"), fs = require("fs"), https = require("https"), http = require("http");

const N = parseInt(process.argv[2] || "1500", 10);
const EDITION = process.argv[3] || latestEdition();
const UA = "CrawlPriceIndexBot/1.0 (+https://crawlpriceindex.com/methodology; sector-classifiability probe)";
const CONCURRENCY = 12;
const TIMEOUT_MS = 10000;
const HARD_DEADLINE_MS = 32000;

function latestEdition() {
  const f = fs.readdirSync("editions").filter(x => x.endsWith(".csv.gz")).sort().pop();
  if (!f) { console.error("no editions/*.csv.gz found"); process.exit(1); }
  return "editions/" + f;
}

const rows = zlib.gunzipSync(fs.readFileSync(EDITION)).toString("utf8").split("\n").filter(Boolean)
  .slice(1).map(l => { const p = l.split(","); return { rank: +p[0], domain: (p[1] || "").toLowerCase(), gptbot: p[2] }; })
  .filter(r => r.domain);

/* Oversample the head: proportional sampling gave the top-100 a single domain.
   The head is the most-scrutinised part of the product, so it gets a floor.
   Band weights are recorded so results can be re-weighted back to the frame. */
const BANDS = [[1, 100], [101, 1000], [1001, 10000], [10001, 50000]];
const FLOOR = { "1-100": 60, "101-1000": 120, "1001-10000": 240 };
let sample = [];
for (const [lo, hi] of BANDS) {
  const pool = rows.filter(r => r.rank >= lo && r.rank <= hi);
  const key = lo + "-" + hi;
  const prop = Math.round(N * (pool.length / rows.length));
  const take = Math.min(pool.length, Math.max(prop, FLOOR[key] || 0));
  for (let i = 0; i < take; i++) sample.push(Object.assign({ band: key, band_pool: pool.length }, pool[Math.floor(pool.length * (i + 0.5) / take)]));
}
sample = sample.filter(Boolean);
console.log(`Probing ${sample.length} domains from ${EDITION} (obeying robots.txt, ${CONCURRENCY} at a time)`);
console.log(`Head oversampled; band weights recorded for re-weighting.\n`);

function robotsAllows(txt) {
  if (!txt) return true;
  const lines = txt.split(/\r?\n/).map(l => l.replace(/#.*$/, "").trim()).filter(Boolean);
  let groups = [], cur = null;
  for (const l of lines) {
    const m = l.match(/^([A-Za-z-]+)\s*:\s*(.*)$/); if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === "user-agent") { if (!cur || cur.rules.length) { cur = { uas: [], rules: [] }; groups.push(cur); } cur.uas.push(v.toLowerCase()); }
    else if (cur && (k === "disallow" || k === "allow")) cur.rules.push({ allow: k === "allow", path: v });
  }
  const pick = groups.find(g => g.uas.some(u => u.includes("crawlpriceindex"))) || groups.find(g => g.uas.includes("*"));
  if (!pick) return true;
  let blocked = false;
  for (const r of pick.rules) { if (r.path === "") continue; if (r.path === "/") blocked = !r.allow; }
  return !blocked;
}

function classifyErr(e) {
  const c = (e && (e.code || e.message)) || "unknown";
  if (/ENOTFOUND|EAI_AGAIN/.test(c)) return "dns_failure";
  if (/ECONNREFUSED/.test(c)) return "refused";
  if (/ECONNRESET|EPIPE/.test(c)) return "reset";
  if (/CERT|SSL|TLS|ERR_TLS|altnames|self.signed/i.test(c)) return "tls_error";
  if (/timeout/i.test(c)) return "timeout";
  if (/EHOSTUNREACH|ENETUNREACH/.test(c)) return "unreachable_net";
  return "other:" + String(c).slice(0, 24);
}

function get(url, cb, redirects) {
  redirects = redirects || 0;
  let done = false;
  const finish = (err, res) => { if (!done) { done = true; cb(err, res); } };
  let u; try { u = new URL(url); } catch (e) { return finish(new Error("badurl")); }
  const lib = u.protocol === "http:" ? http : https;
  const req = lib.get(u, { headers: { "user-agent": UA, accept: "text/html,*/*" }, timeout: TIMEOUT_MS,
                           rejectUnauthorized: false }, res => {
    if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 4) {
      res.resume();
      let next; try { next = new URL(res.headers.location, url).href; } catch (e) { return finish(new Error("badredirect")); }
      return get(next, cb, redirects + 1);
    }
    let body = "", len = 0;
    res.setEncoding("utf8");
    res.on("data", c => { len += c.length; if (len < 400000) body += c; else res.destroy(); });
    res.on("end", () => finish(null, { status: res.statusCode, headers: res.headers, body, url }));
    res.on("error", () => finish(null, { status: res.statusCode, headers: res.headers, body, url }));
  });
  req.on("timeout", () => { req.destroy(); finish(new Error("timeout")); });
  req.on("error", e => finish(e));
}

/* try apex https -> www https -> apex http, stopping at the first success */
function getWithFallback(domain, path, cb) {
  const tries = ["https://" + domain + path, "https://www." + domain + path, "http://" + domain + path];
  let i = 0, firstErr = null;
  const attempt = () => {
    if (i >= tries.length) return cb(firstErr || new Error("unreachable"), null, null);
    const url = tries[i++];
    get(url, (e, r) => {
      if (!e && r) return cb(null, r, url);
      if (!firstErr) firstErr = e;
      attempt();
    });
  };
  attempt();
}

const SCHEMA_SECTOR = /"@type"\s*:\s*"?(NewsMediaOrganization|NewsArticle|OnlineStore|Store|Restaurant|EducationalOrganization|CollegeOrUniversity|GovernmentOrganization|MedicalOrganization|Hospital|BankOrCreditUnion|FinancialService|SoftwareApplication|WebApplication|LocalBusiness|SportsOrganization|NGO|Airline|Hotel|RealEstateAgent|Blog|WebSite|Organization)"?/gi;
const INFORMATIVE = /^(NewsMediaOrganization|NewsArticle|OnlineStore|Store|Restaurant|EducationalOrganization|CollegeOrUniversity|GovernmentOrganization|MedicalOrganization|Hospital|BankOrCreditUnion|FinancialService|SoftwareApplication|WebApplication|SportsOrganization|NGO|Airline|Hotel|RealEstateAgent)$/;
const RTA_RE = /RTA-5042-1996-1400-1577-RTA/i;
const RATING_ADULT_RE = /<meta[^>]+name=["']?rating["']?[^>]+content=["']?(adult|mature|RTA-)/i;
const PLATFORM_RE = /(Shopify|WooCommerce|Magento|PrestaShop|BigCommerce|Squarespace|Wix\.com|WordPress|Ghost|Drupal|Joomla|Salesforce Commerce|Discourse|phpBB|MediaWiki)/i;
const FEED_RE = /<link[^>]+type=["']?application\/(rss|atom)\+xml/i;
const OGTYPE_RE = /<meta[^>]+property=["']?og:type["']?[^>]+content=["']?([a-z.]+)/i;
const ADULT_TLD = new Set(["xxx", "adult", "porn", "sex"]);
const textLen = h => h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
                      .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;

const out = [];
let idx = 0, active = 0, finished = 0;
const t0 = Date.now();
function tick() {
  finished++;
  if (finished % 25 === 0 || finished === sample.length) {
    const el = (Date.now() - t0) / 1000, rate = finished / Math.max(el, .1);
    const eta = Math.max(0, Math.round((sample.length - finished) / Math.max(rate, .01)));
    const cls = out.filter(r => r.outcome === "classifiable").length;
    process.stdout.write(`\r  ${finished}/${sample.length}  ${Math.round(el)}s  ~${eta}s left  ·  classifiable: ${cls}    `);
  }
  if (finished % 100 === 0) { try { fs.writeFileSync("classifiability-partial.json", JSON.stringify({ partial: true, done: finished, rows: out })); } catch (e) {} }
}

function next() {
  while (active < CONCURRENCY && idx < sample.length) {
    const r = sample[idx++]; active++;
    probe(r, () => { active--; if (idx >= sample.length && active === 0) done(); else next(); });
  }
}

function probe(r, cb0) {
  const rec = { rank: r.rank, band: r.band, band_pool: r.band_pool, domain: r.domain, robots_state: r.gptbot };
  let settled = false;
  const guard = setTimeout(() => { if (settled) return; settled = true; rec.outcome = rec.outcome || "timeout"; rec.reach = rec.reach || "timeout"; out.push(rec); tick(); cb0(); }, HARD_DEADLINE_MS);
  const cb = () => { if (settled) return; settled = true; clearTimeout(guard); tick(); cb0(); };

  getWithFallback(r.domain, "/robots.txt", (e1, rr) => {
    rec.robots_http = rr ? rr.status : null;
    rec.robots_err = e1 ? classifyErr(e1) : null;
    const allowed = (!rr || rr.status !== 200) ? true : robotsAllows(rr.body);
    rec.we_may_fetch = allowed;
    if (!allowed) { rec.outcome = "disallowed_by_robots"; rec.reach = "alive"; out.push(rec); return cb(); }

    getWithFallback(r.domain, "/", (e2, hr, usedUrl) => {
      if (e2 || !hr) {
        rec.reach = classifyErr(e2);
        rec.outcome = rec.reach === "timeout" ? "timeout" : "unreachable";
        out.push(rec); return cb();
      }
      rec.reach = "alive";
      rec.served_url = usedUrl;
      rec.used_www = /:\/\/www\./.test(usedUrl || "");
      rec.http = hr.status;
      const html = hr.body || "";
      rec.text_len = textLen(html);
      if (hr.status >= 400) { rec.outcome = hr.status === 403 || hr.status === 429 ? "bot_walled" : "http_error"; out.push(rec); return cb(); }
      const ct = String(hr.headers["content-type"] || "");
      if (!/html/i.test(ct)) { rec.outcome = "not_html"; out.push(rec); return cb(); }
      const all = [...new Set([...html.matchAll(SCHEMA_SECTOR)].map(m => m[1]))];
      rec.schema_types = all;
      rec.schema_informative = all.filter(t => INFORMATIVE.test(t));
      rec.og_type = (html.match(OGTYPE_RE) || [])[1] || null;
      rec.platform = (html.match(PLATFORM_RE) || [])[1] || null;
      rec.feed = FEED_RE.test(html);
      rec.declares_adult = RTA_RE.test(html) || RTA_RE.test(String(hr.headers["rating"] || "")) ||
                           RATING_ADULT_RE.test(html) || ADULT_TLD.has(r.domain.split(".").pop());
      rec.outcome = rec.text_len < 200 ? "thin_or_js_shell" : "classifiable";
      out.push(rec); cb();
    });
  });
}

const pc = (n, d) => (n / Math.max(1, d) * 100).toFixed(1) + "%";

function done() {
  fs.writeFileSync("classifiability-sample.json", JSON.stringify({ edition: EDITION, sampled: out.length, probed_utc: new Date().toISOString(), rows: out }, null, 1));
  const n = out.length;
  const by = {}, reach = {};
  for (const r of out) { by[r.outcome] = (by[r.outcome] || 0) + 1; reach[r.reach || "?"] = (reach[r.reach || "?"] || 0) + 1; }
  const cls = by.classifiable || 0;
  const inf = out.filter(r => (r.schema_informative || []).length).length;
  const plat = out.filter(r => r.platform).length;
  const feed = out.filter(r => r.feed).length;
  const adult = out.filter(r => r.declares_adult).length;
  const anySelf = out.filter(r => (r.schema_informative || []).length || r.platform || r.feed || r.declares_adult).length;
  const www = out.filter(r => r.used_www).length;

  console.log("\n\n" + "=".repeat(72));
  console.log(`CLASSIFIABILITY PROBE v3 — ${n} domains, ${Math.round((Date.now() - t0) / 1000)}s`);
  console.log("=".repeat(72));
  console.log("\nFETCH OUTCOME");
  Object.entries(by).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log("  " + k.padEnd(24) + String(v).padStart(5) + "  " + pc(v, n)));
  console.log("\n  => CLASSIFIABLE (usable HTML): " + cls + "  " + pc(cls, n));
  console.log("  => rescued by www./http fallback: " + www + "  " + pc(www, n) + "  (v2 would have missed these)");

  console.log("\nREACHABILITY  (this is the no_robots split for core CPI)");
  Object.entries(reach).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log("  " + k.padEnd(24) + String(v).padStart(5) + "  " + pc(v, n)));

  console.log("\nSELF-DECLARED SIGNALS");
  console.log("  informative schema.org type " + String(inf).padStart(5) + "  " + pc(inf, n) + "   (of classifiable: " + pc(inf, cls) + ")");
  console.log("  platform/CMS fingerprint    " + String(plat).padStart(5) + "  " + pc(plat, n) + "   (of classifiable: " + pc(plat, cls) + ")");
  console.log("  RSS/Atom feed               " + String(feed).padStart(5) + "  " + pc(feed, n) + "   (of classifiable: " + pc(feed, cls) + ")");
  console.log("  declares adult content      " + String(adult).padStart(5) + "  " + pc(adult, n));
  console.log("  ANY self-declared signal    " + String(anySelf).padStart(5) + "  " + pc(anySelf, n) + "   (of classifiable: " + pc(anySelf, cls) + ")");

  console.log("\nBY RANK BAND (head oversampled — read the rate, not the count)");
  const bands = [...new Set(out.map(r => r.band))];
  for (const b of bands) {
    const g = out.filter(r => r.band === b);
    const c = g.filter(r => r.outcome === "classifiable").length;
    const s = g.filter(r => (r.schema_informative || []).length || r.platform || r.feed).length;
    console.log("  " + b.padEnd(14) + String(c).padStart(4) + "/" + String(g.length).padEnd(5) + " classifiable " + pc(c, g.length).padStart(7) + "  ·  self-declared " + pc(s, g.length));
  }

  // frame-weighted estimate: re-weight bands back to their true share of 50k
  let wCls = 0, wSelf = 0, tot = 0;
  for (const b of bands) {
    const g = out.filter(r => r.band === b);
    const w = g[0].band_pool;
    wCls += (g.filter(r => r.outcome === "classifiable").length / g.length) * w;
    wSelf += (g.filter(r => (r.schema_informative || []).length || r.platform || r.feed).length / g.length) * w;
    tot += w;
  }
  console.log("\nFRAME-WEIGHTED ESTIMATE (corrects for head oversampling)");
  console.log("  classifiable across 50,000 : ~" + Math.round(wCls / tot * 50000).toLocaleString() + "  (" + pc(wCls, tot) + ")");
  console.log("  self-declared signal       : ~" + Math.round(wSelf / tot * 50000).toLocaleString() + "  (" + pc(wSelf, tot) + ")");
  console.log("\nwrote classifiability-sample.json\n");
}

next();
