const fs = require("fs");

// ---- Patch A: run-big.cjs — preserve full rows before panel clobber ----
let rb = fs.readFileSync("run-big.cjs", "utf8");
const A = "console.log(`\\nRobots harvest complete: ${fetched}/${domains.length} parsed.`);";
if (!rb.includes(A)) { console.error("run-big anchor not found — aborting, nothing touched"); process.exit(1); }
if (rb.includes("scan-robots-full.csv")) { console.log("run-big already patched — skipping"); }
else {
  fs.writeFileSync("run-big.cjs.bak", rb);
  rb = rb.replace(A, A + `
  // preserve the full harvest before the panel step — scan.cjs writes its own
  // scan-robots.csv (panel only) and would otherwise clobber the 50k rows.
  fs.copyFileSync(OUT, "scan-robots-full.csv");
  console.log("Full per-domain rows preserved: scan-robots-full.csv");`);
  fs.writeFileSync("run-big.cjs", rb);
  console.log("run-big.cjs patched (backup: run-big.cjs.bak)");
}

// ---- Patch B: rebuild.cjs — prefer the full harvest file ----
let rc = fs.readFileSync("rebuild.cjs", "utf8");
const B = 'const robots = readCSV("scan-robots.csv");';
if (!rc.includes(B)) { console.error("rebuild anchor not found — aborting, rebuild untouched"); process.exit(1); }
if (rc.includes("scan-robots-full.csv")) { console.log("rebuild already patched — skipping"); }
else {
  fs.writeFileSync("rebuild.cjs.bak", rc);
  rc = rc.replace(B, `let robots = readCSV("scan-robots.csv");
// prefer the preserved full harvest (all ranks), keep panel-only domains too
if (fs.existsSync("scan-robots-full.csv")) {
  const full = readCSV("scan-robots-full.csv");
  if (full.length > robots.length) {
    const seen = new Set(full.map(r => r.domain));
    const panelOnly = robots.filter(r => !seen.has(r.domain));
    robots = full.concat(panelOnly);
    console.log("Using full harvest rows: " + full.length + " (+" + panelOnly.length + " panel-only)");
  }
}`);
  fs.writeFileSync("rebuild.cjs", rc);
  console.log("rebuild.cjs patched (backup: rebuild.cjs.bak)");
}
