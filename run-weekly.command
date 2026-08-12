#!/bin/zsh
# CRAWL PRICE INDEX — automation (launchd). Daily scan slice; on sweep
# completion: rebuild → publish site → paid data → sample → Weekly Crawl → git.
export PATH="$HOME/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
cd "$(dirname "$0")" || exit 1
echo "=== $(date) run-weekly start ==="
RUN_START=$(date -u +%Y-%m-%dT%H:%M:%SZ)
log_run() { node -e 'const fs=require("fs");const a=process.argv;const prog=fs.existsSync(".scan-progress.json")?"in_progress":"complete";fs.appendFileSync("runs.log",JSON.stringify({started:a[1],ended:new Date().toISOString(),outcome:a[2],sweep:prog})+"\n")' "$RUN_START" "$1"; }
trap 'log_run interrupted' INT TERM
node run-big.cjs || { echo "SCAN FAILED"; log_run scan_failed; exit 1; }
if [ -f .scan-progress.json ]; then
  echo "Sweep in progress — checkpointed, nothing published today."
  log_run slice_ok
  exit 0
fi
echo "Sweep COMPLETE — publishing pipeline:"
node rebuild.cjs || { echo "REBUILD GATE ABORTED"; exit 1; }
node build-status.cjs || echo "WARN: status page build failed" || { echo "REBUILD GATE ABORTED — live data untouched"; exit 1; }
cp index.json public/ 2>/dev/null
cp trends-public.json public/ 2>/dev/null
wrangler deploy || echo "WARN: site deploy failed"
node push-dataset.cjs || echo "WARN: paid-data KV push failed"
node push-sample.cjs || echo "WARN: sample push failed"
node build-lookup.cjs || echo "WARN: lookup push failed"
node push-snapshot.cjs || echo "WARN: snapshot push failed"
node push-csv.cjs || echo csv-push-failed
node send-weekly.cjs --send || echo "WARN: weekly email failed"
node send-alerts.cjs --send || echo "WARN: alerts failed"
git add -A && git commit -m "weekly scan $(date +%F)" 2>/dev/null && git push || echo "WARN: git push skipped/failed"
log_run published
echo "=== done ==="
