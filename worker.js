/**
 * CRAWL PRICE INDEX — API GATE  (Cloudflare Worker)
 * =================================================
 * Serves the PAID dataset only to valid, active subscribers.
 * Non-payers / invalid keys → HTTP 402. Cancelled subs → key auto-revoked.
 *
 * Routes:
 *   GET  /v1/dataset?key=KEY   → full paid dataset (gated, rate-limited, watermarked)
 *   GET  /v1/status?key=KEY    → key status (active/revoked, usage this month)
 *   POST /webhook/stripe       → Stripe events: issue key on subscribe, revoke on cancel
 *   GET  /health               → ok
 *
 * Storage (Cloudflare KV, bound as KEYS and DATA):
 *   KEYS: key -> { customer, email, status, created, month, count }
 *   KEYS: cust:<customerId> -> key   (reverse lookup for webhook revoke)
 *   DATA: dataset -> the full paid JSON (updated by your scan pipeline)
 *
 * Secrets (wrangler secret put — NEVER in code):
 *   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 *
 * Rate limit: RATE_LIMIT requests/key/month (default 1000). Enough for
 * legit use, low enough that reselling/bulk-mirroring trips it.
 */

const RATE_LIMIT = 1000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    if (path === "/.well-known/http-message-signatures-directory" || path === "/.well-known/http-message-signature-directory") return wbaDirectory(request, env, cors);
    if (path === "/health") return json({ ok: true }, 200, cors);

    if (path === "/webhook/stripe" && request.method === "POST") {
      return handleWebhook(request, env, cors);
    }

    if (path === "/v1/status") {
      const key = url.searchParams.get("key") || bearer(request);
      const rec = key && await env.KEYS.get(key, "json");
      if (!rec) return json({ error: "invalid key" }, 401, cors);
      return json({ status: rec.status, usage: rec.count || 0, limit: RATE_LIMIT, month: rec.month }, 200, cors);
    }

    if (path === "/v1/recover" && request.method === "POST") {
      // customer lost their key — look it up by email, re-send it. Rate-limited
      // implicitly by Stripe email match; only sends to the email on file.
      return recoverKey(request, env, cors);
    }

    if (path === "/v1/subscribe" && request.method === "POST") return subscribe(request, env, cors);
    if (path === "/v1/subscribers") return listSubs(request, env, cors);
    if (path === "/v1/check") return checkDomain(url, env, cors);
    if (path === "/v1/methodology") return methodologyDoc(env, cors);
    if (path === "/v1/watches") return listWatches(request, env, cors);
    if (path === "/v1/alert" && request.method === "POST") return sendAlert(request, env, cors);
    if (path === "/v1/watch" && request.method === "POST") return addWatch(request, env, cors);
    if (path === "/v1/watch/confirm") return confirmWatch(url, env, cors);
    if (path === "/v1/watch/stop") return stopWatch(url, env, cors);
    if (path === "/v1/redeem") return redeemCrawl(url, env, cors);
    if (path === "/v1/confirm") return confirmSub(url, env);
    if (path === "/v1/sample") return sampleData(url, env, cors);
    if (path === "/v1/unsubscribe") return unsubscribeSub(url, env);
    if (path === "/v1/broadcast" && request.method === "POST") return broadcast(request, env, cors);

    if (path === "/v1/dataset") {
      return serveDataset(request, env, url, cors);
    }

    return json({ error: "not found" }, 404, cors);
  },
};

// ---- key recovery: email me my key -----------------------------------------
async function recoverKey(request, env, cors) {
  let email = "";
  try { email = (await request.json()).email || ""; } catch { }
  email = String(email).trim().toLowerCase();
  if (!email || !email.includes("@")) return json({ error: "valid email required" }, 400, cors);
  // scan is not possible in KV without an index; we keep an email->customer map
  const customer = await env.KEYS.get("email:" + email);
  const key = customer && await env.KEYS.get("cust:" + customer);
  const rec = key && await env.KEYS.get(key, "json");
  // Always return the same response whether or not found (don't leak who's a customer)
  if (key && rec && rec.status === "active") {
    try { await sendKeyEmail(env, email, key); } catch (e) { }
  }
  return json({ message: "If that email has an active subscription, its key has been sent." }, 200, cors);
}

