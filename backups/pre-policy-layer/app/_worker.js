/**
 * CPI app — Pages advanced-mode Worker (single entry point, always compiled).
 * Routes:
 *   /api/domains      -> verify Clerk session JWT, then serve the per-domain payload
 *   /private/*        -> 403 (never directly reachable)
 *   everything else   -> static assets
 */
const FRONTEND_API = "wealthy-collie-322.clerk.accounts.dev";
let JWKS = null, JWKS_AT = 0;

function j(o, status) {
  return new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}
function bytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  s += "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
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
    head = JSON.parse(new TextDecoder().decode(bytes(p[0])));
    body = JSON.parse(new TextDecoder().decode(bytes(p[1])));
  } catch (e) { return null; }
  if (head.alg !== "RS256") return null;
  const set = await jwks();
  const k = (set.keys || []).find(x => x.kid === head.kid);
  if (!k) return null;
  const key = await crypto.subtle.importKey("jwk",
    { kty: k.kty, n: k.n, e: k.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, bytes(p[2]),
    new TextEncoder().encode(p[0] + "." + p[1]));
  if (!ok) return null;
  const now = Math.floor(Date.now() / 1000);
  if (body.exp && body.exp < now - 5) return null;
  if (body.nbf && body.nbf > now + 5) return null;
  return body;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // never serve the licensed payload directly
    if (url.pathname.startsWith("/private/")) {
      return j({ error: "not accessible directly; use /api/domains with a valid session" }, 403);
    }

    if (url.pathname === "/api/domains") {
      const auth = request.headers.get("Authorization") || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
      if (!token) return j({ error: "authentication required" }, 401);
      let claims;
      try { claims = await verify(token); }
      catch (e) { return j({ error: "verification unavailable" }, 503); }
      if (!claims) return j({ error: "invalid or expired session" }, 401);

      // TIER GATE (Stripe, next build step) hooks here.
      const res = await env.ASSETS.fetch(new Request(new URL("/private/domains.json", url.origin)));
      if (!res.ok) return j({ error: "dataset unavailable" }, 404);
      return new Response(res.body, {
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, max-age=300" },
      });
    }

    // Serve static assets, but never let the app shell go stale in a browser
    // cache — otherwise a deploy leaves users running yesterday's JavaScript.
    const res = await env.ASSETS.fetch(request);
    const p = url.pathname;
    if (p === "/" || p.endsWith(".html") || p.endsWith(".js") || p.endsWith(".json")) {
      const h = new Headers(res.headers);
      h.set("cache-control", "no-cache, must-revalidate");
      return new Response(res.body, { status: res.status, headers: h });
    }
    return res;
  },
};
