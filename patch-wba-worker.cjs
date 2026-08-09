const fs = require("fs");
let s = fs.readFileSync("worker.js", "utf8");
if (s.includes("wbaDirectory")) { console.log("worker already patched"); process.exit(0); }
const R = '    if (path === "/health") return json({ ok: true }, 200, cors);';
const H = "// ---- helpers";
if (!s.includes(R) || !s.includes(H)) { console.error("anchors missing - aborting"); process.exit(1); }
fs.writeFileSync("worker.js.bak11", s);
const jwks = fs.readFileSync("wba-directory.json", "utf8").trim();
s = s.replace(R, '    if (path === "/.well-known/http-message-signatures-directory" || path === "/.well-known/http-message-signature-directory") return wbaDirectory(request, env, cors);\n' + R);
const fn = [
'// ---- Web Bot Auth key directory (RFC 9421 profile) -------------------------',
'const WBA_JWKS = ' + jwks + ';',
'async function wbaDirectory(request, env, cors) {',
'  const body = JSON.stringify(WBA_JWKS);',
'  const headers = { "Content-Type": "application/http-message-signatures-directory+json", "Cache-Control": "max-age=86400", ...cors };',
'  try {',
'    if (env.WBA_PRIVATE_PKCS8) {',
'      const raw = Uint8Array.from(atob(env.WBA_PRIVATE_PKCS8), c => c.charCodeAt(0));',
'      let key = null, alg = "Ed25519";',
'      try { key = await crypto.subtle.importKey("pkcs8", raw, { name: "Ed25519" }, false, ["sign"]); }',
'      catch (e) { alg = "NODE-ED25519"; key = await crypto.subtle.importKey("pkcs8", raw, { name: "NODE-ED25519", namedCurve: "NODE-ED25519" }, false, ["sign"]); }',
'      const created = Math.floor(Date.now() / 1000), expires = created + 600;',
'      const params = "(\\"@authority\\");created=" + created + ";expires=" + expires + ";keyid=\\"" + WBA_JWKS.keys[0].kid + "\\";tag=\\"web-bot-auth\\"";',
'      const base = "\\"@authority\\": " + new URL(request.url).host + "\\n" + "\\"@signature-params\\": " + params;',
'      const sig = await crypto.subtle.sign(alg === "Ed25519" ? "Ed25519" : { name: "NODE-ED25519" }, key, new TextEncoder().encode(base));',
'      const bytes = new Uint8Array(sig); let bin = "";',
'      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);',
'      headers["Signature-Input"] = "sig=" + params;',
'      headers["Signature"] = "sig=:" + btoa(bin) + ":";',
'    }',
'  } catch (e) { console.error("wba directory signing failed", String(e)); }',
'  return new Response(body, { status: 200, headers });',
'}',
'',
''
].join("\n");
s = s.slice(0, s.indexOf(H)) + fn + s.slice(s.indexOf(H));
fs.writeFileSync("worker.js", s);
console.log("worker: directory route added (backup worker.js.bak11)");
