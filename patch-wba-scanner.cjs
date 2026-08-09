const fs = require("fs");
let s = fs.readFileSync("run-big.cjs", "utf8");
if (s.includes("Web Bot Auth")) { console.log("scanner already patched"); process.exit(0); }
const A = 'const PROGRESS = ".scan-progress.json";';
if (!s.includes(A)) { console.error("anchor missing - aborting"); process.exit(1); }
fs.writeFileSync("run-big.cjs.bak3", s);
const blk = [
A,
'// ---- Web Bot Auth: sign outgoing requests (flag: web_bot_auth) ------------',
'try {',
'  if (cfg && cfg.web_bot_auth && fs.existsSync(".wba-private.pem")) {',
'    const _c = require("crypto");',
'    const _priv = _c.createPrivateKey(fs.readFileSync(".wba-private.pem"));',
'    const _kid = JSON.parse(fs.readFileSync("wba-directory.json", "utf8")).keys[0].kid;',
'    const _agent = "\\"" + (cfg.wba_agent || "https://crawlpriceindex.com") + "\\"";',
'    const _fetch = globalThis.fetch;',
'    globalThis.fetch = function (url, opts) {',
'      opts = opts || {};',
'      try {',
'        const u = new URL(typeof url === "string" ? url : String(url));',
'        const created = Math.floor(Date.now() / 1000), expires = created + 60;',
'        const params = "(\\"@authority\\" \\"signature-agent\\");created=" + created + ";expires=" + expires + ";keyid=\\"" + _kid + "\\";tag=\\"web-bot-auth\\"";',
'        const base = "\\"@authority\\": " + u.host + "\\n" + "\\"signature-agent\\": " + _agent + "\\n" + "\\"@signature-params\\": " + params;',
'        const sig = _c.sign(null, Buffer.from(base), _priv).toString("base64");',
'        opts.headers = Object.assign({}, opts.headers, { "Signature-Agent": _agent, "Signature-Input": "sig=" + params, "Signature": "sig=:" + sig + ":" });',
'      } catch (e) {}',
'      return _fetch(url, opts);',
'    };',
'    console.log("Web Bot Auth: request signing ENABLED (kid " + _kid.slice(0, 12) + ")");',
'  }',
'} catch (e) { console.error("Web Bot Auth init skipped:", String(e)); }'
].join("\n");
s = s.replace(A, blk);
fs.writeFileSync("run-big.cjs", s);
console.log("scanner: signing wrapper added (backup run-big.cjs.bak3)");
