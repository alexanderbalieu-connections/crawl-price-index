#!/bin/zsh
# ============================================================
#  METHODOLOGY v2 RESCAN — one shot, run and walk away.
#  1. backs up the current edition completely
#  2. runs a fresh full 50k sweep with www-fallback + retry pass
#  3. publishes it as edition 2026-08-16 (supersedes 08-15)
#  Nothing is deleted. Ctrl+C is safe at any point.
# ============================================================
cd ~/crawl-price-index || { echo "project folder missing"; read -r; exit 1; }
export PATH="$HOME/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

echo "=== $(date) methodology-v2 rescan start ==="

# ---- 1. full backup of the edition being superseded -------------------------
B="backups/edition-2026-08-15"
mkdir -p "$B"
for f in paid-dataset.json snapshot-dataset.json dataset.csv sample-dataset.json \
         scan-robots-full.csv scan-summary.json scan-signals.csv index.json \
         history/2026-08-15.json history-index.json trends-public.json; do
  [ -f "$f" ] && cp "$f" "$B/" 2>/dev/null
done
echo "Backed up $(ls "$B" | wc -l | tr -d ' ') files to $B"

# ---- 2. fresh full sweep -----------------------------------------------------
caffeinate -i -w $$ &
CPI_MINUTES=600 node run-big.cjs --fresh || { echo "SCAN FAILED — nothing published, backup intact."; read -r; exit 1; }
if [ -f .scan-progress.json ]; then
  echo "Sweep stopped before completing. Nothing published; progress kept."
  read -r; exit 0
fi

# ---- 3. publish pipeline (gate bypassed deliberately: this is a correction) --
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
node send-alerts.cjs --send || echo "WARN: alerts failed"
# NOTE: no send-weekly — subscribers already got this week's email; a second
# one hours later reads as noise. The corrected data is live everywhere else.
git add -A && git commit -m "methodology v2: www-fallback + retry pass; edition 2026-08-16 supersedes 08-15" && git push || echo "WARN: git push failed"

echo ""
echo "=== VERDICT ==="
node -e 'const h=JSON.parse(require("fs").readFileSync("history-index.json","utf8"));console.log("Latest edition:",h.latest_snapshot)'
node -e 'const d=JSON.parse(require("fs").readFileSync("paid-dataset.json","utf8"));console.log("Parsed:",d.coverage.robots_parsed,"of",d.coverage.tranco_top_n)'
echo ""
echo "Press any key to close."
read -k1 2>/dev/null || read -r
