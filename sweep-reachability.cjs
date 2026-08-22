#!/usr/bin/env node
/**
 * CPI — FULL-FRAME REACHABILITY + SITE-EVIDENCE SWEEP
 * ===========================================================================
 *   node sweep-reachability.cjs            full 50k sweep (resumable)
 *   node sweep-reachability.cjs --status   show progress of a running/paused sweep
 *
 * For EVERY domain in the latest edition, records:
 *   reachability : alive / dead_dns / timeout / refused / tls_error / reset
 *   homepage     : http status, final url, bot_walled (403/429), thin/JS-shell
 *   evidence     : schema.org types (REAL JSON-LD parse — arrays and @graph
 *                  handled, fixing the 8.1% artefact), og:type, platform/CMS,
 *                  RSS/Atom, ads.txt presence, RTA/adult self-label
 *
 * This is the data layer behind: the reachability split of `no_robots`,
 * Design B (site-evidence columns), the news-flag join, and the
 * declared-vs-enforced posture signal.
 *
 * Politeness: honest UA, robots.txt obeyed for the homepage fetch (robots.txt
 * and /ads.txt are themselves fetched unconditionally — those files exist to
 * be read by crawlers). One pass per host, no retries, standard Accept +
 * Accept-Language headers only (normal HTTP negotiation; no browser spoofing).
 *
 * Resumable: appends one JSON line per domain to reachability-<edition>.jsonl
 * and skips already-done domains on restart. Ctrl+C is safe at any time.
 * Writes reachability-<edition>-summary.json at completion.
 * ~2–4 hours for 50k at concurrency 24. Progress line updates continuously.
 */
const zlib = require("zlib"), fs = require("fs"), https = require("https"), http = require("http");

const UA = "CrawlPriceIndexBot/1.0 (+https://crawlpriceindex.com/methodology)";
const HEADERS = { "user-agent": UA, accept: "text/html,application/xhtml+xml,*/*;q=0.8", "accept-language": "en" };
const CONCURRENCY = 24, TIMEOUT_MS = 8000, HARD_MS = 22000;

function latestEdition() {
  const f = fs.readdirSync("editions").filter(x => x.endsWith(".csv.gz")).sort().pop();
  if (!f) { console.error("no editions/*.csv.gz"); process.exit(1); }
  return f.replace(".csv.gz", "");
}
const ED = latestEdition();
const OUT = `reachability-${ED}.jsonl`;
const SUM = `reachability-${ED}-summary.json`;

const rows = zlib.gunzipSync(fs.readFileSync(`editions/${ED}.csv.gz`)).toString("utf8")
  .split("\n").filter(Boolean).slice(1)
  .map(l => { const p = l.split(","); return { rank: +p[0], domain: (p[1] || "").toLowerCase() }; })
  .filter(r => r.domain);

/* resume: skip domains already recorded */
const doneSet = new Set();
if (fs.existsSync(OUT)) {
  for (const line of fs.readFileSync(OUT, "utf8").split("\n")) {
    if (!line) continue;
    try { doneSet.add(JSON.parse(line).domain); } catch (e) {}
  }
}
if (process.argv.includes("--status")) {
  console.log(`${doneSet.size}/${rows.length} done (${(doneSet.size / rows.length * 100).toFixed(1)}%) — ${OUT}`);
  process.exit(0);
}
const todo = rows.filter(r => !doneSet.has(r.domain));
console.log(`Edition ${ED}: ${rows.length} domains, ${doneSet.size} already done, ${todo.length} to probe.`);
console.log(`Appending to ${OUT} — Ctrl+C is safe, restart resumes.\n`);

const stream = fs.createWriteStream(OUT, { flags: "a" });

