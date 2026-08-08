#!/usr/bin/env node
/**
 * After a scan+rebuild, push the FULL paid dataset into the Worker's DATA KV,
 * so gated subscribers get fresh data. Run from the project folder.
 * Needs: wrangler installed & logged in.
 *
 *   node push-dataset.cjs
 *
 * It reads the full dataset (paid tier) — NOT the neutered public index.json —
 * from paid-dataset.json (produced by rebuild.cjs's paid output).
 */
const { execSync } = require("child_process");
const fs = require("fs");
const SRC = "paid-dataset.json";
if (!fs.existsSync(SRC)) { console.error("no paid-dataset.json — run rebuild.cjs first"); process.exit(1); }
const size = fs.statSync(SRC).size;
console.log(`Pushing paid dataset (${(size/1024).toFixed(0)} KB) to DATA KV…`);
try {
  execSync(`wrangler kv key put --binding=DATA dataset --path=${SRC} --remote`, { stdio: "inherit" });
  console.log("✓ paid dataset live behind the gate");
} catch (e) {
  console.error("push failed — check wrangler is logged in");
  process.exit(1);
}
