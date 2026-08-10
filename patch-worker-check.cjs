#!/usr/bin/env node
// Adds to the worker:
//   GET  /v1/check?domain=   public benchmark lookup for /check
//   402 x402 payment offer   USDC on Base, subscription-parity price
//   GET  /v1/redeem?tx=      verifies an on-chain USDC payment, mints a
//                            7-day SNAPSHOT key (current edition, no history)
//   snapshot scope           snapshot keys read dataset-snapshot, not dataset
const fs = require("fs");
let s = fs.readFileSync("worker.js", "utf8");
if (s.includes("/v1/check")) { console.log("worker already patched - skipping"); process.exit(0); }

const R = 'if (path === "/v1/subscribers") return listSubs(request, env, cors);';
const F = "// admin: subscriber counts";
const RAW = '  let raw = await env.DATA.get("dataset");';
const STATUS = 'if (rec.status !== "active") return json({ error: "subscription inactive", detail: rec.status }, 402, cors);';
if (!s.includes(R) || !s.includes(F)) { console.error("anchors missing - aborting, worker untouched"); process.exit(1); }
fs.writeFileSync("worker.js.bak12", s);

s = s.replace(R, R + '\n    if (path === "/v1/check") return checkDomain(url, env, cors);\n    if (path === "/v1/redeem") return redeemCrawl(url, env, cors);');

// snapshot-scope keys are served the history-free edition
if (s.includes(RAW)) {
  s = s.replace(RAW, '  let raw = await env.DATA.get(rec.scope === "snapshot" ? "dataset-snapshot" : "dataset");');
  console.log("dataset read is scope-aware");
} else { console.log("NOTE: dataset read anchor not found - snapshot keys would get the full edition"); }

// expiring keys (machine passes)
if (s.includes(STATUS)) {
  s = s.replace(STATUS, STATUS + '\n  if (rec.expires && Date.now() > rec.expires) return json({ error: "crawl pass expired", detail: "one pass = one weekly edition", renew: "https://api.crawlpriceindex.com/v1/dataset" }, 402, cors);');
  console.log("expiry check added");
}

