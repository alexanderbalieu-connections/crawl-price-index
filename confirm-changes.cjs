#!/usr/bin/env node
/**
 * CPI — separate confirmed policy changes from unconfirmed ones
 * ===========================================================================
 * The change feed says "161 crawler×domain status changes across 27 domains".
 * Those are already net of availability flips — cells entering or leaving
 * no_robots are counted separately (26,532 cells / 1,474 domains this
 * edition) and labelled as fetch availability, not a publisher decision.
 *
 * What has never been measured is the residual: of changes between two
 * domains that were readable in BOTH scans, how many survive a re-fetch?
 *
 * TWO CHEAP IDEAS MAKE THIS SMALL.
 *
 * 1. ONLY THE CHANGED DOMAINS NEED RE-FETCHING. 27 domains, not 50,000.
 *
 * 2. THE ARTEFACT IS ASYMMETRIC, AND THAT BOUNDS THE PROBLEM.
 *    The realistic fetch artefact is a truncated or partially-served
 *    robots.txt: rules that were there go missing, so cells fall TOWARD
 *    `unlisted`. Truncation cannot invent a Disallow line. So:
 *
 *      RULE-LOSS  (x -> unlisted)   64 of 161 = 39.8%  <- fakeable
 *      RULE-GAIN  (unlisted -> x)   94 of 161 = 58.4%  <- structurally immune
 *      OTHER                         3
 *
 *    At most ~40% of this edition's changes are of a kind a truncation could
 *    manufacture, and 58% are of a kind it cannot. That is a real bound, for
 *    free, before a single extra request.
 *
 *    CAVEAT, and it is a real one: the asymmetry is not absolute. A
 *    truncation in the PREVIOUS edition produces an apparent rule-gain in
 *    this one. The archived raw bodies fix that — once robots-archive has two
 *    editions, the prior body can be checked directly instead of trusted.
 *    Until then, rule-gain is "probably real", not "proven real".
 *
 * WHAT THIS SCRIPT DOES
 *   Re-fetches every domain that produced a change, twice, spaced apart, with
 *   the production user-agent. Then classifies every changed cell:
 *
 *     confirmed    the new state reproduces in >=2 of 2 re-fetches
 *     unconfirmed  the re-fetches disagree with the edition observation
 *     unstable     the two re-fetches disagree with EACH OTHER
 *     unreachable  the domain would not serve robots.txt on re-fetch
 *
 * It writes change-confirmation.json and prints a publishable sentence.
 * It does NOT rewrite the change feed, the dashboard, or any history. It
 * measures. What to publish is a separate decision.
 *
 * RUN:  node confirm-changes.cjs            (after compute-domains.cjs)
 *       node confirm-changes.cjs --gap 600  (seconds between re-fetches)
 */
const fs = require("fs");

const GAP_S = Number((process.argv.find((a) => a.startsWith("--gap")) || "").split("=")[1] ||
  process.argv[process.argv.indexOf("--gap") + 1] || 300);
const UA = "CrawlPriceIndexBot/1.0 (crawl-economy measurement; robots.txt study; contact: hello@crawlpriceindex.com)";
const CONC = 8;
const TIMEOUT_MS = 12000;

/* ---- what changed, from the edition the dashboard is built on ----------- */
const D = JSON.parse(fs.readFileSync("app/data/dashboard.json", "utf8"));
if (!D.changes || !D.changes.available) { console.log("no change data in this edition"); process.exit(0); }

const ROBOTS_BOTS = D.crawlers.map((c) => c.name);
const items = D.changes.items || [];
if (!items.length) {
  console.log("The dashboard feed carries a SAMPLE of items (" + D.changes.items_total + " total).");
  console.log("Point this at the full per-domain change list to confirm every cell;");
  console.log("what follows confirms the " + items.length + " sampled cells only.");
}
const domains = [...new Set(items.map((i) => i.domain))];
if (!domains.length) { console.log("no changed domains to re-fetch"); process.exit(0); }