// ---- serve the gated dataset ----------------------------------------------
async function serveDataset(request, env, url, cors) {
  const key = url.searchParams.get("key") || bearer(request);
  if (!key) return new Response(JSON.stringify({ error: "payment required", subscribe: "https://app.crawlpriceindex.com", crawler_price: "USD 20.00 per crawl - one weekly edition, the EUR 49/mo Terminal subscription covers the full weekly dataset", licence: "single-subscriber, redistribution prohibited, responses watermarked", terms: "https://crawlpriceindex.com/rsl.xml", ...crawlOffer(env) }), { status: 402, headers: { "Content-Type": "application/json", "crawler-price": "USD 20.00", "payment": "https://app.crawlpriceindex.com", ...cors } });

  const rec = await env.KEYS.get(key, "json");
  if (!rec) return json({ error: "invalid key" }, 401, cors);
  if (rec.status !== "active") return json({ error: "subscription inactive", detail: rec.status }, 402, cors);
  if (rec.expires && Date.now() > rec.expires) return json({ error: "crawl pass expired", detail: "one pass = one weekly edition", renew: "https://api.crawlpriceindex.com/v1/dataset" }, 402, cors);

  // monthly rate-limit (resets on new month)
  const nowMonth = new Date().toISOString().slice(0, 7);
  if (rec.month !== nowMonth) { rec.month = nowMonth; rec.count = 0; }
  if ((rec.count || 0) >= RATE_LIMIT) {
    return json({ error: "monthly rate limit reached", limit: RATE_LIMIT, hint: "unusual volume — contact hello@crawlpriceindex.com" }, 429, cors);
  }
  rec.count = (rec.count || 0) + 1;
  await env.KEYS.put(key, JSON.stringify(rec));

  // fetch the full paid dataset
  // CSV flavour of the same gated dataset — pre-built at publish time so we
  // never parse a multi-MB JSON per request (free-plan CPU ceiling).
  if ((url.searchParams.get("format") || "").toLowerCase() === "csv") {
    const csv = await env.DATA.get("dataset-csv");
    if (!csv) return json({ error: "csv not yet published" }, 503, cors);
    const fp = await sha256(key).then(h => h.slice(0, 16));
    const head = "# The Crawl Price Index — single-subscriber licence. Redistribution prohibited. Traceable.\n"
      + "# issued_to=" + rec.customer + " key_fingerprint=" + fp + " served=" + new Date().toISOString() + "\n";
    return new Response(head + csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": 'attachment; filename="crawl-price-index.csv"',
        "Cache-Control": "no-store",
        ...cors,
      },
    });
  }

  let raw = await env.DATA.get(rec.scope === "snapshot" ? "dataset-snapshot" : "dataset");
  if (!raw) return json({ error: "dataset not yet populated" }, 503, cors);

  // per-customer watermark, stamped by string-splice — no JSON.parse of the
  // multi-MB dataset, so CPU stays tiny as per_domain grows to 50k rows.
  const lic = JSON.stringify({
    issued_to: rec.customer,
    key_fingerprint: await sha256(key).then(h => h.slice(0, 16)),
    terms: "Single-subscriber licence. Redistribution prohibited. Traceable.",
    served: new Date().toISOString(),
  });
  const cut = raw.lastIndexOf("}");
  raw = raw.slice(0, cut) + ',"_license":' + lic + "}";

  return new Response(raw, {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors },
  });
}

// ---- Stripe webhook: lifecycle --------------------------------------------
async function handleWebhook(request, env, cors) {
  const sig = request.headers.get("stripe-signature");
  const body = await request.text();
  const ok = await verifyStripeSig(body, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return json({ error: "bad signature" }, 400, cors);

  const event = JSON.parse(body);
  const type = event.type;
  const obj = event.data.object;

  // subscription created / paid → issue or reactivate a key
  if (type === "checkout.session.completed" || type === "customer.subscription.created" || type === "invoice.paid") {
    const customer = obj.customer || obj.customer_id;
    let email = obj.customer_details?.email || obj.customer_email || "";
    if (customer) {
      let key = await env.KEYS.get("cust:" + customer);
      if (!key) {
        key = "cpi_live_" + crypto.randomUUID().replace(/-/g, "");
        await env.KEYS.put("cust:" + customer, key);
      }
      // fallback: fetch email from the Stripe customer object if the event lacked it
      if (!email && env.STRIPE_SECRET_KEY) {
        try {
          const r = await fetch("https://api.stripe.com/v1/customers/" + customer, {
            headers: { Authorization: "Bearer " + env.STRIPE_SECRET_KEY },
          });
          if (r.ok) email = (await r.json()).email || "";
        } catch (e) { console.error("customer email fetch failed", e); }
      }
      // email->customer map enables key recovery by email
      if (email) await env.KEYS.put("email:" + email.toLowerCase(), customer);
      // preserve created/count/emailed across repeat events (monthly invoice.paid etc.)
      let prev = {};
      try { prev = JSON.parse(await env.KEYS.get(key)) || {}; } catch (e) {}
      const rec = {
        customer,
        email: email || prev.email || "",
        status: "active",
        created: prev.created || new Date().toISOString(),
        month: prev.month || new Date().toISOString().slice(0, 7),
        count: prev.count || 0,
        emailed: !!prev.emailed,
      };
      // send the key once we have an address and haven't sent it yet —
      // whichever event that happens on. Failure never breaks the webhook,
      // but is logged loudly (visible in wrangler tail).
      if (rec.email && !rec.emailed) {
        try { await sendKeyEmail(env, rec.email, key); rec.emailed = true; }
        catch (e) { console.error("sendKeyEmail FAILED", customer, String(e)); }
      }
      await env.KEYS.put(key, JSON.stringify(rec));
    }
  }

  // cancelled / payment failed → revoke
  if (type === "customer.subscription.deleted" || type === "invoice.payment_failed") {
    const customer = obj.customer || obj.customer_id;
    const key = customer && await env.KEYS.get("cust:" + customer);
    if (key) {
      const rec = await env.KEYS.get(key, "json") || {};
      rec.status = (type === "invoice.payment_failed") ? "payment_failed" : "cancelled";
      await env.KEYS.put(key, JSON.stringify(rec));
    }
  }

  return json({ received: true }, 200, cors);
}

// gated free sample (confirmed subscribers only)
async function sampleData(url, env, cors) {
  const email = String(url.searchParams.get("e") || "").trim().toLowerCase();
  const t = url.searchParams.get("t") || "";
  if (!email || t !== await subToken(env, email)) return json({ error: "invalid link" }, 401, cors);
  const rec = await env.KEYS.get("sub:" + email, "json");
  if (!rec || rec.status !== "active") return json({ error: "confirm your subscription first" }, 403, cors);
  const raw = await env.DATA.get("sample");
  if (!raw) return json({ error: "sample not yet published — try again shortly" }, 503, cors);
  return new Response(raw, { headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors } });
}

