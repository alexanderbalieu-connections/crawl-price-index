/**
 * CPI — gated per-domain endpoint  (Cloudflare Pages Function)
 * GET /api/domains   Authorization: Bearer <clerk session jwt>
 *
 * Verifies the Clerk session JWT against the instance JWKS (RS256, cached),
 * then serves the packed per-domain payload. Unauthenticated => 401.
 * Tier gating hooks in at STEP 3 once Stripe lands.
 */
const FRONTEND_API = "wealthy-collie-322.clerk.accounts.dev";
let JWKS_CACHE = null, JWKS_AT = 0;

function b64urlToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  s += "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getJwks() {
  const now = Date.now();
  if (JWKS_CACHE && now - JWKS_AT < 3600e3) return JWKS_CACHE;
  const r = await fetch(`https://${FRONTEND_API}/.well-known/jwks.json`);
  if (!r.ok) throw new Error("jwks fetch failed");
  JWKS_CACHE = await r.json(); JWKS_AT = now;
  return JWKS_CACHE;
}

async function verify(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  if (header.alg !== "RS256") return null;

  const jwks = await getJwks();
  const jwk = (jwks.keys || []).find(k => k.kid === header.kid);
  if (!jwk) return null;

  const key = await crypto.subtle.importKey(
    "jwk", { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
  );
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5", key,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(parts[0] + "." + parts[1])
  );
  if (!ok) return null;

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now - 5) return null;     // expired
  if (payload.nbf && payload.nbf > now + 5) return null;     // not yet valid
  return payload;
}

export async function onRequestGet({ request, env, waitUntil }) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return json({ error: "authentication required" }, 401);

  let claims;
  try { claims = await verify(token); }
  catch (e) { return json({ error: "verification unavailable" }, 503); }
  if (!claims) return json({ error: "invalid or expired session" }, 401);

  // STEP 3 (Stripe): read subscription tier from claims/KV and gate here.
  // Snapshot tier -> current edition only; Historical tier -> all editions.

  const url = new URL(request.url);
  const asset = new URL("/private/domains.json", url.origin);
  const res = await env.ASSETS.fetch(new Request(asset, { headers: { "Accept-Encoding": "gzip" } }));
  if (!res.ok) return json({ error: "dataset unavailable" }, 404);

  return new Response(res.body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, max-age=300",
      "x-cpi-subject": claims.sub || "",
    },
  });
}

function json(o, status) {
  return new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
}
