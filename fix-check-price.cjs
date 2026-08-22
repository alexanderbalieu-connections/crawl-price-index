const fs = require("fs");
const P = "public/check.html";
let s = fs.readFileSync(P, "utf8");
if (s.includes('id="ownprice"')) { console.log("already fixed"); process.exit(0); }

/* 1. give the setup card its own price field — the user's number, not ours */
const anchor = `    </ol>`;
const i = s.indexOf('id="setup"');
if (i < 0) throw new Error("setup card missing");
const olEnd = s.indexOf(anchor, i);
if (olEnd < 0) throw new Error("setup <ol> end missing");
const field = `    </ol>
    <div class="row" style="align-items:center;gap:10px;margin:4px 0 14px">
      <label for="ownprice" style="font-size:13.5px;color:var(--dim);white-space:nowrap">Your price per crawl, in USD</label>
      <input type="number" id="ownprice" value="0.01" min="0" step="0.001" style="max-width:130px;font-family:'Spline Sans Mono',monospace">
      <span style="font-size:12.5px;color:var(--dim)">Your choice &mdash; we do not recommend a figure.</span>
    </div>`;
s = s.slice(0, olEnd) + field + s.slice(olEnd + anchor.length);

/* 2. rewrite recompute(): no revenue maths, no dead element refs */
const rcStart = s.indexOf("  function recompute(){");
const rcEnd = s.indexOf("  function renderArtifacts(", rcStart);
if (rcStart < 0 || rcEnd < 0) throw new Error("recompute boundaries missing");
const newRc = `  // Renders the declaration files at the price the operator chose. CPI does not
  // suggest a price: we measure what sites declare, we do not advise what to charge.
  function recompute(){
    var el = $("ownprice");
    var price = el ? parseFloat(el.value) : 0.01;
    if (!(price >= 0)) price = 0.01;
    renderArtifacts(price);
  }

`;
s = s.slice(0, rcStart) + newRc + s.slice(rcEnd);

/* 3. wire the input */
if (!s.includes('$("ownprice").addEventListener')) {
  s = s.replace("  recompute();", `  if ($("ownprice")) $("ownprice").addEventListener("input", recompute);
  recompute();`);
}

fs.writeFileSync(P, s);
console.log("check.html: own-price field added, recompute() rewritten without revenue maths");
