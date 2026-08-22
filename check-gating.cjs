#!/usr/bin/env node
/**
 * CPI — entitlement guard  (node check-gating.cjs)
 * ===========================================================================
 * The licensed dataset is the product. This asserts the structural properties
 * that keep it behind the paywall, so a future edit cannot quietly open it.
 *
 * It is a static check on app/_worker.js — it cannot prove the deployed build
 * behaves, only that the source we are about to deploy is shaped correctly.
 * Blocking in sunday-run.command.
 */
const fs = require("fs");
let bad = 0, n = 0;
const ok = (cond, label, detail) => {
  n++;
  console.log("  " + (cond ? "ok  " : "FAIL") + "  " + label + (detail ? "\n         " + detail : ""));
  if (!cond) bad++;
};

console.log("\nENTITLEMENT GUARD — app/_worker.js");
console.log("-".repeat(74));
const W = fs.readFileSync("app/_worker.js", "utf8");

/* ---- the /private/ door ------------------------------------------------- */
const doorAt = W.indexOf('probe.toLowerCase().split("/").includes("private")');
ok(doorAt > 0, "the /private/ interceptor exists and is case-folded");
ok(W.includes("decodeURIComponent(path)"), "the interceptor decodes the path before matching");

/* ---- every private asset read sits behind a check ----------------------- */
const RE = /env\.ASSETS\.fetch\(new Request\(new URL\("\/private\/[^"]+"/g;
const sites = [];
let m;
while ((m = RE.exec(W))) sites.push(m.index);
ok(sites.length > 0, "the worker reads the private payload somewhere", sites.length + " call site(s)");

for (const at of sites) {
  // walk back to the start of the route this call sits in
  const routeAt = W.lastIndexOf("if (path === ", at);
  const route = (W.slice(routeAt, at).match(/if \(path === "([^"]+)"/) || [, "?"])[1];
  const between = W.slice(routeAt, at);
  const guarded = /await entitled\(/.test(between) ||
                  (/await entitlementOf\(/.test(between) && /\.entitled/.test(between)) ||
                  /payment_status === "paid"/.test(between);
  ok(guarded, "route " + route + " checks entitlement or payment before reading the private payload");
}

/* ---- entitlement must fail closed --------------------------------------- */
const ent = W.slice(W.indexOf("async function entitled"), W.indexOf("/* ---------- tiny Stripe"));
// the invariant is stronger now: entitlement is only ever granted from an
// authoritative Clerk answer, never from the signed token's tier claim
const eo = W.slice(W.indexOf("async function entitlementOf"), W.indexOf("async function entitled"));
ok(/out\.authoritative = true/.test(eo), "entitlementOf marks a Clerk-backed answer authoritative");
ok(!/entitled = true/.test(eo.slice(eo.indexOf("Clerk unreachable"))),
   "no entitlement is granted on the Clerk-unreachable path");
ok(!/token-claim-fallback|admin-list-fallback/.test(W),
   "no code path grants access from the session token's tier claim");
ok((W.match(/cannot verify your subscription right now/g) || []).length === 2,
   "both gated routes answer 503 when the check is unverifiable, not 402");
ok(/tier === "terminal"/.test(ent) || /tier === "terminal"/.test(W), "entitlement requires tier === 'terminal'");
ok(/\.filter\(Boolean\)/.test(W), "ADMIN_EMAILS drops empty entries, so a blank value grants nobody");
ok(!/return true;\s*\}\s*catch/.test(ent), "no code path returns true from the Clerk fallback's catch");

/* ---- the session token is really verified ------------------------------- */
ok(W.includes('head.alg !== "RS256"'), "JWT algorithm is pinned to RS256 (no alg:none)");
ok(W.includes("crypto.subtle.verify"), "the JWT signature is actually verified");
ok(W.includes("body.exp && body.exp < now"), "expired tokens are rejected");

/* ---- the one-off snapshot link ------------------------------------------ */
ok(W.includes("SNAPSHOT_MAX_AGE_S"), "the snapshot download link has a maximum age");
ok(W.includes('s.status === "complete"'), "the snapshot requires a completed checkout session");

/* ---- the gated payloads must not be cacheable --------------------------
   The browser cache is keyed on the URL and ignores Authorization, so a
   cacheable 200 gets replayed to the next account to sign in on that
   machine. This is what actually leaked the dataset to a free account. */
const gatedResponses = W.split("/private/domains.json").length - 1;
ok(!/"cache-control": "private, max-age=/.test(W),
   "no gated payload is served with a positive max-age");
ok((W.match(/no-store/g) || []).length >= 3,
   "gated payloads and /api/me are all no-store");
ok((W.match(/"Vary": "Authorization"/g) || []).length === 2,
   "both gated payloads Vary on Authorization");
{
  const v = fs.readFileSync("app/views.js", "utf8");
  ok((v.match(/cache: "no-store", headers: token/g) || []).length === 3,
     "the client also bypasses its cache on every account-scoped fetch");
}

/* ---- nothing licensed is sitting in the public tree --------------------- */
const pub = fs.existsSync("app/private") ? fs.readdirSync("app/private") : [];
ok(pub.length > 0, "the licensed payload lives under app/private/", pub.join(", "));
for (const f of ["app/domains.json", "app/data/domains.json", "public/domains.json"]) {
  ok(!fs.existsSync(f), "no copy of the per-domain dataset at " + f);
}
if (fs.existsSync("public/explore-preview.json")) {
  const P = JSON.parse(fs.readFileSync("public/explore-preview.json", "utf8"));
  const shown = (P.domains && P.domains.sample_rows || []).length;
  ok(shown <= 10, "the public /explore preview exposes at most 10 per-domain rows", shown + " rows");
}

/* ---- the change feed is a taste free, the full list paid ---------------- */
{
  const dj = JSON.parse(fs.readFileSync("app/data/dashboard.json", "utf8"));
  const ch = dj.changes || {};
  if (ch.available) {
    ok(ch.items_sample === true, "the public change feed is flagged as a sample");
    const doms = new Set((ch.items || []).map(function (x) { return x.domain; }));
    ok(doms.size <= 6, "the public sample names at most 6 domains", doms.size + " named");
    ok(ch.total_changes > (ch.items || []).length,
       "the totals survive the trim and still describe every change",
       ch.total_changes + " total vs " + (ch.items || []).length + " rows shipped");
    ok(typeof ch.items_domains_total === "number" && ch.items_domains_total >= doms.size,
       "the sample states how many domains it is a sample OF");
  }
  const cb = fs.readFileSync("compute-dashboard.cjs", "utf8");
  ok(/items: sampleItems, items_sample: true/.test(cb),
     "the builder emits a sample, so the next scan does not restore the leak");
  const vw = fs.readFileSync("app/views.js", "utf8");
  ok(/changesSample/.test(vw) && /changesFull/.test(vw),
     "the dashboard renders the sample free and the full feed to Terminal");
  ok(vw.indexOf("full.changes.items = ") > -1,
     "the aggregate JSON download carries the full feed for entitled accounts");
}

/* ---- the free/paid line inside the dashboard --------------------------- */
{
  const vw = fs.readFileSync("app/views.js", "utf8");
  ok(/function cpiLocked\(/.test(vw) && /function cpiLockedGrid\(/.test(vw),
     "the lock helpers exist");
  ok(/function entitled\(\) \{ return !!\(ME && ME\.entitled\); \}/.test(vw),
     "locks read the SERVER decision (ME), never client-side Clerk metadata");
  ok((vw.match(/cpiLocked\(|cpiLockedGrid\(/g) || []).length >= 4,
     "the line is applied in at least four places",
     (vw.match(/cpiLocked\(|cpiLockedGrid\(/g) || []).length + " call sites");
  ok(/entitled\(\) \? \x27\x27 : \x27 disabled\x27/.test(vw) || /\(entitled\(\) \? .. : . disabled/.test(vw),
     "per-crawler filtering is disabled for unentitled accounts");
  const dh = fs.readFileSync("app/dashboard.html", "utf8");
  ok(/\.lockblur\{[^}]*pointer-events:none/.test(dh),
     "blurred rows are inert — not selectable or clickable");
  ok(/\.lockblur\{[^}]*user-select:none/.test(dh),
     "blurred rows cannot be selected and copied out");
}

console.log("-".repeat(74));
if (bad) { console.log(bad + " of " + n + " checks FAILED — do not deploy the app project.\n"); process.exit(1); }
console.log("All " + n + " checks pass — the paid dataset is gated in source.\n");
