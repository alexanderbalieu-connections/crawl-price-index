#!/usr/bin/env node
/**
 * CPI — the paid dataset was cached in the browser for five minutes
 * ===========================================================================
 * THIS IS THE BUG. Both Clerk doors came back clean — the token carries
 * `tier: null` and the user's public_metadata is empty — so entitled() was
 * correctly returning false. The dataset was never coming through the gate at
 * all. It was coming out of the browser's HTTP cache.
 *
 * Both gated payloads were served with:
 *
 *     cache-control: private, max-age=300
 *
 * and no Vary header. The browser cache is keyed on the URL. It does not know
 * or care that the Authorization header changed. So:
 *
 *   1. sign in as the paid account, open Domains -> 200, cached for 5 minutes
 *   2. sign out, sign in as a free account, open Domains within those 5 minutes
 *   3. fetch("/api/domains") is answered from cache. The request never leaves
 *      the browser. The worker never runs. The gate is never consulted.
 *
 * Which is exactly the reported symptom, including the part that made it
 * confusing: the Account tab said "Headline dashboard" because that answer is
 * computed live from Clerk, while the Domains tab served rows from a response
 * cached under a different identity.
 *
 * It is worse than one person's account switching. Any shared or borrowed
 * computer leaks the licensed dataset to whoever signs in next within the
 * window, and signing out does not clear it.
 *
 * Fix: no-store on both gated payloads. A licensed per-domain dataset has no
 * business sitting in a disk cache keyed only by URL. `Vary: Authorization` is
 * added too, so nothing between us and the browser can make the same mistake.
 *
 * The 5 minutes bought nothing anyway: views.js already memoises the payload
 * in `PD` / `BZD` for the life of the page, so a repeat fetch inside one
 * session never happens.
 */
const fs = require("fs");
const W = "app/_worker.js";
let s = fs.readFileSync(W, "utf8");
if (s.includes("Vary")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(W, W + ".bak-cache");

const OLD = `        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, max-age=300" },`;
const NEW = `        headers: {
          "content-type": "application/json; charset=utf-8",
          // no-store, not max-age: the browser cache is keyed on the URL and
          // ignores the Authorization header, so a cached 200 from one account
          // was being replayed to the next account to sign in on that machine
          "cache-control": "private, no-store, max-age=0, must-revalidate",
          "Vary": "Authorization",
        },`;

const count = s.split(OLD).length - 1;
if (count !== 2) throw new Error("expected 2 gated payload responses, found " + count);
s = s.split(OLD).join(NEW);

fs.writeFileSync(W, s);
require("child_process").execSync("node --check " + W);

const out = fs.readFileSync(W, "utf8");
if (/"cache-control": "private, max-age=300"/.test(out)) throw new Error("a cacheable gated response survived");
if ((out.match(/"Vary": "Authorization"/g) || []).length !== 2) throw new Error("Vary missing on a gated route");

console.log("gated payloads are no longer cacheable");
console.log("  /api/domains and /api/bazaar-domains: private, no-store, must-revalidate");
console.log("  + Vary: Authorization");
console.log("");
console.log("  This is the reported bug: the browser was replaying a 200 cached");
console.log("  under the paid account to the free account that signed in next.");
