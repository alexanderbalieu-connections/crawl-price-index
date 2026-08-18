#!/usr/bin/env node
/**
 * fix-orphans.cjs <file> — re-balances panel widths so no half-panel sits alone.
 * Rule: walk the panels in order. A "half" panel needs the NEXT panel to also be
 * half to pair with. If a half panel would be orphaned (next is wide, or it's
 * last with no pair), promote it to wide. Result: clean 2-up pairs + full-width
 * blocks, never a lonely half with empty space beside it.
 */
const fs = require("fs");
const path = process.argv[2];
let s = fs.readFileSync(path, "utf8");
fs.copyFileSync(path, path + ".bak-orphan");

// parse panels in order with their current wide/half state
const re = /<section class="panel( wide)?">/g;
const marks = [];
let m; while ((m = re.exec(s)) !== null) marks.push({ idx: m.index, wide: !!m[1], full: m[0] });

// determine target: pair halves; orphaned half -> wide
const wide = marks.map(p => p.wide);
for (let i = 0; i < marks.length; i++) {
  if (wide[i]) continue;              // already full width
  // is there a half partner immediately after that is also half?
  const next = i + 1 < marks.length ? wide[i + 1] : true;
  if (next === false) { i++; continue; } // this half pairs with next half — good, skip both
  // otherwise this half is orphaned -> promote to wide
  wide[i] = true;
}

// apply: rewrite each section tag to match target width
let out = s, shift = 0;
for (let i = 0; i < marks.length; i++) {
  const want = wide[i] ? '<section class="panel wide">' : '<section class="panel">';
  if (want !== marks[i].full) {
    const at = marks[i].idx + shift;
    out = out.slice(0, at) + want + out.slice(at + marks[i].full.length);
    shift += want.length - marks[i].full.length;
  }
}
fs.writeFileSync(path, out);
const nw = (out.match(/panel wide/g) || []).length, tot = (out.match(/<section class="panel/g) || []).length;
console.log(path.split("/").pop() + ": " + tot + " panels, " + nw + " wide, " + (tot - nw) + " half (paired)");