/* ---- robots ---- */
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
  if (/ENOTFOUND|EAI_AGAIN/.test(c)) return "dead_dns";
  if (/ECONNREFUSED/.test(c)) return "refused";
  if (/ECONNRESET|EPIPE/.test(c)) return "reset";
  if (/CERT|SSL|TLS|EPROTO|altnames|self.signed/i.test(c)) return "tls_error";
  if (/timeout/i.test(c)) return "timeout";
  return "other";
}
function get(url, cb, redirects) {
  redirects = redirects || 0;
  let done = false;
  const fin = (e, r) => { if (!done) { done = true; cb(e, r); } };
  let u; try { u = new URL(url); } catch (e) { return fin(new Error("badurl")); }
  if (u.protocol !== "http:" && u.protocol !== "https:") return fin(new Error("badproto"));
  const req = (u.protocol === "http:" ? http : https).get(u, { headers: HEADERS, timeout: TIMEOUT_MS, rejectUnauthorized: false }, res => {
    if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location && redirects < 4) {
      res.resume();
      let nx; try { nx = new URL(res.headers.location, url).href; } catch (e) { return fin(new Error("badredirect")); }
      return get(nx, cb, redirects + 1);
    }
    let body = "", len = 0;
    res.setEncoding("utf8");
    res.on("data", c => { len += c.length; if (len < 500000) body += c; else res.destroy(); });
    res.on("end", () => fin(null, { status: res.statusCode, headers: res.headers, body, url }));
    res.on("error", () => fin(null, { status: res.statusCode, headers: res.headers, body, url }));
  });
  req.on("timeout", () => { req.destroy(); fin(new Error("timeout")); });
  req.on("error", e => fin(e));
}
function getFB(domain, path, cb) {   // https apex -> https www -> http apex
  const urls = ["https://" + domain + path, "https://www." + domain + path, "http://" + domain + path];
  let i = 0, firstErr = null;
  const go = () => {
    if (i >= urls.length) return cb(firstErr || new Error("unreachable"), null, null);
    const u = urls[i++];
    get(u, (e, r) => { if (!e && r) return cb(null, r, u); if (!firstErr) firstErr = e; go(); });
  };
  go();
}

/* ---- evidence extraction (JSON-LD-aware) ---- */
const PLATFORM_RE = /(Shopify|WooCommerce|Magento|PrestaShop|BigCommerce|Squarespace|Wix\.com|WordPress|Ghost|Drupal|Joomla|Salesforce Commerce|Discourse|phpBB|MediaWiki|vBulletin|Substack)/i;
const FEED_RE = /<link[^>]+type=["']?application\/(rss|atom)\+xml/i;
const OGTYPE_RE = /<meta[^>]+property=["']?og:type["']?[^>]+content=["']?([a-z._]+)/i;
const RTA_RE = /RTA-5042-1996-1400-1577-RTA/i;
const RATING_ADULT_RE = /<meta[^>]+name=["']?rating["']?[^>]+content=["']?(adult|RTA-)/i;
const ADULT_TLD = new Set(["xxx", "adult", "porn", "sex"]);

function jsonldTypes(html) {
  const types = new Set();
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const b of blocks.slice(0, 8)) {
    const inner = b.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    let j; try { j = JSON.parse(inner); } catch (e) { continue; }
    const walk = (o, depth) => {
      if (!o || depth > 6) return;
      if (Array.isArray(o)) return o.forEach(x => walk(x, depth + 1));
      if (typeof o !== "object") return;
      const t = o["@type"];
      if (typeof t === "string") types.add(t);
      else if (Array.isArray(t)) t.forEach(x => typeof x === "string" && types.add(x));
      if (o["@graph"]) walk(o["@graph"], depth + 1);
      for (const k of Object.keys(o)) if (typeof o[k] === "object") walk(o[k], depth + 1);
    };
    walk(j, 0);
  }
  return [...types].slice(0, 20);
}
const textLen = h => h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
                      .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;

