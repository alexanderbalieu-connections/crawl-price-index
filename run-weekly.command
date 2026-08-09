#!/bin/zsh
# CRAWL PRICE INDEX — automation (launchd). Daily scan slice; on sweep
# completion: rebuild → publish site → paid data → sample → Weekly Crawl → git.
export PATH="$HOME/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
cd "$(dirname "$0")" || exit 1
echo "=== $(date) run-weekly start ==="
node run-big.cjs || { echo "SCAN FAILED"; exit 1; }
if [ -f .scan-progress.json ]; then
  echo "Sweep in progress — checkpointed, nothing published today."
  exit 0
fi
echo "Sweep COMPLETE — publishing pipeline:"
node rebuild.cjs || { echo "REBUILD GATE ABORTED — live data untouched"; exit 1; }
cp index.html world.html index.json public/ 2>/dev/null
cp trends-public.json public/ 2>/dev/null
wrangler deploy || echo "WARN: site deploy failed"
node push-dataset.cjs || echo "WARN: paid-data KV push failed"
node push-sample.cjs || echo "WARN: sample push failed"
node send-weekly.cjs --send || echo "WARN: weekly email failed (lock or Resend)"
git add -A && git commit -m "weekly scan $(date +%F)" 2>/dev/null && git push || echo "WARN: git push skipped/failed"
echo "=== done ==="
