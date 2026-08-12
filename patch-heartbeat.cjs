#!/usr/bin/env node
// HEARTBEAT — makes silent automation failure impossible to miss.
// Every autopilot run now appends a JSON line to runs.log: when it started,
// what it did, how far the sweep got, and whether it succeeded.
const fs = require("fs");
const f = "run-weekly.command";
let s = fs.readFileSync(f, "utf8");
if (s.includes("runs.log")) { console.log("heartbeat already installed"); process.exit(0); }
const A = 'echo "=== $(date) run-weekly start ==="';
if (!s.includes(A)) { console.error("anchor missing - aborting"); process.exit(1); }
fs.writeFileSync(f + ".bak2", s);

const open = A + '\n' +
'RUN_START=$(date -u +%Y-%m-%dT%H:%M:%SZ)\n' +
'log_run() { node -e \'const fs=require("fs");const a=process.argv;const prog=fs.existsSync(".scan-progress.json")?"in_progress":"complete";fs.appendFileSync("runs.log",JSON.stringify({started:a[1],ended:new Date().toISOString(),outcome:a[2],sweep:prog})+"\\n")\' "$RUN_START" "$1"; }\n' +
'trap \'log_run interrupted\' INT TERM';

s = s.replace(A, open);

// log the two terminal outcomes
s = s.replace('  echo "Sweep in progress — checkpointed, nothing published today."\n  exit 0',
              '  echo "Sweep in progress — checkpointed, nothing published today."\n  log_run slice_ok\n  exit 0');
s = s.replace('echo "=== done ==="', 'log_run published\necho "=== done ==="');
s = s.replace('node run-big.cjs || { echo "SCAN FAILED"; exit 1; }',
              'node run-big.cjs || { echo "SCAN FAILED"; log_run scan_failed; exit 1; }');

fs.writeFileSync(f, s);
console.log("heartbeat installed - every run now appends to runs.log (backup run-weekly.command.bak2)");