const fn = [
'// ---- public benchmark lookup (one small shard read, never parses the dataset)',
'async function checkShard(env, domain) {',
'  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(domain)));',
'  const shard = await env.DATA.get("lookup:" + (h[0] % 64).toString(16).padStart(2, "0"), "json");',
'  return shard ? shard[domain] : null;',
'}',
'async function checkDomain(url, env, cors) {',
'  const headers = { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600", ...cors };',
'  const meta = await env.DATA.get("lookup:meta", "json");',
'  if (!meta) return new Response(JSON.stringify({ found: false, error: "benchmark index not yet published" }), { status: 503, headers });',
'  const context = { generated_utc: meta.generated_utc, tranco_top_n: meta.tranco_top_n, robots_parsed: meta.robots_parsed, bots: meta.bots, top_price: meta.top_price };',
'  let q = String(url.searchParams.get("domain") || "").trim().toLowerCase();',
'  q = q.replace(/^https?:\\/\\//, "").replace(/\\/.*$/, "").replace(/:.*$/, "");',
'  if (q === "context") return new Response(JSON.stringify({ found: false, context }), { status: 200, headers });',
'  if (!/^[a-z0-9.-]{3,253}$/.test(q) || !q.includes(".")) return new Response(JSON.stringify({ found: false, error: "invalid domain", context }), { status: 400, headers });',
'  const candidates = q.startsWith("www.") ? [q, q.slice(4)] : [q, "www." + q];',
'  let hit = null, hitDomain = null;',
'  for (const c of candidates) { hit = await checkShard(env, c); if (hit) { hitDomain = c; break; } }',
'  if (!hit) return new Response(JSON.stringify({ found: false, domain: q, context }), { status: 200, headers });',
'  const stances = {}; let blocked = 0, any = false;',
'  meta.bots.forEach((b, i) => { const v = hit[i + 1] || "u"; stances[b] = v; if (v === "b") blocked++; if (v !== "n") any = true; });',
'  let percentile = null;',
'  if (any && Array.isArray(meta.hist)) {',
'    let below = 0, total = 0;',
'    meta.hist.forEach((c, i) => { total += c; if (i < blocked) below += c; });',
'    if (total > 0) percentile = 100 * below / total;',
'  }',
'  return new Response(JSON.stringify({ found: true, domain: hitDomain, rank: hit[0] || null, stances, blocked_count: blocked, percentile, context }), { status: 200, headers });',
'}',
'',
'// ---- machine access: pay on-chain, redeem for a one-edition snapshot pass',
'const CRAWL_PRICE_USDC = 20;                                    // parity: EUR 79/mo over ~4 weekly editions',
'const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"; // USDC on Base',
'const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";',
'function payToAddr(env) { return String(env.X402_PAY_TO || "").toLowerCase(); }',
'function crawlOffer(env) {',
'  return {',
'    x402Version: 1,',
'    accepts: [{',
'      scheme: "exact", network: "base", asset: USDC_BASE,',
'      maxAmountRequired: String(CRAWL_PRICE_USDC * 1000000),',
'      payTo: payToAddr(env),',
'      resource: "https://api.crawlpriceindex.com/v1/dataset",',
'      description: "One weekly edition of the Crawl Price Index dataset (current snapshot; trends and history are subscriber-only)",',
'      mimeType: "application/json",',
'      maxTimeoutSeconds: 300,',
'      extra: { redeem: "https://api.crawlpriceindex.com/v1/redeem?tx=YOUR_TX_HASH", pass_days: 7 },',
'    }],',
'  };',
'}',
'async function baseRpc(method, params) {',
'  const r = await fetch("https://mainnet.base.org", {',
'    method: "POST", headers: { "Content-Type": "application/json" },',
'    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),',
'  });',
'  if (!r.ok) throw new Error("rpc " + r.status);',
'  const j = await r.json();',
'  if (j.error) throw new Error(j.error.message || "rpc error");',
'  return j.result;',
'}',
'async function redeemCrawl(url, env, cors) {',
'  const tx = String(url.searchParams.get("tx") || "").trim().toLowerCase();',
'  if (!/^0x[0-9a-f]{64}$/.test(tx)) return json({ error: "pass tx=<transaction hash>", offer: crawlOffer(env) }, 400, cors);',
'  if (!payToAddr(env)) return json({ error: "payments not configured" }, 503, cors);',
'  const existing = await env.KEYS.get("tx:" + tx);',
'  if (existing) {',
'    const r0 = await env.KEYS.get(existing, "json");',
'    return json({ key: existing, scope: "snapshot", expires: r0 && r0.expires, note: "already redeemed", dataset: "https://api.crawlpriceindex.com/v1/dataset?key=" + existing }, 200, cors);',
'  }',
'  let receipt;',
'  try { receipt = await baseRpc("eth_getTransactionReceipt", [tx]); }',
'  catch (e) { return json({ error: "could not verify on-chain", detail: String(e) }, 502, cors); }',
'  if (!receipt) return json({ error: "transaction not found or not yet mined" }, 404, cors);',
'  if (receipt.status !== "0x1") return json({ error: "transaction failed on-chain" }, 400, cors);',
'  const want = BigInt(CRAWL_PRICE_USDC) * 1000000n;',
'  const to32 = "0x" + payToAddr(env).slice(2).padStart(64, "0");',
'  let paid = 0n;',
'  for (const log of receipt.logs || []) {',
'    if (String(log.address).toLowerCase() !== USDC_BASE) continue;',
'    if (!log.topics || String(log.topics[0]).toLowerCase() !== TRANSFER_TOPIC) continue;',
'    if (String(log.topics[2]).toLowerCase() !== to32) continue;',
'    try { paid += BigInt(log.data); } catch (e) {}',
'  }',
'  if (paid < want) return json({ error: "insufficient payment", paid_usdc: Number(paid) / 1e6, required_usdc: CRAWL_PRICE_USDC, offer: crawlOffer(env) }, 402, cors);',
'  const key = "cpi_snap_" + crypto.randomUUID().replace(/-/g, "");',
'  const expires = Date.now() + 7 * 86400000;',
'  const rec = { customer: "x402:" + tx.slice(0, 18), scope: "snapshot", status: "active", created: new Date().toISOString(), expires, month: new Date().toISOString().slice(0, 7), count: 0, emailed: true, paid_usdc: Number(paid) / 1e6 };',
'  await env.KEYS.put(key, JSON.stringify(rec));',
'  await env.KEYS.put("tx:" + tx, key, { expirationTtl: 2592000 });',
'  return json({ key, scope: "snapshot", expires_utc: new Date(expires).toISOString(), pass_days: 7, dataset: "https://api.crawlpriceindex.com/v1/dataset?key=" + key, note: "This pass serves the current weekly edition. Trends, history, country editions and the movers feed are subscriber-only: https://crawlpriceindex.com/#access" }, 200, cors);',
'}',
'',
''
].join("\n");
s = s.slice(0, s.indexOf(F)) + fn + s.slice(s.indexOf(F));

// the gate 402 becomes a real x402 offer
const OLD402 = 'return json({ error: "payment required: no key", subscribe: "https://crawlpriceindex.com/#access" }, 402, cors);';
const NEW402 = 'return new Response(JSON.stringify({ error: "payment required", subscribe: "https://crawlpriceindex.com/#access", crawler_price: "USD 20.00 per crawl - one weekly edition, priced at parity with the EUR 79/mo Terminal subscription", licence: "single-subscriber, redistribution prohibited, responses watermarked", terms: "https://crawlpriceindex.com/rsl.xml", ...crawlOffer(env) }), { status: 402, headers: { "Content-Type": "application/json", "crawler-price": "USD 20.00", "payment": "https://crawlpriceindex.com/#access", ...cors } });';
if (s.includes(OLD402)) { s = s.replace(OLD402, NEW402); console.log("402 is now a machine-payable x402 offer (USD 20.00)"); }
else { console.log("NOTE: 402 anchor not found - offer lives at /v1/redeem and in rsl.xml"); }

fs.writeFileSync("worker.js", s);
console.log("/v1/check + /v1/redeem added (backup worker.js.bak12)");
