#!/usr/bin/env node
// Removes the leftover dark :root token block and dark favicon from every
// static page. theme.css is the sole source of tokens; these page-local blocks
// only ever partially-overrode it and risk inconsistent rendering. Idempotent.
const fs = require("fs");
const dir = "public";
let n = 0;
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith(".html")) continue;
  const p = dir + "/" + f;
  let s = fs.readFileSync(p, "utf8");
  const before = s;
  // dark :root block (the specific old-theme one)
  s = s.replace(/\s*:root\{--ink:#0b0d0e;[^}]*\}/g, "");
  // dark favicon -> light
  s = s.replace(/fill=%27%230b0d0e%27/g, "fill=%27%23FBFAF8%27").replace(/fill=%27%233cf08a%27/g, "fill=%27%231C5D4A%27");
  if (s !== before) { fs.writeFileSync(p, s); n++; console.log("  cleaned " + f); }
}
console.log(n + " pages cleaned");
// verify nothing dark remains site-wide
let dark = [];
for (const f of fs.readdirSync(dir)) {
  if (f.endsWith(".html") && /#0b0d0e|#3cf08a/.test(fs.readFileSync(dir + "/" + f, "utf8"))) dark.push(f);
}
console.log(dark.length ? "STILL DARK: " + dark.join(", ") : "verified: no dark palette anywhere");
