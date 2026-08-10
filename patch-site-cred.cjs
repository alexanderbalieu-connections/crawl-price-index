#!/usr/bin/env node
// Wires the new credibility pages into the site: footer links on the
// homepage, the OpenAPI spec served at a stable path, and llms.txt/robots
// pointers so machines and search engines can find all of it.
const fs = require("fs");

function validate(s, f) {
  const i = s.lastIndexOf("<script>");
  if (i !== -1) { const j = s.indexOf("</script>", i); try { new Function(s.slice(i + 8, j)); } catch (e) { console.error("VALIDATION FAILED script " + f + ": " + e.message); return false; } }
  const m = s.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/);
  if (m) { try { JSON.parse(m[1]); } catch (e) { console.error("VALIDATION FAILED payload " + f + ": " + e.message); return false; } }
  return true;
}

// 1. homepage footer: add the credibility links next to methodology
const OLD = '<a href="/methodology.html">';
let done = 0;
for (const f of ["public/index.html", "homepage-backups/index.html.bak"]) {
  if (!fs.existsSync(f)) continue;
  let s = fs.readFileSync(f, "utf8");
  if (s.includes('href="/privacy.html"')) { console.log("already linked: " + f); continue; }
  const i = s.lastIndexOf(OLD);
  if (i === -1) { console.log("no methodology link in " + f + " - appending to footer instead"); }
  else {
    const end = s.indexOf("</a>", i) + 4;
    s = s.slice(0, end) + ' · <a href="/status.html">status</a> · <a href="/changelog.html">changelog</a> · <a href="/privacy.html">privacy</a> · <a href="/security.html">security</a>' + s.slice(end);
    if (validate(s, f)) { fs.writeFileSync(f, s); done++; console.log("credibility links added: " + f); }
  }
}

// 2. robots.txt + llms.txt pointers
try {
  let r = fs.readFileSync("public/robots.txt", "utf8");
  if (!r.includes("status.html")) {
    r += "\n# Openly documented: https://crawlpriceindex.com/methodology.html\n# Live coverage and caveats: https://crawlpriceindex.com/status.html\n# API spec: https://crawlpriceindex.com/openapi.json\n";
    fs.writeFileSync("public/robots.txt", r);
    console.log("robots.txt: documentation pointers added");
  }
} catch (e) { console.log("no robots.txt found - skipped"); }

try {
  let l = fs.readFileSync("public/llms.txt", "utf8");
  if (!l.includes("openapi.json")) {
    l += "\n## Verify us\n- Methodology and evidence model: https://crawlpriceindex.com/methodology.html\n- Machine-readable provenance: https://api.crawlpriceindex.com/v1/methodology\n- Live coverage, freshness and known caveats: https://crawlpriceindex.com/status.html\n- OpenAPI specification: https://crawlpriceindex.com/openapi.json\n- Changelog: https://crawlpriceindex.com/changelog.html\n- Our crawler's public key directory: https://crawlpriceindex.com/.well-known/http-message-signatures-directory\n";
    fs.writeFileSync("public/llms.txt", l);
    console.log("llms.txt: verification pointers added");
  }
} catch (e) { console.log("no llms.txt found - skipped"); }
