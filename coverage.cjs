#!/usr/bin/env node
const fs = require("fs");
const lines = fs.readFileSync("scan-robots-full.csv", "utf8").trim().split("\n");
const hdr = lines[0].split(",");
const tally = {};
const uniformTally = {};
let rows = 0;
for (let i = 1; i < lines.length; i++) {
  const p = lines[i].split(",");
  if (p.length < hdr.length) continue;
  rows++;
  const vals = p.slice(2);
  tally[vals[0]] = (tally[vals[0]] || 0) + 1;
  const uniq = new Set(vals);
  if (uniq.size === 1) uniformTally[vals[0]] = (uniformTally[vals[0]] || 0) + 1;
}
const show = function (label, obj) {
  console.log("\n" + label);
  Object.entries(obj).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 15)
    .forEach(function (e) { console.log("  " + String(e[0]).padEnd(24) + String(e[1]).padStart(7) + "   " + (100 * e[1] / rows).toFixed(1) + "%"); });
};
console.log("Data rows: " + rows + "   bot columns: " + (hdr.length - 2));
show("Distinct values in first bot column [" + hdr[2] + "]:", tally);
show("Rows where ALL bot columns share one value:", uniformTally);