/* ---- the asymmetry bound, computed before any request ------------------- */
const tr = D.changes.transitions || {};
let loss = 0, gain = 0, other = 0;
for (const [k, n] of Object.entries(tr)) {
  const [a, b] = k.split("->");
  if (b === "unlisted" && a !== "unlisted") loss += n;
  else if (a === "unlisted" && b !== "unlisted") gain += n;
  else other += n;
}
const tot = loss + gain + other;

/* ---- fetch + parse, identical to the production path -------------------- */
function parseRobots(txt) {
  const result = {}; if (!txt) return result;
  const lines = txt.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim());
  let cur = [], rules = {}, lastAgent = false;
  for (const line of lines) {
    const m = line.match(/^user-agent\s*:\s*(.+)$/i);
    if (m) { if (!lastAgent) cur = []; cur.push(m[1].trim().toLowerCase()); lastAgent = true; for (const a of cur) if (!rules[a]) rules[a] = { dis: [] }; continue; }
    lastAgent = false;
    const d = line.match(/^disallow\s*:\s*(.*)$/i);
    if (d) for (const a of cur) rules[a]?.dis.push(d[1].trim());
  }
  for (const bot of ROBOTS_BOTS) {
    const r = rules[bot.toLowerCase()];
    if (!r) result[bot] = "unlisted";
    else if (r.dis.includes("/")) result[bot] = "blocked";
    else if (r.dis.every((x) => x === "")) result[bot] = "allowed";
    else result[bot] = "partial";
  }
  return result;
}

async function getRobots(domain) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch("https://" + domain + "/robots.txt",
      { headers: { "user-agent": UA, accept: "text/plain,*/*" }, redirect: "follow", signal: ctl.signal });
    if (r.status !== 200) { try { r.body?.cancel(); } catch {} return { ok: false, status: r.status }; }
    const body = (await r.text()).slice(0, 500000);
    if (/^\s*</.test(body)) return { ok: false, status: 200, html: true };
    return { ok: true, status: 200, body, bytes: body.length };
  } catch (e) {
    return { ok: false, status: 0, err: e.name === "AbortError" ? "timeout" : (e.cause?.code || "err") };
  } finally { clearTimeout(t); }
}

async function sweep(label) {
  const out = {}; const q = domains.slice();
  await Promise.all(Array.from({ length: CONC }, async () => {
    for (;;) {
      const d = q.shift(); if (!d) return;
      const r = await getRobots(d);
      out[d] = r.ok ? { states: parseRobots(r.body), bytes: r.bytes } : { fail: r.status === 0 ? (r.err || "net") : "http_" + r.status };
    }
  }));
  const okN = Object.values(out).filter((x) => !x.fail).length;
  console.log("  " + label + ": " + okN + "/" + domains.length + " readable");
  return out;
}