/* ---- main loop ---- */
let idx = 0, active = 0, finished = 0;
const t0 = Date.now();
function tick() {
  finished++;
  if (finished % 50 === 0 || finished === todo.length) {
    const el = (Date.now() - t0) / 1000, rate = finished / Math.max(el, .1);
    const etaMin = Math.round((todo.length - finished) / Math.max(rate, .01) / 60);
    process.stdout.write(`\r  ${finished + doneSet.size}/${rows.length}  ${Math.round(el / 60)}m elapsed  ~${etaMin}m left  (${rate.toFixed(1)}/s)   `);
  }
}
function next() {
  while (active < CONCURRENCY && idx < todo.length) {
    const r = todo[idx++]; active++;
    probe(r, () => { active--; tick(); if (idx >= todo.length && active === 0) summarise(); else next(); });
  }
}
function probe(r, cb0) {
  const rec = { rank: r.rank, domain: r.domain, ts: Date.now() };
  let settled = false;
  const guard = setTimeout(() => { if (settled) return; settled = true; rec.reach = rec.reach || "timeout"; stream.write(JSON.stringify(rec) + "\n"); cb0(); }, HARD_MS);
  const emit = () => { if (settled) return; settled = true; clearTimeout(guard); stream.write(JSON.stringify(rec) + "\n"); cb0(); };

  getFB(r.domain, "/robots.txt", (e1, rr) => {
    rec.robots_http = rr ? rr.status : null;
    if (e1 && !rr) { rec.reach = classifyErr(e1); return emit(); }   // robots unreachable -> host state known
    rec.reach = "alive";
    const allowed = (!rr || rr.status !== 200) ? true : robotsAllows(rr.body);
    rec.fetch_allowed = allowed;

    // ads.txt — a crawler-directed public declaration file, fetched unconditionally
    getFB(r.domain, "/ads.txt", (ea, ar) => {
      rec.has_ads_txt = !!(ar && ar.status === 200 && /^[^<]{0,200}(,|#|=)/m.test((ar.body || "").slice(0, 400)));
      if (!allowed) { rec.homepage = "disallowed_by_robots"; return emit(); }

      getFB(r.domain, "/", (e2, hr, usedUrl) => {
        if (e2 || !hr) { rec.homepage = classifyErr(e2); return emit(); }
        rec.http = hr.status;
        rec.final_url = usedUrl;
        if (hr.status === 403 || hr.status === 429) { rec.homepage = "bot_walled"; return emit(); }
        if (hr.status >= 400) { rec.homepage = "http_error"; return emit(); }
        const ct = String(hr.headers["content-type"] || "");
        if (!/html/i.test(ct)) { rec.homepage = "not_html"; return emit(); }
        const html = hr.body || "";
        rec.text_len = textLen(html);
        rec.homepage = rec.text_len < 200 ? "thin_or_js_shell" : "ok";
        rec.schema_types = jsonldTypes(html);
        rec.og_type = (html.match(OGTYPE_RE) || [])[1] || null;
        rec.platform = (html.match(PLATFORM_RE) || [])[1] || null;
        rec.has_feed = FEED_RE.test(html);
        rec.adult_self = RTA_RE.test(html) || RATING_ADULT_RE.test(html) || ADULT_TLD.has(r.domain.split(".").pop()) || undefined;
        emit();
      });
    });
  });
}

function summarise() {
  const all = fs.readFileSync(OUT, "utf8").split("\n").filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
  const reach = {}, home = {};
  let ads = 0, plat = 0, feed = 0, schema = 0, adult = 0, walled = 0;
  for (const r of all) {
    reach[r.reach || "?"] = (reach[r.reach || "?"] || 0) + 1;
    if (r.homepage) home[r.homepage] = (home[r.homepage] || 0) + 1;
    if (r.has_ads_txt) ads++;
    if (r.platform) plat++;
    if (r.has_feed) feed++;
    if ((r.schema_types || []).length) schema++;
    if (r.adult_self) adult++;
    if (r.homepage === "bot_walled") walled++;
  }
  const s = { edition: ED, generated_utc: new Date().toISOString(), domains: all.length,
              reachability: reach, homepage: home,
              evidence: { has_ads_txt: ads, platform: plat, has_feed: feed, schema_any: schema, adult_self: adult, bot_walled: walled } };
  fs.writeFileSync(SUM, JSON.stringify(s, null, 1));
  const pc = x => (x / Math.max(1, all.length) * 100).toFixed(1) + "%";
  console.log("\n\n" + "=".repeat(64));
  console.log(`REACHABILITY SWEEP COMPLETE — ${all.length} domains, edition ${ED}`);
  console.log("=".repeat(64));
  console.log("REACHABILITY"); Object.entries(reach).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log("  " + k.padEnd(20) + String(v).padStart(6) + "  " + pc(v)));
  console.log("HOMEPAGE");     Object.entries(home).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log("  " + k.padEnd(20) + String(v).padStart(6) + "  " + pc(v)));
  console.log("EVIDENCE");
  console.log("  ads.txt " + ads + " (" + pc(ads) + ") · platform " + plat + " (" + pc(plat) + ") · feed " + feed + " (" + pc(feed) + ") · schema " + schema + " (" + pc(schema) + ") · adult-self " + adult);
  console.log("\nwrote " + SUM + "\n");
}

next();
