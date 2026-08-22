#!/usr/bin/env node
/**
 * CPI — CSS COVERAGE GUARD  (node check-css.cjs)
 * Every class name views.js generates must be defined in dashboard.html's
 * stylesheet. A missing class renders as run-together unstyled text — this
 * exact bug shipped twice (".reading" and ".lrow/.lb2") before this guard.
 * Exit 0 = clean, 1 = missing classes. Wire non-fatally into the Sunday run.
 */
const fs = require("fs");
const v = fs.readFileSync("app/views.js", "utf8");
const h = fs.readFileSync("app/dashboard.html", "utf8");
const used = new Set();
for (const m of v.matchAll(/class=\\?"([^"\\]+)/g))
  m[1].split(/\s+/).forEach(c => { if (/^[a-z][a-z0-9-]*$/i.test(c)) used.add(c); });
// dynamic role classes rtag renders as r<role>; ignore those (covered by .rtag base)
const css = (h.match(/<style>[\s\S]*?<\/style>/i) || [""])[0];
const defined = new Set();
for (const m of css.matchAll(/\.([a-zA-Z][a-zA-Z0-9-]*)/g)) defined.add(m[1]);
const IGNORE = /^r[a-z]+$/;   // .rtraining/.rsearch/.ruser variants have a styled base
const missing = [...used].filter(c => !defined.has(c) && !IGNORE.test(c)).sort();
console.log(`CSS COVERAGE GUARD — ${used.size} classes used, ${defined.size} defined`);
if (!missing.length) { console.log("clean — every generated class is styled."); process.exit(0); }
console.log("MISSING (will render unstyled): " + missing.join(", "));
process.exit(1);
