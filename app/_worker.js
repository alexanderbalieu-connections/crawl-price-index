/**
 * CPI app — Pages advanced-mode Worker (single entry point, always compiled).
 *
 * Routes:
 *   /api/domains          -> verify Clerk JWT, ENFORCE TIER, serve per-domain payload
 *   /api/checkout   (POST)-> create a Stripe Checkout Session (subscription OR snapshot)
 *   /api/portal     (POST)-> create a Stripe Billing Portal session (manage/cancel)
 *   /api/snapshot   (GET) -> verify a paid one-off Checkout session, serve the dataset once
 *   /api/stripe-webhook   -> Stripe events -> set Clerk tier (subscription lifecycle)
 *   /private/*            -> 403 (never directly reachable)
 *   everything else       -> static assets
 *
 * Secrets (set with: wrangler pages secret put NAME --project-name=cpi-app):
 *   STRIPE_SECRET_KEY      sk_live_… (or sk_test_…)
 *   STRIPE_WEBHOOK_SECRET  whsec_…   (from the webhook endpoint)
 *   CLERK_SECRET_KEY       sk_…      (Clerk backend key; writes the user's tier)
 * Optional vars:
 *   ADMIN_EMAILS           comma-separated emails that always get Terminal access.
 *                          Checked against Clerk's stored email, not the token's,
 *                          and reported on the Account tab so a grant from this
 *                          list is never mistaken for a paid subscription.
 *   RESEND_API_KEY         Resend key; enables branded welcome/snapshot emails (non-fatal if unset)
 *
 * The two Stripe price IDs are NOT secret and live here as constants.
 */
const FRONTEND_API = "clerk.crawlpriceindex.com";
const PRICE_SUB = "price_1U6PU1Rvq8NsY4rHwTRPlb14";   // Terminal — €49/mo subscription
const PRICE_SNAP = "price_1U6PUvRvq8NsY4rHQDea1YVe";  // Snapshot — €29 one-off
const APP_ORIGIN = "https://app.crawlpriceindex.com";
const MAIL_FROM = "Crawl Price Index <hello@crawlpriceindex.com>";
const MAIL_SUPPORT = "hello@crawlpriceindex.com";

let JWKS = null, JWKS_AT = 0;

function j(o, status, extra) {
  const headers = Object.assign({ "content-type": "application/json; charset=utf-8" }, extra || {});
  return new Response(JSON.stringify(o), { status, headers });
}
function b64urlToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  s += "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ---------- Clerk JWT verification (unchanged core) ---------------------- */
async function jwks() {
  const now = Date.now();
  if (JWKS && now - JWKS_AT < 3600e3) return JWKS;
  const r = await fetch(`https://${FRONTEND_API}/.well-known/jwks.json`);
  if (!r.ok) throw new Error("jwks");
  JWKS = await r.json(); JWKS_AT = now;
  return JWKS;
}
async function verify(token) {
  const p = token.split(".");
  if (p.length !== 3) return null;
  let head, body;
  try {
    head = JSON.parse(new TextDecoder().decode(b64urlToBytes(p[0])));
    body = JSON.parse(new TextDecoder().decode(b64urlToBytes(p[1])));
  } catch (e) { return null; }
  if (head.alg !== "RS256") return null;
  const set = await jwks();
  const k = (set.keys || []).find(x => x.kid === head.kid);
  if (!k) return null;
  const key = await crypto.subtle.importKey("jwk",
    { kty: k.kty, n: k.n, e: k.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(p[2]),
    new TextEncoder().encode(p[0] + "." + p[1]));
  if (!ok) return null;
  const now = Math.floor(Date.now() / 1000);
  if (body.exp && body.exp < now - 5) return null;
  if (body.nbf && body.nbf > now + 5) return null;
  return body;
}
async function authClaims(request) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return { error: "authentication required", status: 401 };
  let claims;
  try { claims = await verify(token); }
  catch (e) { return { error: "verification unavailable", status: 503 }; }
  if (!claims) return { error: "invalid or expired session", status: 401 };
  return { claims };
}

