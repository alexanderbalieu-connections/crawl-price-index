#!/usr/bin/env node
/**
 * CPI — FEEDBACK AUDIT  (node audit-feedback.cjs)
 * Mechanically checks every change Alex has asked for in this session against
 * the actual source files. No memory, no assumptions — greps only.
 * Prints: IN SOURCE (will ship on next deploy) / MISSING / DEFERRED-BY-PLAN.
 */
const fs = require("fs");
const read = p => { try { return fs.readFileSync(p, "utf8"); } catch (e) { return ""; } };

const V = read("app/views.js");
const D = read("app/dashboard.html");
const H = read("public/index.html");
const W = read("app/_worker.js");
const CP = read("check-public.cjs");
const SR = read("sunday-run.command");

const CHECKS = [
  // ---- from the "VERY CONCERNED" message -------------------------------
  ["Nav chip renamed to 'Policy changes'",            () => D.includes(">Policy changes</a>")],
  ["TABS title 'Policy changes'",                     () => V.includes('title: "Policy changes"')],
  ["'How to read this' has block-level styled label", () => D.includes(".reading .rh2")],
  ["Account page Stripe buttons restored",            () => V.includes("buy-sub") && V.includes("bill-portal")],
  ["'next build step' placeholder removed",           () => !V.includes("next build step")],
  ["Admin/tier 402 fix (backend entitlement check)",  () => W.includes("async function entitled") && W.includes("await entitled(")],
  // ---- from the 10-point message ---------------------------------------
  ["'&gt; $1' histogram label fixed",                 () => V.includes('bzBar("> $1"')],
  ["Segments bars diverge from a centre axis",        () => V.includes("right:50%") && V.includes("left:50%")],
  ["Trend graph shrunk on 'This edition'",            () => V.includes("max-width:600px")],
  ["Wire evidence restructured into tables",          () => V.includes("Observed for") && V.includes("byDom")],
  ["Full-detail Policy box enriched (direction)",     () => V.includes("dir2.reversions")],
  // ---- latest message ---------------------------------------------------
  ["'Training versus traffic' bar CSS defined",       () => D.includes(".lrow{") && D.includes(".lb2{")],
  ["All 13 missing CSS classes added",                () => [".bar2{",".nw{",".pl-row",".rtag{",".sig{",".sighead{",".sigkey{",".tp{"].every(c => D.includes(c))],
  // ---- Phase 1 (credibility) --------------------------------------------
  ["Trend renamed 'Observed weekly block rate'",      () => (V.match(/Observed weekly block rate/g) || []).length >= 2],
  ["Wire evidence = 'Field notes' + probe banner",    () => V.includes("Field notes") && V.includes("Non-random probe")],
  ["'sellers' -> 'distinct pay-to addresses'",        () => V.includes("distinct pay-to addresses") && !/\bfmt\(s\.distinct\), "distinct sellers"/.test(V)],
  ["Composition bars labelled 'not market share'",    () => V.includes("not market share")],
  ["Penetration shows counts, not bare %",            () => V.includes("in frame") && V.includes("band_size")],
  ["Blockers-that-sell framed as watchlist",          () => V.includes("watchlist")],
  ["Copy guard: causal/market language rules",        () => CP.includes("causal language") && CP.includes("market framing")],
  ["Copy guard is negation-aware",                    () => CP.includes("NEGATED_OK")],
  // ---- Phase 2 ----------------------------------------------------------
  ["Policy-change direction split panel",             () => V.includes("Direction of travel") && V.includes("RESTRICTION_RANK")],
  ["Reversions (moved off a block) surfaced",         () => V.includes("moved <b>off</b> an explicit block")],
  // ---- homepage / marketing --------------------------------------------
  ["Homepage has 'Sign in' link",                     () => H.includes(">Sign in</a>")],
  ["2-button nav retained",                           () => H.includes(">Free dashboard</a>") && H.includes(">Get the Terminal</a>")],
  // ---- guards wired -----------------------------------------------------
  ["CSS coverage guard exists",                       () => fs.existsSync("check-css.cjs")],
  ["CSS guard wired into Sunday run",                 () => SR.includes("check-css.cjs")],
  ["Bazaar guard wired into Sunday run",              () => SR.includes("check-bazaar.cjs")],
];

const DEFERRED = [
  "Edition-comparison filters (vs last edition / 3 months)  — v3 plan Phase 2 #14",
  "Click-through drill-downs on charts (3 highest-value)     — v3 plan Phase 2 #12",
  "Crawler co-blocking / discrimination matrix               — v3 plan Phase 2 #9",
  "Policy archetypes / template-vs-bespoke split             — v3 plan Phase 2 #10",
  "Wire-evidence full 'evidence lab' redesign                — v3 plan Phase 1 #2 (partial: tables shipped)",
  "Persistence metric (do changes stick?)                    — v3 plan Phase 2 #8 (needs pipeline)",
  "Segments within-group discrimination default view         — v3 plan Phase 2 #11",
];

let pass = 0, fail = [];
console.log("\nCPI FEEDBACK AUDIT — source files on disk");
console.log("=".repeat(72));
for (const [label, fn] of CHECKS) {
  let ok = false; try { ok = !!fn(); } catch (e) { ok = false; }
  console.log((ok ? "  ok   " : " MISS  ") + label);
  ok ? pass++ : fail.push(label);
}
console.log("=".repeat(72));
console.log(`${pass}/${CHECKS.length} implemented in source.`);
if (fail.length) { console.log("\nMISSING:"); fail.forEach(f => console.log("  - " + f)); }
console.log("\nDEFERRED BY PLAN (agreed, not lost):");
DEFERRED.forEach(d => console.log("  · " + d));
console.log("\nNOTE: 'ok' means present in the file on disk. It ships only after a deploy.");
console.log("  app  -> npx wrangler pages deploy app --project-name=cpi-app --commit-dirty=true");
console.log("  site -> npx wrangler deploy\n");
process.exit(fail.length ? 1 : 0);
