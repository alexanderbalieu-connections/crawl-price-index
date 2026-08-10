#!/usr/bin/env node
// Make the crawl price configurable so the mint path can be proven with a
// small real payment. Defaults to 20 USDC when the var is absent.
const fs = require("fs");
let s = fs.readFileSync("worker.js", "utf8");
if (s.includes("crawlPrice(env)")) { console.log("already patched"); process.exit(0); }
const A = 'const CRAWL_PRICE_USDC = 20;';
if (!s.includes(A)) { console.error("anchor missing - aborting"); process.exit(1); }
fs.writeFileSync("worker.js.bak14", s);
s = s.replace(A, 'const CRAWL_PRICE_USDC = 20;                                    // default when CRAWL_PRICE_USDC is unset\nfunction crawlPrice(env) { const v = parseFloat(env.CRAWL_PRICE_USDC); return v > 0 ? v : CRAWL_PRICE_USDC; }');
// use it everywhere the constant was used
s = s.split('maxAmountRequired: String(CRAWL_PRICE_USDC * 1000000)').join('maxAmountRequired: String(Math.round(crawlPrice(env) * 1000000))');
s = s.split('const want = BigInt(CRAWL_PRICE_USDC) * 1000000n;').join('const want = BigInt(Math.round(crawlPrice(env) * 1000000));');
s = s.split('required_usdc: CRAWL_PRICE_USDC').join('required_usdc: crawlPrice(env)');
fs.writeFileSync("worker.js", s);
console.log("crawl price is now env-configurable (backup worker.js.bak14)");
