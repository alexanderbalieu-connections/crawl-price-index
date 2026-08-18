#!/bin/zsh
# ============================================================
#  SUNDAY RUN — the weekly edition, on demand.
#  Double-click when you sit down on Sunday. One full 50,000-domain
#  sweep in one sitting (~3-4h), then publish: rebuild, deploy, data,
#  newsletter, alerts, git. Nothing deleted; Ctrl+C is safe anytime.
# ============================================================
cd ~/crawl-price-index || { echo "project folder missing"; read -r; exit 1; }
export PATH="$HOME/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

clear
echo "  ============================================"
echo "   CRAWL PRICE INDEX — Sunday edition"
echo "  ============================================"
echo ""
node where.cjs 2>/dev/null | sed -n '1,8p'
echo ""

# refuse if a sweep is already mid-flight
if [ -f .scan-progress.json ]; then
  echo "  A sweep is already in progress (checkpointed)."
  echo "  Resume it with:  node run-big.cjs"
  echo "  Or clear it and start fresh:  rm .scan-progress.json"
  echo ""
  echo "  Press any key to close."
  read -k1 2>/dev/null || read -r
  exit 0
fi

echo "  This runs a full 50,000-domain sweep (about 3-4 hours) and then"
echo "  publishes the new edition. Keep this window open; the Mac is kept"
echo "  awake automatically. Ctrl+C is safe."
echo ""
printf "  Start the Sunday sweep now? [y/N] "
read -r ans
case "$ans" in [yY]*) ;; *) echo "  Nothing done."; exit 0 ;; esac

TODAY=$(date +%F)
echo ""
echo "=== $(date) sunday-run start ==="

# ---- 1. dated backup of the current edition ---------------------------------
B="backups/edition-$TODAY"
mkdir -p "$B"
for f in paid-dataset.json snapshot-dataset.json dataset.csv sample-dataset.json \
         scan-robots-full.csv scan-summary.json scan-signals.csv index.json \
         history-index.json trends-public.json; do
  [ -f "$f" ] && cp "$f" "$B/" 2>/dev/null
done
LATEST=$(node -pe 'try{JSON.parse(require("fs").readFileSync("history-index.json","utf8")).latest_snapshot}catch(e){""}' 2>/dev/null)
[ -n "$LATEST" ] && [ -f "history/$LATEST.json" ] && cp "history/$LATEST.json" "$B/" 2>/dev/null
echo "Backed up $(ls "$B" 2>/dev/null | wc -l | tr -d ' ') files to $B"

# ---- 2. full sweep, one pass ------------------------------------------------
caffeinate -i -w $$ &
CPI_MINUTES=600 node run-big.cjs --fresh || { echo "SCAN FAILED — nothing published, backup intact."; read -r; exit 1; }
if [ -f .scan-progress.json ]; then
  echo "Sweep stopped before completing. Progress kept; nothing published."
  echo "Resume later with: node run-big.cjs"
  read -r; exit 0
fi

# ---- 3. publish pipeline (full weekly, newsletter included) ------------------
BEFORE=$(node -pe 'try{JSON.parse(require("fs").readFileSync("history-index.json","utf8")).latest_snapshot}catch(e){"none"}' 2>/dev/null)
node rebuild.cjs || { echo "REBUILD GATE ABORTED — live site unchanged, backup intact."; read -r; exit 1; }
node build-status.cjs || echo "WARN: status build failed"
node build-suggest.cjs || echo "WARN: suggest build failed"
cp index.json public/ 2>/dev/null
cp trends-public.json public/ 2>/dev/null
npx wrangler deploy || echo "WARN: site deploy failed"
node push-dataset.cjs || echo "WARN: dataset push failed"
node push-sample.cjs || echo "WARN: sample push failed"
node build-lookup.cjs || echo "WARN: lookup push failed"
node push-snapshot.cjs || echo "WARN: snapshot push failed"
node push-csv.cjs || echo "WARN: csv push failed"
node send-weekly.cjs --send || echo "WARN: weekly email failed"
node send-alerts.cjs --send || echo "WARN: alerts failed"
git add -A && git commit -m "weekly edition $TODAY" 2>/dev/null && git push || echo "WARN: git push skipped/failed"

AFTER=$(node -pe 'try{JSON.parse(require("fs").readFileSync("history-index.json","utf8")).latest_snapshot}catch(e){"none"}' 2>/dev/null)
echo ""
echo "  ============================================"
if [ "$BEFORE" = "$AFTER" ]; then
  echo "  !! NO NEW EDITION RECORDED. Latest still $AFTER."
  echo "     Something in the chain failed — scroll up for the error."
else
  echo "  PUBLISHED. New edition: $AFTER  (was $BEFORE)"
fi
echo "  ============================================"
echo ""
echo "  Press any key to close."
read -k1 2>/dev/null || read -r
