#!/usr/bin/env node
// ONE navigation, ONE measure, on EVERY page including the homepage.
// - identical masthead markup everywhere (so spacing cannot drift)
// - strips the homepage's competing masthead CSS
// - marks reading pages body.prose for a single column measure
// Idempotent. Backs up once per file.
const fs = require("fs");
const path = require("path");

const DIR = "public";
const SKIP = new Set(["index-v2.html", "index-v1-backup.html"]);
const LINK = '<link rel="stylesheet" href="/theme.css">';

const CURRENT = {
  "check.html": "/check", "world.html": "/world",
  "why.html": "/why", "methodology.html": "/methodology", "status.html": "/methodology",
  "changelog.html": "/methodology", "sample.html": "/sample"
};
// pages that are mostly text get one narrow measure
const PROSE = new Set(["methodology.html","status.html","changelog.html","privacy.html",
  "terms.html","security.html","sample.html","recover.html","success.html","cancel.html"]);

function bar(cur) {
  const item = (href, label) =>
    '    <a class="lnk" href="' + href + '"' + (cur === href ? ' aria-current="page"' : "") + ">" + label + "</a>";
  return [
    '<div class="masthead"><div class="wrap">',
    '  <a class="mark" href="/">The Crawl Price Index<b>.</b></a>',
    '  <nav>',
    item("/check", "Check a domain"),
    item("/why", "Why it matters"),
    item("/world", "World editions"),
    item("/methodology", "Methodology"),
    '    <a class="ghost" href="/sample">Weekly email</a>',
    '    <a class="btn" href="/#access">Subscribe</a>',
    '  </nav>',
    '</div></div>'
  ].join("\n");
}

const files = fs.readdirSync(DIR).filter(f => f.endsWith(".html") && !SKIP.has(f)).sort();
let changed = 0;

for (const f of files) {
  const p = path.join(DIR, f);
  let s = fs.readFileSync(p, "utf8");
  const before = s;
  const did = [];

  if (s.indexOf('href="/theme.css"') === -1) {
    const i = s.lastIndexOf("</style>");
    if (i !== -1) { s = s.slice(0, i + 8) + "\n" + LINK + s.slice(i + 8); did.push("theme"); }
  }

  // the homepage shipped its own masthead markup AND its own masthead CSS.
  // Both are removed so every page renders from the same source.
  if (f === "index.html") {
    s = s.replace(/<header class="masthead">[\s\S]*?<\/header>/, bar(null));
    s = s.replace(/\.masthead\{[^}]*\}/g, "").replace(/\.masthead \.wrap\{[^}]*\}/g, "")
         .replace(/\.nav\{[^}]*\}/g, "").replace(/\.nav a\.lnk\{[^}]*\}/g, "")
         .replace(/\.nav a\.lnk:hover\{[^}]*\}/g, "");
    if (s !== before) did.push("masthead normalised");
  } else if (s.indexOf('class="masthead"') === -1) {
    s = s.replace("<body>", "<body>\n" + bar(CURRENT[f] || null));
    did.push("nav");
  } else {
    s = s.replace(/<div class="masthead"><div class="wrap">[\s\S]*?<\/div><\/div>/, bar(CURRENT[f] || null));
    did.push("nav refreshed");
  }

  if (PROSE.has(f) && !/<body[^>]*class="[^"]*prose/.test(s)) {
    s = s.replace(/<body([^>]*)>/, function (m, attrs) {
      return /class="/.test(attrs)
        ? "<body" + attrs.replace(/class="([^"]*)"/, 'class="$1 prose"') + ">"
        : "<body" + attrs + ' class="prose">';
    });
    did.push("prose measure");
  }

  if (s === before) { console.log("  " + f.padEnd(24) + "already consistent"); continue; }
  if (!fs.existsSync(p + ".bak-nav")) fs.copyFileSync(p, p + ".bak-nav");
  fs.writeFileSync(p, s);
  console.log("  " + f.padEnd(24) + did.join(", "));
  changed++;
}
console.log("\n" + changed + " of " + files.length + " pages updated.");
console.log('Undo:  for f in public/*.html.bak-nav; do mv "$f" "${f%.bak-nav}"; done');
