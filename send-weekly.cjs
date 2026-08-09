#!/usr/bin/env node
// THE WEEKLY CRAWL v3 — movers engine (named weekly deltas from the 50k rows).
// Preview: node send-weekly.cjs   Send: --send   Bypass 20h lock: --send --force
const fs = require("fs");
const sum = JSON.parse(fs.readFileSync("scan-summary.json", "utf8"));
let trends = null, paid = null;
try { trends = JSON.parse(fs.readFileSync("trends.json", "utf8")); } catch {}
try { paid = JSON.parse(fs.readFileSync("paid-dataset.json", "utf8")); } catch {}
const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const BOTS = Object.keys(sum.block_rates);

// ---- movers: diff current full harvest vs last-sent snapshot ----
const CUR = "scan-robots-full.csv", LAST = "last-sent-robots.csv";
function loadCSV(p) {
  const lines = fs.readFileSync(p, "utf8").trim().split("\n");
  const H = lines.shift().split(",");
  return lines.map(l => { const c = l.split(","); const o = {}; H.forEach((k, i) => o[k] = c[i]); return o; });
}
let movers = null;
if (fs.existsSync(CUR) && fs.existsSync(LAST)) {
  const cur = loadCSV(CUR), lastMap = new Map(loadCSV(LAST).map(r => [r.domain, r]));
  const flips = [], botGain = {};
  for (const r of cur) {
    const p = lastMap.get(r.domain); if (!p) continue;
    for (const b of BOTS) {
      const a = p[b], n = r[b];
      if (!a || !n || a === n || a === "no_robots" || n === "no_robots") continue;
      flips.push({ domain: r.domain, rank: +r.rank, bot: b, from: a, to: n });
      if (n === "blocked") botGain[b] = (botGain[b] || 0) + 1;
      else if (a === "blocked") botGain[b] = (botGain[b] || 0) - 1;
    }
  }
  if (flips.length) {
    flips.sort((x, y) => x.rank - y.rank);
    let top = null;
    for (const [b, d] of Object.entries(botGain)) if (!top || Math.abs(d) > Math.abs(top[1])) top = [b, d];
    const spotDomain = flips[0].domain;
    const spotRow = cur.find(r => r.domain === spotDomain);
    const spotBlocked = spotRow ? BOTS.filter(b => spotRow[b] === "blocked").length : 0;
    movers = {
      domains: new Set(flips.map(f => f.domain)).size,
      total: flips.length,
      top5: flips.slice(0, 5),
      botTop: top,
      spot: { domain: spotDomain, blocked: spotBlocked, of: BOTS.length, flip: flips[0] },
    };
  }
}

// ---- core numbers ----
const delta = b => { const v = trends && trends.block_rates && trends.block_rates[b]; return v && v.week != null ? v.week : null; };
const rows = Object.entries(sum.block_rates).slice(0, 6).map(([b, v]) => ({ bot: b, pct: v.rate_pct, d: delta(b) }));
const maxPct = Math.max(...rows.map(r => r.pct));
const priceRaw = (sum.panel && sum.panel.prices && sum.panel.prices[0]) || "stackoverflow.com: USD 0.50";
const priceNum = (priceRaw.match(/(\d[\d.]*)/) || [null, "0.50"])[1];
const nRows = paid && paid.per_domain ? paid.per_domain.length : 0;
const nCountries = paid && paid.country_editions ? Object.keys(paid.country_editions).length : 0;
const nHist = trends && trends.history_span ? trends.history_span.points : 1;
const gpt = sum.block_rates.GPTBot ? sum.block_rates.GPTBot.rate_pct : 0;
const sigLine = paid && paid.signals
  ? "TollBit-gated: " + paid.signals.tollbit_gated.length + " · licensing-402: " + paid.signals.licensing_402.length + " · declares-free: " + paid.signals.declares_free.length
  : "6 signal dialects tracked";
const flipWord = f => f.to === "blocked" ? "now BLOCKS" : f.from === "blocked" ? "UNBLOCKED" : f.from + " → " + f.to;
const dTxt = d => d == null ? "—" : (d > 0 ? "▲ +" + d : d < 0 ? "▼ " + d : "· 0") + " pts";

