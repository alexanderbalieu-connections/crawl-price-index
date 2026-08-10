#!/usr/bin/env node
// PROVENANCE LAYER — the single best criticism from both AI reviews:
// never let an inference look like an observation. This makes the
// distinction STRUCTURAL (in the data), not just editorial (in prose).
//
// Adds to paid-dataset.json + the free feed:
//   methodology_version   pinned string, bumped when the method changes
//   evidence              per-signal-class taxonomy: what was actually seen,
//                         how it was obtained, and whether it is observed,
//                         derived or inferred
//   per_domain_evidence   what a per_domain row means, exactly
//   corrections           machine-readable correction log (empty = none yet)
const fs = require("fs");
let s = fs.readFileSync("rebuild.cjs", "utf8");
if (s.includes("methodology_version")) { console.log("rebuild already has provenance - skipping"); process.exit(0); }
const B = "  gtld_baseline: gtldBaseline,";
if (!s.includes(B)) { console.error("anchor missing - aborting, rebuild untouched"); process.exit(1); }
fs.writeFileSync("rebuild.cjs.bak5", s);

const block = [
'  methodology_version: METHODOLOGY_VERSION,',
'  evidence: EVIDENCE_MODEL,',
'  corrections: readCorrections(),',
B,
].join("\n");
s = s.replace(B, block);

// constants + helper, inserted before the first function or at the top after requires
const CONST = [
'',
'// ---- provenance model (v' + '1.0' + ') ---------------------------------------',
'// Every signal we publish is labelled with HOW it was obtained and WHETHER',
'// it is an observation, a derivation, or an inference. Reviewers asked for',
'// this explicitly: "GPTBot was blocked" is an observation; "this publisher',
'// charges $0.01/page" would be a much stronger claim requiring evidence.',
'const METHODOLOGY_VERSION = "2026-08-10.1";',
'const EVIDENCE_MODEL = {',
'  version: METHODOLOGY_VERSION,',
'  crawler_identity: "CrawlPriceIndexBot/1.0, self-identified, requests cryptographically signed (RFC 9421 / Web Bot Auth). Public key directory: https://crawlpriceindex.com/.well-known/http-message-signatures-directory",',
'  signal_classes: {',
'    robots_stance: {',
'      what: "Per-crawler directive parsed from the site\'s own robots.txt",',
'      method: "GET /robots.txt with our identified user agent, parsed for User-agent/Disallow/Allow groups",',
'      evidence_type: "observed",',
'      values: { blocked: "an explicit Disallow rule applies to this crawler", allowed: "an explicit Allow rule applies", partial: "some paths disallowed, not the whole site", unlisted: "robots.txt exists but names no rule for this crawler", no_robots: "no robots.txt was served" },',
'      caveat: "A declaration is not enforcement. See enforcement.",',
'    },',
'    observed_price: {',
'      what: "A price a site quotes to an AI crawler",',
'      method: "Recorded only when the site returns it in a machine-readable payment response (HTTP 402 with a crawler-price/payment header, or an equivalent x402 offer)",',
'      evidence_type: "observed",',
'      caveat: "We publish only prices we have actually been quoted. We do not estimate, model or extrapolate prices for domains that do not quote one.",',
'    },',
'    payment_signal: {',
'      what: "Paywall / licensing / toll signals other than an explicit price",',
'      method: "HTTP status and headers on identified-crawler requests to the homepage (402 responses, TollBit-style token walls, licensing redirects, payment:free declarations)",',
'      evidence_type: "observed",',
'    },',
'    block_rates: {',
'      what: "Share of scanned domains blocking a given crawler",',
'      method: "Aggregated from robots_stance across all parsed domains in the current sweep",',
'      evidence_type: "derived",',
'      caveat: "Derived arithmetic over observations. Denominator is robots_parsed, not tranco_top_n.",',
'    },',
'    country_editions: {',
'      what: "Block rates segmented by country-code top-level domain",',
'      method: "ccTLD of the domain, aggregated where at least 8 domains are present",',
'      evidence_type: "derived",',
'      caveat: "ccTLD is a proxy for country, not a measure of publisher nationality or audience.",',
'    },',
'    enforcement: {',
'      what: "Whether a declared block is actually enforced when the crawler arrives",',
'      method: "Compare robots.txt declaration against the HTTP status returned to a crawler-identified request, on the documented publisher panel only",',
'      evidence_type: "observed (panel-limited)",',
'      caveat: "Small n. Directional for the panel, not projectable to the whole web.",',
'    },',
'    trends: {',
'      what: "Week-over-week movement of the above",',
'      method: "Difference between consecutive weekly snapshots held in our own archive",',
'      evidence_type: "derived",',
'      caveat: "History cannot be backfilled: series begin the week we first observed them.",',
'    },',
'    suggested_price_band: {',
'      what: "Guidance shown in the public checker for what a site might charge",',
'      method: "Our judgement, anchored to observed quotes and the domain\'s Tranco rank",',
'      evidence_type: "inferred",',
'      caveat: "NOT a measurement. Explicitly labelled as judgement wherever it appears.",',
'    },',
'  },',
'  not_measured: [',
'    "Actual revenue earned by any site",',
'    "Traffic volumes of any site",',
'    "Prices for domains that do not publish one",',
'    "Private licensing deal values",',
'    "Whether an AI company honoured a payment request",',
'  ],',
'  reproducibility: "Every figure is regenerated weekly from a full sweep. Method, crawler identity and signal definitions are published at https://crawlpriceindex.com/methodology.html and versioned above.",',
'  corrections_policy: "Errors are corrected in the next weekly edition and listed in corrections[] with the date, what changed and why. We do not silently amend past editions.",',
'};',
'function readCorrections() {',
'  try { return JSON.parse(fs.readFileSync("corrections.json", "utf8")); } catch (e) { return []; }',
'}',
'',
].join("\n");

// insert constants right after the requires at the top
const lines = s.split("\n");
let insertAt = 0;
for (let i = 0; i < Math.min(lines.length, 40); i++) {
  if (/^const .*=\s*require\(/.test(lines[i])) insertAt = i + 1;
}
lines.splice(insertAt, 0, CONST);
s = lines.join("\n");

// also surface it in the free/public feed
const PUB = '  full_dataset: "gated';
if (s.includes(PUB)) {
  s = s.replace(PUB, '  methodology_version: METHODOLOGY_VERSION,\n  evidence_summary: { crawler_identity: EVIDENCE_MODEL.crawler_identity, observed: ["robots stances", "quoted prices", "payment signals"], derived: ["block rates", "country editions", "trends"], inferred: ["suggested price bands (checker only)"], full_model: "https://api.crawlpriceindex.com/v1/methodology" },\n' + PUB);
}

fs.writeFileSync("rebuild.cjs", s);
console.log("provenance layer added to rebuild.cjs (backup rebuild.cjs.bak5)");
console.log("  methodology_version: 2026-08-10.1");
console.log("  signal classes labelled observed / derived / inferred");
console.log("  not_measured list + corrections log + reproducibility statement");
