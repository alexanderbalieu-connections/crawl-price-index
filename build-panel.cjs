#!/usr/bin/env node
/**
 * BUILD-PANEL — assembles the weekly identity-matrix panel from three sources,
 * so the list is an OUTPUT of measurement, not a hand-picked guess.
 *
 *   1. SPINE (panel-spine.txt) — fixed 49, kept for series continuity.
 *   2. SIGNAL — every domain the wide honest probe flagged (402 / tollbit /
 *      payment header / noai) in wide-probe.json, auto-promoted.
 *   3. AUDIT — a rotating random draw from the full harvest, so AI-only walls
 *      invisible to the honest probe still get sampled (and measured).
 *
 * Demotion: a signal domain unseen for DEMOTE_WEEKS drops out (tracked in
 * panel-state.json). Spine domains never demote.
 *
 * Writes: .panel.txt (consumed by scan.cjs) and public/panel.json (disclosure).
 */
const fs = require("fs");

const AUDIT_N = Number(process.env.AUDIT_N || 15);
const DEMOTE_WEEKS = 8;
const SPINE_FILE = "panel-spine.txt";
const STATE_FILE = "panel-state.json";

const readLines = f => { try { return fs.readFileSync(f, "utf8").split(/\r?\n/).map(s => s.trim()).filter(Boolean); } catch (e) { return []; } };
const today = new Date().toISOString().slice(0, 10);

const spine = readLines(SPINE_FILE);
if (!spine.length) { console.error("ABORT: panel-spine.txt missing/empty"); process.exit(1); }

// ---- state: {domain: {firstSeen, lastSignal}} for signal-promoted domains ---
let state = {};
try { state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch (e) {}

// ---- 2. signal domains from the latest wide probe ---------------------------
let signalNow = [];
try {
  const wp = JSON.parse(fs.readFileSync("wide-probe.json", "utf8"));
  for (const r of (wp.results || [])) {
    if (r.p402 || r.tollbit || r.sig || r.noai) signalNow.push(r.domain);
  }
} catch (e) { console.log("(no wide-probe.json yet — signal tier empty this run)"); }
signalNow = [...new Set(signalNow)];
for (const d of signalNow) {
  state[d] = state[d] || { firstSeen: today };
  state[d].lastSignal = today;
}
// demote the long-silent
const weeksBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / (7 * 86400000));
for (const d of Object.keys(state)) {
  if (weeksBetween(state[d].lastSignal, today) >= DEMOTE_WEEKS) delete state[d];
}
const signalTier = Object.keys(state);

// ---- 3. rotating audit sample from the harvest ------------------------------
let audit = [];
try {
  const rows = fs.readFileSync("scan-robots-full.csv", "utf8").split("\n").slice(1);
  const doms = rows.map(l => l.split(",")[1]).filter(Boolean);
  // seed the shuffle on the week number so a given week is reproducible
  const seed = Math.floor(Date.parse(today) / (7 * 86400000));
  let x = seed;
  const rand = () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; };
  const pool = [...doms];
  for (let i = 0; i < AUDIT_N && pool.length; i++) {
    audit.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
} catch (e) { console.log("(no harvest yet — audit tier empty this run)"); }

// ---- assemble, dedupe, tagging preserved for panel.json ---------------------
const seen = new Set();
const tagged = [];
const add = (list, tier) => { for (const d of list) { if (d && !seen.has(d)) { seen.add(d); tagged.push({ domain: d, tier }); } } };
add(spine, "spine");
add(signalTier, "signal");
add(audit, "audit");

fs.writeFileSync(".panel.txt", tagged.map(t => t.domain).join("\n") + "\n");
fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 1));
fs.mkdirSync("public", { recursive: true });
fs.writeFileSync("public/panel.json", JSON.stringify({
  generated: today,
  size: tagged.length,
  selection: "Identity-matrix panel. Spine = fixed continuity set. Signal = domains the honest wide probe flagged as showing payment/blocking behaviour (auto-promoted, demoted after " + DEMOTE_WEEKS + " silent weeks). Audit = rotating random sample from the full scan, so AI-only walls invisible to honest probing are still sampled and their prevalence measured. The identity matrix uses impersonated user agents and is deliberately capped; the honest wide probe covers thousands of domains and never impersonates.",
  tiers: { spine: spine.length, signal: signalTier.length, audit: audit.length },
  domains: tagged
}, null, 1));

console.log("panel assembled: " + tagged.length + " domains");
console.log("  spine  " + spine.length + "  (continuity)");
console.log("  signal " + signalTier.length + "  (promoted from wide probe)");
console.log("  audit  " + audit.length + "  (rotating random)");
console.log("wrote .panel.txt and public/panel.json");
