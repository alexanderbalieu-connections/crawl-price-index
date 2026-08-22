#!/usr/bin/env node
/**
 * CPI — orphaned-helper guard  (node check-helpers.cjs)
 * ===========================================================================
 * Twice in one day a page shipped calling a helper that was not in scope:
 *
 *   check.html    `$` — the price listeners were moved to "page init", which
 *                 in that file is after the IIFE closes, where $ is undefined
 *   estimate.html `set` — the calculator was moved out of the homepage and
 *                 left its one-line helper behind
 *
 * Both threw on the first call and killed everything after them. Both looked
 * completely fine in review, because the missing half was in a different file
 * or a different scope. Static structure checks did not see it and neither
 * did I.
 *
 * This walks every inline script in every public page, collects the functions
 * and vars it DEFINES, collects the identifiers it CALLS, and flags any call
 * to something that is neither defined in that page nor a known global. It is
 * deliberately conservative — an allowlist of browser and site globals, and it
 * only inspects call sites — so a hit is nearly always real.
 */
const fs = require("fs");
const path = require("path");

const GLOBALS = new Set([
  // language + browser
  "Array","Boolean","Date","Error","JSON","Math","Number","Object","Promise","RegExp","String","Symbol","Map","Set","WeakMap",
  "parseInt","parseFloat","isNaN","isFinite","encodeURIComponent","decodeURIComponent","encodeURI","decodeURI",
  "setTimeout","setInterval","clearTimeout","clearInterval","requestAnimationFrame","fetch","alert","atob","btoa",
  "document","window","location","history","navigator","console","URL","URLSearchParams","Blob","FormData","Headers",
  "getComputedStyle","Image","Audio","FileReader","CustomEvent","Event","Intl","scrollTo","matchMedia","structuredClone","queueMicrotask","IntersectionObserver","ResizeObserver",
  // site-wide, defined by shared chrome or third parties
  "Clerk","cpiSub","cpiSubFoot","cpiPost","CPI_BOOT","CPI_ON_CLERK_READY",
  // control flow that the regex can otherwise mistake for a call
  "async","if","for","while","switch","catch","return","typeof","function","new","do","else","delete","void","in","of","await","yield","case","throw",
]);

/* Identifiers inside strings are prose, not calls. "…most blocking (42.1%)"
   read as a call to most(). Blank out string and template bodies, and
   comments, before looking for anything. */
const stripLiterals = (src) => src
  .replace(/\\./g, "__")                                   // escapes first
  .replace(/\/\*[\s\S]*?\*\//g, " ")                       // block comments
  .replace(/(^|[^:])\/\/[^\n]*/g, " ")                     // line comments
  .replace(/"[^"\n]*"/g, '""')                             // double-quoted
  .replace(/'[^'\n]*'/g, "''")                             // single-quoted
  .replace(/`[^`]*`/g, "``");                                // template
let bad = 0, n = 0, scanned = 0;
const report = [];

const inlineScripts = (html) => {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    if (/\bsrc=/.test(m[1])) continue;                 // external file, not ours to check
    if (/type=["']application\/json["']/.test(m[1])) continue;
    out.push(m[2]);
  }
  return out;
};

const dir = "public";
for (const f of fs.readdirSync(dir).filter(x => x.endsWith(".html")).sort()) {
  const html = fs.readFileSync(path.join(dir, f), "utf8");
  const scripts = inlineScripts(html);
  if (!scripts.length) continue;
  scanned++;
  const code = stripLiterals(scripts.join("\n;\n"));

  const defined = new Set();
  for (const m of code.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)/g)) defined.add(m[1]);
  for (const m of code.matchAll(/\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)/g)) defined.add(m[1]);
  // destructuring and multi-declarator forms: var a = 1, b = 2
  for (const m of code.matchAll(/[,{]\s*([A-Za-z_$][\w$]*)\s*[=,}]/g)) defined.add(m[1]);
  // parameters, loosely — anything inside a function signature
  for (const m of code.matchAll(/function\s*[A-Za-z_$\w]*\s*\(([^)]*)\)/g))
    m[1].split(",").map(x => x.trim().split(/[\s=]/)[0]).filter(Boolean).forEach(p => defined.add(p));
  for (const m of code.matchAll(/\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*=>/g)) defined.add(m[1]);

  const called = new Set();
  for (const m of code.matchAll(/(^|[^.\w$'"`])([A-Za-z_$][\w$]*)\s*\(/g)) called.add(m[2]);

  /* A name declared twice is almost always a copy going wrong. It bit us as
     $ collapsing to $ (String.replace treats $ as an escape), which
     redefined $ as querySelectorAll — and because a NodeList is truthy and
     accepts a .innerHTML property assignment, three panels rendered empty
     with no error at all. Silent is worse than broken. */
  const decls = [...code.matchAll(/function\s+(\$\$?|[A-Za-z_][\w$]*)\s*\(/g)].map(m => m[1]);
  const dupes = [...new Set(decls.filter((d, i) => decls.indexOf(d) !== i))];

  const orphans = [...called].filter(c => !defined.has(c) && !GLOBALS.has(c)).sort();
  n++;
  if (orphans.length || dupes.length) {
    bad++;
    report.push({ f, orphans, dupes });
  }
}

console.log("\nORPHANED-HELPER GUARD");
console.log("-".repeat(74));
console.log("  scanned " + scanned + " public pages with inline script");
for (const r of report) {
  if (r.orphans.length)
    console.log("  FAIL  " + r.f + " calls " + r.orphans.map(o => o + "()").join(", ") +
                "\n         not defined in this page and not a known global");
  if (r.dupes.length)
    console.log("  FAIL  " + r.f + " declares " + r.dupes.map(o => o + "()").join(", ") +
                " twice\n         a later declaration silently replaces the earlier one");
}
if (!bad) console.log("  ok    every helper is defined in its page, and none is declared twice");
console.log("-".repeat(74));
if (bad) {
  console.log(bad + " page(s) call a helper that is not in scope — they will throw on load.\n");
  console.log("If a name above is legitimately global, add it to GLOBALS in this file.\n");
  process.exit(1);
}
console.log("All " + n + " pages clean.\n");