const subject = movers
  ? "The Weekly Crawl — " + movers.domains + " domains changed their AI policy · " + movers.spot.domain.replace(/^www\./, "") + " " + flipWord(movers.spot.flip).toLowerCase() + " " + movers.spot.flip.bot
  : "The Weekly Crawl — GPTBot blocked by " + gpt + "% of the top web · a crawl costs $" + priceNum;

// ---- text version ----
const moversText = movers ? `
THIS WEEK'S MOVES — ${movers.domains} domains changed AI-crawler policy (${movers.total} individual changes):
${movers.top5.map(f => "  #" + f.rank + " " + f.domain.padEnd(26) + " " + flipWord(f) + " " + f.bot).join("\n")}
Biggest shift: ${movers.botTop[0]} ${movers.botTop[1] > 0 ? "+" + movers.botTop[1] + " new blocks" : movers.botTop[1] + " blocks (wall receding)"}

DOMAIN SPOTLIGHT: ${movers.spot.domain} — ${flipWord(movers.spot.flip)} ${movers.spot.flip.bot}; now blocks ${movers.spot.blocked} of ${movers.spot.of} tracked crawlers. Full row in the Terminal.
` : `
THE RECORD STARTS NOW — from next issue, this section names every notable
domain that changed its AI-crawler policy that week. Nobody else keeps this list.
`;
const text = `THE WEEKLY CRAWL · ${date}
What the web charges AI to read it.
${moversText}
THE NUMBER: $${priceNum} — the observed price of one AI crawl
(${priceRaw}, via Cloudflare pay-per-crawl, x402 format)

TOP ROBOTS.TXT BLOCK RATES (WoW):
${rows.map(r => "  " + r.bot.padEnd(18) + String(r.pct).padStart(5) + "%   " + dTxt(r.d)).join("\n")}

Signals this scan: ${sigLine}
Coverage: ${sum.robots_parsed.toLocaleString()} of the Tranco top ${sum.tranco_top_n.toLocaleString()}

INSIDE THE TERMINAL (€79/mo):
  · ${nRows.toLocaleString()} per-domain rows · ${nCountries} country editions · ${nHist} week(s) of history
  → https://crawlpriceindex.com/#access

— The Crawl Price Index · https://crawlpriceindex.com`;

