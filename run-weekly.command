#!/bin/bash
# Automated DAILY run — invoked by launchd once a day.
# Does ~15 min of scanning (a slice of the full 50k sweep). Only when a full
# sweep COMPLETES does it rebuild + publish. So the site refreshes ~weekly,
# built from short gentle daily slices. Nothing to double-click.
cd "$(dirname "$0")" || exit 1
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"

echo ""
echo "==== $(date) : daily slice starting ===="

# Run one time-boxed slice. Resumes from yesterday's checkpoint automatically.
node run-big.cjs

# Did a full sweep just COMPLETE? run-big deletes .scan-progress.json only when
# it finishes the whole list. If the checkpoint is gone AND we have a summary,
# the sweep is done -> rebuild + publish. If the checkpoint still exists, we're
# mid-sweep; do nothing and wait for tomorrow's slice.
if [ -f ".scan-progress.json" ]; then
  echo "Mid-sweep — checkpoint present. No publish today; resuming tomorrow."
  echo "==== $(date) : slice done ===="
  exit 0
fi

echo "Full sweep complete — rebuilding and publishing."
if node rebuild.cjs; then
  git add index.json index.html world.html scan-robots.csv scan-signals.csv scan-summary.json 2>/dev/null
  if git diff --cached --quiet; then
    echo "no changes to publish"
  else
    git commit -m "Weekly scan $(date -u +%Y-%m-%d)" >/dev/null 2>&1
    git push >/dev/null 2>&1 && echo "published ✓" || echo "push failed (retries next cycle)"
  fi
else
  echo "rebuild declined (thin scan) — live site kept, nothing published"
fi
echo "==== $(date) : sweep published ===="
