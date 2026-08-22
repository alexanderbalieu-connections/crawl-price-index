#!/usr/bin/env node
/**
 * CPI — repair the $$ collapse on /explore, and guard the whole class
 * ===========================================================================
 * Copying the homepage's renderer block onto /explore corrupted it:
 *
 *     function $(s){ return document.querySelector(s); }
 *     function $(s){ return document.querySelectorAll(s); }   <-- was $$
 *
 * Cause: String.replace() with a STRING replacement treats `$$` as an escape
 * for a literal `$`. Every `$$` in the copied code collapsed to `$`. This is
 * the second time today the same family of bug has landed — the first was `$'`
 * swallowing the tail of a document — and I had already fixed that one by
 * switching to a function replacer, then reintroduced it here.
 *
 * The failure was silent and worse than a crash. The duplicate declaration
 * redefined `$` as querySelectorAll, so `$('#rates')` returned a NodeList —
 * truthy, so the null guard passed — and `.innerHTML = …` set a property on a
 * NodeList, which does nothing at all. No error, no output. The block-rate
 * ladder, the posture grid and the ticker rendered empty on /explore and
 * nothing complained.
 *
 * Fix: re-copy the block from the homepage with a function replacer, then
 * guard the class in check-helpers.cjs — a page that declares the same
 * function name twice is now a hard failure.
 */
const fs = require("fs");
const H = "public/index.html";
const E = "public/explore.html";

let e = fs.readFileSync(E, "utf8");
const h = fs.readFileSync(H, "utf8");

/* pull the authoritative block out of the homepage */
const START = "var D = {};";
const END = "})();\n\n\n</script>";
const ha = h.indexOf(START), hb = h.indexOf(END, ha);
if (ha < 0 || hb < 0) throw new Error("homepage renderer block not found");
const good = h.slice(ha, hb + END.length - "</script>".length);
if (!good.includes("function $$(s)")) throw new Error("homepage copy is itself corrupted — fix that first");

/* and swap the corrupted copy on /explore for it */
const ea = e.indexOf(START);
if (ea < 0) throw new Error("explore renderer block not found");
const eb = e.indexOf("</script>", ea);
if (eb < 0) throw new Error("explore block end not found");
const before = e.slice(ea, eb);
const dollarDollar = (before.match(/\$\$/g) || []).length;

// a function replacer is never scanned for $ patterns
e = e.slice(0, ea) + good + e.slice(eb);
fs.writeFileSync(E, e);

/* ---- verify -------------------------------------------------------------- */
const out = fs.readFileSync(E, "utf8");
const decls = [...out.matchAll(/function\s+(\$\$?|[A-Za-z_][\w$]*)\s*\(/g)].map(m => m[1]);
const dupes = decls.filter((d, i) => decls.indexOf(d) !== i);
if (dupes.length) throw new Error("duplicate function declarations remain: " + [...new Set(dupes)].join(", "));
if (!out.includes("function $$(s){ return document.querySelectorAll(s); }"))
  throw new Error("$$ helper still missing");
if (!out.includes("$$('.calc-price')") && out.includes("calc-price"))
  throw new Error("calc-price still calls the wrong helper");

console.log("/explore renderer block re-copied correctly");
console.log("  the corrupted copy had " + dollarDollar + " surviving $$ and a duplicate function $");
console.log("  restored: function $$ , and every $$ call site with it");
console.log("");
console.log("  WHY IT WAS SILENT: the duplicate declaration made $ = querySelectorAll,");
console.log("  so $('#rates') returned a NodeList — truthy, so the null guard passed —");
console.log("  and setting .innerHTML on a NodeList does nothing. No error, no output.");
