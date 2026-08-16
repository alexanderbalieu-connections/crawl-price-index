#!/usr/bin/env node
// CONSISTENCY SWEEP — one source of truth for shared components.
// 1. DELETES every page-local CSS rule for components theme.css owns
//    (buttons, masthead, mark, nav, crumbs, back links). Patching around
//    them loses on specificity; removing them cannot.
// 2. Removes crumb/back-link markup — the masthead is the navigation.
// 3. Verifies afterwards that no page defines a competing rule, and FAILS
//    LOUDLY if one remains.
// Idempotent. One backup per file.
const fs = require("fs");
const path = require("path");

const DIR = "public";
const SKIP = new Set(["index-v2.html", "index-v1-backup.html"]);

// selectors owned by theme.css — page-local definitions get deleted
const OWNED = /(^|[,\s}])(a\.btn(-ghost)?(:hover)?|\.btn(-ghost)?(:hover)?|button\.go(:hover)?|\.go(:hover)?|\.ghost(:hover)?|\.crumb( a)?(:hover)?|\.back(:hover)?|\.mark( b| em)?|\.masthead[^,{]*|\.nav( a[^,{]*)?|header \.wrap)\s*$/;

function stripOwnedRules(css) {
  let out = "", i = 0, removed = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open === -1) { out += css.slice(i); break; }
    const close = css.indexOf("}", open);
    if (close === -1) { out += css.slice(i); break; }
    const selector = css.slice(i, open);
    const owned = selector.split(",").every(function (sel) {
      return OWNED.test(" " + sel.trim());
    }) && selector.trim().length > 0 && selector.indexOf("@") === -1;
    if (owned) { removed++; }
    else { out += css.slice(i, close + 1); }
    i = close + 1;
  }
  return { css: out, removed: removed };
}

const files = fs.readdirSync(DIR).filter(f => f.endsWith(".html") && !SKIP.has(f)).sort();
let total = 0;

for (const f of files) {
  const p = path.join(DIR, f);
  let s = fs.readFileSync(p, "utf8");
  const before = s;
  let removed = 0;

  // strip owned rules inside every <style> block
  s = s.replace(/<style>([\s\S]*?)<\/style>/g, function (m, css) {
    const r = stripOwnedRules(css);
    removed += r.removed;
    return "<style>" + r.css + "</style>";
  });

  // crumbs and back links out — the masthead is the navigation
  s = s.replace(/<div class="crumb">[\s\S]*?<\/div>\s*/g, "");
  s = s.replace(/<a class="back"[^>]*>[\s\S]*?<\/a>\s*/g, "");

  if (s === before) { console.log("  " + f.padEnd(24) + "clean"); continue; }
  if (!fs.existsSync(p + ".bak-cons")) fs.copyFileSync(p, p + ".bak-cons");
  fs.writeFileSync(p, s);
  console.log("  " + f.padEnd(24) + removed + " competing rules removed" + (before.indexOf('class="crumb"') > -1 || before.indexOf('class="back"') > -1 ? ", crumbs removed" : ""));
  total += removed;
}

// ---- verification: NOTHING may still define an owned selector --------------
console.log("\nVERIFICATION");
let fail = false;
for (const f of files) {
  const s = fs.readFileSync(path.join(DIR, f), "utf8");
  const styles = (s.match(/<style>[\s\S]*?<\/style>/g) || []).join("\n");
  const hits = [];
  ["a.btn{", "a.btn:", ".btn{", ".btn:", ".ghost{", ".crumb{", ".back{", ".mark{", ".masthead{", ".nav{"].forEach(function (sig) {
    if (styles.indexOf(sig) !== -1) hits.push(sig.replace("{", "").replace(":", ""));
  });
  if (s.indexOf('class="crumb"') !== -1) hits.push("crumb markup");
  if (s.indexOf('class="back"') !== -1) hits.push("back markup");
  if (hits.length) { console.log("  FAIL " + f.padEnd(22) + hits.join(", ")); fail = true; }
}
if (fail) { console.error("\nCOMPETING RULES REMAIN — do not deploy."); process.exit(1); }
console.log("  all " + files.length + " pages defer to theme.css for shared components.");
console.log("\n" + total + " rules removed. Undo: for f in public/*.html.bak-cons; do mv \"$f\" \"${f%.bak-cons}\"; done");
