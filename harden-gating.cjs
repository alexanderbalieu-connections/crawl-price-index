#!/usr/bin/env node
/**
 * CPI — close two entitlement holes in app/_worker.js
 * ===========================================================================
 * Found while auditing why a free account might be seeing the paid dataset.
 * Neither is the reported symptom on its own, but both are real.
 *
 * 1. /api/snapshot IS THE WHOLE DATASET, FOREVER, WITH NO LOGIN.
 *    It accepts any Stripe session_id whose payment_status is "paid" and
 *    streams private/domains.json. Nothing binds that session to a person,
 *    nothing expires it, and nothing limits how many times it is used. After
 *    checkout the session_id sits in the browser's address bar, so it lands in
 *    history, bookmarks, referrer headers and anything the buyer pastes to
 *    anyone. One €29 purchase is a permanent download link to the €49 product.
 *
 *    Fixed: the session must be `complete`, and older than 48 hours is
 *    refused with a message telling the buyer how to get a fresh link. A
 *    one-off purchase is a download, not a standing subscription, and 48 hours
 *    is generous for "I clicked buy and want my file".
 *
 * 2. The /private/ interceptor was case-sensitive.
 *    `path.startsWith("/private/")` does not match /Private/ or /PRIVATE/.
 *    Cloudflare Pages asset lookup is normally case-sensitive too, so this is
 *    belt-and-braces rather than a live hole — but it costs nothing, and the
 *    thing behind that door is the entire licensed dataset.
 */
const fs = require("fs");
const P = "app/_worker.js";
let s = fs.readFileSync(P, "utf8");
if (s.includes("SNAPSHOT_MAX_AGE_S")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(P, P + ".bak-gating-" + Math.floor(Date.now() / 1000));

const sub = (from, to, label) => {
  if (!s.includes(from)) throw new Error("not found: " + label);
  s = s.split(from).join(to);
};

/* ---- 1. the /private/ door ---------------------------------------------- */
sub(
  '    /* never serve the licensed payload directly */\n' +
  '    if (path.startsWith("/private/")) {',
  '    /* never serve the licensed payload directly.\n' +
  '       Case-folded and decoded first: the whole licensed dataset is behind\n' +
  '       this door, so it should not turn on the casing of a URL. */\n' +
  '    let probe = path;\n' +
  '    try { probe = decodeURIComponent(path); } catch (e) { /* malformed: use raw */ }\n' +
  '    if (probe.toLowerCase().split("/").includes("private")) {',
  "private interceptor"
);

/* ---- 2. the snapshot link ------------------------------------------------ */
sub(
  '    if (path === "/api/snapshot") {\n' +
  '      const sid = url.searchParams.get("session_id");\n' +
  '      if (!sid) return j({ error: "session_id required" }, 400);\n' +
  '      try {\n' +
  '        const s = await stripeGet(env, "checkout/sessions/" + encodeURIComponent(sid));\n' +
  '        const paid = s.payment_status === "paid" && s.mode === "payment";\n' +
  '        if (!paid) return j({ error: "payment not confirmed" }, 402);',
  '    if (path === "/api/snapshot") {\n' +
  '      const sid = url.searchParams.get("session_id");\n' +
  '      if (!sid) return j({ error: "session_id required" }, 400);\n' +
  '      try {\n' +
  '        const s = await stripeGet(env, "checkout/sessions/" + encodeURIComponent(sid));\n' +
  '        const paid = s.payment_status === "paid" && s.mode === "payment" && s.status === "complete";\n' +
  '        if (!paid) return j({ error: "payment not confirmed" }, 402);\n' +
  '        // A one-off purchase is a download, not a standing licence. Without\n' +
  '        // this the session_id — which sits in the address bar after checkout,\n' +
  '        // and so in history, bookmarks and referrers — is a permanent,\n' +
  '        // shareable link to the entire dataset.\n' +
  '        const age = Math.floor(Date.now() / 1000) - Number(s.created || 0);\n' +
  '        if (!s.created || age > SNAPSHOT_MAX_AGE_S) {\n' +
  '          return j({ error: "this download link has expired",\n' +
  '                     detail: "Snapshot links are valid for 48 hours after purchase. Reply to your receipt and we will send a fresh one.",\n' +
  '                     support: MAIL_SUPPORT }, 410);\n' +
  '        }',
  "snapshot gate"
);

/* the constant, next to the other config at the top of the module */
sub(
  "/* ---------- entitlement -------------------------------------------------- */",
  "/* How long a one-off snapshot download link stays live after purchase. */\n" +
  "const SNAPSHOT_MAX_AGE_S = 48 * 60 * 60;\n\n" +
  "/* ---------- entitlement -------------------------------------------------- */",
  "snapshot constant"
);

fs.writeFileSync(P, s);
require("child_process").execSync("node --check " + P);

/* ---- verify -------------------------------------------------------------- */
const out = fs.readFileSync(P, "utf8");
for (const m of ["SNAPSHOT_MAX_AGE_S", 'split("/").includes("private")', 's.status === "complete"', "410"])
  if (!out.includes(m)) throw new Error("missing after patch: " + m);
if (out.includes('if (path.startsWith("/private/"))')) throw new Error("old case-sensitive check survived");

console.log("app/_worker.js hardened");
console.log("  /api/snapshot  now requires a COMPLETE session and expires the link after 48h");
console.log("                 (it was a permanent, login-free, shareable link to the full dataset)");
console.log("  /private/*     match is now case-folded and URL-decoded");
console.log("");
console.log("  NOTE: this does NOT explain a signed-in free account seeing the dataset.");
console.log("        That path runs through entitled(), which needs claims.tier==='terminal',");
console.log("        Clerk public_metadata.tier==='terminal', or the email in ADMIN_EMAILS.");
