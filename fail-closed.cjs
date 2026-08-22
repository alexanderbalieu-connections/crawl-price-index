#!/usr/bin/env node
/**
 * CPI — entitlement fails closed, and says so honestly
 * ===========================================================================
 * check-gating.cjs caught this in my own change: I had made entitlement
 * authoritative, then added a fallback that trusts the signed token's `tier`
 * claim when Clerk is unreachable. That fallback quietly reopens the exact
 * hole the change exists to close — a misconfigured Clerk session-token
 * template would still unlock the dataset, just only during a Clerk outage.
 *
 * The fallback is also close to pointless: if Clerk's API is down its JWKS
 * endpoint usually is too, and verify() already fails the request at 503
 * before entitlement is ever consulted.
 *
 * So: no grant without an authoritative answer.
 *
 * The important part is telling the two failures apart. "You do not have a
 * subscription" and "we cannot check your subscription right now" are
 * different things, and answering the second with 402 SUBSCRIBE would invite
 * a paying customer to buy the same thing twice. Unverifiable now returns 503
 * with a retry message; only a confirmed absence of entitlement returns 402.
 */
const fs = require("fs");
const W = "app/_worker.js";
let s = fs.readFileSync(W, "utf8");
if (s.includes("cannot verify your subscription")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(W, W + ".bak-failclosed");

const sub = (from, to, label) => {
  if (!s.includes(from)) throw new Error("not found: " + label);
  s = s.split(from).join(to);
};

/* ---- no grant without an authoritative answer --------------------------- */
sub(
  `  // Clerk unreachable. Fall back to the signed token so a Clerk outage does
  // not lock out paying subscribers — but mark the decision non-authoritative
  // so /api/me can say the answer is provisional.
  out.tier = claims.tier || "none";
  if (claims.tier === "terminal") { out.entitled = true; out.via = "token-claim-fallback"; }
  else {
    const email = (claims.email || "").toLowerCase();
    if (email && adminList(env).includes(email)) { out.entitled = true; out.via = "admin-list-fallback"; }
  }
  return out;`,
  `  // Clerk unreachable: we cannot answer, so we do not grant. Trusting the
  // token's tier claim here would reopen the hole this function exists to
  // close — the claim is only as trustworthy as the session-token template.
  // Callers must distinguish this from a confirmed "no": see UNVERIFIED.
  out.tier = "unknown";
  out.via = "unverified";
  return out;`,
  "fallback removal"
);

/* ---- the gated routes tell the two failures apart ----------------------- */
const GATE_OLD = `      if (!(await entitled(a.claims, env))) {
        return j({ error: "subscription required", tier: a.claims.tier || "none",
                   subscribe: APP_ORIGIN + "/dashboard.html#account" }, 402);
      }`;
const GATE_NEW = `      const ent = await entitlementOf(a.claims, env);
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
      }`;
const before = (s.match(new RegExp(GATE_OLD.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
if (before !== 2) throw new Error("expected 2 gated routes, found " + before);
s = s.split(GATE_OLD).join(GATE_NEW);

fs.writeFileSync(W, s);
require("child_process").execSync("node --check " + W);

/* ---- the client should surface the difference too ----------------------- */
const V = "app/views.js";
let v = fs.readFileSync(V, "utf8");
const vsub = (from, to, label) => {
  if (!v.includes(from)) throw new Error("views: not found — " + label);
  v = v.split(from).join(to);
};
vsub(
  `          if (r.status === 402) throw new Error("A Terminal subscription is required for the per-domain dataset. Open Account & data to subscribe.");`,
  `          if (r.status === 503) throw new Error("We couldn't check your subscription just now — that's our end, not yours. Try again in a moment.");
          if (r.status === 402) throw new Error("A Terminal subscription is required for the per-domain dataset. Open Account & data to subscribe.");`,
  "domains 503"
);
vsub(
  `          if (r.status === 402) throw new Error("A Terminal subscription unlocks the full list. Open Account & data to subscribe.");`,
  `          if (r.status === 503) throw new Error("We couldn't check your subscription just now — that's our end, not yours. Try again in a moment.");
          if (r.status === 402) throw new Error("A Terminal subscription unlocks the full list. Open Account & data to subscribe.");`,
  "bazaar 503"
);
vsub(
  `        (me && me.via && me.via.indexOf("fallback") > -1 ? ' <b style="color:#8A6A1F">· provisional, account service unreachable</b>' : "") +`,
  `        (me && me.via === "unverified" ? ' <b style="color:#8A6A1F">· could not be checked just now, this is our end</b>' : "") +`,
  "account unverified line"
);
fs.writeFileSync(V, v);
require("child_process").execSync("node --check " + V);

/* ---- verify -------------------------------------------------------------- */
const w2 = fs.readFileSync(W, "utf8");
if (/token-claim-fallback|admin-list-fallback/.test(w2)) throw new Error("a token-claim fallback survived");
if ((w2.match(/cannot verify your subscription right now/g) || []).length !== 2)
  throw new Error("both gated routes must distinguish 503 from 402");

console.log("entitlement now fails closed");
console.log("  no grant is issued without an authoritative answer from Clerk");
console.log("  unverifiable -> 503 + retry-after, NOT 402 'subscribe'");
console.log("  (402 would invite a paying customer to buy the same thing twice)");
console.log("  both gated routes and both client loaders handle the distinction");