/* How long a one-off snapshot download link stays live after purchase. */
const SNAPSHOT_MAX_AGE_S = 48 * 60 * 60;

/* ---------- entitlement -------------------------------------------------- */
// Terminal access if the Clerk session token carries tier==="terminal"
// (set by the Stripe webhook), or the user's email is in ADMIN_EMAILS.
function adminList(env) {
  return (env.ADMIN_EMAILS || "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
}
// Clerk's public_metadata is the source of truth: the Stripe webhook writes
// it, and unlike the session-token claim it cannot be changed by editing a
// token template in a dashboard. Returns a decision object so the reason is
// reportable to /api/me rather than collapsing to a bare boolean.
async function entitlementOf(claims, env) {
  const out = { entitled: false, tier: "none", via: "none", authoritative: false };
  if (!claims || !claims.sub) return out;

  let user = null;
  try { user = await getClerkUser(env, claims.sub); } catch (e) { user = null; }

  if (user) {
    out.authoritative = true;
    const md = user.public_metadata || {};
    out.tier = md.tier || "none";
    if (md.tier === "terminal") { out.entitled = true; out.via = "subscription"; return out; }
    const primId = user.primary_email_address_id;
    const list = user.email_addresses || [];
    const em = list.find(e => e.id === primId) || list[0];
    const email = (em && em.email_address || "").toLowerCase();
    if (email && adminList(env).includes(email)) {
      out.entitled = true; out.via = "admin-list";
    }
    return out;
  }

  // Clerk unreachable: we cannot answer, so we do not grant. Trusting the
  // token's tier claim here would reopen the hole this function exists to
  // close — the claim is only as trustworthy as the session-token template.
  // Callers must tell this apart from a confirmed "no": out.authoritative is
  // false here, and the gated routes answer 503 rather than 402.
  out.tier = "unknown";
  out.via = "unverified";
  return out;
}
// Convenience boolean. Prefer entitlementOf() at a call site that needs to
// tell "no subscription" apart from "could not check" — they are different
// answers and deserve different HTTP statuses.
async function entitled(claims, env) {
  return (await entitlementOf(claims, env)).entitled;
}

/* ---------- tiny Stripe REST helpers (form-encoded) ---------------------- */
function form(obj, prefix, out) {
  out = out || new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object" && !Array.isArray(v)) form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}
async function stripe(env, path, params, method) {
  const r = await fetch("https://api.stripe.com/v1/" + path, {
    method: method || "POST",
    headers: {
      Authorization: "Bearer " + env.STRIPE_SECRET_KEY,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params ? form(params).toString() : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error("stripe " + path + ": " + (data.error && data.error.message || r.status));
  return data;
}
async function stripeGet(env, path) {
  const r = await fetch("https://api.stripe.com/v1/" + path, {
    headers: { Authorization: "Bearer " + env.STRIPE_SECRET_KEY },
  });
  const data = await r.json();
  if (!r.ok) throw new Error("stripe GET " + path + ": " + (data.error && data.error.message || r.status));
  return data;
}

/* ---------- Clerk backend: write the user's tier ------------------------- */
async function setClerkTier(env, userId, patch) {
  const r = await fetch(`https://api.clerk.com/v1/users/${userId}/metadata`, {
    method: "PATCH",
    headers: { Authorization: "Bearer " + env.CLERK_SECRET_KEY, "content-type": "application/json" },
    body: JSON.stringify({ public_metadata: patch }),
  });
  if (!r.ok) throw new Error("clerk metadata " + r.status + " " + (await r.text()).slice(0, 200));
}
async function getClerkUser(env, userId) {
  const r = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    headers: { Authorization: "Bearer " + env.CLERK_SECRET_KEY },
  });
  if (!r.ok) throw new Error("clerk get user " + r.status);
  return r.json();
}

/* ---------- Stripe webhook signature verification ------------------------ */
function hex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function verifyStripeSig(rawBody, sigHeader, secret) {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(sigHeader.split(",").map(kv => kv.split("=")));
  const t = parts.t, v1 = parts.v1;
  if (!t || !v1) return false;
  // reject signatures older than 5 minutes (replay protection)
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(t + "." + rawBody));
  const expected = hex(mac);
  // constant-time-ish compare
  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

/* ---------- transactional email (Resend; non-fatal) --------------------- */
async function sendEmail(env, to, subject, text, html) {
  if (!env.RESEND_API_KEY || !to) return;   // silently skip if unconfigured
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ from: MAIL_FROM, to: [to], reply_to: MAIL_SUPPORT, subject, text, html }),
    });
    if (!r.ok) console.log("resend " + r.status + " " + (await r.text()).slice(0, 200));
  } catch (e) { console.log("resend threw: " + (e.message || e)); }
}
// Shared CPI-branded shell. `blocks` is body HTML.
function mailShell(preheader, blocks) {
  return `<!doctype html><html><body style="margin:0;background:#ffffff;padding:28px 12px">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#f5f1e8;border:1px solid #e4dcc7;border-radius:4px;overflow:hidden">
  <tr><td style="background:#0d2b23;padding:22px 32px;border-bottom:3px solid #c9a24b">
    <span style="font-family:ui-monospace,Menlo,monospace;font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#f5f1e8">Crawl&nbsp;Price&nbsp;Index</span>
  </td></tr>
  <tr><td style="padding:32px">${blocks}</td></tr>
  <tr><td style="padding:20px 32px;background:#eee7d6;border-top:1px solid #ded4bd">
    <p style="margin:0;font-family:ui-monospace,Menlo,monospace;font-size:11px;line-height:1.6;color:#6b6152">
      Crawl Price Index &middot; a weekly census of how the top 50,000 domains declare policy toward AI crawlers.<br>
      Questions? Just reply, or write <a href="mailto:${MAIL_SUPPORT}" style="color:#1c5d4a">${MAIL_SUPPORT}</a>.
    </p>
  </td></tr>
</table></body></html>`;
}
function btn(href, label) {
  return `<a href="${href}" style="display:inline-block;background:#1c5d4a;color:#f5f1e8;font-family:ui-monospace,Menlo,monospace;font-size:13px;letter-spacing:.03em;padding:13px 24px;text-decoration:none;border-radius:3px">${label}</a>`;
}
function welcomeSubEmail() {
  const h = `Georgia,'Times New Roman',serif`;
  const blocks =
    `<h1 style="margin:0 0 6px;font-family:${h};font-weight:400;font-size:26px;line-height:1.15;color:#0d2b23">Your Terminal is live.</h1>
     <p style="margin:0 0 20px;font-family:${h};font-size:15px;color:#5c6b64">Thank you for subscribing to the Crawl Price Index Terminal.</p>
     <p style="margin:0 0 16px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#28352f">
       You now have full access: the live dashboard, every domain's per-crawler policy row, the weekly change feed, trends and history, and dataset downloads. It refreshes with each weekly edition.</p>
     <p style="margin:0 0 24px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#28352f">
       Sign in any time with this email address &mdash; no password to remember, Terminal access follows your account.</p>
     <p style="margin:0 0 26px">${btn(APP_ORIGIN, "Open the Terminal →")}</p>
     <p style="margin:0;padding:14px 16px;background:#efe8d7;border-left:3px solid #c9a24b;font-family:ui-monospace,Menlo,monospace;font-size:12px;line-height:1.6;color:#6b6152">
       Founding rate: your &euro;49/mo is held for 24 months from sign-up. Manage or cancel any time from Account &rarr; Manage billing.
       <br>Terms: <a href="https://crawlpriceindex.com/terms.html" style="color:#1c5d4a">crawlpriceindex.com/terms.html</a></p>`;
  return {
    subject: "Welcome to the Crawl Price Index Terminal",
    text: `Your Terminal is live.

Thank you for subscribing to the Crawl Price Index Terminal. You now have full access: the live dashboard, every domain's per-crawler policy row, the weekly change feed, trends and history, and dataset downloads.

Open the Terminal: ${APP_ORIGIN}
Sign in with this email address — Terminal access follows your account.

Founding rate: your EUR 49/mo is held for 24 months from sign-up. Manage or cancel any time from Account -> Manage billing.
Terms: https://crawlpriceindex.com/terms.html

Questions? Reply to this email or write ${MAIL_SUPPORT}.`,
    html: mailShell("Your Crawl Price Index Terminal is live.", blocks),
  };
}
function welcomeSnapEmail(downloadUrl) {
  const h = `Georgia,'Times New Roman',serif`;
  const blocks =
    `<h1 style="margin:0 0 6px;font-family:${h};font-weight:400;font-size:26px;line-height:1.15;color:#0d2b23">Your snapshot is ready.</h1>
     <p style="margin:0 0 20px;font-family:${h};font-size:15px;color:#5c6b64">Thank you for buying a single edition of the Crawl Price Index.</p>
     <p style="margin:0 0 16px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#28352f">
       This is the current weekly edition &mdash; every measured domain's complete AI-crawler policy row, as machine-readable JSON. The link below serves your download.</p>
     <p style="margin:0 0 26px">${btn(downloadUrl, "Download the snapshot →")}</p>
     <p style="margin:0;padding:14px 16px;background:#efe8d7;border-left:3px solid #c9a24b;font-family:ui-monospace,Menlo,monospace;font-size:12px;line-height:1.6;color:#6b6152">
       Single-edition purchase &mdash; no subscription, no ongoing access. Trends, history and the weekly change feed are part of the Terminal subscription (&euro;49/mo): <a href="${APP_ORIGIN}" style="color:#1c5d4a">app.crawlpriceindex.com</a>.
       <br>Single-subscriber licence &mdash; redistribution prohibited and traceable.</p>`;
  return {
    subject: "Your Crawl Price Index snapshot",
    text: `Your snapshot is ready.

Thank you for buying a single edition of the Crawl Price Index. This is the current weekly edition — every measured domain's complete AI-crawler policy row, as machine-readable JSON.

Download: ${downloadUrl}

Single-edition purchase — no subscription, no ongoing access. Trends, history and the weekly change feed are part of the Terminal subscription (EUR 49/mo): ${APP_ORIGIN}
Single-subscriber licence — redistribution prohibited and traceable.

Questions? Reply to this email or write ${MAIL_SUPPORT}.`,
    html: mailShell("Your Crawl Price Index snapshot is ready to download.", blocks),
  };
}

