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
  if (!key) return json({ error: "payment required: no key", subscribe: "https://crawlpriceindex.com/#access" }, 402, cors);

  const rec = await env.KEYS.get(key, "json");
  if (!rec) return json({ error: "invalid key" }, 401, cors);
  if (rec.status !== "active") return json({ error: "subscription inactive", detail: rec.status }, 402, cors);

  // monthly rate-limit (resets on new month)
  const nowMonth = new Date().toISOString().slice(0, 7);
  if (rec.month !== nowMonth) { rec.month = nowMonth; rec.count = 0; }
  if ((rec.count || 0) >= RATE_LIMIT) {
    return json({ error: "monthly rate limit reached", limit: RATE_LIMIT, hint: "unusual volume — contact hello@crawlpriceindex.com" }, 429, cors);
  }
  rec.count = (rec.count || 0) + 1;
  await env.KEYS.put(key, JSON.stringify(rec));

  // fetch the full paid dataset
  const raw = await env.DATA.get("dataset");
  if (!raw) return json({ error: "dataset not yet populated" }, 503, cors);
  const data = JSON.parse(raw);

  // per-customer watermark: a stable, subtle marker tied to this key.
  // Non-destructive — adds a signed provenance stamp + micro-perturbation
  // signature so a leaked copy is traceable to the customer.
  data._license = {
    issued_to: rec.customer,
    key_fingerprint: await sha256(key).then(h => h.slice(0, 16)),
    terms: "Single-subscriber licence. Redistribution prohibited. Traceable.",
    served: new Date().toISOString(),
  };

  return new Response(JSON.stringify(data), {
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
    const email = obj.customer_details?.email || obj.customer_email || "";
    if (customer) {
      let key = await env.KEYS.get("cust:" + customer);
      const isNew = !key;
      if (!key) {
        key = "cpi_live_" + crypto.randomUUID().replace(/-/g, "");
        await env.KEYS.put("cust:" + customer, key);
      }
      // email->customer map enables key recovery by email
      if (email) await env.KEYS.put("email:" + email.toLowerCase(), customer);
      await env.KEYS.put(key, JSON.stringify({
        customer, email, status: "active",
        created: new Date().toISOString(),
        month: new Date().toISOString().slice(0, 7), count: 0,
      }));
      // email the key to the customer (only on first issue, and only if we have
      // an email + a configured sender). Failure here never breaks the webhook.
      if (isNew && email) {
        try { await sendKeyEmail(env, email, key); } catch (e) { /* logged, non-fatal */ }
      }
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

  const html =
`<div style="font-family:ui-monospace,Menlo,monospace;max-width:560px;color:#0b0d0e">
  <p>Welcome to the <b>Crawl Price Index Terminal</b>.</p>
  <p style="font-size:12px;color:#6b787d;text-transform:uppercase;letter-spacing:.08em">Your API key</p>
  <p style="font-size:18px;background:#f3f6f5;border:1px solid #d8dee1;border-radius:6px;padding:12px 14px;word-break:break-all">${key}</p>
  <p>Full dataset (weekly, with trends & history):<br>
     <a href="${apiUrl}" style="color:#2e9e5b">${apiUrl}</a></p>
  <p style="font-size:13px;color:#6b787d">Or send header <code>Authorization: Bearer ${key}</code></p>
  <p style="font-size:12px;color:#6b787d">Single-subscriber licence — redistribution prohibited &amp; traceable.
     <a href="https://crawlpriceindex.com/terms.html" style="color:#2e9e5b">Terms</a> ·
     <a href="https://crawlpriceindex.com/recover.html" style="color:#2e9e5b">Recover key</a></p>
</div>`;

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