// ---- public benchmark lookup (one small shard read, never parses the dataset)
async function checkShard(env, domain) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(domain)));
  const shard = await env.DATA.get("lookup:" + (h[0] % 64).toString(16).padStart(2, "0"), "json");
  return shard ? shard[domain] : null;
}
async function checkDomain(url, env, cors) {
  const headers = { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600", ...cors };
  const meta = await env.DATA.get("lookup:meta", "json");
  if (!meta) return new Response(JSON.stringify({ found: false, error: "benchmark index not yet published" }), { status: 503, headers });
  const context = { generated_utc: meta.generated_utc, tranco_top_n: meta.tranco_top_n, robots_parsed: meta.robots_parsed, bots: meta.bots, top_price: meta.top_price };
  let q = String(url.searchParams.get("domain") || "").trim().toLowerCase();
  q = q.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:.*$/, "");
  if (q === "context") return new Response(JSON.stringify({ found: false, context }), { status: 200, headers });
  if (!/^[a-z0-9.-]{3,253}$/.test(q) || !q.includes(".")) return new Response(JSON.stringify({ found: false, error: "invalid domain", context }), { status: 400, headers });
  const candidates = q.startsWith("www.") ? [q, q.slice(4)] : [q, "www." + q];
  let hit = null, hitDomain = null;
  for (const c of candidates) { hit = await checkShard(env, c); if (hit) { hitDomain = c; break; } }
  if (!hit) return new Response(JSON.stringify({ found: false, domain: q, context }), { status: 200, headers });
  const stances = {}; let blocked = 0, any = false;
  meta.bots.forEach((b, i) => { const v = hit[i + 1] || "u"; stances[b] = v; if (v === "b") blocked++; if (v !== "n") any = true; });
  let percentile = null;
  if (any && Array.isArray(meta.hist)) {
    let below = 0, total = 0;
    meta.hist.forEach((c, i) => { total += c; if (i < blocked) below += c; });
    if (total > 0) percentile = 100 * below / total;
  }
  return new Response(JSON.stringify({ found: true, domain: hitDomain, rank: hit[0] || null, stances, blocked_count: blocked, percentile, context }), { status: 200, headers });
}

// ---- machine access: pay on-chain, redeem for a one-edition snapshot pass
const CRAWL_PRICE_USDC = 20;                                    // default when CRAWL_PRICE_USDC is unset
function crawlPrice(env) { const v = parseFloat(env.CRAWL_PRICE_USDC); return v > 0 ? v : CRAWL_PRICE_USDC; }                                    // machine per-crawl price; Terminal is EUR 49/mo for the full dataset
const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"; // USDC on Base
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
function payToAddr(env) { return String(env.X402_PAY_TO || "").toLowerCase(); }
function crawlOffer(env) {
  return {
    x402Version: 1,
    accepts: [{
      scheme: "exact", network: "base", asset: USDC_BASE,
      maxAmountRequired: String(Math.round(crawlPrice(env) * 1000000)),
      payTo: payToAddr(env),
      resource: "https://api.crawlpriceindex.com/v1/dataset",
      description: "One weekly edition of the Crawl Price Index dataset (current snapshot; trends and history are subscriber-only)",
      mimeType: "application/json",
      maxTimeoutSeconds: 300,
      extra: { redeem: "https://api.crawlpriceindex.com/v1/redeem?tx=YOUR_TX_HASH", pass_days: 7 },
    }],
  };
}
const BASE_RPCS = [
  "https://base-rpc.publicnode.com",
  "https://base.llamarpc.com",
  "https://mainnet.base.org",
  "https://1rpc.io/base",
  "https://base.drpc.org",
];
async function baseRpc(method, params) {
  const rounds = 3;
  let lastErr = "no endpoints tried";
  for (let round = 0; round < rounds; round++) {
   if (round > 0) await new Promise(r => setTimeout(r, 700));
   for (const url of BASE_RPCS) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      if (!r.ok) { lastErr = url + " -> HTTP " + r.status; continue; }
      const j = await r.json();
      if (j.error) { lastErr = url + " -> " + (j.error.message || "rpc error"); continue; }
      return j.result;
    } catch (e) { lastErr = url + " -> " + String(e); }
   }
  }
  throw new Error("all Base RPC endpoints failed after " + rounds + " rounds (" + lastErr + ")");
}

