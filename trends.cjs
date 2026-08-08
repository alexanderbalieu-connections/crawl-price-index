#!/usr/bin/env node
/**
 * CRAWL PRICE INDEX — TRENDS ENGINE  (node trends.cjs)
 * ====================================================
 * Turns the accumulating history/ snapshots into trend intelligence:
 * deltas over week / month / quarter / year, trajectories, and "movers".
 * This is the paid-tier crown jewel — the record no latecomer can rebuild.
 *
 * Reads:  history/*.json, history-index.json
 * Writes: trends.json          — full trend data (goes in PAID dataset)
 *         trends-public.json   — a small "top movers" teaser (public site)
 *
 * Degrades honestly: with 1 snapshot it reports "baseline established, deltas
 * accrue from here" and invents NO movement. Windows only populate once real
 * history exists to fill them.
 */
const fs = require("fs");
const path = require("path");

if (!fs.existsSync("history-index.json")) {
  console.error("no history yet — run archive.cjs after a scan first");
  process.exit(1);
}
const idx = JSON.parse(fs.readFileSync("history-index.json", "utf8"));
const snaps = idx.dates.map(d => JSON.parse(fs.readFileSync(path.join("history", d + ".json"), "utf8")));
const latest = snaps[snaps.length - 1];
const today = new Date(latest.date);

// find the snapshot closest to N days ago (for a given window)
function snapshotNDaysAgo(days) {
  const target = new Date(today); target.setDate(target.getDate() - days);
  let best = null, bestGap = Infinity;
  for (const s of snaps) {
    if (s.date === latest.date) continue;
    const gap = Math.abs(new Date(s.date) - target);
    if (gap < bestGap) { bestGap = gap; best = s; }
  }
  // only accept if within half the window (so a "month" delta isn't secretly a week)
  return best && bestGap <= days * 0.5 * 86400000 ? best : null;
}

const WINDOWS = { week: 7, month: 30, quarter: 91, year: 365 };

// compute deltas for one scalar metric across all windows
function deltaSet(getter) {
  const now = getter(latest);
  const out = { current: now };
  for (const [name, days] of Object.entries(WINDOWS)) {
    const past = snapshotNDaysAgo(days);
    if (past == null || now == null) { out[name] = null; continue; }
    const then = getter(past);
    if (then == null) { out[name] = null; continue; }
    out[name] = { from: then, to: now, change: +(now - then).toFixed(2), from_date: past.date };
  }
  return out;
}

const bots = Object.keys(latest.block_rates || {});
const countries = Object.keys(latest.country_any_ai || {});

const trends = {
  generated_utc: new Date().toISOString(),
  history_span: { first: idx.first_snapshot, latest: idx.latest_snapshot, points: idx.snapshot_count },
  maturity: idx.snapshot_count === 1
    ? "baseline"
    : idx.snapshot_count < 5 ? "early" : "established",
  note: idx.snapshot_count === 1
    ? "Baseline snapshot established today. Week/month/quarter/year deltas populate automatically as history accrues. This record cannot be backfilled by anyone who started later."
    : `Trends computed from ${idx.snapshot_count} dated snapshots spanning ${idx.first_snapshot} → ${idx.latest_snapshot}.`,

  // flagship: is the observed crawl price moving?
  observed_price_usd: deltaSet(s => s.top_observed_price_usd),

  // per-bot block-rate trajectories
  block_rates: Object.fromEntries(bots.map(b => [b, deltaSet(s => s.block_rates?.[b])])),

  // signal adoption spread over time (TollBit, licensing, PPC posture)
  signal_adoption: {
    tollbit_gated: deltaSet(s => s.signal_counts?.tollbit_gated),
    licensing_402: deltaSet(s => s.signal_counts?.licensing_402),
    declares_free: deltaSet(s => s.signal_counts?.declares_free),
  },

  // per-country blocking trajectories
  country_any_ai: Object.fromEntries(countries.map(c => [c, deltaSet(s => s.country_any_ai?.[c])])),
};

// ---- "movers": the biggest changes, ranked — the sellable headline ----------
function collectMovers(window) {
  const movers = [];
  for (const b of bots) {
    const d = trends.block_rates[b][window];
    if (d && Math.abs(d.change) >= 0.1) movers.push({ metric: `${b} block rate`, ...d, unit: "pp" });
  }
  for (const c of countries) {
    const d = trends.country_any_ai[c][window];
    if (d && Math.abs(d.change) >= 0.1) movers.push({ metric: `${c} AI-blocking`, ...d, unit: "pp" });
  }
  const pd = trends.observed_price_usd[window];
  if (pd && Math.abs(pd.change) >= 0.01) movers.push({ metric: "Top observed crawl price", ...pd, unit: "USD" });
  return movers.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}
trends.movers = {
  month: collectMovers("month"),
  quarter: collectMovers("quarter"),
};

fs.writeFileSync("trends.json", JSON.stringify(trends));

// ---- public teaser: just the top 3 movers (or the baseline message) ---------
const topMovers = (trends.movers.month.length ? trends.movers.month : trends.movers.quarter).slice(0, 3);
const trendsPublic = {
  maturity: trends.maturity,
  history_span: trends.history_span,
  headline: trends.maturity === "baseline"
    ? "Trend tracking began " + idx.first_snapshot + ". The crawl economy's month-over-month movements — which bots, which countries, and whether prices are climbing — become available here as history builds. This is the record no competitor who started later can reconstruct."
    : `Biggest movers over the last month, from ${idx.snapshot_count} dated snapshots since ${idx.first_snapshot}.`,
  top_movers_teaser: topMovers.map(m => ({
    metric: m.metric,
    direction: m.change > 0 ? "up" : "down",
    // teaser hides the exact number — subscribe to see magnitudes + full history
    locked: true,
  })),
  full_trends: "Terminal subscription — full deltas, all windows, every metric, complete history.",
};
fs.writeFileSync("trends-public.json", JSON.stringify(trendsPublic, null, 2));

console.log(`Trends computed. Maturity: ${trends.maturity} (${idx.snapshot_count} snapshot(s)).`);
if (trends.maturity === "baseline") {
  console.log("  No deltas yet — today is the baseline. Real trends appear from the 2nd scan onward.");
} else {
  console.log(`  Top movers this month: ${trends.movers.month.slice(0,3).map(m=>m.metric).join(", ") || "none yet"}`);
}
