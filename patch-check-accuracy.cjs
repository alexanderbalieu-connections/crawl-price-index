#!/usr/bin/env node
// Accuracy pass on the checker: never imply we measured something the user
// typed, never call our judgment a benchmark, and format money consistently.
const fs = require("fs");
const F = "public/check.html";
let s = fs.readFileSync(F, "utf8");
if (s.includes("we do not detect this")) { console.log("already patched"); process.exit(0); }

const swaps = [
  // 1. content type is an INPUT, not a detection — force an explicit choice
  ['        <label for="ctype">Content type</label>',
   '        <label for="ctype">Your content type <span style="text-transform:none;letter-spacing:0">(your call — we do not detect this)</span></label>'],
  ['          <option value="0.7" selected>Technical / niche expertise</option>',
   '          <option value="0.7">Technical / niche expertise</option>'],
  ['        <select id="ctype">\n          <option value="1.0">News / journalism</option>',
   '        <select id="ctype">\n          <option value="" selected>Choose one…</option>\n          <option value="1.0">News / journalism</option>'],

  // 2. our tier bands are judgment, not measurement
  ['<div class="band" id="bandnote">Benchmark for your tier: <em id="bandtxt">—</em> · top observed quote on the open web: <em>$0.50</em> (stackoverflow.com → ClaudeBot)</div>',
   '<div class="band" id="bandnote">Suggested band for your tier: <em id="bandtxt">—</em> — our judgment, anchored to the highest price we actually observe anyone charging: <em>$0.50 / crawl</em> (stackoverflow.com → ClaudeBot, reproduced weekly).</div>'],

  // 3. money formatting: $0.50 not $0.5, consistent decimals in a range
  ['  function fmt(n){ return n>=1000 ? "$"+Math.round(n).toLocaleString() : (n>=10 ? "$"+n.toFixed(0) : "$"+n.toFixed(2)); }',
   '  function fmt(n){ return n>=1000 ? "$"+Math.round(n).toLocaleString() : (n>=100 ? "$"+n.toFixed(0) : "$"+n.toFixed(2)); }'],
  ['    $("prval").textContent = price.toFixed(price < 0.01 ? 4 : (price < 0.1 ? 3 : 2)).replace(/0+$/,"").replace(/\\.$/,"");',
   '    $("prval").textContent = price < 0.01 ? price.toFixed(4) : (price < 0.1 ? price.toFixed(3) : price.toFixed(2));'],

  // 4. estimate only computes once the user has chosen; no silent assumption
  ['    var visits = +($("visits").value), factor = +($("ctype").value);',
   '    var visits = +($("visits").value), factor = parseFloat($("ctype").value);\n    if (!(factor > 0)) {\n      $("now").textContent = "—"; $("future").textContent = "—";\n      $("prval").textContent = (PRICES[+$("pr").value] < 0.1 ? PRICES[+$("pr").value].toFixed(3) : PRICES[+$("pr").value].toFixed(2));\n      renderArtifacts(PRICES[+$("pr").value]);\n      return;\n    }'],

  // 5. say plainly which half is measured and which half is input
  ['<div class="truth" id="truthline">Where these numbers come from:',
   '<div class="truth" id="truthline"><b>What is measured vs. what you chose:</b> your policy fingerprint, percentile and rank are measured by our own crawler this week. The revenue figures are an estimate built from the traffic and content type <em>you</em> selected — we do not measure your traffic. Where the ratios come from:'],
];

let done = 0;
for (const [a, b] of swaps) {
  if (s.includes(a)) { s = s.split(a).join(b); done++; }
  else console.error("  anchor not found: " + a.slice(0, 70).replace(/\n/g, " ") + "…");
}
if (done < swaps.length) { console.error("only " + done + "/" + swaps.length + " applied - aborting, file untouched"); process.exit(1); }

const i = s.lastIndexOf("<script>"), j = s.indexOf("</script>", i);
try { new Function(s.slice(i + 8, j)); } catch (e) { console.error("VALIDATION FAILED: " + e.message); process.exit(1); }
fs.writeFileSync(F, s);
console.log("checker accuracy pass applied (" + done + " edits, script validated)");
