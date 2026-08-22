#!/usr/bin/env node
/**
 * CPI guard — every class a public page renders must actually be styled.
 * ===========================================================================
 * Written after "Who gets blocked", "How the door answers" and the trend
 * chart were all found rendering unstyled on /explore: their renderers were
 * copied from index.html without the CSS rules they depend on. No console
 * error, no empty element — the panels simply looked wrong, for days.
 *
 * A class counts as styled if a selector mentioning it exists in the page's
 * own <style> block or in theme.css. HOOKS below are classes deliberately
 * carrying no styling — they exist to be found by querySelectorAll.
 */
const fs = require("fs");
const path = require("path");

const HOOKS = new Set([
  "tpt",   // SVG points on the trend chart: styled by inline attributes,
           // classed only so the tooltip handler can find them
  "ppt",   // the same thing on /estimate's projection chart
  "preset",// /estimate scenario buttons: .ghost is the look, .preset is the
           // handle the click handler binds to
  "n0",    // /why nesting strip: n1/n2/n3 each add an indent, n0 is the
           // un-indented base. Written out so the four levels read as a set.
]);

const theme = fs.existsSync("public/theme.css") ? fs.readFileSync("public/theme.css", "utf8") : "";
const pages = fs.readdirSync("public").filter((f) => f.endsWith(".html"));
let bad = 0, checked = 0;

for (const f of pages) {
  const src = fs.readFileSync(path.join("public", f), "utf8");
  // every class="..." literal, in static markup and in JS-emitted strings
  const used = new Set();
  for (const m of src.matchAll(/class="([^"'+]+)"/g))
    m[1].split(/\s+/).forEach((c) => { if (/^[A-Za-z][\w-]*$/.test(c)) used.add(c); });
  const styleStart = src.indexOf("<style"), styleEnd = src.lastIndexOf("</style>");
  const css = (styleStart >= 0 ? src.slice(styleStart, styleEnd) : "") + theme;
  const missing = [...used].filter((c) => !HOOKS.has(c) && !new RegExp("\\." + c + "(?![\\w-])").test(css));
  checked += used.size;
  if (missing.length) {
    bad += missing.length;
    console.log("  FAIL  " + f + " renders " + missing.length + " unstyled class" +
      (missing.length > 1 ? "es" : "") + ": " + missing.sort().join(", "));
  }
}

console.log("-".repeat(74));
if (bad) {
  console.log(bad + " unstyled class(es) across " + pages.length + " public pages.");
  console.log("Either add the rule (usually by copying it from the page the renderer came");
  console.log("from) or, if the class is only a querySelectorAll hook, add it to HOOKS.");
  process.exit(1);
}
console.log("All " + checked + " class uses across " + pages.length + " public pages are styled.");
