#!/usr/bin/env node
// The homepage used its own token vocabulary (--ink = TEXT) while every other
// page used the opposite (--ink = BACKGROUND). One stylesheet cannot serve
// both, which is why the two halves of the site drifted apart.
// This renames the homepage's variable references onto the shared vocabulary
// so theme.css governs the whole site. Idempotent; validates; rolls back.
const fs = require("fs");
const P = "public/index.html";
let s = fs.readFileSync(P, "utf8");

if (s.indexOf("/* tokens-unified */") !== -1) { console.log("already unified — no change"); process.exit(0); }

// two-pass rename so swaps do not collide
const PASS1 = [
  ["--ink",    "--Xfg"],     // was text  -> becomes --fg
  ["--paper",  "--Xink"],    // was bg    -> becomes --ink
  ["--rule",   "--Xline"],
  ["--muted",  "--Xdim"],
  ["--ledger", "--Xsignal"],
  ["--brass",  "--Xamber"]
];
const PASS2 = [
  ["--Xfg", "--fg"], ["--Xink", "--ink"], ["--Xline", "--line"],
  ["--Xdim", "--dim"], ["--Xsignal", "--signal"], ["--Xamber", "--amber"]
];

const before = s;
for (const [a, b] of PASS1) s = s.split(a).join(b);
for (const [a, b] of PASS2) s = s.split(a).join(b);

// mark the Terminal tier as the recommended one
s = s.replace('<div class="tier">\n        <p class="eyebrow">Terminal</p>',
              '<div class="tier featured">\n        <p class="eyebrow">Terminal</p>');

s = s.replace("<style>", "<style>\n/* tokens-unified */");

if (s === before) { console.log("nothing matched — check the file"); process.exit(1); }

fs.copyFileSync(P, P + ".bak-tokens");
fs.writeFileSync(P, s);

// the payload marker and the populate script must survive
const okMarker = s.indexOf('<script id="data" type="application/json">') !== -1;
const m = s.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
let okJs = true;
if (m) {
  fs.writeFileSync("/tmp/_home.js", m[1]);
  try { require("child_process").execSync("node --check /tmp/_home.js", { stdio: "pipe" }); }
  catch (e) { okJs = false; }
}
if (!okMarker || !okJs) {
  fs.copyFileSync(P + ".bak-tokens", P);
  console.error("VALIDATION FAILED (marker:" + okMarker + " js:" + okJs + ") — rolled back");
  process.exit(1);
}
console.log("homepage tokens unified; payload marker intact (backup: index.html.bak-tokens)");
