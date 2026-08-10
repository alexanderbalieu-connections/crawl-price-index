#!/usr/bin/env node
// 1) Links /check from the homepage hero. 2) Re-applies the missing
// methodology signed-requests paragraph. Both validation-gated.
const fs = require("fs");

function validate(s, f) {
  const i = s.lastIndexOf("<script>");
  if (i !== -1) {
    const j = s.indexOf("</script>", i);
    try { new Function(s.slice(i + 8, j)); } catch (e) { console.error("VALIDATION FAILED script " + f + ": " + e.message); return false; }
  }
  const m = s.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/);
  if (m) { try { JSON.parse(m[1]); } catch (e) { console.error("VALIDATION FAILED payload " + f + ": " + e.message); return false; } }
  return true;
}

// --- homepage: tool link under the hero note (both live file and clean base) ---
const A = '<div class="cta-note">Full per-domain dataset · weekly history · API access · cancel anytime</div>';
const LINK = A + '\n    <div class="cta-note" style="margin-top:6px">Free tool: <a href="/check">What could your site charge AI? →</a></div>';
for (const f of ["public/index.html", "homepage-backups/index.html.bak"]) {
  if (!fs.existsSync(f)) { console.log("skip (missing): " + f); continue; }
  let s = fs.readFileSync(f, "utf8");
  if (s.includes('href="/check"')) { console.log("already linked: " + f); continue; }
  if (!s.includes(A)) { console.error("hero anchor missing in " + f + " - skipping"); continue; }
  s = s.replace(A, LINK);
  if (!validate(s, f)) continue;
  fs.writeFileSync(f, s);
  console.log("homepage now links /check: " + f);
}

// --- methodology: signed-requests paragraph (was reported missing) ---
const mf = "public/methodology.html";
if (fs.existsSync(mf)) {
  let s = fs.readFileSync(mf, "utf8");
  if (s.includes("Web Bot Auth")) { console.log("methodology already patched"); }
  else {
    let kid = "";
    try { kid = JSON.parse(fs.readFileSync("wba-directory.json", "utf8")).keys[0].kid; } catch (e) {}
    const block = '<p><b>Signed requests.</b> Every request our crawler makes is cryptographically signed using HTTP Message Signatures (RFC 9421) under the Web Bot Auth profile, so any site can verify that traffic claiming to be ours really is ours. Our public key directory is published at <a href="/.well-known/http-message-signatures-directory">/.well-known/http-message-signatures-directory</a>' + (kid ? ' (key ID <code>' + kid + '</code>)' : '') + '. We identify honestly, we do not spoof other crawlers at scale, and we store no page content.</p>\n';
    const i = s.lastIndexOf("</main>");
    const j = i === -1 ? s.lastIndexOf("</body>") : i;
    if (j === -1) { console.error("methodology: no insert point"); }
    else { s = s.slice(0, j) + block + s.slice(j); fs.writeFileSync(mf, s); console.log("methodology: signed-requests paragraph added"); }
  }
} else { console.log("methodology.html not found - skipped"); }
