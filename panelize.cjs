#!/usr/bin/env node
/**
 * panelize.cjs <file> — converts a reading page's <h2> sections into numbered
 * panels on the locked template, preserving all inner content verbatim.
 * Robust boundary detection: operates on the whole document, replacing the
 * <header> and then wrapping the run of <h2>-delimited sections wherever they are.
 */
const fs = require("fs");
const path = process.argv[2];
if (!path) { console.error("usage: node panelize.cjs <file>"); process.exit(1); }
let s = fs.readFileSync(path, "utf8");
if (s.indexOf('class="panels"') !== -1) { console.log(path + ": already panelized"); process.exit(0); }
fs.copyFileSync(path, path + ".bak-panelize");

// 1) header -> page-open
s = s.replace(/<header><div class="wrap">([\s\S]*?)<\/div><\/header>/,
  '<div class="page-open"><div class="wrap">$1</div></div>');

// 2) locate the FIRST <h2> and the LAST </h2>...end-of-its-section. The content
//    region runs from the first <h2> to just before <footer> (or </body> / the
//    closing wrap that immediately precedes footer). Grab generously to EOF-ish.
const firstH2 = s.indexOf('<h2>');
if (firstH2 === -1) { fs.copyFileSync(path + ".bak-panelize", path); console.log("no <h2> sections; only header updated"); process.exit(0); }

// end of content = start of footer, else the <script> block, else </body>
let endIdx = s.indexOf('<footer');
if (endIdx === -1) endIdx = s.indexOf('<script');
if (endIdx === -1) endIdx = s.indexOf('</body>');
if (endIdx === -1) endIdx = s.length;

// the content region may be wrapped in <div class="wrap"> ... </div>. Find the
// wrap open BEFORE firstH2 and its matching close BEFORE endIdx.
const wrapOpenIdx = s.lastIndexOf('<div class="wrap">', firstH2);
// content to panelize = from firstH2 up to the last </div> before endIdx that
// closes the content wrap. Simplest robust rule: take everything from firstH2
// to endIdx, then strip a trailing lone </div></div> or </div> that closed wrap.
let region = s.slice(firstH2, endIdx);
// trim trailing wrap-closing divs (we'll re-add our own container)
let trailingCloses = 0;
region = region.replace(/(\s*<\/div>){1,3}\s*$/,(m)=>{ trailingCloses = (m.match(/<\/div>/g)||[]).length; return ""; });

// 3) split on <h2> and wrap each section
const parts = region.split(/(?=<h2>)/);
let panels = "";
for (const part of parts) {
  const m = part.match(/^<h2>([\s\S]*?)<\/h2>([\s\S]*)$/);
  if (!m) { if (part.trim()) panels += part; continue; }
  const title = m[1].trim();
  const body = m[2];
  const rows = (body.match(/<tr/g) || []).length + (body.match(/<li/g) || []).length;
  const wide = /<table|<pre|class="q-list"/.test(body) || rows >= 4;
  panels += `<section class="panel${wide ? ' wide' : ''}">\n` +
            `  <div class="ix"><span class="lead-in">${title}</span></div>\n` +
            `  <h2>${title}</h2>${body}</section>\n`;
}

// 4) reassemble: keep the wrap-open we found, insert .panels, restore closes
const before = s.slice(0, wrapOpenIdx !== -1 ? wrapOpenIdx : firstH2);
const wrapTag = wrapOpenIdx !== -1 ? '<div class="wrap">' : '<div class="wrap">';
const after = s.slice(endIdx);
s = before + wrapTag + '<div class="panels">\n' + panels + '</div></div>\n' + after;

// validate — no h2 lost, balance intact
const h2o = (s.match(/<h2>/g) || []).length, h2c = (s.match(/<\/h2>/g) || []).length;
const panelCount = (s.match(/<section class="panel/g) || []).length;
if (h2o !== h2c || panelCount === 0) { fs.copyFileSync(path + ".bak-panelize", path); console.error("validation failed (h2 " + h2o + "/" + h2c + ", panels " + panelCount + "), rolled back"); process.exit(1); }
fs.writeFileSync(path, s);
console.log(path + ": " + panelCount + " panels, " + h2o + " sections preserved");