async function redeemCrawl(url, env, cors) {
  const tx = String(url.searchParams.get("tx") || "").trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(tx)) return json({ error: "pass tx=<transaction hash>", offer: crawlOffer(env) }, 400, cors);
  if (!payToAddr(env)) return json({ error: "payments not configured" }, 503, cors);
  const existing = await env.KEYS.get("tx:" + tx);
  if (existing) {
    const r0 = await env.KEYS.get(existing, "json");
    return json({ key: existing, scope: "snapshot", expires: r0 && r0.expires, note: "already redeemed", dataset: "https://api.crawlpriceindex.com/v1/dataset?key=" + existing }, 200, cors);
  }
  let receipt;
  try { receipt = await baseRpc("eth_getTransactionReceipt", [tx]); }
  catch (e) { return json({ error: "could not verify on-chain", detail: String(e) }, 502, cors); }
  if (!receipt) return json({ error: "transaction not found or not yet mined" }, 404, cors);
  if (receipt.status !== "0x1") return json({ error: "transaction failed on-chain" }, 400, cors);
  const want = BigInt(Math.round(crawlPrice(env) * 1000000));
  const to32 = "0x" + payToAddr(env).slice(2).padStart(64, "0");
  let paid = 0n;
  for (const log of receipt.logs || []) {
    if (String(log.address).toLowerCase() !== USDC_BASE) continue;
    if (!log.topics || String(log.topics[0]).toLowerCase() !== TRANSFER_TOPIC) continue;
    if (String(log.topics[2]).toLowerCase() !== to32) continue;
    try { paid += BigInt(log.data); } catch (e) {}
  }
  if (paid < want) return json({ error: "insufficient payment", paid_usdc: Number(paid) / 1e6, required_usdc: crawlPrice(env), offer: crawlOffer(env) }, 402, cors);
  const key = "cpi_snap_" + crypto.randomUUID().replace(/-/g, "");
  const expires = Date.now() + 7 * 86400000;
  const rec = { customer: "x402:" + tx.slice(0, 18), scope: "snapshot", status: "active", created: new Date().toISOString(), expires, month: new Date().toISOString().slice(0, 7), count: 0, emailed: true, paid_usdc: Number(paid) / 1e6 };
  await env.KEYS.put(key, JSON.stringify(rec));
  await env.KEYS.put("tx:" + tx, key, { expirationTtl: 2592000 });
  return json({ key, scope: "snapshot", expires_utc: new Date(expires).toISOString(), pass_days: 7, dataset: "https://api.crawlpriceindex.com/v1/dataset?key=" + key, note: "This pass serves the current weekly edition. Trends, history, country editions and the movers feed are subscriber-only: https://app.crawlpriceindex.com" }, 200, cors);
}

// ---- provenance: how we measure, machine-readable ------------------------
async function methodologyDoc(env, cors) {
  const headers = { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600", ...cors };
  const meta = await env.DATA.get("lookup:meta", "json");
  const raw = await env.DATA.get("dataset-snapshot");
  let ev = null, mv = null;
  if (raw) {
    // pull just the two fields we need without parsing the whole edition
    const mvM = raw.match(/"methodology_version":"([^"]+)"/);
    mv = mvM ? mvM[1] : null;
    const i = raw.indexOf('"evidence":');
    if (i > -1) {
      let depth = 0, j = raw.indexOf("{", i);
      for (let k = j; k < raw.length && k < j + 20000; k++) {
        if (raw[k] === "{") depth++;
        else if (raw[k] === "}") { depth--; if (depth === 0) { try { ev = JSON.parse(raw.slice(j, k + 1)); } catch (e) {} break; } }
      }
    }
  }
  return new Response(JSON.stringify({
    methodology_version: mv,
    generated_utc: meta && meta.generated_utc,
    coverage: meta ? { tranco_top_n: meta.tranco_top_n, robots_parsed: meta.robots_parsed, crawlers_tracked: (meta.bots || []).length } : null,
    evidence: ev,
    human_readable: "https://crawlpriceindex.com/methodology.html",
    crawler_key_directory: "https://crawlpriceindex.com/.well-known/http-message-signatures-directory",
    contact: "hello@crawlpriceindex.com",
  }, null, 2), { status: 200, headers });
}

