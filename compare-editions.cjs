#!/usr/bin/env node
/**
 * CPI — compare the Pi's shadow edition against the Mac's live edition
 * ===========================================================================
 * THE POINT THAT MATTERS MOST: the two will NOT match exactly, and expecting
 * them to would make this test useless.
 *
 * Two machines scanning 50,000 domains at different times, even from the same
 * connection, see a different web. We measured exactly this today: the same
 * deterministic 1,809-domain sample returned 1,108 then 1,150 readable files
 * three hours apart, and across five production editions the readable base
 * ran 26,987 / 27,067 / 26,953 / 28,048 / 27,975 — a 4.1% range.
 *
 * So "identical" is the wrong pass mark. The right question is whether the
 * Pi's edition falls inside the variation the Mac already shows against
 * itself week to week. A Pi run that differs by 3% is working correctly. A Pi
 * run that differs by 30% has a real fault — a truncated frame, a DNS
 * problem, a rate limit, a partial scan.
 *
 * TOLERANCES, derived from the production series rather than invented:
 *   readable count      within 6%   (the observed range is 4.1%; 6% allows
 *                                    for the two runs being further apart in
 *                                    time than any two consecutive editions)
 *   any-block rate      within 1.5pp
 *   per-crawler rate    within 2pp each
 *   frame size          EXACT — 50,000. A different frame is a broken setup,
 *                       not natural variation, and is a hard fail.
 *
 * PER-DOMAIN AGREEMENT is the strongest signal and is reported separately:
 * of the domains readable on BOTH machines, what share got the same state for
 * the same crawler? That should be very high (>99%); disagreement there means
 * the two machines are parsing differently, which is a code or locale fault,
 * not web variation.
 *
 * RUN, on the Mac, after both editions exist:
 *   node compare-editions.cjs <path-to-pi-scan-robots.csv>
 *
 * Nothing is written and nothing is published. It prints a verdict.
 */
const fs = require("fs");

const PI = process.argv[2];
const MAC = process.argv[3] || "scan-robots.csv";
if (!PI) {
  console.error("usage: node compare-editions.cjs <pi-scan-robots.csv> [mac-scan-robots.csv]");
  console.error("  e.g. scp alex@192.168.178.198:/srv/cpi/crawl-price-index/scan-robots.csv /tmp/pi-scan.csv");
  console.error("       node compare-editions.cjs /tmp/pi-scan.csv");
  process.exit(2);
}
for (const f of [PI, MAC]) if (!fs.existsSync(f)) { console.error("missing: " + f); process.exit(2); }

function load(p) {
  const lines = fs.readFileSync(p, "utf8").split(/\r?\n/).filter(Boolean);
  const head = lines[0].split(",");
  const bots = head.slice(2);
  const rows = new Map();
  let readable = 0;
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",");
    if (c.length < 3) continue;
    const states = c.slice(2);
    rows.set(c[1], states);
    if (states[0] !== "no_robots") readable++;
  }
  return { bots, rows, readable, total: rows.size, path: p };
}

const a = load(MAC), b = load(PI);
const L = console.log;
const fails = [], warns = [];

L("=".repeat(74));
L("EDITION COMPARISON — Mac (live) vs Pi (shadow)");
L("=".repeat(74));
L("  Mac  " + a.path.padEnd(34) + String(a.total).padStart(7) + " domains, " + a.readable + " readable");
L("  Pi   " + b.path.padEnd(34) + String(b.total).padStart(7) + " domains, " + b.readable + " readable");
L("");

/* ---- 1. the frame must be identical — this is not natural variation ----- */
if (a.total !== b.total) fails.push("frame size differs: Mac " + a.total + " vs Pi " + b.total +
  " — the Pi is not scanning the same frame. Check tranco-top-1m.csv and frame-cpi50k-v1.json.");
else L("  frame size            " + a.total + " on both                                 PASS");

if (a.bots.join(",") !== b.bots.join(","))
  fails.push("crawler columns differ — the two machines are tracking different crawlers");
else L("  crawlers tracked      " + a.bots.length + " on both                                     PASS");

/* ---- 2. readable count, against the observed production range ----------- */
const rd = Math.abs(a.readable - b.readable) / a.readable * 100;
const rdLine = "  readable robots.txt   " + a.readable + " vs " + b.readable +
  "   diff " + rd.toFixed(2) + "%   (tolerance 6%)";
