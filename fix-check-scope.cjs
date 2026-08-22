#!/usr/bin/env node
/**
 * CPI — /check: the price wiring was outside its own closure
 * ===========================================================================
 * THIS IS THE REAL ROOT CAUSE, and it was mine.
 *
 * check.html's main script is one IIFE that defines `$`, `recompute` and
 * `renderArtifacts` privately, and closes with `})();` well before the end of
 * the file. An earlier fix moved the price listeners "to page init" — but page
 * init here is AFTER that closing line, at global scope, where `$` does not
 * exist. Every statement in that block threw ReferenceError: $ is not defined
 * on the first call, so the listeners were never attached at all.
 *
 * Driving the page in a browser is what surfaced it: typing a new price and
 * clicking Update left the snippet unchanged and printed that error. Reading
 * the source had shown a listener sitting there looking perfectly correct.
 *
 * Fix: the price block moves inside the closure, immediately before it ends.
 * A regression guard below asserts the block sits before the `})();` line, so
 * this cannot silently come back.
 */
const fs = require("fs");
const P = "public/check.html";
let s = fs.readFileSync(P, "utf8");
fs.copyFileSync(P, P + ".bak-scope");

const MARK = "  // The price is applied on demand rather than on every keystroke";
const start = s.indexOf(MARK);
if (start < 0) throw new Error("price block not found");
const end = s.indexOf("  recompute();\n</script>", start);
if (end < 0) throw new Error("price block tail not found");
const block = s.slice(start, end + "  recompute();\n".length);

/* lift it out of global scope */
s = s.slice(0, start) + s.slice(end + "  recompute();\n".length);

/* and drop it back in just before the closure ends */
const CLOSE = "  renderArtifacts(PRICES[6]);\n  recompute();\n})();";
if (!s.includes(CLOSE)) throw new Error("closure tail not found");
s = s.replace(CLOSE, "  renderArtifacts(PRICES[6]);\n\n" + block + "})();");

fs.writeFileSync(P, s);

/* ---- regression guard: the block must sit INSIDE the closure ------------ */
const out = fs.readFileSync(P, "utf8");
const iPrice = out.indexOf(MARK);
const iClose = out.indexOf("\n})();");
if (iPrice < 0) throw new Error("price block lost");
if (iPrice > iClose) throw new Error("price block is still outside the closure — $ would be undefined");
if (out.indexOf("applyPrice") > iClose) throw new Error("applyPrice sits outside the closure");

/* the script must still parse */
const a = out.indexOf("</script><script>") + "</script><script>".length;
const b = out.indexOf("\n</script>", a);
fs.writeFileSync("/tmp/chk2.js", out.slice(a, b));
require("child_process").execSync("node --check /tmp/chk2.js");

console.log("/check price wiring moved inside the closure");
console.log("  it was at global scope, where $ is undefined — every listener threw");
console.log("  and therefore never attached. Guarded: the block must precede })();");
