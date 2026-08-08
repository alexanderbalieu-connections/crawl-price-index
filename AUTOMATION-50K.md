# Fully automated 50k scan — gentle daily slices (zero clicks)

Runs itself a little every day. Each daily session scans for ~15 minutes then
stops and saves its place; after ~4 days a full 50,000-domain sweep is done,
the site republishes, and a fresh cycle begins. You never open anything, and
your Mac only needs to be online for a few minutes a day.

## Why daily slices (your idea — it's the better design)
- **Gentle on your IP**: short ~15-min sessions look like normal traffic, not a
  60-minute spike that could get your home connection flagged.
- **Resilient**: if your Mac is asleep/offline on a given day, that slice just
  happens the next day. Nothing is ever lost — progress is checkpointed.
- **Safe**: the site only republishes when a FULL sweep completes and passes the
  health gate. A partial or thin scan never touches the live data.

Net effect: the published numbers refresh roughly weekly, built from painless
daily slices. (Weekly is the cadence competitors update at, if ever.)

## Files
- `run-big.cjs` — resumable, time-boxed slice scanner (reads scan-config.json)
- `run-weekly.command` — what the scheduler runs daily; publishes only when a
  full sweep finishes
- `com.crawlpriceindex.weekly.plist` — schedule: every day 06:00, catches up on wake
- `scan-config.json` — top_n 50000, daily_minutes 15 (change either to tune)

## One-time install (with Claude, after git setup)
    FOLDER="$HOME/Downloads/crawl-price-index"
    sed "s|__FOLDER__|$FOLDER|g" com.crawlpriceindex.weekly.plist > ~/Library/LaunchAgents/com.crawlpriceindex.weekly.plist
    launchctl load ~/Library/LaunchAgents/com.crawlpriceindex.weekly.plist
    # optional: run a slice right now to watch it
    launchctl start com.crawlpriceindex.weekly
    tail -f scan.log      # Ctrl-C to stop watching

Done. It now runs a slice daily by itself. `scan.log` shows what each run did.

## Tuning
- Bigger/smaller sweep: edit `top_n` in scan-config.json (25000, 100000…).
- Longer/shorter daily sessions: edit `daily_minutes` (10 = gentler/slower to
  complete, 20 = faster).
- If your IP ever gets throttled, the scan auto-slows; you can also drop top_n.

## Honest expectations
- Many domains return `no_robots` — normal; what matters is the tens of
  thousands that parse, far beyond any competitor.
- First run downloads the Tranco top-1M list (~30MB) once.
- A full sweep spans ~4 days of ~15-min sessions; publish happens on completion.
