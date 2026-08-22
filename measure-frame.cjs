#!/usr/bin/env node
/* Measure what is actually IN the 50k frame, for the sector-tagging decision.
   Read-only. Uses only deterministic signals available offline. */
const zlib = require("zlib"), fs = require("fs");
const f = process.argv[2] || "editions/2026-08-17.csv.gz";
const lines = zlib.gunzipSync(fs.readFileSync(f)).toString("utf8").split("\n").filter(Boolean);
const rows = lines.slice(1).map(l => { const p = l.split(","); return { rank: +p[0], domain: (p[1]||"").toLowerCase() }; }).filter(r => r.domain);

const tld = d => d.slice(d.lastIndexOf(".") + 1);
const sld = d => d.split(".").slice(-2).join(".");

/* 1. ADULT — sponsored/restricted TLDs. Deterministic, zero inference. */
const ADULT_TLD = new Set(["xxx","adult","porn","sex"]);
const adult = rows.filter(r => ADULT_TLD.has(tld(r.domain)));

/* 2. NOT-A-CONTENT-SITE — infrastructure with no industry to assign.
      Conservative: only unambiguous infra/CDN/telemetry patterns. */
const INFRA_RE = /(^|\.)(gtld-servers|root-servers|nstld|akadns|akamai|akamaiedge|edgekey|edgesuite|cloudfront|fastly|fbcdn|akamaitechnologies|llnwd|cdn77|stackpathdns|azureedge|trafficmanager|cloudapp|elb\.amazonaws|compute\.amazonaws|1e100|gvt1|gvt2|ntp\.org|in-addr)/;
const INFRA_SLD = new Set(["gtld-servers.net","root-servers.net","akadns.net","akamaiedge.net","edgekey.net",
  "edgesuite.net","cloudfront.net","fbcdn.net","akamaitechnologies.com","1e100.net","gvt1.com","gvt2.com",
  "azureedge.net","trafficmanager.net","cloudapp.net","llnwd.net","nstld.com","amazonaws.com","windows.net",
  "office.net","aaplimg.com","apple-dns.net","icloud-content.com","doubleclick.net","googleapis.com",
  "gstatic.com","googlesyndication.com","googletagmanager.com","googleusercontent.com","cloudflare.com",
  "cloudflare-dns.com","workers.dev","pages.dev","herokuapp.com","netlify.app","vercel.app"]);
const infra = rows.filter(r => INFRA_SLD.has(sld(r.domain)) || INFRA_RE.test(r.domain));

/* 3. DETERMINISTIC PUBLIC-SECTOR / EDUCATION by TLD suffix. */
const govEdu = rows.filter(r => /(^|\.)(gov|mil)$/.test(tld(r.domain))
  || /\.(gov|gouv|go|gob|govt)\.[a-z]{2}$/.test(r.domain)
  || /(^|\.)edu$/.test(tld(r.domain)) || /\.(edu|ac)\.[a-z]{2}$/.test(r.domain));

/* 4. TLD spread — how much of the frame is even Latin-script commercial. */
const tldCount = {};
for (const r of rows) tldCount[tld(r.domain)] = (tldCount[tld(r.domain)] || 0) + 1;
const topTld = Object.entries(tldCount).sort((a,b) => b[1]-a[1]).slice(0, 12);

const pct = n => (n / rows.length * 100).toFixed(2) + "%";
console.log("FRAME MEASUREMENT — " + f);
console.log("=".repeat(66));
console.log("total domains in frame            " + rows.length);
console.log("");
console.log("ADULT (sponsored TLD only)        " + adult.length + "  (" + pct(adult.length) + ")");
if (adult.length) console.log("   e.g. " + adult.slice(0,6).map(r=>r.domain+" #"+r.rank).join(", "));
console.log("NOT-A-CONTENT-SITE (infra/CDN)    " + infra.length + "  (" + pct(infra.length) + ")");
console.log("   e.g. " + infra.slice(0,6).map(r=>r.domain+" #"+r.rank).join(", "));
console.log("GOV / EDU (deterministic TLD)     " + govEdu.length + "  (" + pct(govEdu.length) + ")");
console.log("   e.g. " + govEdu.slice(0,6).map(r=>r.domain+" #"+r.rank).join(", "));
console.log("");
console.log("T0 deterministic coverage total   " + (adult.length+infra.length+govEdu.length) +
            "  (" + pct(adult.length+infra.length+govEdu.length) + ")");
console.log("");
console.log("TOP TLDs");
for (const [t,c] of topTld) console.log("   ." + t.padEnd(10) + String(c).padStart(6) + "  " + pct(c));
