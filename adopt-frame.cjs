#!/usr/bin/env node
/**
 * CPI — FRAME CUTOVER to CPI-50K v1  (node adopt-frame.cjs [--dry])
 * ===========================================================================
 * Adopts the licence-clean custom Tranco list (Umbrella + Majestic only;
 * Cloudflare Radar CC BY-NC and CrUX CC BY-SA deliberately excluded) as the
 * CPI sampling frame, and filters the residual non-website junk.
 *
 *   source list : tranco-Y8V2G.csv   (permalink https://tranco-list.eu/list/Y8V2G)
 *   writes      : tranco-top-1m.csv (rank,domain) — the frame run-big.cjs reads
 *                 frame-cpi50k-v1.json — provenance + exclusion audit trail
 *
 * Excluded as non-websites (recorded, never silently dropped):
 *   - reverse-DNS zones  *.in-addr.arpa / *.ip6.arpa  (never a website)
 *   - bare public suffixes / malformed labels
 * Everything else is kept: CDN and infrastructure domains STAY in the frame,
 * because "how much of a popularity ranking isn't a website" is a published
 * CPI finding, not something to quietly clean up.
 */
const fs = require("fs");

const SRC = "tranco-Y8V2G.csv";
const LIST_ID = "Y8V2G";
const PERMALINK = "https://tranco-list.eu/list/" + LIST_ID;
const OUT = "tranco-top-1m.csv";   // the filename run-big.cjs reads
const PROV = "frame-cpi50k-v1.json";
const N = 50000;
const DRY = process.argv.includes("--dry");

if (!fs.existsSync(SRC)) { console.error("missing " + SRC); process.exit(1); }

const clean = s => (s || "").replace(/[\r\n]+$/, "").trim().toLowerCase();
const raw = fs.readFileSync(SRC, "utf8").split("\n").filter(Boolean)
  .map(l => { const p = l.split(","); return { rank: +clean(p[0]), domain: clean(p[1]) }; })
  .filter(r => r.domain && Number.isFinite(r.rank));

const ARPA = /\.(in-addr|ip6)\.arpa$/;
const MALFORMED = /^[^.]+$|^[.-]|[.-]$|\s/;

const excluded = [];
const kept = [];
for (const r of raw) {
  if (kept.length >= N) break;
  let why = null;
  if (ARPA.test(r.domain)) why = "reverse_dns_zone";
  else if (MALFORMED.test(r.domain)) why = "malformed_or_bare_label";
  if (why) { if (excluded.length < 500) excluded.push({ src_rank: r.rank, domain: r.domain, why }); continue; }
  kept.push({ rank: kept.length + 1, domain: r.domain, src_rank: r.rank });
}

const byWhy = {};
for (const e of excluded) byWhy[e.why] = (byWhy[e.why] || 0) + 1;

const prov = {
  frame: "CPI-50K v1",
  adopted_utc: new Date().toISOString(),
  source: { provider: "Tranco", list_id: LIST_ID, permalink: PERMALINK,
            generated: "2026-08-21", inputs: ["Cisco Umbrella", "Majestic"],
            excluded_inputs: [
              { name: "Cloudflare Radar", licence: "CC BY-NC 4.0", reason: "non-commercial clause incompatible with a paid dataset" },
              { name: "Chrome UX Report (CrUX)", licence: "CC BY-SA 4.0", reason: "share-alike could attach to the redistributed dataset" }],
            config: { days: 30, end_date: "2026-08-20", combination: "harmonic (Dowdall)",
                      aggregate_prefix: 1000000, pay_level_domains: true, other_filters: "none" } },
  size: kept.length,
  excluded_total: excluded.length,
  excluded_by_reason: byWhy,
  excluded_sample: excluded.slice(0, 40),
  attribution: "Tranco (Le Pochat et al., NDSS 2019), custom list " + LIST_ID + "; ranking inputs Cisco Umbrella and Majestic (Majestic data CC BY 3.0).",
  note: "Infrastructure, CDN and parked domains are deliberately RETAINED — the share of a popularity ranking that is not a website is a published CPI finding. Only reverse-DNS zones and malformed labels are removed, and every removal is listed here.",
};

console.log("CPI-50K v1 — frame adoption" + (DRY ? "  [DRY RUN]" : ""));
console.log("=".repeat(60));
console.log("source list      " + LIST_ID + "  (" + PERMALINK + ")");
console.log("rows read        " + raw.length);
console.log("excluded         " + excluded.length + "  " + JSON.stringify(byWhy));
console.log("frame size       " + kept.length);
console.log("top 10           " + kept.slice(0, 10).map(r => r.domain).join(", "));
if (excluded.length) console.log("excluded sample  " + excluded.slice(0, 6).map(e => e.domain).join(", "));

if (DRY) { console.log("\ndry run — nothing written."); process.exit(0); }
if (kept.length < N) { console.error("\nREFUSING: only " + kept.length + " usable rows (<" + N + ")."); process.exit(1); }

if (fs.existsSync(OUT)) fs.copyFileSync(OUT, OUT + ".bak-preclean-" + Date.now());
fs.writeFileSync(OUT, kept.map(r => r.rank + "," + r.domain).join("\n") + "\n");
fs.writeFileSync(PROV, JSON.stringify(prov, null, 1));
console.log("\nwrote " + OUT + " (" + kept.length + " rows) and " + PROV);
console.log("Next: the Sunday run picks this up automatically. First edition on this");
console.log("frame is a labelled discontinuity — frame churn is excluded from policy-change counts.");
