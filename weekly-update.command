#!/bin/bash
# ============================================================================
#  THE CRAWL PRICE INDEX — WEEKLY UPDATE  (double-click to run)
# ----------------------------------------------------------------------------
#  This is your entire weekly job. Double-click this file in Finder.
#  It scans the web, rebuilds the site data, and publishes. Then close it.
#
#  What it does, in order:
#    1. scan.cjs      — fetches robots.txt + headers across the web
#    2. rebuild.cjs   — turns the scan into the live site data (safely)
#    3. git push      — publishes; Cloudflare auto-deploys in ~30s
#
#  If the scan comes back broken (bad wifi, a site blocks you), rebuild.cjs
#  refuses to publish and your live site is left untouched. Safe to re-run.
# ============================================================================

# cd to the folder this script lives in, whatever the machine
cd "$(dirname "$0")" || exit 1

echo ""
echo "  ┌─────────────────────────────────────────────┐"
echo "  │   THE CRAWL PRICE INDEX · weekly update      │"
echo "  └─────────────────────────────────────────────┘"
echo ""

# --- 0. checks ---
command -v node >/dev/null 2>&1 || { echo "  ✗ Node isn't installed. Install from nodejs.org, then re-run."; echo ""; read -p "  Press Enter to close."; exit 1; }
command -v git  >/dev/null 2>&1 || { echo "  ✗ Git isn't installed. Run 'xcode-select --install', then re-run."; echo ""; read -p "  Press Enter to close."; exit 1; }

# --- 1. scan ---
echo "  [1/3] Scanning the web… (a few minutes — grab a coffee)"
echo ""
# Change --top 2000 to --top 10000 once you've seen a clean run.
node scan.cjs --top 2000 || { echo ""; echo "  ✗ Scan failed. Check your internet and re-run."; echo ""; read -p "  Press Enter to close."; exit 1; }
echo ""

# --- 2. rebuild (safe: aborts if scan is broken) ---
echo "  [2/3] Rebuilding site data…"
echo ""
if ! node rebuild.cjs; then
  echo ""
  echo "  ⚠  Rebuild declined to publish (scan looked thin). Your LIVE site is unchanged."
  echo "     This is the safety net working. Try again later — nothing is broken."
  echo ""
  read -p "  Press Enter to close."
  exit 0
fi
echo ""

# --- 3. publish ---
echo "  [3/3] Publishing…"
echo ""
git add index.json index.html world.html scan-robots.csv scan-signals.csv scan-summary.json 2>/dev/null
if git diff --cached --quiet; then
  echo "  Nothing changed since last run — nothing to publish."
else
  git commit -m "Weekly scan $(date +%Y-%m-%d)" >/dev/null 2>&1
  if git push >/dev/null 2>&1; then
    echo "  ✓ Published. Cloudflare will show the new numbers in ~30 seconds."
    echo "    (This week's data is now permanent history — the part nobody can copy.)"
  else
    echo "  ⚠  Committed locally but the push failed (auth or offline)."
    echo "     Your data is saved. Fix connection and run again, or 'git push' manually."
  fi
fi

echo ""
echo "  Done. You can close this window."
echo ""
read -p "  Press Enter to close."
