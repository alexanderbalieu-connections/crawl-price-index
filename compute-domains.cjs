#!/usr/bin/env node
/**
 * CPI — PER-DOMAIN GATED PAYLOAD  (node compute-domains.cjs)
 * ==========================================================
 * Packs the per-domain matrix into a compact file served ONLY through the
 * authenticated Pages Function (never in the public bundle).
 *
 * Packing: each domain's 18 statuses -> an 18-char string.
 *   b=blocked  p=partial  a=allowed  u=unlisted  n=no_robots
 * Rows: [rank, domain, statusString]  (arrays, not objects — much smaller)
 *
 * Writes: private/domains.json  (gzipped by the Function on the way out)
 * Reads:  latest editions/<date>.csv.gz  (or scan-robots-full.csv)
 */
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const CODE = { blocked:"b", partial:"p", allowed:"a", unlisted:"u", no_robots:"n" };

function readEdition(file) {
  const raw = file.endsWith(".gz") ? zlib.gunzipSync(fs.readFileSync(file)).toString("utf8")
                                   : fs.readFileSync(file, "utf8");
  const lines = raw.trim().split("\n");
  const crawlers = lines[0].split(",").slice(2);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].split(",");
    if (p.length < 3) continue;
    rows.push([+p[0], p[1], p.slice(2).map(s => CODE[s] || "?").join("")]);
  }
  return { crawlers, rows };
}

let file, date;
const edDir = "editions";
const eds = fs.existsSync(edDir) ? fs.readdirSync(edDir).filter(f => /^\d{4}-\d{2}-\d{2}\.csv\.gz$/.test(f)).sort() : [];
if (eds.length) { file = path.join(edDir, eds[eds.length - 1]); date = eds[eds.length - 1].slice(0, 10); }
else if (fs.existsSync("scan-robots-full.csv")) { file = "scan-robots-full.csv"; date = new Date().toISOString().slice(0, 10); }
else { console.error("no edition data"); process.exit(1); }

const cur = readEdition(file);

// full change list (not capped — the dashboard caps display, not the data)
let changes = [];
if (eds.length >= 2) {
  const prev = readEdition(path.join(edDir, eds[eds.length - 2]));
  const pm = new Map(prev.rows.map(r => [r[1], r[2]]));
  for (const [rank, domain, st] of cur.rows) {
    const ps = pm.get(domain);
    if (!ps) continue;                       // frame churn is not a policy change
    for (let ci = 0; ci < st.length; ci++) {
      if (ps[ci] === st[ci]) continue;
      // exclude availability churn (robots.txt became reachable/unreachable):
      // one flaky fetch would otherwise fabricate 18 "policy changes" for a domain
      if (ps[ci] === "n" || st[ci] === "n") continue;
      changes.push([rank, domain, ci, ps[ci], st[ci]]);
    }
  }
  changes.sort((a, b) => a[0] - b[0]);
}

const out = {
  edition: date,
  crawlers: cur.crawlers,
  legend: { b:"blocked", p:"partial", a:"allowed", u:"unlisted", n:"no_robots" },
  rows: cur.rows,
  changes,
  prev_edition: eds.length >= 2 ? eds[eds.length - 2].slice(0, 10) : null,
  note: "Per-domain declared robots policy. Licensed to the authenticated subscriber; not for redistribution.",
};
fs.mkdirSync("private", { recursive: true });
fs.writeFileSync("private/domains.json", JSON.stringify(out));
const plain = fs.statSync("private/domains.json").size;
const gz = zlib.gzipSync(fs.readFileSync("private/domains.json"), { level: 9 }).length;
console.log(`private/domains.json: ${cur.rows.length} domains, ${changes.length} changes`);
console.log(`  ${(plain/1048576).toFixed(2)} MB raw -> ${(gz/1048576).toFixed(2)} MB gzipped over the wire`);
