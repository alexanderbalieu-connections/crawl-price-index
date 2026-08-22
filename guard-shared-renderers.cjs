#!/usr/bin/env node
/**
 * CPI — the shared renderer block must tolerate a missing panel
 * ===========================================================================
 * Moving six panels from the homepage to /explore left the homepage running
 * their renderers against elements that are no longer there:
 *
 *   TypeError: Cannot set properties of null (setting 'innerHTML')
 *
 * The block writes to #rates, #posture, #board and #trend with no null check,
 * so the first missing one threw and every renderer after it never ran. On the
 * homepage that killed the trend chart and the ticker; the damage was silent
 * because the panels themselves had gone.
 *
 * The block now lives on BOTH pages, so hard-coding which ids exist where is
 * exactly the wrong fix — it would break again the next time a panel moves.
 * Each renderer simply bails when its target is absent. Same code, either
 * page, no assumptions about which panels are present.
 */
const fs = require("fs");
const FILES = ["public/index.html", "public/explore.html"];

const GUARDS = [
  // [what to find, what to replace it with, label]
  [`(function(){
  var rows = D.block_rows||[]; if(!rows.length) return;`,
   `(function(){
  var rows = D.block_rows||[]; if(!rows.length || !$('#rates')) return;`,
   "block-rate ladder"],

  [`(function(){
  var p = D.posture||[];
  $('#posture').innerHTML`,
   `(function(){
  var p = D.posture||[];
  if (!$('#posture') || !$('#board')) return;
  $('#posture').innerHTML`,
   "posture + ticker"],

  [`(function(){
  var hist = D.history;
  var svg = document.getElementById('trend');`,
   `(function(){
  var hist = D.history;
  var svg = document.getElementById('trend');
  if (!svg) return;`,
   "trend chart"],
];

let touched = 0;
for (const f of FILES) {
  let s = fs.readFileSync(f, "utf8");
  if (!s.includes("var rows = D.block_rows")) { console.log("  (no shared block: " + f + ")"); continue; }
  if (s.includes("!$('#rates')")) { console.log("  (already guarded: " + f + ")"); continue; }
  fs.copyFileSync(f, f + ".bak-renderguard");
  for (const [from, to, label] of GUARDS) {
    if (!s.includes(from)) throw new Error(f + ": not found — " + label);
    s = s.split(from).join(to);
  }
  fs.writeFileSync(f, s);
  touched++;
  console.log("  guarded: " + f);
}

/* every renderer target must now be guarded in both files */
for (const f of FILES) {
  const s = fs.readFileSync(f, "utf8");
  if (!s.includes("var rows = D.block_rows")) continue;
  for (const need of ["!$('#rates')", "!$('#posture')", "!$('#board')", "if (!svg) return;"])
    if (!s.includes(need)) throw new Error(f + ": missing guard " + need);
}

console.log("\nshared renderers bail when their panel is absent (" + touched + " file(s))");
console.log("  the homepage was throwing on #rates after those panels moved to /explore,");
console.log("  which silently killed every renderer after it");
