#!/usr/bin/env node
/**
 * CPI — don't offer to sell to someone we simply failed to check
 * ===========================================================================
 * Caught by driving the Account tab through all four entitlement states.
 *
 * On the API side I was careful to answer "cannot verify" with 503 rather than
 * 402, precisely so a paying customer is never told to subscribe because our
 * account service is down. The Account tab did not carry the same care: with
 * via === "unverified" it printed "could not be checked just now" and then,
 * directly underneath, a **Subscribe — €49/mo** button. A subscriber hitting a
 * Clerk outage could buy the thing they already own.
 *
 * The purchase buttons are now replaced, in that state only, with a plain
 * explanation and a Try again control. Same principle as the 503: an unknown
 * answer is not a "no".
 */
const fs = require("fs");
const V = "app/views.js";
let v = fs.readFileSync(V, "utf8");
if (v.includes("acct-retry")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(V, V + ".bak-unverified");

const sub = (from, to, label) => {
  if (!v.includes(from)) throw new Error("not found: " + label);
  v = v.split(from).join(to);
};

/* the Subscription panel gains a third state */
sub(
  `    h += '<section class="panel"><div class="ix">Subscription</div>' +
      (isTerminal`,
  `    var unverified = !!(me && me.via === "unverified");
    h += '<section class="panel"><div class="ix">Subscription</div>' +
      (unverified
        ? '<p class="sub">We couldn&rsquo;t check your subscription just now &mdash; that&rsquo;s our end, not yours. ' +
          'Nothing has changed on your account.</p>' +
          '<div class="ctrls"><button class="btnx" id="acct-retry">Try again</button></div>' +
          '<p class="foot">Deliberately not showing a purchase button here: if you are already a subscriber, ' +
          'a failed check is not a reason to be sold the same thing twice.</p>'
        : isTerminal`,
  "subscription panel"
);

/* no extra paren needed: the original already wraps the ternary */

/* wire the retry: forget the cached decision and re-render */
sub(
  `    if (EL("buy-snap")) EL("buy-snap").addEventListener("click", function () { startCheckout("snap", this); });`,
  `    if (EL("acct-retry")) EL("acct-retry").addEventListener("click", function () {
      this.disabled = true; this.textContent = "Checking…";
      meForget();
      account();
    });
    if (EL("buy-snap")) EL("buy-snap").addEventListener("click", function () { startCheckout("snap", this); });`,
  "retry wiring"
);

fs.writeFileSync(V, v);
require("child_process").execSync("node --check " + V);

const out = fs.readFileSync(V, "utf8");
for (const m of ["acct-retry", "var unverified =", "not a reason to be sold the same thing twice"])
  if (!out.includes(m)) throw new Error("missing after patch: " + m);

console.log("Account tab: an unverifiable check no longer offers to sell");
console.log("  purchase buttons replaced with an explanation and Try again");
console.log("  matches the API, which answers 503 rather than 402 in the same case");
