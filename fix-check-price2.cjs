#!/usr/bin/env node
/**
 * CPI — /check step 3: the price control  (node fix-check-price2.cjs)
 * ===========================================================================
 * Feedback: changing the price does not update the copy/paste snippet; the
 * input is misaligned; the spinner is not wanted; there should be an Update
 * button that confirms with a green tick.
 *
 * The reported symptom had TWO causes, and only one of them is cosmetic:
 *
 *  a) The live site is running a build from before the listener was moved to
 *     page init, so on production the field only starts working after a
 *     lookup. Fixed at source already; it ships on the next deploy.
 *  b) But even with the listener working, THE PRICE WAS NEVER IN THE
 *     robots.txt SNIPPET — and that is the box sitting directly under the
 *     field. It only ever appeared in rsl.xml, further down the page. So the
 *     field genuinely looked dead no matter what. robots.txt has no standard
 *     way to state a price, so we write it as a comment (ignored by every
 *     parser) pointing at the licence file that carries it properly. Now the
 *     box under the field visibly changes.
 *
 * Plus what was asked for: no spinner, aligned control, an Update button, and
 * a green "Updated" confirmation that fades. Enter in the field does the same.
 */
const fs = require("fs");
const P = "public/check.html";
let s = fs.readFileSync(P, "utf8");
if (s.includes("priceapply")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(P, P + ".bak-price2");

const sub = (from, to, label) => {
  if (!s.includes(from)) throw new Error("not found: " + label);
  s = s.split(from).join(to);
};

/* ---- the control ------------------------------------------------------- */
sub(
  '    <div class="row" style="align-items:center;gap:10px;margin:4px 0 14px">\n' +
  '      <label for="ownprice" style="font-size:13.5px;color:var(--dim);white-space:nowrap">Your price per crawl, in USD</label>\n' +
  '      <input type="number" id="ownprice" value="0.01" min="0" step="0.001" style="max-width:130px;font-family:\'Spline Sans Mono\',monospace">\n' +
  '      <span style="font-size:12.5px;color:var(--dim)">Your choice &mdash; we do not recommend a figure.</span>\n' +
  '    </div>',
  '    <div class="pricebar">\n' +
  '      <label for="ownprice">Your price per crawl</label>\n' +
  '      <span class="priceinp"><span class="cur">$</span><input type="number" id="ownprice" value="0.01" min="0" step="0.001" inputmode="decimal" aria-describedby="pricenote"></span>\n' +
  '      <button type="button" class="btn" id="priceapply">Update</button>\n' +
  '      <span class="priceok" id="priceok" hidden>&#10003; Updated</span>\n' +
  '      <span class="pricenote" id="pricenote">Your choice &mdash; we do not recommend a figure. It is written into <b>rsl.xml</b>, and noted as a comment in robots.txt.</span>\n' +
  '    </div>',
  "price control markup"
);

/* ---- the robots.txt snippet now carries the figure, as a comment -------- */
sub(
  '    $("robotsout").textContent =\n' +
  '"# AI training & data crawlers — blocked unless licensed (see License link)\\n" +',
  '    $("robotsout").textContent =\n' +
  '"# Per-crawl price: USD " + price.toFixed(2) + " — full terms in the licence file below.\\n" +\n' +
  '"# A comment: robots.txt has no standard field for a price. Parsers ignore this line.\\n\\n" +\n' +
  '"# AI training & data crawlers — blocked unless licensed (see License link)\\n" +',
  "robots price comment"
);

/* ---- Update button drives it; the tick confirms ------------------------- */
sub(
  '  // price field drives the declaration files; attached once at load\n' +
  '  if ($("ownprice")) {\n' +
  '    $("ownprice").addEventListener("input", recompute);\n' +
  '    $("ownprice").addEventListener("change", recompute);\n' +
  '  }\n' +
  '  recompute();',
  '  // The price is applied on demand rather than on every keystroke, so the\n' +
  '  // green tick means something. Attached once at load — an earlier build had\n' +
  '  // this inside the lookup handler, where it only bound after a search.\n' +
  '  var okTimer = null;\n' +
  '  function applyPrice(){\n' +
  '    recompute();\n' +
  '    var ok = $("priceok");\n' +
  '    if (!ok) return;\n' +
  '    ok.hidden = false; ok.classList.remove("fade");\n' +
  '    clearTimeout(okTimer);\n' +
  '    okTimer = setTimeout(function(){ ok.classList.add("fade"); }, 1600);\n' +
  '  }\n' +
  '  if ($("priceapply")) $("priceapply").addEventListener("click", applyPrice);\n' +
  '  if ($("ownprice")) {\n' +
  '    $("ownprice").addEventListener("keydown", function(e){\n' +
  '      if (e.key === "Enter") { e.preventDefault(); applyPrice(); }\n' +
  '    });\n' +
  '    // typing hides a stale confirmation so the tick never lies about the\n' +
  '    // snippet below matching the number in the box\n' +
  '    $("ownprice").addEventListener("input", function(){\n' +
  '      var ok = $("priceok"); if (ok) ok.hidden = true;\n' +
  '    });\n' +
  '  }\n' +
  '  recompute();',
  "apply wiring"
);

/* ---- styles ------------------------------------------------------------ */
sub("</style>",
  "\n  /* step 3 price control — label, field and button share a baseline */\n" +
  "  .pricebar{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:6px 0 16px}\n" +
  "  .pricebar label{font-size:13.5px;color:var(--dim);white-space:nowrap}\n" +
  "  .priceinp{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:3px;background:#fff;height:38px;padding:0 10px}\n" +
  "  .priceinp:focus-within{border-color:var(--signal);box-shadow:0 0 0 3px rgba(28,93,74,.12)}\n" +
  "  .priceinp .cur{font-family:'Spline Sans Mono',ui-monospace,monospace;font-size:14px;color:var(--dim);margin-right:3px}\n" +
  "  .priceinp input{width:82px;border:0;outline:none;background:transparent;font-family:'Spline Sans Mono',ui-monospace,monospace;font-size:14px;color:var(--fg);padding:0}\n" +
  "  /* the stepper arrows were not wanted, and a per-crawl price is not a\n" +
  "     quantity you nudge one step at a time */\n" +
  "  .priceinp input::-webkit-outer-spin-button,.priceinp input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}\n" +
  "  .priceinp input[type=number]{-moz-appearance:textfield;appearance:textfield}\n" +
  "  .pricebar .btn{height:38px;padding:0 16px;display:inline-flex;align-items:center}\n" +
  "  .priceok{font-size:13px;color:var(--signal);font-weight:600;white-space:nowrap;opacity:1;transition:opacity .5s}\n" +
  "  .priceok.fade{opacity:0}\n" +
  "  .pricenote{font-size:12.5px;color:var(--dim);flex:1 1 260px;min-width:0;line-height:1.4}\n" +
  "</style>",
  "price styles"
);

fs.writeFileSync(P, s);

const out = fs.readFileSync(P, "utf8");
for (const m of ["priceapply", "Per-crawl price: USD", ".priceok.fade", "applyPrice"])
  if (!out.includes(m)) throw new Error("missing after patch: " + m);
if (out.includes('$("ownprice").addEventListener("change", recompute)'))
  throw new Error("old change listener survived");

console.log("/check step 3 price control");
console.log("  ROOT CAUSE the price was never in the robots.txt snippet — the box right");
console.log("             under the field. It is now written there as a parser-ignored comment.");
console.log("  Update button + green tick; Enter does the same; typing clears a stale tick");
console.log("  spinner arrows removed; label, field and button share one 38px baseline");
