#!/usr/bin/env node
/**
 * CPI — one source of truth for entitlement
 * ===========================================================================
 * The reported symptom is the diagnosis: the Account tab said "Headline
 * dashboard (subscribe for per-domain data)" while the same account could
 * pull the full per-domain dataset. Those two answers come from two different
 * places, and nothing ever made them agree:
 *
 *   the UI    reads Clerk's public_metadata.tier, client-side
 *   the gate  reads the session token's `tier` claim, or ADMIN_EMAILS
 *
 * So the server could be granting through a door the UI cannot see. Whichever
 * door it turns out to be, the shape of the bug is that there are two answers.
 *
 * Two changes:
 *
 * 1. ENTITLEMENT BECOMES AUTHORITATIVE.
 *    hasTerminal() short-circuited on the token's `tier` claim and never asked
 *    Clerk. That makes the paywall only as good as the Clerk session-token
 *    template: map that claim to the wrong thing — or hardcode it — and every
 *    account that signs up gets the full dataset, with nothing in our code
 *    able to notice. The token claim is a cache, not the truth. Clerk's
 *    public_metadata (which the Stripe webhook writes) is the truth.
 *
 *    entitled() now asks Clerk first and believes the answer. The token claim
 *    is used only when Clerk cannot be reached, so a Clerk outage does not
 *    lock out paying subscribers — and that fallback is recorded in the
 *    decision so it is visible rather than silent.
 *
 * 2. /api/me — THE SERVER PUBLISHES ITS OWN DECISION, AND THE UI RENDERS IT.
 *    The Account tab stops guessing from client-side metadata and shows what
 *    the gate actually decided, including WHICH door granted access. An
 *    ADMIN_EMAILS grant now says so on screen instead of masquerading as a
 *    free account. These two can no longer disagree, because there is only
 *    one answer now.
 */
const fs = require("fs");

/* ======================= worker ========================================== */
const W = "app/_worker.js";
let s = fs.readFileSync(W, "utf8");
if (s.includes("entitlementOf")) { console.log("worker: already applied"); }
else {
  fs.copyFileSync(W, W + ".bak-authz-" + Math.floor(Date.now() / 1000));
  const sub = (from, to, label) => {
    if (!s.includes(from)) throw new Error("worker: not found — " + label);
    s = s.split(from).join(to);
  };

  /* j() took only (body, status); /api/me must not be cached by anything */
  sub(
    `function j(o, status) {
  return new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}`,
    `function j(o, status, extra) {
  const headers = Object.assign({ "content-type": "application/json; charset=utf-8" }, extra || {});
  return new Response(JSON.stringify(o), { status, headers });
}`,
    "json helper"
  );

  const OLD = `function hasTerminal(claims, env) {
  if (claims && claims.tier === "terminal") return true;
  const email = (claims && claims.email || "").toLowerCase();
  return !!email && adminList(env).includes(email);
}`;
  const NEW = `// Clerk's public_metadata is the source of truth: the Stripe webhook writes
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

  // Clerk unreachable. Fall back to the signed token so a Clerk outage does
  // not lock out paying subscribers — but mark the decision non-authoritative
  // so /api/me can say the answer is provisional.
  out.tier = claims.tier || "none";
  if (claims.tier === "terminal") { out.entitled = true; out.via = "token-claim-fallback"; }
  else {
    const email = (claims.email || "").toLowerCase();
    if (email && adminList(env).includes(email)) { out.entitled = true; out.via = "admin-list-fallback"; }
  }
  return out;
}`;
  sub(OLD, NEW, "hasTerminal");

  const OLDENT = `async function entitled(claims, env) {
  if (hasTerminal(claims, env)) return true;
  if (!claims || !claims.sub) return false;
  try {
    const u = await getClerkUser(env, claims.sub);
    if (u && u.public_metadata && u.public_metadata.tier === "terminal") return true;
    const primId = u && u.primary_email_address_id;
    const list = u && u.email_addresses || [];
    const em = list.find(e => e.id === primId) || list[0];
    const email = (em && em.email_address || "").toLowerCase();
    return !!email && adminList(env).includes(email);
  } catch (e) { return false; }
}`;
  const NEWENT = `async function entitled(claims, env) {
  return (await entitlementOf(claims, env)).entitled;
}`;
  sub(OLDENT, NEWENT, "entitled");

  /* /api/me — the server's own answer, for the UI to render */
  sub(
    '    /* ---- gated dataset: require an active Terminal entitlement ---------- */',
    `    /* ---- who am I, and what did the GATE decide? ------------------------
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

    /* ---- gated dataset: require an active Terminal entitlement ---------- */`,
    "api/me route"
  );

  fs.writeFileSync(W, s);
  require("child_process").execSync("node --check " + W);
  console.log("app/_worker.js");
  console.log("  entitlement is now decided by Clerk public_metadata, not the token claim");
  console.log("  the token claim is a fallback for a Clerk outage, and is flagged as such");
  console.log("  new /api/me publishes the gate's own decision, including which door granted it");
}