// ---- html version ----
const bar = r => '<td style="padding:8px 0;width:120px"><div style="background:#e8edeb;height:8px;border-radius:2px"><div style="background:#2e9e5b;height:8px;border-radius:2px;width:' + Math.round(r.pct / maxPct * 100) + '%"></div></div></td>';
const moversHtml = movers ? `
<tr><td style="padding:24px 28px 6px;font-family:ui-monospace,Menlo,monospace">
  <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#2e9e5b;border-bottom:2px solid #2e9e5b;padding-bottom:8px">This week's moves &middot; ${movers.domains} domains changed AI policy</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:ui-monospace,Menlo,monospace;font-size:12.5px">
  ${movers.top5.map(f => '<tr style="border-bottom:1px solid #eef2f0"><td style="padding:9px 8px 9px 0;color:#9aa5a1;white-space:nowrap">#' + f.rank + '</td><td style="padding:9px 8px 9px 0;color:#0b0d0e;font-weight:600">' + f.domain.replace(/^www\./, "") + '</td><td style="padding:9px 0;color:' + (f.to === "blocked" ? '#c0503c' : '#2e9e5b') + '">' + flipWord(f) + ' ' + f.bot + '</td></tr>').join("")}
  </table>
  <div style="font-size:12px;color:#3b4548;margin-top:10px;background:#f4f7f6;border-left:3px solid #2e9e5b;padding:10px 14px"><b>Spotlight — ${movers.spot.domain.replace(/^www\./, "")}:</b> ${flipWord(movers.spot.flip)} ${movers.spot.flip.bot}; now blocks ${movers.spot.blocked} of ${movers.spot.of} tracked crawlers. Its full row — and every other mover's — is in the Terminal.</div>
</td></tr>` : `
<tr><td style="padding:24px 28px 6px;font-family:ui-monospace,Menlo,monospace">
  <div style="font-size:12.5px;color:#3b4548;background:#f4f7f6;border-left:3px solid #2e9e5b;padding:12px 14px"><b>The record starts now.</b> From next issue, this space names every notable domain that changed its AI-crawler policy that week — the only public list of its kind.</div>
</td></tr>`;
const html = `<div style="background:#eef2f0;padding:24px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #dde4e1">
<tr><td style="background:#0b0d0e;padding:18px 28px">
  <div style="font-family:ui-monospace,Menlo,monospace;font-size:12px;letter-spacing:.22em;color:#3cf08a">THE WEEKLY CRAWL</div>
  <div style="font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#6b787d;margin-top:4px">${date} · what the web charges AI to read it</div>
</td></tr>
${moversHtml}
<tr><td style="padding:22px 28px 8px;font-family:ui-monospace,Menlo,monospace">
  <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6b787d">The number</div>
  <div style="font-size:42px;font-weight:700;color:#0b0d0e;margin-top:6px">$${priceNum}<span style="font-size:15px;font-weight:400;color:#6b787d"> / crawl</span></div>
  <div style="font-size:12.5px;color:#3b4548;margin-top:6px;line-height:1.5">${priceRaw.split(":")[0]} quotes this to ClaudeBot via Cloudflare pay-per-crawl — the leading edge of a market with almost no public prices.</div>
</td></tr>
<tr><td style="padding:20px 28px 4px;font-family:ui-monospace,Menlo,monospace">
  <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6b787d;border-bottom:1px solid #e3e8e6;padding-bottom:8px">Robots.txt block rates · top ${(sum.tranco_top_n / 1000)}k</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:ui-monospace,Menlo,monospace;font-size:13px">
  ${rows.map(r => '<tr style="border-bottom:1px solid #eef2f0"><td style="padding:8px 8px 8px 0;color:#0b0d0e;white-space:nowrap">' + r.bot + '</td>' + bar(r) + '<td align="right" style="padding:8px 0 8px 8px;color:#0b0d0e">' + r.pct + '%</td><td align="right" style="padding:8px 0 8px 12px;color:' + (r.d == null ? '#9aa5a1' : r.d > 0 ? '#2e9e5b' : '#c0503c') + ';white-space:nowrap;font-size:12px">' + dTxt(r.d) + '</td></tr>').join("")}
  </table>
  <div style="font-size:11.5px;color:#6b787d;margin-top:10px">${sigLine} · coverage ${sum.robots_parsed.toLocaleString()} of top ${sum.tranco_top_n.toLocaleString()}</div>
</td></tr>
<tr><td style="padding:20px 28px 28px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f6;border:1px solid #dde4e1"><tr><td style="padding:18px 20px;font-family:ui-monospace,Menlo,monospace">
    <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6b787d">&#128274; Inside the Terminal this week</div>
    <div style="font-size:13px;color:#0b0d0e;margin-top:10px;line-height:1.8">${nRows.toLocaleString()} per-domain rows — every domain &times; every crawler<br>${nCountries} country editions &middot; ${nHist} week(s) of history, compounding weekly<br>Every mover above, with its complete row &middot; JSON/CSV API</div>
    <div style="margin-top:16px"><a href="https://crawlpriceindex.com/#access" style="display:inline-block;background:#2e9e5b;color:#ffffff;font-family:ui-monospace,Menlo,monospace;font-size:13px;padding:12px 22px;text-decoration:none">Unlock the Terminal — &euro;79/mo &rarr;</a></div>
  </td></tr></table>
</td></tr>
<tr><td style="padding:0 28px 24px;font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#9aa5a1">The Crawl Price Index &middot; independent observatory of the machine-readable web &middot; <a href="https://crawlpriceindex.com" style="color:#2e9e5b">crawlpriceindex.com</a></td></tr>
</table></td></tr></table></div>`;

console.log("---- PREVIEW ------------------------------------------\nSubject: " + subject + "\n\n" + text + "\n-------------------------------------------------------");
if (!movers) console.log("(movers section: baseline — activates automatically from the 2nd send once last-sent-robots.csv exists)");
if (!process.argv.includes("--send")) { console.log("\nPreview only. Send: node send-weekly.cjs --send"); process.exit(0); }
const token = fs.readFileSync(".admin-token", "utf8").trim();
const body = { subject, text, html };
if (process.argv.includes("--force")) body.force = true;
fetch("https://api.crawlpriceindex.com/v1/broadcast", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-admin-token": token },
  body: JSON.stringify(body),
}).then(r => r.json()).then(j => {
  console.log("broadcast:", JSON.stringify(j));
  if (j.sent > 0 && fs.existsSync(CUR)) { fs.copyFileSync(CUR, LAST); console.log("snapshot saved — next issue diffs against today"); }
}).catch(e => console.error("send failed:", e));
