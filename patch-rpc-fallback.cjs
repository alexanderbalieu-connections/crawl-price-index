#!/usr/bin/env node
// mainnet.base.org rate-limits Cloudflare's shared egress IPs (HTTP 429).
// Replace the single-endpoint RPC call with a fallback chain: first endpoint
// that answers wins. Read-only calls, no keys needed, all free public nodes.
const fs = require("fs");
let s = fs.readFileSync("worker.js", "utf8");
if (s.includes("BASE_RPCS")) { console.log("already patched"); process.exit(0); }
const A = "async function baseRpc(method, params) {";
const B = "async function redeemCrawl(";
const a = s.indexOf(A), b = s.indexOf(B);
if (a === -1 || b === -1 || b < a) { console.error("anchors missing - aborting, worker untouched"); process.exit(1); }
fs.writeFileSync("worker.js.bak13", s);
const fn = [
'const BASE_RPCS = [',
'  "https://base-rpc.publicnode.com",',
'  "https://base.llamarpc.com",',
'  "https://mainnet.base.org",',
'  "https://1rpc.io/base",',
'  "https://base.drpc.org",',
'];',
'async function baseRpc(method, params) {',
'  let lastErr = "no endpoints tried";',
'  for (const url of BASE_RPCS) {',
'    try {',
'      const r = await fetch(url, {',
'        method: "POST",',
'        headers: { "Content-Type": "application/json", "Accept": "application/json" },',
'        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),',
'      });',
'      if (!r.ok) { lastErr = url + " -> HTTP " + r.status; continue; }',
'      const j = await r.json();',
'      if (j.error) { lastErr = url + " -> " + (j.error.message || "rpc error"); continue; }',
'      return j.result;',
'    } catch (e) { lastErr = url + " -> " + String(e); }',
'  }',
'  throw new Error("all Base RPC endpoints failed (" + lastErr + ")");',
'}',
'',
''
].join("\n");
s = s.slice(0, a) + fn + s.slice(b);
fs.writeFileSync("worker.js", s);
console.log("Base RPC now falls back across " + 5 + " endpoints (backup worker.js.bak13)");
