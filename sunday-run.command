#!/bin/zsh
# ============================================================
#  SUNDAY RUN — the weekly edition, on demand.
#  Double-click when you sit down Sat/Sun morning. Steps, in order:
#    1. Back up the current edition (nothing is ever deleted).
#    2. Snapshot the x402 Bazaar (fast; captured even if you stop the sweep).
#    3. Full 50,000-domain robots.txt sweep + wide payment probe (~3-5h).
#    4. Publish: rebuild, copy-guard, site deploy, data, newsletter, alerts, git.
#    5. Customer app deploy + paid-dataset gate verification.
#  Ctrl+C is safe at any point; a half-finished sweep resumes, nothing publishes.
# ============================================================
cd ~/crawl-price-index || { echo "project folder missing"; read -r; exit 1; }
export PATH="$HOME/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

clear
echo "  ============================================"
echo "   CRAWL PRICE INDEX — Sunday edition"
echo "  ============================================"
echo ""
# ---------------------------------------------------------------------------
# SHADOW MODE.  CPI_SHADOW=1 ./sunday-run.command
# Runs the scan, the rebuild and every guard. Publishes nothing: no deploy,
# no KV push, no newsletter, no alerts, no commit. Used for the Pi parallel
# run, where the Pi must prove it can produce an edition without being able
# to publish one.
# ---------------------------------------------------------------------------
if [ "${CPI_SHADOW:-0}" = "1" ]; then
  echo ""
  echo "############################################################"
  echo "#  SHADOW RUN — nothing will be published, sent or pushed. #"
  echo "############################################################"
  echo ""
fi
pub() {
  if [ "${CPI_SHADOW:-0}" = "1" ]; then
    echo "  [shadow] skipped: $*"
    return 0
  fi
  "$@"
}

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

echo "  This runs a full 50,000-domain sweep plus the wide payment probe"
echo "  (about 3-5 hours) and then publishes the new edition. Keep this window"
echo "  open; the Mac is kept awake automatically. Ctrl+C is safe."
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

# ---- 2. capture the x402 Bazaar (opt-in machine-payment registry) -----------
# A weekly snapshot of a live registry nobody publishes as a time series, so a
# missed week can never be backfilled. Deliberately BEFORE the sweep so it is
# captured even if you abort the sweep. Fully non-fatal. (The frame-intersection
# it computes matches against last week's edition, which is fine — the 50k frame
# barely moves week to week, and capturing the Bazaar is the priority.)
node bazaar-snapshot.cjs || echo "WARN: bazaar snapshot failed (non-fatal, edition unaffected)"

# ---- 3. full sweep + wide payment probe -------------------------------------
# run-big.cjs harvests all 50k robots.txt, then internally runs the wide honest
# payment probe (top-2000 + every blocker) and the identity panel. One sitting.
caffeinate -i -w $$ &
CPI_MINUTES=600 node run-big.cjs --fresh || { echo "SCAN FAILED — nothing published, backup intact."; read -r; exit 1; }
if [ -f .scan-progress.json ]; then
  echo "Sweep stopped before completing. Progress kept; nothing published."
  echo "Resume later with: node run-big.cjs"
  read -r; exit 0
fi

# ---- 4. publish pipeline (full weekly, newsletter included) ------------------
BEFORE=$(node -pe 'try{JSON.parse(require("fs").readFileSync("history-index.json","utf8")).latest_snapshot}catch(e){"none"}' 2>/dev/null)
node rebuild.cjs || { echo "REBUILD GATE ABORTED — live site unchanged, backup intact."; read -r; exit 1; }

# The dashboard's prose makes qualitative claims about the data ("a third of all
# blocking", "overwhelmingly in one direction"). The numbers inside those
# sentences interpolate from the data; the characterisations around them do not.
# This asserts every such claim against the new edition. It does not block the
# publish — the data is still correct, only the wording would be stale.
node check-copy.cjs || {
  echo ""
  echo "  !! COPY GUARD FAILED — wording above no longer matches this edition."
  echo "     The edition is fine to publish; the sentence is not. Fix it in app/views.js"
  echo "     at the location named, then redeploy the app."
  echo ""
  printf "  Publish anyway? [y/N] "
  read -r cpans
  case "$cpans" in [yY]*) ;; *) echo "  Stopped. Nothing published."; read -r; exit 1 ;; esac
}
node build-status.cjs || echo "WARN: status build failed"
node build-suggest.cjs || echo "WARN: suggest build failed"

# Public-surface guard: assert the machine feed reconciles with the scan and the
# public pages carry none of the forbidden framings ("% of the web", enforcement
# as a rate, ccTLD mislabelled country). Non-fatal — it prints loudly right
# before deploy so stale/incorrect public copy is caught, but never blocks the
# edition. Make it blocking (like the copy guard) if you prefer.
node check-public.cjs || echo "WARN: public-surface guard found issues above — review before/after deploy"

# Orphaned-helper guard: twice a page has shipped calling a helper that was
# not in scope ($ moved outside its IIFE in check.html, set() left behind in
# index.html when the calculator moved to /estimate). Both threw on load and
# killed everything after them, and both looked fine in review.
node check-helpers.cjs || echo "WARN: a page calls a helper that is not in scope — it will throw on load"

# Bazaar (Machine payments) tab: recompute the intersection against THIS week's
# edition (no re-fetch), assert the tab copy still matches the data, then build
# the app's free aggregate + gated per-domain files. All non-fatal.
# Reachability + site-evidence sweep: the alive/dead/walled split of the frame
# plus per-domain evidence (ads.txt, platform, schema, feeds). Resumable; if a
# partial file exists from earlier in the week it completes rather than restarts.
node sweep-reachability.cjs || echo "WARN: reachability sweep failed (non-fatal)"

