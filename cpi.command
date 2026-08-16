#!/bin/zsh
# ============================================================
#  CRAWL PRICE INDEX — control panel
#  Double-click. Shows where things stand, offers the one
#  action that makes sense. Read-only until you type y.
# ============================================================
cd ~/crawl-price-index || { echo "Cannot find ~/crawl-price-index"; read -r; exit 1; }
export PATH="$HOME/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

clear
node where.cjs

node can-publish.cjs >/dev/null 2>&1
GATE=$?
DAYS=$(node can-publish.cjs --days 2>/dev/null)

echo "  ------------------------------------------------------"
echo ""

pause_exit() {
  echo ""
  echo "  Press any key to close."
  read -k1 2>/dev/null || read -r
  exit 0
}

# Publishes, then states truthfully whether an edition actually went out.
# $1 = "force" to override the 7-day minimum.
publish_now() {
  if [ "$1" = "force" ]; then
    node can-publish.cjs --force >/dev/null 2>&1
    FORCED=1
  else
    FORCED=0
  fi
  node can-publish.cjs >/dev/null 2>&1
  PRE=$?
  if [ $PRE -ne 0 ] && [ $FORCED -eq 0 ]; then
    echo ""
    echo "  NOT PUBLISHED. The gate is holding this edition."
    echo "  Re-run this panel and choose the early-publish option."
    pause_exit
  fi
  echo ""
  echo "  Publishing: rebuild, deploy, dataset, newsletter, git."
  echo ""
  BEFORE=$(node -e 'try{console.log(JSON.parse(require("fs").readFileSync("history-index.json","utf8")).latest_snapshot||"none")}catch(e){console.log("none")}')
  ./run-weekly.command
  AFTER=$(node -e 'try{console.log(JSON.parse(require("fs").readFileSync("history-index.json","utf8")).latest_snapshot||"none")}catch(e){console.log("none")}')
  echo ""
  if [ "$BEFORE" = "$AFTER" ]; then
    echo "  !! NO NEW EDITION WAS RECORDED. Latest is still $AFTER."
    echo "     Something in the chain did not complete. Scroll up for the error."
  else
    echo "  PUBLISHED. New edition: $AFTER (was $BEFORE)."
  fi
  echo ""
  node where.cjs
  pause_exit
}

# Warn before a long scan whose result would be held.
confirm_scan() {
  if [ -n "$DAYS" ] && [ "${DAYS%%.*}" -lt 7 ] 2>/dev/null; then
    echo "  NOTE: the last edition was $DAYS days ago. A scan finishing"
    echo "  today would be HELD until the 7-day minimum, not published."
    echo ""
    printf "  Scan AND publish early on completion? [y = publish early / n = cancel] "
    read -r a2
    case "$a2" in [yY]*) SCAN_MODE="force"; return 0 ;; *) return 1 ;; esac
  fi
  SCAN_MODE="normal"
  return 0
}

run_full_scan() {
  echo ""
  echo "  Starting a full 50,000-domain sweep. Roughly 3-4 hours."
  echo "  Keep this window open and stop the Mac from sleeping."
  echo "  Ctrl+C is safe: progress is checkpointed, nothing publishes."
  echo ""
  CPI_MINUTES=600 node run-big.cjs --fresh || { echo "  SCAN FAILED — nothing published."; pause_exit; }
  if [ -f .scan-progress.json ]; then
    echo ""
    echo "  Stopped before reaching 50,000. Progress kept, nothing published."
    pause_exit
  fi
  publish_now "$SCAN_MODE"
}

# ---- completed sweep, interval satisfied ------------------------------------
if [ $GATE -eq 0 ]; then
  echo "  A completed sweep is ready and the interval has passed."
  printf "  Publish it now? [y/N] "
  read -r ans
  case "$ans" in [yY]*) publish_now normal ;; *) echo "  Nothing done."; pause_exit ;; esac
fi

# ---- completed sweep, held --------------------------------------------------
if [ $GATE -eq 10 ]; then
  echo "  A completed sweep is HELD until the 7-day minimum is reached."
  echo "  It is safe on disk. Nothing will overwrite it."
  echo ""
  printf "  Publish early anyway? [y/N] "
  read -r ans
  case "$ans" in [yY]*) publish_now force ;; *) echo "  Left as is."; pause_exit ;; esac
fi

# ---- partial slice sweep open -----------------------------------------------
if [ -f .scan-progress.json ]; then
  echo "  A partial sweep is in progress, built from daily slices."
  echo "  Its rows were read on different days, so the edition would be"
  echo "  a smear across that window rather than a clean snapshot."
  echo ""
  printf "  Discard it and run a FULL scan in one pass? [y/N] "
  read -r ans
  if [[ "$ans" == [yY]* ]]; then
    confirm_scan && run_full_scan
    echo "  Cancelled."
    pause_exit
  fi
  echo "  Left running on daily slices."
  pause_exit
fi

# ---- nothing open, nothing pending ------------------------------------------
echo "  No sweep open and nothing waiting to publish."
echo ""
printf "  Start a FULL scan now? [y/N] "
read -r ans
if [[ "$ans" == [yY]* ]]; then
  confirm_scan && run_full_scan
  echo "  Cancelled."
  pause_exit
fi
echo "  Nothing done."
pause_exit
