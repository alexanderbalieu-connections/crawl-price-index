#!/usr/bin/env node
// Retry pass, tamed: 8s budget (a host that won't answer in 8s won't in 15),
// progress line every 500, hard 45-minute cap. Validates, rolls back.
const fs = require("fs");
const { execSync } = require("child_process");
let s = fs.readFileSync("run-big.cjs", "utf8");
if (s.indexOf("RETRY_CAP_MS") !== -1) { console.log("already capped"); process.exit(0); }
fs.copyFileSync("run-big.cjs", "run-big.cjs.bak-cap");

const oldHead = 'console.log(`\\nRetry pass: ${retryables.length} network-level failures, concurrency 4, 15s budget…`);';
const newHead = `const RETRY_CAP_MS = 45 * 60000, retryT0 = Date.now();
    let retryDone = 0;
    console.log(\`\\nRetry pass: \${retryables.length} network-level failures · concurrency 4 · 8s budget · 45 min cap\`);`;
if (s.indexOf(oldHead) === -1) { console.error("ABORT: retry header not found"); process.exit(1); }
s = s.replace(oldHead, newHead);

const oldGet = 'const r = await getRobots(d, 15000);';
const newGet = `if (Date.now() - retryT0 > RETRY_CAP_MS) { rq.length = 0; break; }
        const r = await getRobots(d, 8000);
        retryDone++;
        if (retryDone % 500 === 0) console.log(\`  retry \${retryDone}/\${retryables.length} · \${Math.round((Date.now()-retryT0)/60000)} min\`);`;
if (s.indexOf(oldGet) === -1) { console.error("ABORT: retry fetch line not found"); process.exit(1); }
s = s.replace(oldGet, newGet);

fs.writeFileSync("run-big.cjs", s);
try { execSync("node --check run-big.cjs", { stdio: "pipe" }); console.log("retry pass capped: 8s budget, progress every 500, 45-min ceiling"); }
catch (e) { fs.copyFileSync("run-big.cjs.bak-cap", "run-big.cjs"); console.error("SYNTAX FAILED — rolled back"); process.exit(1); }
