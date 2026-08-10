#!/usr/bin/env node
// FULL WORKFLOW TEST — run after deploying, before pitching anyone.
//   node smoke-test.cjs
//   node smoke-test.cjs --key cpi_live_...        (adds paid-tier tests)
//   node smoke-test.cjs --key ... --snap cpi_snap_...  (adds machine-tier tests)
//   node smoke-test.cjs --email you+test@gmail.com     (adds live signup test)
const SITE = "https://crawlpriceindex.com";
const API = "https://api.crawlpriceindex.com";
const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const KEY = arg("--key"), SNAP = arg("--snap"), EMAIL = arg("--email");

let pass = 0, fail = 0, warn = 0;
const ok = (n, d) => { pass++; console.log("  PASS  " + n + (d ? "  · " + d : "")); };
const no = (n, d) => { fail++; console.log("  FAIL  " + n + (d ? "  · " + d : "")); };
const wa = (n, d) => { warn++; console.log("  WARN  " + n + (d ? "  · " + d : "")); };
const head = t => console.log("\n" + t + "\n" + "-".repeat(t.length));

async function get(url, opts) {
  const r = await fetch(url, Object.assign({ redirect: "follow" }, opts || {}));
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: r.status, headers: r.headers, text, json };
}

(async () => {
  console.log("CRAWL PRICE INDEX — full workflow test · " + new Date().toISOString());

  head("1. Public pages");
  for (const p of ["/", "/check", "/world.html", "/methodology.html", "/terms.html", "/recover.html", "/sample.html", "/rsl.xml", "/robots.txt", "/llms.txt"]) {
    const r = await get(SITE + p);
    r.status === 200 ? ok(p, r.text.length.toLocaleString() + " bytes") : no(p, "HTTP " + r.status);
  }
  const rob = await get(SITE + "/robots.txt");
  rob.text.includes("License:") ? ok("robots.txt advertises License") : wa("robots.txt has no License line", "append it");
  const rsl = await get(SITE + "/rsl.xml");
  rsl.text.includes("train-ai") && rsl.text.includes("1.00") ? ok("rsl.xml has class-differentiated pricing") : wa("rsl.xml unexpected content");

  head("2. Homepage integrity (the thing that broke twice)");
  const home = await get(SITE + "/");
  const i = home.text.lastIndexOf("<script>"), j = home.text.indexOf("</script>", i);
  try { new Function(home.text.slice(i + 8, j)); ok("homepage script parses"); } catch (e) { no("homepage script BROKEN", e.message); }
  const m = home.text.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/);
  if (m) { try { JSON.parse(m[1]); ok("homepage data payload parses"); } catch (e) { no("homepage payload BROKEN", e.message); } }
  home.text.includes('href="/check"') ? ok("homepage links the checker") : no("homepage missing /check link");
  home.text.includes("cta-hero") ? ok("hero subscribe CTA present") : no("hero CTA missing");
  home.text.includes("wk-form") || home.text.includes("data-wk") ? ok("email capture present") : no("email capture missing");

  head("3. Checker API");
  const ctx = await get(API + "/v1/check?domain=context");
  if (ctx.json && ctx.json.context) {
    const c = ctx.json.context;
    ok("context loads", c.robots_parsed.toLocaleString() + " parsed · top " + c.tranco_top_n.toLocaleString() + " · " + (c.generated_utc || "").slice(0, 10));
    const age = (Date.now() - Date.parse(c.generated_utc)) / 86400000;
    age < 10 ? ok("index is fresh", age.toFixed(1) + " days old") : wa("index is stale", age.toFixed(1) + " days");
    Array.isArray(c.bots) && c.bots.length >= 15 ? ok("bot list complete", c.bots.length + " crawlers") : wa("unexpected bot count");
  } else no("context endpoint", "HTTP " + ctx.status);

  const known = await get(API + "/v1/check?domain=www.nytimes.com");
  if (known.json && known.json.found) {
    const k = known.json;
    ok("known domain lookup", "rank #" + k.rank + " · blocks " + k.blocked_count + " · " + Math.round(k.percentile) + "th pct");
    k.stances && Object.keys(k.stances).length >= 15 ? ok("stances complete") : no("stances incomplete");
    (k.percentile >= 0 && k.percentile <= 100) ? ok("percentile in range") : no("percentile out of range", String(k.percentile));
  } else no("known domain lookup", "found=false for nytimes");

  const www = await get(API + "/v1/check?domain=nytimes.com");
  www.json && www.json.found ? ok("www/non-www fallback works") : wa("bare-domain fallback missed");
  const miss = await get(API + "/v1/check?domain=this-domain-does-not-exist-9x7.com");
  miss.status === 200 && miss.json && miss.json.found === false && miss.json.context ? ok("unknown domain degrades gracefully") : no("unknown domain handling", "HTTP " + miss.status);
  const bad = await get(API + "/v1/check?domain=not a domain");
  bad.status === 400 ? ok("invalid input rejected") : wa("invalid input returned HTTP " + bad.status);
  ctx.headers.get("access-control-allow-origin") ? ok("CORS open (browser can call it)") : no("CORS missing — the checker page will fail");

  head("4. The gate");
  const health = await get(API + "/health");
  health.json && health.json.ok ? ok("/health") : no("/health", "HTTP " + health.status);
  const nokey = await get(API + "/v1/dataset");
  if (nokey.status === 402) {
    ok("no key returns 402");
    nokey.headers.get("crawler-price") ? ok("crawler-price header", nokey.headers.get("crawler-price")) : wa("no crawler-price header");
    const off = nokey.json && nokey.json.accepts && nokey.json.accepts[0];
    if (off) {
      ok("x402 offer present", off.network + " · " + off.maxAmountRequired + " units");
      /^0x[0-9a-fA-F]{40}$/.test(off.payTo || "") ? ok("payTo wallet configured") : no("payTo empty — run: wrangler secret put X402_PAY_TO");
    } else no("x402 offer missing from 402 body");
  } else no("no-key request", "expected 402, got " + nokey.status);
  const badkey = await get(API + "/v1/dataset?key=cpi_live_notarealkey");
  badkey.status === 401 ? ok("invalid key returns 401") : no("invalid key", "HTTP " + badkey.status);
  const nosample = await get(API + "/v1/sample?e=x@y.com&t=bogus");
  [401, 403].includes(nosample.status) ? ok("sample link is token-gated") : no("sample not gated", "HTTP " + nosample.status);

  head("5. Web Bot Auth");
  for (const p of ["/.well-known/http-message-signatures-directory", "/.well-known/http-message-signature-directory"]) {
    const r = await get(SITE + p);
    if (r.status === 200) {
      const signed = r.headers.get("signature") ? "signed" : "UNSIGNED";
      const kid = r.json && r.json.keys && r.json.keys[0] && r.json.keys[0].kid;
      signed === "signed" ? ok(p, signed + " · kid " + String(kid).slice(0, 12)) : wa(p, "200 but unsigned");
    } else no(p, "HTTP " + r.status);
  }

  head("6. Machine payment path");
  const redeem0 = await get(API + "/v1/redeem");
  redeem0.status === 400 && redeem0.json && redeem0.json.offer ? ok("/v1/redeem returns the offer without tx") : no("/v1/redeem no-arg", "HTTP " + redeem0.status);
  const fakeTx = "0x" + "1".repeat(64);
  const redeem1 = await get(API + "/v1/redeem?tx=" + fakeTx);
  if (redeem1.status === 404) ok("on-chain verification reachable", "unknown tx correctly rejected (Base RPC responded)");
  else if (redeem1.status === 502) no("Base RPC unreachable from worker", redeem1.json && redeem1.json.detail);
  else wa("unexpected redeem response", "HTTP " + redeem1.status);

  if (KEY) {
    head("7. Paid tier (subscriber key)");
    const d = await get(API + "/v1/dataset?key=" + KEY);
    if (d.status === 200 && d.json) {
      const rows = (d.json.per_domain || []).length;
      ok("dataset served", rows.toLocaleString() + " rows");
      d.json._license && d.json._license.key_fingerprint ? ok("watermark present", d.json._license.key_fingerprint) : no("watermark missing");
      d.json.trends ? ok("subscriber gets trends/history") : no("trends missing from subscriber edition");
      d.json.country_editions && Object.keys(d.json.country_editions).length > 10 ? ok("country editions", Object.keys(d.json.country_editions).length + " countries") : wa("few country editions");
      d.json.enforcement ? ok("enforcement metric present", d.json.enforcement.enforced_pct + "% enforced") : wa("enforcement metric missing");
    } else no("dataset with key", "HTTP " + d.status);
    const csv = await get(API + "/v1/dataset?key=" + KEY + "&format=csv");
    if (csv.status === 200) {
      const lines = csv.text.split("\n");
      ok("CSV served", (lines.length - 3).toLocaleString() + " data rows");
      csv.text.startsWith("#") ? ok("CSV licence header") : wa("CSV missing licence header");
      (csv.headers.get("content-type") || "").includes("csv") ? ok("CSV content-type") : wa("CSV content-type is " + csv.headers.get("content-type"));
    } else no("CSV", "HTTP " + csv.status);
  } else wa("paid-tier tests skipped", "re-run with --key cpi_live_...");

  if (SNAP) {
    head("8. Machine tier (snapshot pass)");
    const s = await get(API + "/v1/dataset?key=" + SNAP);
    if (s.status === 200 && s.json) {
      ok("snapshot served", (s.json.per_domain || []).length.toLocaleString() + " rows");
      !s.json.trends ? ok("history correctly WITHHELD from machine tier") : no("LEAK: trends present in snapshot edition");
      s.json.edition === "snapshot" ? ok("edition labelled") : wa("edition label missing");
      s.json._license ? ok("snapshot watermarked") : wa("snapshot not watermarked");
    } else no("snapshot with pass key", "HTTP " + s.status);
  } else wa("machine-tier tests skipped", "re-run with --snap cpi_snap_... after the wallet test");

  if (EMAIL) {
    head("9. Signup funnel (sends a real email)");
    const r = await fetch(API + "/v1/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: EMAIL }) });
    const j = await r.json();
    j.message ? ok("subscribe accepted", j.message) : no("subscribe", JSON.stringify(j));
    console.log("     → check that inbox for the branded confirm email, click it, then check for the welcome + sample link");
  } else wa("signup test skipped", "re-run with --email you+test@gmail.com");

  head("RESULT");
  console.log("  " + pass + " passed · " + fail + " failed · " + warn + " warnings");
  console.log(fail === 0 ? "\n  ALL CRITICAL CHECKS PASSED — safe to pitch.\n" : "\n  FIX THE FAILURES BEFORE PITCHING.\n");
  process.exit(fail === 0 ? 0 : 1);
})();