function cancelEmail() {
  const h = `Georgia,'Times New Roman',serif`;
  const blocks =
    `<h1 style="margin:0 0 6px;font-family:${h};font-weight:400;font-size:26px;line-height:1.15;color:#0d2b23">Your Terminal has ended.</h1>
     <p style="margin:0 0 20px;font-family:${h};font-size:15px;color:#5c6b64">Your Crawl Price Index Terminal subscription has been cancelled.</p>
     <p style="margin:0 0 16px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#28352f">
       The per-domain explorer, weekly change feed, history and downloads are now switched off. You keep the free aggregate dashboard and, if you're subscribed, the weekly newsletter &mdash; so you won't lose sight of the headline numbers.</p>
     <p style="margin:0 0 24px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#28352f">
       If this was a mistake, or you'd like to come back, you can resubscribe any time &mdash; your account and settings are still here.</p>
     <p style="margin:0 0 26px">${btn(APP_ORIGIN + "/dashboard.html#account", "Resubscribe →")}</p>
     <p style="margin:0;padding:14px 16px;background:#efe8d7;border-left:3px solid #c9a24b;font-family:ui-monospace,Menlo,monospace;font-size:12px;line-height:1.6;color:#6b6152">
       Anything we could have done better? Just reply &mdash; a real person reads it.</p>`;
  return {
    subject: "Your Crawl Price Index Terminal has ended",
    text: `Your Terminal has ended.

Your Crawl Price Index Terminal subscription has been cancelled. The per-domain explorer, weekly change feed, history and downloads are now switched off. You keep the free aggregate dashboard and the weekly newsletter.

If this was a mistake, or you'd like to come back, you can resubscribe any time — your account and settings are still here.

Resubscribe: ${APP_ORIGIN}/dashboard.html#account

Anything we could have done better? Just reply — a real person reads it, or write ${MAIL_SUPPORT}.`,
    html: mailShell("Your Crawl Price Index Terminal subscription has ended.", blocks),
  };
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    /* never serve the licensed payload directly.
       Case-folded and decoded first: the whole licensed dataset is behind
       this door, so it should not turn on the casing of a URL. */
    let probe = path;
    try { probe = decodeURIComponent(path); } catch (e) { /* malformed: use raw */ }
    if (probe.toLowerCase().split("/").includes("private")) {
      return j({ error: "not accessible directly; use /api/domains with a valid session" }, 403);
    }

    /* ---- who am I, and what did the GATE decide? ------------------------
       The Account tab renders this rather than guessing from client-side
       Clerk metadata, so the UI and the paywall cannot disagree. */
    if (path === "/api/me") {
      const a = await authClaims(request);
      if (a.error) return j({ error: a.error }, a.status);
      const e = await entitlementOf(a.claims, env);
      return j({
        entitled: e.entitled, tier: e.tier, via: e.via, authoritative: e.authoritative,
        token_tier: (a.claims && a.claims.tier) || null,
      }, 200, { "cache-control": "private, no-store" });
    }

    /* ---- gated dataset: require an active Terminal entitlement ---------- */
    if (path === "/api/domains") {
      const a = await authClaims(request);
      if (a.error) return j({ error: a.error }, a.status);
      const ent = await entitlementOf(a.claims, env);
      if (!ent.entitled) {
        // 503, not 402: telling a paying customer to subscribe because our
        // account service is down is how people buy the same thing twice
        if (!ent.authoritative) {
          return j({ error: "cannot verify your subscription right now",
                     detail: "This is our end, not yours. Try again in a moment.",
                     retry: true }, 503, { "retry-after": "20" });
        }
        return j({ error: "subscription required", tier: ent.tier,
                   subscribe: APP_ORIGIN + "/dashboard.html#account" }, 402);
      }
      const res = await env.ASSETS.fetch(new Request(new URL("/private/domains.json", url.origin)));
      if (!res.ok) return j({ error: "dataset unavailable" }, 404);
      return new Response(res.body, {
        headers: {
          "content-type": "application/json; charset=utf-8",
          // no-store, not max-age: the browser cache is keyed on the URL and
          // ignores the Authorization header, so a cached 200 from one account
          // was being replayed to the next account to sign in on that machine
          "cache-control": "private, no-store, max-age=0, must-revalidate",
          "Vary": "Authorization",
        },
      });
    }

    /* ---- gated Bazaar per-domain table (same Terminal entitlement) ------ */
    if (path === "/api/bazaar-domains") {
      const a = await authClaims(request);
      if (a.error) return j({ error: a.error }, a.status);
      const ent = await entitlementOf(a.claims, env);
      if (!ent.entitled) {
        // 503, not 402: telling a paying customer to subscribe because our
        // account service is down is how people buy the same thing twice
        if (!ent.authoritative) {
          return j({ error: "cannot verify your subscription right now",
                     detail: "This is our end, not yours. Try again in a moment.",
                     retry: true }, 503, { "retry-after": "20" });
        }
        return j({ error: "subscription required", tier: ent.tier,
                   subscribe: APP_ORIGIN + "/dashboard.html#account" }, 402);
      }
      const res = await env.ASSETS.fetch(new Request(new URL("/private/bazaar-domains.json", url.origin)));
      if (!res.ok) return j({ error: "bazaar table unavailable" }, 404);
      return new Response(res.body, {
        headers: {
          "content-type": "application/json; charset=utf-8",
          // no-store, not max-age: the browser cache is keyed on the URL and
          // ignores the Authorization header, so a cached 200 from one account
          // was being replayed to the next account to sign in on that machine
          "cache-control": "private, no-store, max-age=0, must-revalidate",
          "Vary": "Authorization",
        },
      });
    }

    /* ---- create a Checkout Session ------------------------------------- */
    if (path === "/api/checkout" && request.method === "POST") {
      const a = await authClaims(request);
      if (a.error) return j({ error: a.error }, a.status);
      let planReq = {};
      try { planReq = await request.json(); } catch (e) {}
      const plan = planReq.plan === "snap" ? "snap" : "sub";
      const userId = a.claims.sub;
      const email = a.claims.email || undefined;
      try {
        let params;
        if (plan === "sub") {
          params = {
            mode: "subscription",
            "line_items[0][price]": PRICE_SUB,
            "line_items[0][quantity]": 1,
            client_reference_id: userId,
            "subscription_data[metadata][clerk_user_id]": userId,
            allow_promotion_codes: true,
            success_url: APP_ORIGIN + "/dashboard.html?sub=success",
            cancel_url: APP_ORIGIN + "/dashboard.html#account",
          };
          if (email) params.customer_email = email;
        } else {
          params = {
            mode: "payment",
            "line_items[0][price]": PRICE_SNAP,
            "line_items[0][quantity]": 1,
            client_reference_id: userId,
            "metadata[clerk_user_id]": userId,
            success_url: APP_ORIGIN + "/dashboard.html?snap_session={CHECKOUT_SESSION_ID}",
            cancel_url: APP_ORIGIN + "/dashboard.html#account",
          };
          if (email) params.customer_email = email;
        }
        const session = await stripe(env, "checkout/sessions", params);
        return j({ url: session.url }, 200);
      } catch (e) {
        return j({ error: "checkout unavailable", detail: String(e.message || e) }, 502);
      }
    }

    /* ---- billing portal (manage / cancel) ------------------------------ */
    if (path === "/api/portal" && request.method === "POST") {
      const a = await authClaims(request);
      if (a.error) return j({ error: a.error }, a.status);
      try {
        const user = await getClerkUser(env, a.claims.sub);
        const cust = user.public_metadata && user.public_metadata.stripe_customer_id;
        if (!cust) return j({ error: "no billing account yet" }, 404);
        const ps = await stripe(env, "billing_portal/sessions", {
          customer: cust, return_url: APP_ORIGIN + "/dashboard.html#account",
        });
        return j({ url: ps.url }, 200);
      } catch (e) {
        return j({ error: "portal unavailable", detail: String(e.message || e) }, 502);
      }
    }

    /* ---- snapshot delivery: verify a paid one-off session, serve once --- */
    if (path === "/api/snapshot") {
      const sid = url.searchParams.get("session_id");
      if (!sid) return j({ error: "session_id required" }, 400);
      try {
        const s = await stripeGet(env, "checkout/sessions/" + encodeURIComponent(sid));
        const paid = s.payment_status === "paid" && s.mode === "payment" && s.status === "complete";
        if (!paid) return j({ error: "payment not confirmed" }, 402);
        // A one-off purchase is a download, not a standing licence. Without
        // this the session_id — which sits in the address bar after checkout,
        // and so in history, bookmarks and referrers — is a permanent,
        // shareable link to the entire dataset.
        const age = Math.floor(Date.now() / 1000) - Number(s.created || 0);
        if (!s.created || age > SNAPSHOT_MAX_AGE_S) {
          return j({ error: "this download link has expired",
                     detail: "Snapshot links are valid for 48 hours after purchase. Reply to your receipt and we will send a fresh one.",
                     support: MAIL_SUPPORT }, 410);
        }
        const res = await env.ASSETS.fetch(new Request(new URL("/private/domains.json", url.origin)));
        if (!res.ok) return j({ error: "dataset unavailable" }, 404);
        return new Response(res.body, {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "content-disposition": 'attachment; filename="cpi-snapshot.json"',
            "cache-control": "private, no-store",
          },
        });
      } catch (e) {
        return j({ error: "snapshot unavailable", detail: String(e.message || e) }, 502);
      }
    }

    /* ---- Stripe webhook: subscription lifecycle -> Clerk tier ---------- */
    if (path === "/api/stripe-webhook" && request.method === "POST") {
      const raw = await request.text();
      const ok = await verifyStripeSig(raw, request.headers.get("Stripe-Signature"), env.STRIPE_WEBHOOK_SECRET);
      if (!ok) return j({ error: "bad signature" }, 400);
      let evt;
      try { evt = JSON.parse(raw); } catch (e) { return j({ error: "bad json" }, 400); }
      const o = evt.data && evt.data.object || {};
      try {
        if (evt.type === "checkout.session.completed" && o.mode === "subscription") {
          const userId = o.client_reference_id || (o.metadata && o.metadata.clerk_user_id);
          if (userId) await setClerkTier(env, userId, { tier: "terminal", stripe_customer_id: o.customer, stripe_subscription_id: o.subscription });
          const to = (o.customer_details && o.customer_details.email) || o.customer_email;
          const m = welcomeSubEmail();
          await sendEmail(env, to, m.subject, m.text, m.html);   // non-fatal
        } else if (evt.type === "checkout.session.completed" && o.mode === "payment") {
          const to = (o.customer_details && o.customer_details.email) || o.customer_email;
          const m = welcomeSnapEmail(APP_ORIGIN + "/dashboard.html?snap_session=" + encodeURIComponent(o.id));
          await sendEmail(env, to, m.subject, m.text, m.html);   // non-fatal; snapshot sets no tier
        } else if (evt.type === "customer.subscription.updated" || evt.type === "customer.subscription.created") {
          const userId = o.metadata && o.metadata.clerk_user_id;
          const active = ["active", "trialing", "past_due"].includes(o.status);
          if (userId) await setClerkTier(env, userId, { tier: active ? "terminal" : "none", stripe_customer_id: o.customer, stripe_subscription_id: o.id });
        } else if (evt.type === "customer.subscription.deleted") {
          const userId = o.metadata && o.metadata.clerk_user_id;
          if (userId) await setClerkTier(env, userId, { tier: "none", stripe_customer_id: o.customer, stripe_subscription_id: null });
          try {                                     // cancellation email — non-fatal
            const cust = o.customer ? await stripeGet(env, "customers/" + encodeURIComponent(o.customer)) : null;
            const to = cust && cust.email;
            const m = cancelEmail();
            await sendEmail(env, to, m.subject, m.text, m.html);
          } catch (e) { console.log("cancel email skip: " + (e.message || e)); }
        }
        // NB: failed-payment recovery is intentionally handled by Stripe's own
        // hosted recovery email (Revenue recovery → Emails), which converts better
        // than a sign-in link. We deliberately do NOT send our own here.
      } catch (e) {
        // 200 anyway would drop the event; 500 tells Stripe to retry.
        return j({ error: "handler failed", detail: String(e.message || e) }, 500);
      }
      return j({ received: true }, 200);
    }

    /* ---- static assets (no-cache on the shell) ------------------------- */
    const res = await env.ASSETS.fetch(request);
    if (path === "/" || path.endsWith(".html") || path.endsWith(".js") || path.endsWith(".json")) {
      const h = new Headers(res.headers);
      h.set("cache-control", "no-cache, must-revalidate");
      return new Response(res.body, { status: res.status, headers: h });
    }
    return res;
  },
};
