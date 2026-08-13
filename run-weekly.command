#!/bin/zsh
# CRAWL PRICE INDEX — automation (launchd). Fires DAILY at 06:00.
# Daily scan slice; when the sweep completes AND at least 7 days have passed
# since the last edition: rebuild → publish → paid data → sample → email → git.
# A sweep that finishes early is HELD, not discarded and not re-scanned.
export PATH="$HOME/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
cd "$(dirname "$0")" || exit 1
echo "=== $(date) run-weekly start ==="

# --- publish gate, BEFORE any scanning -------------------------------------
# 0 = publish now, 10 = hold a completed sweep, 20 = nothing pending
node can-publish.cjs
GATE=$?
if [ $GATE -eq 10 ]; then
  echo "Completed sweep held for the minimum interval. No scan, no publish today."
  exit 0
fi

if [ $GATE -ne 0 ]; then
  node run-big.cjs || { echo "SCAN FAILED"; exit 1; }
  if [ -f .scan-progress.json ]; then
    echo "Sweep in progress — checkpointed, nothing published today."
    exit 0
  fi
  # sweep just completed: re-check the interval before publishing
  node can-publish.cjs
  GATE=$?
  if [ $GATE -ne 0 ]; then
    echo "Sweep COMPLETE but held for the minimum interval. Nothing published."
    exit 0
  fi
fi

echo "Sweep COMPLETE and interval satisfied — publishing pipeline:"
node rebuild.cjs || { echo "REBUILD GATE ABORTED"; exit 1; }
node build-status.cjs || echo "WARN: status page build failed"
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
echo "=== done ==="
