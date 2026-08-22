#!/usr/bin/env node
// CHANGE ALERTS — the recurring workflow both reviews said was missing.
// Diffs this week's harvest against the snapshot the last alert run used,
// per watched domain, and emails ONLY when something actually changed.
// Preview: node send-alerts.cjs        Send: node send-alerts.cjs --send
const fs = require("fs");

const API = "https://api.crawlpriceindex.com";
const CUR = "scan-robots-full.csv";
const LAST = "last-alert-robots.csv";
const SEND = process.argv.includes("--send");

if (!fs.existsSync(CUR)) { console.error("no " + CUR + " - run a full sweep first"); process.exit(1); }

function loadCSV(p) {
  const lines = fs.readFileSync(p, "utf8").trim().split("\n");
  const H = lines.shift().split(",");
  const out = {};
  for (const l of lines) {
    const c = l.split(",");
    const o = {};
    H.forEach((k, i) => o[k] = c[i]);
    if (o.domain) out[o.domain] = o;
  }
  return { rows: out, cols: H };
}

const cur = loadCSV(CUR);
const BOTS = cur.cols.filter(c => c !== "rank" && c !== "domain");
const prev = fs.existsSync(LAST) ? loadCSV(LAST).rows : null;

if (!prev) {
  console.log("No previous alert snapshot yet - this run establishes the baseline.");
  if (SEND) { fs.copyFileSync(CUR, LAST); console.log("baseline saved to " + LAST); }
  process.exit(0);
}

// ---- who is watching what ----
const token = fs.readFileSync(".admin-token", "utf8").trim();
(async () => {
  let watches = [];
  try {
    const r = await fetch(API + "/v1/watches", { headers: { "x-admin-token": token } });
    const j = await r.json();
    watches = j.watches || [];
  } catch (e) { console.error("could not list watches:", String(e)); process.exit(1); }

  if (!watches.length) { console.log("no active watches - nothing to do"); if (SEND) fs.copyFileSync(CUR, LAST); process.exit(0); }

  const byEmail = {};
  let totalChanges = 0;
  for (const w of watches) {
    const a = prev[w.domain], b = cur.rows[w.domain];
    if (!a || !b) continue;
    const changes = [];
    for (const bot of BOTS) {
      if (!a[bot] || !b[bot] || a[bot] === b[bot]) continue;
      if (a[bot] === "no_robots" || b[bot] === "no_robots") continue;
      changes.push({ bot, from: a[bot], to: b[bot] });
    }
    if (changes.length) {
      (byEmail[w.email] = byEmail[w.email] || []).push({ domain: w.domain, changes });
      totalChanges += changes.length;
    }
  }

  const emails = Object.keys(byEmail);
  console.log("watches: " + watches.length + " · domains changed: " + Object.values(byEmail).reduce((n, d) => n + d.length, 0) + " · individual changes: " + totalChanges + " · recipients: " + emails.length);
  if (!emails.length) { console.log("nothing changed for any watched domain this week"); if (SEND) fs.copyFileSync(CUR, LAST); process.exit(0); }

  const verb = c => c.to === "blocked" ? "now BLOCKS" : (c.from === "blocked" ? "no longer blocks" : c.from + " -> " + c.to);
  for (const email of emails) {
    const items = byEmail[email];
    const subject = items.length === 1
      ? "Access change: " + items[0].domain + " (" + items[0].changes.length + ")"
      : "Access changes on " + items.length + " domains you watch";
    const text = "CRAWL PRICE INDEX - ACCESS ALERT\n\n" + items.map(it =>
      it.domain + "\n" + it.changes.map(c => "  " + c.bot + ": " + verb(c)).join("\n")).join("\n\n")
      + "\n\nChecked against this week's scan of the Tranco top 50,000. Full per-domain data: https://app.crawlpriceindex.com";
    const html = '<!doctype html><html><body style="margin:0;background:#ffffff;padding:28px 12px">'
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#f5f1e8;border:1px solid #e4dcc7;border-radius:4px;overflow:hidden">'
      + '<tr><td style="background:#0d2b23;padding:22px 32px;border-bottom:3px solid #c9a24b"><div style="font-family:ui-monospace,Menlo,monospace;font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#f5f1e8">Access Alert</div>'
      + '<div style="font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#c9a24b;margin-top:5px">what changed on the domains you watch</div></td></tr>'
      + items.map(it => '<tr><td style="padding:24px 32px 6px">'
          + '<div style="font-family:Georgia,\'Times New Roman\',serif;font-size:19px;color:#0d2b23">' + it.domain + '</div>'
          + '<table role="presentation" width="100%" style="margin-top:8px;font-family:ui-monospace,Menlo,monospace;font-size:13px">'
          + it.changes.map(c => '<tr style="border-bottom:1px solid #e4dcc7"><td style="padding:8px 8px 8px 0;color:#0d2b23">' + c.bot + '</td>'
              + '<td align="right" style="padding:8px 0;color:' + (c.to === "blocked" ? "#A33A2A" : "#1c5d4a") + '">' + verb(c) + '</td></tr>').join("")
          + '</table></td></tr>').join("")
      + '<tr><td style="padding:16px 32px 4px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:12.5px;line-height:1.6;color:#28352f">'
      + 'Observed in this week&rsquo;s scan of the Tranco top 50,000 by our signed crawler. Declarations are what the site publishes in robots.txt &mdash; see <a href="https://crawlpriceindex.com/methodology.html" style="color:#1c5d4a">methodology</a> for what we do and do not measure.</td></tr>'
      + '<tr><td style="padding:14px 32px 26px"><a href="https://app.crawlpriceindex.com" style="display:inline-block;background:#1c5d4a;color:#f5f1e8;font-family:ui-monospace,Menlo,monospace;font-size:13px;padding:12px 22px;text-decoration:none;border-radius:3px">Full per-domain dataset &rarr;</a></td></tr>'
      + '<tr><td style="padding:0 32px 22px;background:#eee7d6;border-top:1px solid #ded4bd"><p style="margin:14px 0 0;font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#6b6152">The Crawl Price Index &middot; <a href="https://crawlpriceindex.com" style="color:#1c5d4a">crawlpriceindex.com</a></p></td></tr>'
      + '</table></body></html>';
    console.log("\n--- " + email + " ---\n" + text);
    if (SEND) {
      const r = await fetch(API + "/v1/alert", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ email, subject, text, html }),
      });
      console.log("  sent:", r.status);
    }
  }
  if (SEND) { fs.copyFileSync(CUR, LAST); console.log("\nsnapshot updated - next run diffs against today"); }
  else console.log("\nPreview only. Send: node send-alerts.cjs --send");
})();
