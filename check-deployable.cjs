#!/usr/bin/env node
/**
 * CPI guard — public/ is the deployed directory. Nothing but assets belongs.
 * ===========================================================================
 * Written after 101 patch-script backups were found being served from the
 * live site, including pre-correction copies of pages that had been publicly
 * corrected. Wrangler ships whatever is in public/; a stray file there is a
 * published file.
 *
 * Backups belong in .page-backups/ at the repo root. Patch scripts that touch
 * a file under public/ must write their .bak there, not beside the original.
 */
const fs = require("fs");
const path = require("path");

const OK_EXT = new Set([".html",".json",".txt",".xml",".css",".js",".png",".jpg",".jpeg",".svg",".webp",".ico",".gif",".woff",".woff2",".pdf",".map"]);
const PUB = "public";

function scan(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...scan(p));
    else if (!OK_EXT.has(path.extname(e.name).toLowerCase())) out.push(p);
  }
  return out;
}

const strays = scan(PUB);
const total = (function count(d) {
  let n = 0;
  for (const e of fs.readdirSync(d, { withFileTypes: true }))
    n += e.isDirectory() ? count(path.join(d, e.name)) : 1;
  return n;
})(PUB);

console.log("-".repeat(74));
if (strays.length) {
  console.log("  FAIL  " + strays.length + " non-deployable file(s) in " + PUB + "/ — these WILL be published:");
  strays.slice(0, 25).forEach((p) => console.log("        " + p));
  if (strays.length > 25) console.log("        …and " + (strays.length - 25) + " more");
  console.log("");
  console.log("Move them out of the deployed directory:  node clean-public.cjs");
  process.exit(1);
}
console.log("All " + total + " files in " + PUB + "/ are deployable assets.");
