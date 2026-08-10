#!/usr/bin/env node
// Weekly autopilot: send change alerts after the newsletter.
const fs = require("fs");
const f = "run-weekly.command";
let s = fs.readFileSync(f, "utf8");
if (s.includes("send-alerts.cjs")) { console.log("autopilot already sends alerts"); process.exit(0); }
const A = "node send-weekly.cjs --send";
if (!s.includes(A)) { console.error("anchor missing - aborting"); process.exit(1); }
s = s.replace(A, A + ' || echo "WARN: weekly email failed"\nnode send-alerts.cjs --send');
// avoid a duplicated trailing || clause on the original line
s = s.replace('node send-alerts.cjs --send || echo "WARN: weekly email failed (lock or Resend)"', 'node send-alerts.cjs --send || echo "WARN: alerts failed"');
fs.writeFileSync(f, s);
console.log("autopilot: change alerts now send weekly");