// ---- change alerts: the recurring workflow -------------------------------
// KEYS: watch:<email>:<domain> -> { status, created, last } with metadata
// {s} so the weekly diff job can list actives without per-key reads.
async function addWatch(request, env, cors) {
  let email = "", domain = "";
  try { const b = await request.json(); email = b.email || ""; domain = b.domain || ""; } catch (e) {}
  email = String(email).trim().toLowerCase();
  domain = String(domain).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:.*$/, "");
  if (!email || !email.includes("@") || email.length > 254) return json({ error: "valid email required" }, 400, cors);
  if (!/^[a-z0-9.-]{3,253}$/.test(domain) || !domain.includes(".")) return json({ error: "valid domain required" }, 400, cors);
  const id = email + ":" + domain;
  const t = await subToken(env, id);
  await env.KEYS.put("watch:" + id, JSON.stringify({ status: "pending", email, domain, created: new Date().toISOString() }), { metadata: { s: "pending" } });
  const cUrl = "https://api.crawlpriceindex.com/v1/watch/confirm?e=" + encodeURIComponent(email) + "&d=" + encodeURIComponent(domain) + "&t=" + t;
  const xUrl = "https://api.crawlpriceindex.com/v1/watch/stop?e=" + encodeURIComponent(email) + "&d=" + encodeURIComponent(domain) + "&t=" + t;
  const txt = "Confirm alerts for " + domain + ".\n\nWe scan the web weekly. If any AI crawler's access to " + domain + " changes - a new block, an unblock, a price or paywall appearing - you get one email naming exactly what changed.\n\nConfirm: " + cUrl + "\n\nNot you? " + xUrl;
  const htm = brandCard("<h1 style=\"margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:24px;line-height:1.15;color:#0d2b23\">Confirm alerts for " + domain + "</h1>"
    + "<p style=\"margin:0\">We scan the web every week. If any AI crawler&rsquo;s access to this domain changes &mdash; a new block, an unblock, a price or a paywall appearing &mdash; you get one email naming exactly what changed.</p>"
    + btn(cUrl, "Confirm alerts")
    + "<p style=\"font-size:11.5px;color:#6b6152;margin:0\">Not you? <a href=\"" + xUrl + "\" style=\"color:#6b6152\">Cancel this request</a>.</p>");
  try { await sendListEmail(env, email, "Confirm alerts for " + domain, txt, htm); }
  catch (e) { console.error("watch confirm email FAILED", String(e)); }
  return json({ message: "Check your inbox to confirm alerts for " + domain + "." }, 200, cors);
}
async function confirmWatch(url, env, cors) {
  const email = String(url.searchParams.get("e") || "").trim().toLowerCase();
  const domain = String(url.searchParams.get("d") || "").trim().toLowerCase();
  const t = url.searchParams.get("t") || "";
  if (!email || !domain || t !== await subToken(env, email + ":" + domain)) return subPage("Invalid link", "This confirmation link is not valid.");
  const rec = await env.KEYS.get("watch:" + email + ":" + domain, "json");
  if (!rec) return subPage("Invalid link", "This confirmation link is not valid.");
  rec.status = "active"; rec.confirmed = new Date().toISOString();
  await env.KEYS.put("watch:" + email + ":" + domain, JSON.stringify(rec), { metadata: { s: "active" } });
  return subPage("Watching " + domain + ".", "From the next weekly scan, you will be emailed the moment any tracked AI crawler&#39;s access to this domain changes. Nothing else - no newsletter unless you asked for it separately.");
}
async function stopWatch(url, env, cors) {
  const email = String(url.searchParams.get("e") || "").trim().toLowerCase();
  const domain = String(url.searchParams.get("d") || "").trim().toLowerCase();
  const t = url.searchParams.get("t") || "";
  if (!email || !domain || t !== await subToken(env, email + ":" + domain)) return subPage("Invalid link", "This link is not valid.");
  await env.KEYS.delete("watch:" + email + ":" + domain);
  return subPage("Alerts stopped.", "You will not receive further alerts for " + domain + ".");
}

// admin: active watches (for the weekly alert job)
async function listWatches(request, env, cors) {
  if ((request.headers.get("x-admin-token") || "") !== (env.ADMIN_TOKEN || "?")) return json({ error: "unauthorized" }, 401, cors);
  const watches = []; let cursor;
  do {
    const p = await env.KEYS.list({ prefix: "watch:", cursor });
    for (const k of p.keys) {
      if (!k.metadata || k.metadata.s !== "active") continue;
      const rest = k.name.slice(6);
      const i = rest.lastIndexOf(":");
      if (i > 0) watches.push({ email: rest.slice(0, i), domain: rest.slice(i + 1) });
    }
    cursor = p.list_complete ? null : p.cursor;
  } while (cursor);
  return json({ watches, count: watches.length }, 200, cors);
}
// admin: send one alert email (body composed by the local job)
async function sendAlert(request, env, cors) {
  if ((request.headers.get("x-admin-token") || "") !== (env.ADMIN_TOKEN || "?")) return json({ error: "unauthorized" }, 401, cors);
  let p = {};
  try { p = await request.json(); } catch (e) {}
  if (!p.email || !p.subject || !p.text) return json({ error: "email, subject and text required" }, 400, cors);
  const t = await subToken(env, p.email);
  const unsub = "https://api.crawlpriceindex.com/v1/unsubscribe?e=" + encodeURIComponent(p.email) + "&t=" + t;
  try {
    await sendListEmail(env, p.email, p.subject, p.text + "\n\nManage alerts: https://crawlpriceindex.com/check",
      (p.html || "<pre>" + p.text + "</pre>") + '<p style="font-size:11px;color:#6b787d;font-family:ui-monospace,monospace;margin-top:20px"><a href="https://crawlpriceindex.com/check" style="color:#6b787d">Manage alerts</a></p>');
  } catch (e) { return json({ error: "send failed", detail: String(e) }, 502, cors); }
  return json({ sent: 1 }, 200, cors);
}

// admin: subscriber counts (x-admin-token)
async function listSubs(request, env, cors) {
  if ((request.headers.get("x-admin-token") || "") !== (env.ADMIN_TOKEN || "?")) return json({ error: "unauthorized" }, 401, cors);
  let active = 0, pending = 0, cursor; const latest = [];
  do {
    const p = await env.KEYS.list({ prefix: "sub:", cursor });
    for (const k of p.keys) {
      if (k.metadata && k.metadata.s === "active") { active++; if (latest.length < 50) latest.push(k.name.slice(4)); }
      else pending++;
    }
    cursor = p.list_complete ? null : p.cursor;
  } while (cursor);
  return json({ active, pending, latest }, 200, cors);
}

