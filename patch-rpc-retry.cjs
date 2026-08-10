#!/usr/bin/env node
// Make baseRpc resilient to transient 429s: try each endpoint, and if the
// whole list 429s, wait briefly and sweep again (up to 3 rounds). Public
// RPCs rate-limit Cloudflare's shared egress IPs in bursts; a short retry
// clears it. Read-only calls, no keys.
const fs = require("fs");
let s = fs.readFileSync("worker.js", "utf8");
if (s.includes("rounds = 3")) { console.log("already has retry - skipping"); process.exit(0); }
const A = 'async function baseRpc(method, params) {\n  let lastErr = "no endpoints tried";\n  for (const url of BASE_RPCS) {';
if (!s.includes(A)) { console.error("anchor missing - aborting"); process.exit(1); }
fs.writeFileSync("worker.js.bak15", s);
const B = 'async function baseRpc(method, params) {\n  const rounds = 3;\n  let lastErr = "no endpoints tried";\n  for (let round = 0; round < rounds; round++) {\n   if (round > 0) await new Promise(r => setTimeout(r, 700));\n   for (const url of BASE_RPCS) {';
s = s.replace(A, B);
// close the extra loop: the throw at the end needs one more brace before it
const C = '  }\n  throw new Error("all Base RPC endpoints failed (" + lastErr + ")");';
const D = '   }\n  }\n  throw new Error("all Base RPC endpoints failed after " + rounds + " rounds (" + lastErr + ")");';
if (!s.includes(C)) { console.error("close anchor missing - restoring"); fs.writeFileSync("worker.js", fs.readFileSync("worker.js.bak15")); process.exit(1); }
s = s.replace(C, D);
fs.writeFileSync("worker.js", s);
console.log("baseRpc now retries up to 3 rounds with backoff (backup worker.js.bak15)");
