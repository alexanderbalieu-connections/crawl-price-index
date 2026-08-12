#!/usr/bin/env node
// RETHEME — put every page on the v2 look.
//
// Two changes per page, both additive:
//   1. swap the Google Fonts URL so Archivo replaces Spline Sans Mono
//   2. link /theme.css immediately after the page's own </style>, so it
//      overrides at equal specificity without touching any markup or script
//
// index.html is skipped: it is already v2.
//
//   node retheme.cjs --dry    report only, write nothing
//   node retheme.cjs          apply, keeping a .pretheme backup per file
const fs = require("fs");
const path = require("path");

const DRY = process.argv.includes("--dry");
const DIR = "public";
const SKIP = new Set(["index.html", "index-v2.html", "index-v1-backup.html"]);
const LINK = '<link rel="stylesheet" href="/theme.css">';

const OLD_FONTS = "family=Newsreader:opsz,wght@6..72,400;6..72,500&family=Spline+Sans+Mono:wght@400;500;600;700";
const NEW_FONTS = "family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;1,6..72,300&family=Archivo:wght@400;500;600";

if (!fs.existsSync(path.join(DIR, "theme.css"))) {
  console.error("ABORT: " + DIR + "/theme.css is missing. Copy it in first.");
  process.exit(1);
}

const files = fs.readdirSync(DIR).filter(f => f.endsWith(".html") && !SKIP.has(f)).sort();
let touched = 0;

for (const f of files) {
  const p = path.join(DIR, f);
  let s = fs.readFileSync(p, "utf8");
  const before = s;
  const did = [];

  if (s.indexOf(OLD_FONTS) !== -1) { s = s.split(OLD_FONTS).join(NEW_FONTS); did.push("fonts"); }

  if (s.indexOf(LINK) === -1) {
    const i = s.lastIndexOf("</style>");
    if (i === -1) { console.log("  " + f.padEnd(22) + "SKIPPED - no </style> found"); continue; }
    s = s.slice(0, i + 8) + "\n" + LINK + s.slice(i + 8);
    did.push("theme link");
  } else did.push("already linked");

  if (s === before) { console.log("  " + f.padEnd(22) + "no change"); continue; }

  console.log("  " + f.padEnd(22) + did.join(", "));
  touched++;
  if (!DRY) {
    if (!fs.existsSync(p + ".pretheme")) fs.copyFileSync(p, p + ".pretheme");
    fs.writeFileSync(p, s);
  }
}

console.log("");
console.log(DRY ? "DRY RUN - nothing written. Run without --dry to apply." : "Written. Backups: public/*.html.pretheme");
console.log(touched + " of " + files.length + " files changed.");
if (!DRY) console.log('Undo:  for f in public/*.html.pretheme; do mv "$f" "${f%.pretheme}"; done');
