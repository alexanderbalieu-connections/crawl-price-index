#!/usr/bin/env node
/**
 * CPI — one decimal everywhere in the block ladder and the suffix card
 * ==========================================================================
 * The ladder renders "15.2%" next to "5%" and the suffix card "42.1%" next to
 * "4%", because the feed carries plain numbers and the renderers interpolate
 * them raw. tabular-nums cannot align a column whose values have different
 * widths after the point. One decimal, everywhere, on both pages that use
 * these renderers.
 *
 * Formatting only — no value changes, so check-copy has nothing to re-verify.
 */
const fs = require("fs");
const T = [["public/index.html", "ladder"], ["public/explore.html", "ladder"], ["public/explore.html", "suffix"]];
const EDITS = {
  ladder: [[`class="pc">'+r.rate+'%</span>`, `class="pc">'+Number(r.rate).toFixed(1)+'%</span>`]],
  suffix: [
    [`'<span class="sfxv">' + hi.any_ai_block_pct + '%</span>'`, `'<span class="sfxv">' + Number(hi.any_ai_block_pct).toFixed(1) + '%</span>'`],
    [`'<span class="sfxv">' + lo.any_ai_block_pct + '%</span>'`, `'<span class="sfxv">' + Number(lo.any_ai_block_pct).toFixed(1) + '%</span>'`],
  ],
};
let n = 0;
for (const [f, kind] of T) {
  let s = fs.readFileSync(f, "utf8");
  for (const [from, to] of EDITS[kind]) {
    if (s.includes(to)) continue;               // idempotent
    const c = s.split(from).length - 1;
    if (c !== 1) throw new Error(f + " / " + kind + ": expected 1 match, found " + c);
    s = s.split(from).join(to); n++;
  }
  fs.writeFileSync(f, s);
}
// nothing may still interpolate a bare rate into a percent sign
for (const [f] of T) {
  const s = fs.readFileSync(f, "utf8");
  if (/\+r\.rate\+'%/.test(s)) throw new Error("a raw rate survives in " + f);
  if (/\+ (hi|lo)\.any_ai_block_pct \+ '%/.test(s)) throw new Error("a raw suffix pct survives in " + f);
}
console.log("one decimal applied in " + n + " place(s)");