node bazaar-snapshot.cjs --reprocess || echo "WARN: bazaar reprocess failed (keeps last capture)"
node check-bazaar.cjs || echo "WARN: bazaar copy guard found drift above — update renderBazaar wording in app/views.js"
node check-css.cjs || echo "WARN: views.js uses CSS classes dashboard.html does not define — panels will render unstyled"
node check-pubcss.cjs || echo "WARN: a PUBLIC page renders a class nothing styles — that panel will look wrong with no error. See the FAIL lines above."

# How many of this edition's policy changes survive a re-fetch? Availability
# flips (to/from no_robots) are already partitioned out upstream; this measures
# the residual — changes between domains readable in BOTH scans. Writes
# change-confirmation.json. Never aborts: it refuses to report a verdict when
# more than half the re-fetches fail, which is what a network problem looks like.
node confirm-changes.cjs --gap 180 || echo "WARN: change confirmation did not complete — the edition is unaffected, but this week's changes are unconfirmed"
node build-bazaar-appdata.cjs || echo "WARN: bazaar app-data build failed"

# /explore dashboard preview: real figures from THIS edition, with the gated
# per-domain layer masked rather than faked. The guard is BLOCKING on staleness
# because a preview one edition behind the page around it is the one way this
# panel can mislead — it would still look authoritative.
node build-explore-preview.cjs || echo "WARN: explore preview build failed"
node check-explore.cjs || echo "WARN: /explore preview is stale or inconsistent — do NOT deploy until fixed"

# Entitlement guard: the licensed per-domain dataset is the product, so assert
# in source that every route reading it checks entitlement or payment first,
# that entitlement fails closed, and that no copy has leaked into the public
# tree. Static only — it cannot vouch for the deployed build.
node check-gating.cjs || echo "WARN: ENTITLEMENT GUARD FAILED — do NOT deploy the app project until fixed"

cp index.json public/ 2>/dev/null
cp trends-public.json public/ 2>/dev/null

# public/ is what Wrangler ships. A stray backup or scratch file there is a
# published file — 101 of them were once served live, including pre-correction
# copies of pages we had publicly corrected. BLOCKING: do not deploy strays.
node check-deployable.cjs || { echo "DEPLOY BLOCKED — non-deployable files in public/. Run: node clean-public.cjs"; read -r; exit 1; }

# Every file must be classified as code / measurement / derived / secret.
# An unclassified file is one nobody has decided how to protect — which is how
# measurement data came to exist in exactly one place on earth. Reports the
# irreplaceable set and any pipeline code that is not committed to git.
node check-backup.cjs || echo "WARN: files with no backup policy, or uncommitted pipeline code — see above"
pub npx wrangler deploy || echo "WARN: site deploy failed"

# ---- 5. the customer app (app.crawlpriceindex.com) --------------------------
# compute-domains.cjs writes private/domains.json at the repo root; the Pages
# deploy only ships what is INSIDE app/, so it has to be copied in first.
# Without this the portal serves last week's data and the Changes/Domains tabs
# report "dataset unavailable".
if [ -f private/domains.json ]; then
  mkdir -p app/private && cp private/domains.json app/private/domains.json && \
    echo "app/private/domains.json refreshed ($(du -h app/private/domains.json | cut -f1))"
else
  echo "WARN: private/domains.json missing — app will serve stale per-domain data"
fi
APP_OUT=$(pub npx wrangler pages deploy app --project-name=cpi-app --commit-dirty=true 2>&1) || echo "WARN: app deploy failed"
echo "$APP_OUT" | tail -6
# The gate lives in app/_worker.js. Pages only compiles it if it is inside the
# deployed directory, and when it silently is not, the paid dataset goes public.
if echo "$APP_OUT" | grep -q "Uploading Worker bundle"; then
  echo "Gate: Worker bundle uploaded."
else
  echo "!! GATE WARNING: no 'Uploading Worker bundle' in the deploy output."
fi
sleep 6
G1=$(curl -s --max-time 20 https://app.crawlpriceindex.com/private/domains.json | head -c 60)
G2=$(curl -s --max-time 20 https://app.crawlpriceindex.com/api/domains | head -c 60)
if echo "$G1" | grep -q "not accessible" && echo "$G2" | grep -q "authentication required"; then
  echo "Gate verified: /private/* refused, /api/domains requires auth."
else
  echo ""
  echo "  !!!! GATE NOT ENFORCED — THE PAID DATASET MAY BE PUBLIC RIGHT NOW !!!!"
  echo "       /private/domains.json -> $G1"
  echo "       /api/domains          -> $G2"
  echo "       Check app/_worker.js is inside the deployed directory, then redeploy."
  echo ""
fi

pub node push-dataset.cjs || echo "WARN: dataset push failed"
pub node push-sample.cjs || echo "WARN: sample push failed"
pub node build-lookup.cjs || echo "WARN: lookup push failed"
pub node push-snapshot.cjs || echo "WARN: snapshot push failed"
pub node push-csv.cjs || echo "WARN: csv push failed"
pub node send-weekly.cjs --send || echo "WARN: weekly email failed"
pub node send-alerts.cjs --send || echo "WARN: alerts failed"
if [ "${CPI_SHADOW:-0}" = "1" ]; then
  echo "  [shadow] skipped: git commit + push"
else
  git add -A && git commit -m "weekly edition $TODAY" 2>/dev/null && git push || echo "WARN: git push skipped/failed"
fi

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