// ---- free tier: The Weekly Crawl subscriber list ---------------------------
// KEYS: sub:<email> -> { status, created } with KV metadata {s} so broadcast
// can list without per-subscriber reads. Links carry HMAC(email, LIST_SECRET).
async function subToken(env, email) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.LIST_SECRET || ""), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const m = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(email));
  return [...new Uint8Array(m)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
function subPage(title, msg) {
  const h = '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#f5f1e8;color:#28352f;font-family:-apple-system,Segoe UI,Roboto,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center"><div style="max-width:480px;padding:32px;text-align:center"><div style="color:#1c5d4a;font-family:ui-monospace,Menlo,monospace;font-size:12px;letter-spacing:.18em;text-transform:uppercase">Crawl Price Index</div><h1 style="color:#0d2b23;font-family:Georgia,\'Times New Roman\',serif;font-weight:400;font-size:26px;margin:16px 0 10px">' + title + '</h1><p style="font-size:15px;line-height:1.6">' + msg + '</p><p style="margin-top:22px"><a href="https://crawlpriceindex.com" style="color:#1c5d4a">&larr; crawlpriceindex.com</a></p></div>';
  return new Response(h, { headers: { "Content-Type": "text/html;charset=utf-8" } });
}
// CPI-branded email shell — matches app/_worker.js mailShell (white bg, deep-green
// header, gold rule, cream card, serif headline via <h1> in bodyHtml, mono labels).
function brandCard(bodyHtml) {
  return '<!doctype html><html><body style="margin:0;background:#ffffff;padding:28px 12px">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#f5f1e8;border:1px solid #e4dcc7;border-radius:4px;overflow:hidden">'
    + '<tr><td style="background:#0d2b23;padding:22px 32px;border-bottom:3px solid #c9a24b">'
    + '<span style="font-family:ui-monospace,Menlo,monospace;font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#f5f1e8">Crawl&nbsp;Price&nbsp;Index</span></td></tr>'
    + '<tr><td style="padding:32px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#28352f">' + bodyHtml + '</td></tr>'
    + '<tr><td style="padding:20px 32px;background:#eee7d6;border-top:1px solid #ded4bd">'
    + '<p style="margin:0;font-family:ui-monospace,Menlo,monospace;font-size:11px;line-height:1.6;color:#6b6152">The Crawl Price Index &middot; a weekly census of how the top 50,000 domains declare policy toward AI crawlers.<br><a href="https://crawlpriceindex.com" style="color:#1c5d4a">crawlpriceindex.com</a></p></td></tr>'
    + '</table></body></html>';
}
const btn = (href, label) => '<p style="margin:22px 0"><a href="' + href + '" style="display:inline-block;background:#1c5d4a;color:#f5f1e8;font-family:ui-monospace,Menlo,monospace;font-size:13px;letter-spacing:.03em;padding:13px 24px;text-decoration:none;border-radius:3px">' + label + ' &rarr;</a></p>';

async function sendListEmail(env, to, subject, text, html) {
  if (!env.RESEND_API_KEY) throw new Error("no RESEND_API_KEY");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Crawl Price Index <weekly@crawlpriceindex.com>", to: [to], subject, text, html }),
  });
  if (!r.ok) throw new Error("resend failed: " + r.status);
}
async function subscribe(request, env, cors) {
  let email = "";
  try { email = (await request.json()).email || ""; } catch { }
  email = String(email).trim().toLowerCase();
  if (!email || !email.includes("@") || email.length > 254) return json({ error: "valid email required" }, 400, cors);
  const existing = await env.KEYS.get("sub:" + email, "json");
  if (!existing || existing.status !== "active") {
    // Single opt-in: activate immediately and send one welcome + free-sample email.
    const now = new Date().toISOString();
    await env.KEYS.put("sub:" + email, JSON.stringify({ status: "active", created: now, confirmed: now }), { metadata: { s: "active" } });
    try { await sendWelcomeSample(env, email); }
    catch (e) { console.error("welcome email FAILED", String(e)); }
  }
  return json({ message: "You're in — check your inbox for your free sample." }, 200, cors);
}
// One branded welcome + free-sample email (used by single opt-in subscribe,
// and still by the legacy confirm link for any pending signups).
async function sendWelcomeSample(env, email) {
  const st = await subToken(env, email);
  const sUrl = "https://crawlpriceindex.com/sample.html?e=" + encodeURIComponent(email) + "&t=" + st;
  const uUrl = "https://api.crawlpriceindex.com/v1/unsubscribe?e=" + encodeURIComponent(email) + "&t=" + st;
  const wtxt = "You are in.\n\nYour free sample — the top 100 domains' complete AI-crawler rows, real data from the latest scan:\n" + sUrl + "\n\nEvery week: which domains changed their AI policy, block-rate shifts, observed crawl prices.\n\nFull dataset — every domain, weekly history and the change feed: the Terminal, €49/mo: https://app.crawlpriceindex.com\n\nUnsubscribe: " + uUrl;
  const whtm = brandCard('<h1 style="margin:0 0 14px;font-family:Georgia,\'Times New Roman\',serif;font-weight:400;font-size:26px;line-height:1.15;color:#0d2b23">You are in.</h1>'
    + '<p style="margin:0 0 4px">Here is your free sample &mdash; the top-100 domains&rsquo; complete AI-crawler rows, real data from the latest scan.</p>'
    + btn(sUrl, 'Open your sample')
    + '<p style="margin:0 0 4px">Every week from here: <b>which domains changed their AI policy</b>, block-rate shifts, and observed crawl prices.</p>'
    + '<p style="margin:18px 0 0;padding:14px 16px;background:#efe8d7;border-left:3px solid #c9a24b;font-family:ui-monospace,Menlo,monospace;font-size:12px;line-height:1.6;color:#6b6152">Want it all &mdash; every domain, weekly history and the change feed? The Terminal is &euro;49/mo: <a href="https://app.crawlpriceindex.com" style="color:#1c5d4a">app.crawlpriceindex.com</a></p>'
    + '<p style="font-size:11px;margin:14px 0 0"><a href="' + uUrl + '" style="color:#9aa5a1">Unsubscribe anytime</a></p>');
  await sendListEmail(env, email, "Your free Crawl Price Index sample", wtxt, whtm);
}