/* ======================= views ============================================ */
const V = "app/views.js";
let v = fs.readFileSync(V, "utf8");
if (v.includes("ME_STATE")) { console.log("views: already applied"); }
else {
  fs.copyFileSync(V, V + ".bak-authz-" + Math.floor(Date.now() / 1000));
  const subv = (from, to, label) => {
    if (!v.includes(from)) throw new Error("views: not found — " + label);
    v = v.split(from).join(to);
  };

  /* loader for the server's decision, next to the other gated loaders */
  subv(
    "  /* ---------- gated per-domain loader ---------- */",
    `  /* ---------- the server's entitlement decision ----------
     The Account tab used to read Clerk's client-side metadata and draw its own
     conclusion, which is how it came to say "Headline dashboard" to an account
     that could pull the whole dataset. It now renders what the gate decided. */
  var ME = null, ME_STATE = "idle";
  function loadMe(cb) {
    if (ME) return cb(ME);
    if (ME_STATE === "loading") return;
    ME_STATE = "loading";
    var go = function (token) {
      fetch("/api/me", { headers: token ? { Authorization: "Bearer " + token } : {} })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (jn) { ME = jn || { entitled: false, tier: "unknown", via: "unavailable" }; ME_STATE = "ready"; cb(ME); })
        .catch(function () { ME = { entitled: false, tier: "unknown", via: "unavailable" }; ME_STATE = "ready"; cb(ME); });
    };
    if (window.Clerk && window.Clerk.session) window.Clerk.session.getToken().then(go).catch(function () { go(null); });
    else go(null);
  }

  /* ---------- gated per-domain loader ---------- */`,
    "loadMe"
  );

  /* the Account tab waits for it */
  subv(
    `  function account() {
    var u = (window.Clerk && window.Clerk.user) || null;
    var email = u && u.primaryEmailAddress ? u.primaryEmailAddress.emailAddress : "—";
    var meta = (u && u.publicMetadata) || {};
    var isTerminal = meta.tier === "terminal";`,
    `  function account() {
    EL("content").innerHTML = '<section class="panel"><div class="ix">Account</div><div class="empty">Checking your access…</div></section>';
    loadMe(function (me) { accountView(me); });
  }
  function accountView(me) {
    var u = (window.Clerk && window.Clerk.user) || null;
    var email = u && u.primaryEmailAddress ? u.primaryEmailAddress.emailAddress : "—";
    // the gate's answer, not our own guess at it
    var isTerminal = !!(me && me.entitled);`,
    "account split"
  );

  /* say which door, when it is not a subscription */
  subv(
    `'<div class="hrow" style="grid-template-columns:120px 1fr"><span class="hk">Access</span><span>' + (isTerminal ? "Terminal — full dashboard &amp; per-domain data" : "Headline dashboard (subscribe for per-domain data)") + '</span></div>' +`,
    `'<div class="hrow" style="grid-template-columns:120px 1fr"><span class="hk">Access</span><span>' +
        (isTerminal ? "Terminal — full dashboard &amp; per-domain data" : "Headline dashboard (subscribe for per-domain data)") +
        (me && me.via === "admin-list" ? ' <b style="color:#8A6A1F">· granted by the admin list, not a subscription</b>' : "") +
        (me && me.via && me.via.indexOf("fallback") > -1 ? ' <b style="color:#8A6A1F">· provisional, account service unreachable</b>' : "") +
        '</span></div>' +`,
    "access line"
  );

  fs.writeFileSync(V, v);
  console.log("app/views.js");
  console.log("  the Account tab renders /api/me instead of guessing from client-side metadata");
  console.log("  an ADMIN_EMAILS grant now says so on screen instead of looking like a free account");
}

/* ======================= verify =========================================== */
const w2 = fs.readFileSync(W, "utf8");
if (w2.includes("function hasTerminal")) throw new Error("hasTerminal survived");
if (!w2.includes('path === "/api/me"')) throw new Error("/api/me missing");
if (!/await getClerkUser\(env, claims\.sub\)/.test(w2)) throw new Error("Clerk lookup missing");
const v2 = fs.readFileSync(V, "utf8");
if (v2.includes("var isTerminal = meta.tier")) throw new Error("client-side tier guess survived");
if (!v2.includes("loadMe(")) throw new Error("loadMe not wired");
console.log("\nverified: no code path decides entitlement from the token claim while Clerk is reachable");
