#!/usr/bin/env node
// Injects the census / two-probe / blind-spot material into public/methodology.html
// at the correct sections, matching existing markup. Static file, so this edits
// it directly. Idempotent; validates HTML balance; backs up.
const fs = require("fs");
const P = "public/methodology.html";
let s = fs.readFileSync(P, "utf8");
if (s.indexOf("MethodV2Census") !== -1) { console.log("already injected"); process.exit(0); }
fs.copyFileSync(P, P + ".bak-census");
const before = s;

// ---- 1. new section: the two probes + three-tier panel ---------------------
// insert right before "Coverage and freshness"
const panelSection = `<!-- MethodV2Census -->
<h2>Two probes, and how the panel is chosen</h2>
<p>We measure crawler policy two ways, on purpose. The <b>wide honest probe</b> visits thousands of domains — the top by rank, plus every domain observed blocking any AI crawler — using only our own signed, identified user agent. It never pretends to be another crawler. It records what an honest, verifiable bot is shown: the HTTP status, payment or licensing headers, Cloudflare fronting, <code>X-Robots-Tag</code> directives, and whether a machine-readable <code>llms.txt</code> is served. Because it never impersonates, it can run at scale without misrepresenting anyone.</p>
<p>The <b>identity matrix</b> is small and deliberately capped. For a limited panel it issues the same request under several identities — a browser, and the published user-agent strings of major AI crawlers — and compares the answers. This is the only way to observe <em>identity-conditional</em> behaviour: a site that serves one crawler and charges another. Because it sends another crawler's user-agent string, it is treated as a disclosed measurement study, kept to roughly ninety domains a week, and never scaled.</p>
<p>The panel is assembled, not hand-picked. It has three parts: a fixed <b>spine</b> carried unchanged for continuity; a <b>signal</b> tier, where any domain the wide probe flags as showing payment or blocking behaviour is promoted automatically the following week and dropped after eight silent weeks; and a rotating <b>audit</b>, a small random sample from the full scan each week, so that a wall which fires only at AI crawlers — and shows our honest bot a clean page — is still sampled and its prevalence measured over time. The panel's full composition is published at <a href="/panel.json">/panel.json</a>.</p>

<h2>Coverage and freshness</h2>`;
s = s.replace("<h2>Coverage and freshness</h2>", panelSection);

// ---- 2. upgrade Coverage bullets: reached vs parsed -------------------------
const oldCov = `  <li><b>Parsed:</b> not every domain answers. We publish the parsed count alongside the frame every week and always compute rates against the parsed count.</li>`;
const newCov = `  <li><b>Reached vs parsed:</b> the Tranco list ranks registrable domains, not working websites. A large share never answer — no DNS record, refused connections, dead TLS, or a timeout on both the bare domain and its <code>www</code> host. Of roughly 39,000 domains that return a live response, about 28,000 publish a readable <code>robots.txt</code> — <b>~72% of the reachable web</b>. We report coverage against what is reachable, not against the raw 50,000, and every unreachable domain is itemised by reason (no DNS, refused, timeout, broken TLS, HTTP error) in a separate census. One finding falls straight out of it: a meaningful share of the busiest sites return an HTTP error to a crawler simply asking for their public <code>robots.txt</code>.</li>`;
s = s.replace(oldCov, newCov);

// panel note in coverage now points at the real size + selection
s = s.replace(
  "plus a fixed publisher panel of ~49 news and reference sites.",
  "plus an identity-matrix panel of ~90 domains (a fixed spine, plus domains promoted from the wide probe, plus a rotating audit — see above).");

// ---- 3. blind-spot limitation ----------------------------------------------
const oldLimEnd = `  <li><b>One vantage point.</b> We crawl from one network. Sites that vary responses by geography or ASN may present differently elsewhere.</li>`;
const newLim = oldLimEnd + `
  <li><b>The honest probe has a blind spot.</b> Our wide probe uses one honest identity, so a wall that fires <em>only</em> at a named AI crawler — showing our identified bot an ordinary page — is invisible to it, and enters the record only through the rotating audit. Today's data suggests this is uncommon (most walls show the honest bot something: a 403, a redirect, a header), but it is a real limit, and the audit exists to size it rather than hide it.</li>`;
s = s.replace(oldLimEnd, newLim);

if (s === before) { console.error("nothing matched — structure differs, rolled back"); fs.copyFileSync(P + ".bak-census", P); process.exit(1); }

// validate tag balance for the tags we touched
const balanced = (tag) => (s.split("<" + tag + ">").length + s.split("<" + tag + " ").length - 2) >= 0;
const h2open = (s.match(/<h2>/g) || []).length, h2close = (s.match(/<\/h2>/g) || []).length;
if (h2open !== h2close) { fs.copyFileSync(P + ".bak-census", P); console.error("h2 imbalance ("+h2open+"/"+h2close+") — rolled back"); process.exit(1); }
fs.writeFileSync(P, s);
console.log("methodology census injected: two-probe section, reached-vs-parsed, blind-spot limitation");
console.log("h2 sections now: " + h2open);