async function confirmSub(url, env) {
  const email = String(url.searchParams.get("e") || "").trim().toLowerCase();
  const t = url.searchParams.get("t") || "";
  if (!email || t !== await subToken(env, email)) return subPage("Invalid link", "This confirmation link is not valid.");
  const rec = await env.KEYS.get("sub:" + email, "json");
  if (!rec) return subPage("Invalid link", "This confirmation link is not valid.");
  rec.status = "active"; rec.confirmed = new Date().toISOString();
  await env.KEYS.put("sub:" + email, JSON.stringify(rec), { metadata: { s: "active" } });
  try { await sendWelcomeSample(env, email); }   // legacy pending links → same welcome+sample
  catch (e) { console.error("welcome email FAILED", String(e)); }
  return subPage("You are in.", "The Weekly Crawl lands in your inbox once a week - the headline numbers of what the web charges AI. Unsubscribe anytime from any email.");
}
async function unsubscribeSub(url, env) {
  const email = String(url.searchParams.get("e") || "").trim().toLowerCase();
  const t = url.searchParams.get("t") || "";
  if (!email || t !== await subToken(env, email)) return subPage("Invalid link", "This unsubscribe link is not valid.");
  await env.KEYS.delete("sub:" + email);
  return subPage("Unsubscribed.", "You will not receive The Weekly Crawl anymore.");
}
async function broadcast(request, env, cors) {
  if ((request.headers.get("x-admin-token") || "") !== (env.ADMIN_TOKEN || "?")) return json({ error: "unauthorized" }, 401, cors);
  let p = {};
  try { p = await request.json(); } catch { }
  if (!p.subject || !p.text) return json({ error: "subject and text required" }, 400, cors);
  const lock = await env.KEYS.get("broadcast:lock");
  if (lock && !p.force) return json({ error: "already sent recently", last: lock, hint: "pass force:true to override" }, 429, cors);
  const emails = [];
  let cursor;
  do {
    const page = await env.KEYS.list({ prefix: "sub:", cursor });
    for (const k of page.keys) if (k.metadata && k.metadata.s === "active") emails.push(k.name.slice(4));
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  if (!emails.length) return json({ sent: 0, note: "no active subscribers" }, 200, cors);
  let sent = 0;
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100);
    const batch = [];
    for (const to of chunk) {
      const t = await subToken(env, to);
      const unsub = "https://api.crawlpriceindex.com/v1/unsubscribe?e=" + encodeURIComponent(to) + "&t=" + t;
      const htmlBody = (p.html || ('<pre style="font-family:ui-monospace,Menlo,monospace;white-space:pre-wrap">' + p.text + "</pre>"));
      batch.push({
        from: "Crawl Price Index <weekly@crawlpriceindex.com>",
        to: [to],
        subject: p.subject,
        text: p.text + "\n\nUnsubscribe: " + unsub,
        html: htmlBody + '<p style="font-size:11px;color:#6b787d;font-family:ui-monospace,monospace;margin-top:24px"><a href="' + unsub + '" style="color:#6b787d">Unsubscribe</a></p>',
      });
    }
    const r = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { "Authorization": "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });
    if (r.ok) sent += chunk.length; else console.error("broadcast batch FAILED", r.status);
  }
  await env.KEYS.put("broadcast:lock", new Date().toISOString(), { expirationTtl: 72000 });
  return json({ sent, subscribers: emails.length }, 200, cors);
}