(async () => {
  console.log("=".repeat(74));
  console.log("CHANGE CONFIRMATION");
  console.log("=".repeat(74));
  console.log("edition " + D.edition + "  ·  " + D.changes.total_changes + " changes across " +
    D.changes.changed_domains + " domains  ·  re-fetching " + domains.length + " domains");
  console.log("");
  console.log("BOUND BEFORE ANY REQUEST — a truncated robots.txt loses rules, it cannot invent them:");
  console.log("  rule-loss  (x -> unlisted)   " + String(loss).padStart(4) + "   " + (loss / tot * 100).toFixed(1) + "%   fakeable by truncation");
  console.log("  rule-gain  (unlisted -> x)   " + String(gain).padStart(4) + "   " + (gain / tot * 100).toFixed(1) + "%   structurally immune*");
  console.log("  other                        " + String(other).padStart(4));
  console.log("  * immune to truncation in THIS scan. A truncation in the PREVIOUS edition");
  console.log("    still shows up here as an apparent gain. robots-archive fixes that once");
  console.log("    two editions exist — the prior body can be read instead of trusted.");
  console.log("");

  const a = await sweep("re-fetch 1");
  console.log("  waiting " + GAP_S + "s…");
  await new Promise((r) => setTimeout(r, GAP_S * 1000));
  const b = await sweep("re-fetch 2");

  /* ---- classify every changed cell -------------------------------------- */
  const verdict = { confirmed: [], unconfirmed: [], unstable: [], unreachable: [] };
  for (const it of items) {
    const ra = a[it.domain], rb = b[it.domain];
    const row = { domain: it.domain, rank: it.rank, crawler: it.crawler, prev: it.prev, cur: it.cur };
    if (!ra || !rb || ra.fail || rb.fail) { row.why = (ra?.fail || "") + "/" + (rb?.fail || ""); verdict.unreachable.push(row); continue; }
    const sa = ra.states[it.crawler], sb = rb.states[it.crawler];
    row.refetch = [sa, sb];
    if (sa !== sb) verdict.unstable.push(row);
    else if (sa === it.cur) verdict.confirmed.push(row);
    else verdict.unconfirmed.push(row);
  }

  const n = items.length;
  const pc = (x) => n ? (x / n * 100).toFixed(1) + "%" : "—";

  /* A run where almost nothing resolves is a local network failure, not a
     finding about publishers. Caught the first time this was tested: every
     domain returned EAI_AGAIN and the script cheerfully reported "0 of 15
     confirmed", which would have been a catastrophic thing to believe. */
  const unreachRate = n ? verdict.unreachable.length / n : 0;
  if (unreachRate > 0.5) {
    console.log("");
    console.log("!! RUN INVALID — " + pc(verdict.unreachable.length) + " of cells unreachable.");
    console.log("   That is a local network or DNS problem, not publisher behaviour.");
    console.log("   No verdict is written. Re-run from a machine with working outbound DNS");
    console.log("   (the same machine the weekly sweep runs on).");
    process.exit(2);
  }
  console.log("");
  console.log("VERDICT on " + n + " re-checked cells:");
  console.log("  confirmed    " + String(verdict.confirmed.length).padStart(4) + "   " + pc(verdict.confirmed.length) + "   new state reproduced in both re-fetches");
  console.log("  unconfirmed  " + String(verdict.unconfirmed.length).padStart(4) + "   " + pc(verdict.unconfirmed.length) + "   re-fetch disagrees with the edition");
  console.log("  unstable     " + String(verdict.unstable.length).padStart(4) + "   " + pc(verdict.unstable.length) + "   the two re-fetches disagree with each other");
  console.log("  unreachable  " + String(verdict.unreachable.length).padStart(4) + "   " + pc(verdict.unreachable.length) + "   would not serve robots.txt on re-fetch");
  for (const k of ["unconfirmed", "unstable", "unreachable"])
    verdict[k].slice(0, 8).forEach((r) => console.log("     [" + k + "] #" + r.rank + " " + r.domain + " " + r.crawler +
      " " + r.prev + "->" + r.cur + (r.refetch ? "  refetch " + r.refetch.join("/") : "  " + r.why)));

  fs.writeFileSync("change-confirmation.json", JSON.stringify({
    generated_utc: new Date().toISOString(), edition: D.edition,
    scope: D.changes.items_sample ? "sample of " + D.changes.items_total : "full",
    rechecked: n, gap_seconds: GAP_S,
    asymmetry: { rule_loss: loss, rule_gain: gain, other, total: tot },
    counts: Object.fromEntries(Object.entries(verdict).map(([k, v]) => [k, v.length])),
    verdict,
  }, null, 1));

  console.log("");
  console.log("wrote change-confirmation.json");
  console.log("");
  console.log("PUBLISHABLE SENTENCE — house pattern, both numbers, one sentence:");
  console.log('  "' + D.changes.total_changes + " crawler×domain status changes across " + D.changes.changed_domains +
    " domains that were readable in both");
  console.log('   scans (' + verdict.confirmed.length + " of " + n + " re-checked cells confirmed on re-fetch); a further " +
    (D.changes.availability?.cells ?? "—"));
  console.log('   cells across ' + (D.changes.availability?.domains ?? "—") +
    ' domains moved only because the file became reachable or');
  console.log('   unreachable, and are counted separately."');
  console.log("");
  console.log("NOT DONE HERE, ON PURPOSE: this does not rewrite the feed, the dashboard, or any");
  console.log("published edition. It measures. Whether to publish, and how to label the five");
  console.log("editions collected before this rule existed, is a separate decision.");
})();
