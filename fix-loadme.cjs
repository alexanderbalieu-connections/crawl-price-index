#!/usr/bin/env node
/**
 * CPI — loadMe(): fix two faults in the code I just added
 * ===========================================================================
 *  1. DROPPED CALLBACK. loadMe() copied the shape of loadDomains(), which
 *     returns early — without calling the callback — if a fetch is already in
 *     flight. loadDomains gets away with it because a second call repaints the
 *     same tab. account() does not: it paints "Checking your access…" first,
 *     so a dropped callback leaves that stuck on screen forever. Callers now
 *     queue.
 *
 *  2. STALE AFTER PAYMENT. ME is cached for the page's lifetime, and the
 *     Stripe-return poller calls account() the moment Clerk reports the new
 *     tier. With a cached ME that repaint would show the pre-payment decision
 *     to someone who has just paid €49. The poller now clears the cache first,
 *     and it waits on OUR gate rather than on Clerk's client-side metadata —
 *     the gate is what actually unlocks the data, and the whole point of this
 *     change is to stop the UI having a second opinion.
 */
const fs = require("fs");
const V = "app/views.js";
let v = fs.readFileSync(V, "utf8");
if (v.includes("ME_WAIT")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(V, V + ".bak-loadme");

const sub = (from, to, label) => {
  if (!v.includes(from)) throw new Error("not found: " + label);
  v = v.split(from).join(to);
};

sub(
  `  var ME = null, ME_STATE = "idle";
  function loadMe(cb) {
    if (ME) return cb(ME);
    if (ME_STATE === "loading") return;
    ME_STATE = "loading";`,
  `  var ME = null, ME_STATE = "idle", ME_WAIT = [];
  function meForget() { ME = null; ME_STATE = "idle"; }
  function loadMe(cb) {
    if (ME) return cb(ME);
    // queue rather than drop: account() paints a placeholder before calling
    // this, so a dropped callback leaves "Checking your access…" on screen
    ME_WAIT.push(cb);
    if (ME_STATE === "loading") return;
    ME_STATE = "loading";`,
  "loadMe head"
);

sub(
  `        .then(function (jn) { ME = jn || { entitled: false, tier: "unknown", via: "unavailable" }; ME_STATE = "ready"; cb(ME); })
        .catch(function () { ME = { entitled: false, tier: "unknown", via: "unavailable" }; ME_STATE = "ready"; cb(ME); });`,
  `        .then(function (jn) { meDone(jn || { entitled: false, tier: "unknown", via: "unavailable" }); })
        .catch(function () { meDone({ entitled: false, tier: "unknown", via: "unavailable" }); });`,
  "loadMe resolve"
);

sub(
  `    if (window.Clerk && window.Clerk.session) window.Clerk.session.getToken().then(go).catch(function () { go(null); });
    else go(null);
  }

  /* ---------- gated per-domain loader ---------- */`,
  `    if (window.Clerk && window.Clerk.session) window.Clerk.session.getToken().then(go).catch(function () { go(null); });
    else go(null);
  }
  function meDone(res) {
    ME = res; ME_STATE = "ready";
    var q = ME_WAIT; ME_WAIT = [];
    q.forEach(function (fn) { try { fn(ME); } catch (e) {} });
  }

  /* ---------- gated per-domain loader ---------- */`,
  "meDone"
);

/* the Stripe-return poller waits on OUR gate, not on Clerk's client metadata */
sub(
  `              var m = (window.Clerk.user.publicMetadata || {});
              if (m.tier === "terminal") { history.replaceState({}, "", "/dashboard.html#account"); account(); }
              else if (tries < 8) setTimeout(poll, 2000);
              else payStatus("Subscription is processing. If it doesn't appear shortly, reload the page.");`,
  `              // ask the gate, not Clerk's client-side copy: the gate is what
              // unlocks the data, and a cached ME would otherwise show the
              // pre-payment answer to someone who has just paid
              meForget();
              loadMe(function (me) {
                if (me && me.entitled) { history.replaceState({}, "", "/dashboard.html#account"); account(); }
                else if (tries < 8) setTimeout(poll, 2000);
                else payStatus("Subscription is processing. If it doesn't appear shortly, reload the page.");
              });`,
  "poller"
);

fs.writeFileSync(V, v);
require("child_process").execSync("node --check " + V);

const out = fs.readFileSync(V, "utf8");
for (const m of ["ME_WAIT", "function meDone", "meForget()", "loadMe(function (me) {"])
  if (!out.includes(m)) throw new Error("missing after patch: " + m);
if (out.includes("if (m.tier === \"terminal\") { history.replaceState"))
  throw new Error("poller still keys off client-side metadata");

console.log("loadMe() fixed");
console.log("  concurrent callers queue instead of being dropped (the Account tab could hang)");
console.log("  the cache is cleared after payment, and the poller waits on the gate's answer");
