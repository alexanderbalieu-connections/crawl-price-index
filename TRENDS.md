# Trends — the compounding moat

## Why this is the most important feature
Today's numbers are facts — copyable by anyone. The *history* of how those
numbers moved is NOT copyable by a competitor who started measuring later.
Every scan snapshots the crawl economy; over weeks and months this becomes the
only record of the trends. That's what a Terminal subscriber is really buying,
and what no latecomer can reconstruct.

## Files
- archive.cjs — after each scan, writes history/<date>.json + history-index.json
- trends.cjs  — diffs snapshots into week/month/quarter/year deltas + "movers"
                → trends.json (goes in PAID dataset) + trends-public.json (teaser)
- history/    — the accumulating dated snapshots. COMMIT THESE — they are the asset.

## Automatic
rebuild.cjs now runs archive + trends and folds trends into paid-dataset.json.
run-weekly.command commits history/ so the series persists week to week.
You do nothing — it accrues on its own.

## Honesty built in
- 1 snapshot (today) → "baseline", NO fabricated deltas.
- 2-4 snapshots → "early", real deltas where windows can be filled.
- 5+ → "established". Windows only populate when a real past snapshot exists
  within half the window (a "monthly" delta is never secretly a weekly one).

## What subscribers get (in paid-dataset.json under `trends`)
- observed_price_usd: is the going crawl rate rising? (flagship)
- block_rates[bot]: each crawler's block-rate trajectory
- country_any_ai[country]: per-country blocking over time
- signal_adoption: TollBit / licensing-402 / PPC spread over time
- movers: biggest ranked changes this month & quarter

## What the public sees (trends-public.json)
Top-3 movers, direction only (▲/▼), magnitudes hidden — subscribe to see
the numbers and the full history. Baseline message until history exists.

## The pitch this enables
"Anyone can tell you France blocks 71% today. Only we can tell you it was 60%
in May and is climbing 4 points a month." That sentence sells subscriptions and
cannot be said by a copycat. Start date = your unfair advantage. Every week widens it.
