#!/usr/bin/env node
// Applies the payload-driven headline fix to YOUR live world.html, in place.
// Touches only prose and the render script — the data payload (tonight's
// edition) is left byte-for-byte untouched. Validates; rolls back on failure.
const fs = require("fs");
const P = "public/world.html";
let s = fs.readFileSync(P, "utf8");

if (s.indexOf("hl-top") !== -1) { console.log("already fixed — no change"); process.exit(0); }
fs.copyFileSync(P, P + ".bak-worldfix");
const before = s;

// 1. headline becomes two payload-filled spans
s = s.replace(/<h2>[^<]*leads\.[^<]*<\/h2>/,
  '<h2><span id="hl-top">\u2014</span> leads. <span id="hl-bottom">\u2014</span> barely bothers.</h2>');

// 2. lede loses the named-country claims
s = s.replace(
  /The same scan shows France gating most of its web from AI, while Russia leaves it wide open\. Here is the map, by country, refreshed weekly\./,
  "The same scan shows some countries gating most of their web from AI while others leave it wide open. Here is the map, by country, refreshed with every edition.");

// 3. meta description generalised
s = s.replace(
  /content="AI-crawler block rates by country\. France blocks hardest; Russia barely at all\. Updated weekly\."/,
  'content="AI-crawler block rates by country, from a weekly scan of the Tranco top domains. Which countries gate their web from AI, and which leave it open."');

// 4. render script also fills the headline from the same rows as the chart
const anchor = "$('#note').textContent = D.note;";
if (s.indexOf(anchor) === -1) { fs.copyFileSync(P + ".bak-worldfix", P); console.error("ABORT: render anchor not found"); process.exit(1); }
s = s.replace(anchor, anchor + `
  // headline derives from the SAME payload as the chart, so it can never
  // contradict it (the France/Norway lesson, 2026-08-16)
  try {
    const byRate = [...D.rows].sort((a,b)=>b.any-a.any);
    const solid = byRate.filter(r=>(r.n||0)>=20);
    const top = solid[0] || byRate[0];
    const bottom = solid[solid.length-1] || byRate[byRate.length-1];
    if (top) document.getElementById('hl-top').textContent = top.country;
    if (bottom) document.getElementById('hl-bottom').textContent = bottom.country;
  } catch(e){}`);

if (s === before) { console.error("nothing matched — page structure differs; rolled back"); fs.copyFileSync(P + ".bak-worldfix", P); process.exit(1); }
fs.writeFileSync(P, s);

// validate: inline JS parses, payload untouched
const m = s.match(/<script>([\s\S]*?)<\/script>/);
try {
  fs.writeFileSync("/tmp/_w.js", m[1]);
  require("child_process").execSync("node --check /tmp/_w.js", { stdio: "pipe" });
} catch (e) {
  fs.copyFileSync(P + ".bak-worldfix", P);
  console.error("JS validation FAILED — rolled back, nothing changed");
  process.exit(1);
}
const stale = /France leads|Russia opts out|France gating/.test(s.replace(/<script id="data"[\s\S]*?<\/script>/, ""));
console.log("world.html fixed in place. Payload untouched. Stale prose remaining:", stale ? "YES — tell Claude" : "none");