if (rd > 6) { fails.push("readable count differs by " + rd.toFixed(2) + "% — beyond anything the production series shows"); L(rdLine + "   FAIL"); }
else if (rd > 4.1) { warns.push("readable diff " + rd.toFixed(2) + "% exceeds the 4.1% production range but is within tolerance"); L(rdLine + "   WARN"); }
else L(rdLine + "   PASS");

/* ---- 3. headline rates -------------------------------------------------- */
const anyBlock = (d) => {
  let n = 0, parsed = 0;
  for (const s of d.rows.values()) {
    if (s[0] === "no_robots") continue;
    parsed++;
    if (s.includes("blocked")) n++;
  }
  return { pct: parsed ? n / parsed * 100 : 0, n, parsed };
};
const aa = anyBlock(a), bb = anyBlock(b);
const dpp = Math.abs(aa.pct - bb.pct);
const abLine = "  any-block rate        " + aa.pct.toFixed(2) + "% vs " + bb.pct.toFixed(2) +
  "%   diff " + dpp.toFixed(2) + "pp   (tolerance 1.5pp)";
if (dpp > 1.5) { fails.push("any-block rate differs by " + dpp.toFixed(2) + "pp"); L(abLine + "  FAIL"); }
else L(abLine + "  PASS");

/* ---- 4. per crawler ------------------------------------------------------ */
L("");
L("  per-crawler blocked %, Mac vs Pi:");
let worst = 0, worstBot = "";
for (let i = 0; i < a.bots.length; i++) {
  const rate = (d) => {
    let n = 0, parsed = 0;
    for (const s of d.rows.values()) { if (s[0] === "no_robots") continue; parsed++; if (s[i] === "blocked") n++; }
    return parsed ? n / parsed * 100 : 0;
  };
  const ra = rate(a), rb = rate(b), d = Math.abs(ra - rb);
  if (d > worst) { worst = d; worstBot = a.bots[i]; }
  const flag = d > 2 ? "  FAIL" : d > 1 ? "  warn" : "";
  if (d > 1) L("    " + a.bots[i].padEnd(22) + ra.toFixed(2) + "%  vs  " + rb.toFixed(2) + "%   " + d.toFixed(2) + "pp" + flag);
  if (d > 2) fails.push("crawler " + a.bots[i] + " differs by " + d.toFixed(2) + "pp");
}
if (worst <= 1) L("    every crawler within 1pp — largest gap " + worst.toFixed(2) + "pp (" + worstBot + ")");

/* ---- 5. per-domain agreement — the strongest signal --------------------- */
let both = 0, agree = 0, cellsSame = 0, cellsTotal = 0;
for (const [dom, sa] of a.rows) {
  const sb = b.rows.get(dom);
  if (!sb) continue;
  if (sa[0] === "no_robots" || sb[0] === "no_robots") continue;
  both++;
  let same = true;
  for (let i = 0; i < sa.length; i++) { cellsTotal++; if (sa[i] === sb[i]) cellsSame++; else same = false; }
  if (same) agree++;
}
const domPct = both ? agree / both * 100 : 0;
const cellPct = cellsTotal ? cellsSame / cellsTotal * 100 : 0;
L("");
L("  PER-DOMAIN AGREEMENT — of domains readable on BOTH machines");
L("    domains compared    " + both);
L("    identical rows      " + agree + "   (" + domPct.toFixed(2) + "%)");
L("    identical cells     " + cellsSame + " of " + cellsTotal + "   (" + cellPct.toFixed(3) + "%)");
if (cellPct < 99) fails.push("cell agreement " + cellPct.toFixed(2) + "% — below 99%. The machines are PARSING differently, which is a code or locale fault, not web variation. Check locale (en_GB.UTF-8) and that both are on the same commit.");
else L("    -> the two machines parse the same file the same way              PASS");

/* ---- verdict ------------------------------------------------------------- */
L("");
L("=".repeat(74));
if (warns.length) { L("WARNINGS"); warns.forEach((w) => L("  · " + w)); L(""); }
if (fails.length) {
  L("VERDICT: DO NOT CUT OVER");
  fails.forEach((f) => L("  ✗ " + f));
  L("");
  L("The Mac remains primary. Investigate before running the Pi live.");
  process.exit(1);
}
L("VERDICT: the Pi reproduces the Mac's edition within the variation the");
L("production series already shows against itself.");
L("");
L("That means the Pi CAN run the pipeline. It does not mean it should yet —");
L("the cutover gate is a local backup drive, bought, mounted and restore-");
L("tested. Until then the Mac is the second copy and must keep running.");