// ---- email sender ----------------------------------------------------------
// Sends the API key to a customer. Supports two providers depending on which
// secret is set:
//   RESEND_API_KEY  → uses Resend (recommended; simplest, reliable)
//   (fallback)      → MailChannels (free from Workers, needs domain SPF/DKIM)
// From address: keys@crawlpriceindex.com. Non-fatal on failure.
async function sendKeyEmail(env, to, key) {
  const subject = "Your Crawl Price Index API key";
  const apiUrl = "https://api.crawlpriceindex.com/v1/dataset?key=" + key;
  const text =
`Welcome to the Crawl Price Index Terminal.

Your API key:
  ${key}

Get the full dataset (updated weekly, with trends & history):
  ${apiUrl}

Or pass it as a header:
  Authorization: Bearer ${key}

Keep this key private — it is tied to your subscription and rate-limited.
This is a single-subscriber licence; redistribution is prohibited and traceable.
Full terms: https://crawlpriceindex.com/terms.html
Lost your key later? https://crawlpriceindex.com/recover.html

— The Crawl Price Index`;

  const html = brandCard(
    '<h1 style="margin:0 0 14px;font-family:Georgia,\'Times New Roman\',serif;font-weight:400;font-size:26px;line-height:1.15;color:#0d2b23">Your API key</h1>'
    + '<p style="margin:0 0 12px">Here is your Crawl Price Index API key for the full weekly dataset.</p>'
    + '<p style="font-family:ui-monospace,Menlo,monospace;font-size:15px;background:#efe8d7;border:1px solid #ded4bd;border-radius:4px;padding:12px 14px;word-break:break-all;color:#0d2b23;margin:0 0 16px">' + key + '</p>'
    + '<p style="margin:0 0 8px">Full dataset (weekly, with trends &amp; history):<br><a href="' + apiUrl + '" style="color:#1c5d4a;word-break:break-all">' + apiUrl + '</a></p>'
    + '<p style="font-size:13px;color:#6b6152;margin:0 0 8px">Or send header <code>Authorization: Bearer ' + key + '</code></p>'
    + '<p style="font-size:12px;color:#6b6152;margin:0">Single-subscriber licence &mdash; redistribution prohibited &amp; traceable. <a href="https://crawlpriceindex.com/terms.html" style="color:#1c5d4a">Terms</a> &middot; <a href="https://crawlpriceindex.com/recover.html" style="color:#1c5d4a">Recover key</a></p>');

  if (env.RESEND_API_KEY) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Crawl Price Index <keys@crawlpriceindex.com>", to: [to], subject, text, html }),
    });
    if (!r.ok) throw new Error("resend failed: " + r.status);
    return;
  }
  // MailChannels fallback (free from Cloudflare Workers)
  const r = await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: "keys@crawlpriceindex.com", name: "Crawl Price Index" },
      subject, content: [{ type: "text/plain", value: text }, { type: "text/html", value: html }],
    }),
  });
  if (!r.ok) throw new Error("mailchannels failed: " + r.status);
}

// ---- Web Bot Auth key directory (RFC 9421 profile) -------------------------
const WBA_JWKS = {
  "keys": [
    {
      "crv": "Ed25519",
      "x": "nqx_2Hm-Wb7_2DRRG5M9wuSp48AQRlfIVmjjD-ZKD0I",
      "kty": "OKP",
      "kid": "7aTiXCf9gQKA-5jTPraozVjn7D4v05T4YnZYcBhcOks",
      "nbf": 1786300844
    }
  ]
};
async function wbaDirectory(request, env, cors) {
  const body = JSON.stringify(WBA_JWKS);
  const headers = { "Content-Type": "application/http-message-signatures-directory+json", "Cache-Control": "max-age=86400", ...cors };
  try {
    if (env.WBA_PRIVATE_PKCS8) {
      const raw = Uint8Array.from(atob(env.WBA_PRIVATE_PKCS8), c => c.charCodeAt(0));
      let key = null, alg = "Ed25519";
      try { key = await crypto.subtle.importKey("pkcs8", raw, { name: "Ed25519" }, false, ["sign"]); }
      catch (e) { alg = "NODE-ED25519"; key = await crypto.subtle.importKey("pkcs8", raw, { name: "NODE-ED25519", namedCurve: "NODE-ED25519" }, false, ["sign"]); }
      const created = Math.floor(Date.now() / 1000), expires = created + 600;
      const params = "(\"@authority\");created=" + created + ";expires=" + expires + ";keyid=\"" + WBA_JWKS.keys[0].kid + "\";tag=\"web-bot-auth\"";
      const base = "\"@authority\": " + new URL(request.url).host + "\n" + "\"@signature-params\": " + params;
      const sig = await crypto.subtle.sign(alg === "Ed25519" ? "Ed25519" : { name: "NODE-ED25519" }, key, new TextEncoder().encode(base));
      const bytes = new Uint8Array(sig); let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      headers["Signature-Input"] = "sig=" + params;
      headers["Signature"] = "sig=:" + btoa(bin) + ":";
    }
  } catch (e) { console.error("wba directory signing failed", String(e)); }
  return new Response(body, { status: 200, headers });
}

// ---- helpers ---------------------------------------------------------------
function json(o, status, cors) {
  return new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", ...cors } });
}
function bearer(req) {
  const a = req.headers.get("authorization") || "";
  return a.startsWith("Bearer ") ? a.slice(7) : null;
}
async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
// Stripe signature verification (HMAC-SHA256 over `t.payload`, constant-time compare)
async function verifyStripeSig(payload, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  const parts = Object.fromEntries(sigHeader.split(",").map(p => p.split("=")));
  const t = parts.t, v1 = parts.v1;
  if (!t || !v1) return false;
  // reject if timestamp older than 5 min (replay protection)
  if (Math.abs(Date.now() / 1000 - parseInt(t)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`));
  const expected = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, "0")).join("");
  // constant-time compare
  if (expected.length !== v1.length) return false;
  let diff = 0; for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}
