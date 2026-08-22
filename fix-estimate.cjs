#!/usr/bin/env node
/**
 * CPI — /estimate: the calculator threw on load
 * ===========================================================================
 * "Sensitivity tool page opens but doesn't render at all."
 *
 * ReferenceError: set is not defined.
 *
 * When the market-sizing calculator was moved out of the homepage into its own
 * page, the code came with it but the one-line helper it depends on did not —
 * `set()` is defined in index.html's script block and was never copied. Six
 * call sites, so the recompute function threw on its first statement and every
 * output on the page stayed blank.
 *
 * This is the second time today a helper has been orphaned by moving code
 * between scopes (the first was `$` in check.html, left outside its IIFE). So
 * this ships with a guard that catches the whole class: check-helpers.cjs.
 */
const fs = require("fs");
const P = "public/estimate.html";
let s = fs.readFileSync(P, "utf8");
if (s.includes("function set(")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(P, P + ".bak-set");

const ANCHOR = 'function $(s){ return document.querySelector(s); }';
if (!s.includes(ANCHOR)) throw new Error("helper anchor not found");
s = s.replace(ANCHOR,
  ANCHOR + '\n' +
  '// Came from index.html with the calculator; the helper it needs did not.\n' +
  'function set(id,v){ var e=document.getElementById(id); if(e) e.textContent=v; }');

fs.writeFileSync(P, s);

/* every id the calculator writes to must exist in the markup */
const out = fs.readFileSync(P, "utf8");
const ids = [...out.matchAll(/\bset\('([^']+)'/g)].map(m => m[1]);
const missing = ids.filter(id => !out.includes('id="' + id + '"'));
if (missing.length) throw new Error("set() targets ids that do not exist: " + missing.join(", "));

console.log("/estimate fixed — set() was called 6 times and never defined");
console.log("  targets verified present in the markup: " + [...new Set(ids)].join(", "));
