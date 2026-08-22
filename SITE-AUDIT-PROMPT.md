# CPI — Full website & data-architecture review brief

*Paste this entire document into another AI. It is self-contained: it catalogues every page of the marketing site, every tab of the paid dashboard, and every data asset behind them — extracted from source today (2026-08-21), not from memory. The AI you are reading this in has NOT seen the website. Your job is defined in §5. We want exceptional detail back.*

---

## 1. The product and the moat (context)

**The Crawl Price Index (CPI)** — crawlpriceindex.com — is a weekly, independent census of what the web charges AI to read it. Solo founder, Luxembourg. Revenue: **€49/mo "Terminal"** subscription (full dashboard + per-domain data + CSV) and a **€29 one-off snapshot**. Free tier: aggregate dashboard, weekly email, per-domain check tool. Launch outreach: 20 September (cold outreach to ~20 prospects with PDFs).

**The moat is methodological rigour**, mechanically enforced: every figure states its denominator; automated copy-guards fail the build on banned framings ("% of the web", causal language, market-share claims, country labels for ccTLDs, trend language on a young series). The product NEVER over-claims. This constrains all copy suggestions you make.

**Two properties, one design language** (cream/ledger-green/serif "financial almanac" aesthetic):
- **Marketing site** `crawlpriceindex.com` — static pages, Cloudflare Worker.
- **App** `app.crawlpriceindex.com` — Clerk auth (free account = aggregate dashboard; Terminal tier = per-domain data), advanced-mode Pages worker.

## 2. Complete page catalogue (extracted from source today)

Shared chrome on every page: masthead "The Crawl Price Index." (serif, left) + nav links + two CTAs ("Free dashboard" ghost, "Get the Terminal" filled) + bold green "Sign in" text link. Footer with legal links.

**KNOWN NAV PROBLEMS (founder-flagged today, fix as part of your proposal):**
(a) Layout: wants site name pushed hard left, page links centred with active-state highlight, and the right side holding Log in + subscribe CTA(s) with clear separation — reference pattern: tranco-list.eu.
(b) **Naming**: "Free dashboard" and "Get the Terminal" mean nothing to a first-time visitor. A dashboard of what? What terminal? The CTAs assume familiarity the visitor doesn't have.

### Public pages (linked)

**index.html (33KB) — homepage.** Title: "What the web charges AI to read it." Sections in order: (01) **The number** — huge "$0.50/crawl, n=1", the only posted per-crawl price observed (stackoverflow.com to ClaudeBot via Cloudflare pay-per-crawl); (02) **The wall is rising** — block rates by edition; (03) **Who gets blocked** — per-crawler differences; (04) **How the door answers** — wire evidence categories; (05) **A sensitivity tool, not a forecast** — an interactive calculator "what could a priced crawl-web be worth?" with presets/sliders (vol × price × monetised share), heavy disclaimers; (06) **Coverage & method** — live stat row (frame size, GPTBot block %, highest observed price) + methodology link; (07) **The Weekly Crawl** — email signup two-column box. CTAs: check-any-domain, Terminal €49, snapshot €29, free dashboard.
*Founder verdict, agreed: $0.50-n=1 is the weakest strong number we have as the lead; the calculator doesn't belong above the fold; stronger findings (below) are buried or absent.*

**why.html (9KB) — "Why it matters."** H1 "The web just started charging AI to read it." Sections: The shift (reading→transaction) / The gap (questions without data) / What becomes answerable / The legal backdrop (the signal the law looks at) / What this is (independent observatory, not participant). Good page, essay-style.

**check.html (26KB) — free per-domain tool.** H1 "What could your site charge AI?" Enter a domain → its policy fingerprint across 18 crawlers, comparison vs the scanned panel, a "benchmark price", how to charge. *Note: the "what could YOU charge" framing borders on advice/valuation — review against the rigour brand.*

**explore.html (12KB) — free aggregate explorer.** H2s: Robots.txt block rates / The observed price / **"ccTLD extremes"** ← *defect: this is exactly the country-adjacent framing the copy-guard philosophy bans; page needs realignment or retirement.*

**world.html (12KB) — "World editions."** H1 "Where the web is building its toll booth." Block rates by ccTLD suffix group with map framing. *Defect: the strongest remaining country-framing surface. Founder has been told repeatedly (by 3 independent AI reviews) to demote geographic cuts; this page IS a geographic cut as a flagship. Decide: reframe as "suffix groups" with disclaimers, demote, or retire.*

**methodology.html (17KB).** Sections: The short version / What we measure / What we do not measure / How we identify ourselves / Two probes and how the panel is chosen / Coverage and freshness / Known limitations / Corrections / Reproduce our work / Independence. *The credibility anchor. Will need updating for: reachability states, the new frame (CPI-50K, Radar/CrUX excluded), site-evidence signals, news flag.*

**status.html (6KB).** Live coverage/freshness, probe-panel counts ("counts only, and why there is no percentage here"), known imperfections, verify-yourself.

**sample.html (6KB).** The free top-100 sample table ("Who blocks which AI crawler"), upsell to Terminal.

**changelog.html (8KB).** Dated product/method changes.

**terms.html (6KB), privacy.html (9KB), security.html (5KB).** Legal set. Privacy includes "Data about websites, not people". (A deeper GDPR-driven privacy rewrite is separately planned — ignore.)

**success.html / cancel.html / recover.html.** Stripe outcome pages + legacy API-key recovery.

### Unlinked/stale files found by this audit
`_preview.html` (29KB, still shows **€79/mo** — stale price, must die or update), `index-v1-backup.html` (old homepage), `_measure.html` (internal). *Cleanup targets; check nothing links to them.*

## 3. The paid dashboard (app.crawlpriceindex.com) — tab by tab, with the data behind each

Auth: free account → aggregate tabs; Terminal (or admin) → per-domain data + CSVs. Nav tabs in order:

1. **This edition** (`#overview`) — the week's lead sentence (copy-buttoned, free to cite); headline number (% of parsed domains blocking ≥1 of 18 tracked AI crawlers, with by-rank-band bars and the template-cohort caveat); biggest movers (Δpp per crawler); what changed (counts + top named domains); **observed weekly block rate** chart (young-series language); basis footer with denominators.
2. **Full detail** (`#detail`) — crawler leaderboard (per-crawler explicit-block % of parsed, sortable, filter, basis switch); trend panel; selective-treatment panel (% blocking some-but-not-all); **Policy changes box** (count + direction split: more/less restrictive + reversions); **Observed wire evidence box** (counts of posted prices / 402s / token walls / payment headers); **NEW: Frame reachability panel** — see §4 reachability.
3. **Crawlers** (`#crawlers`) — per-crawler cards + **Training versus traffic**: domains blocking training-role crawlers vs search/user-role crawlers — the flagship asymmetry: **1,571 block training-only vs 106 search-only = 14.8:1**, plus per-vendor like-for-like table (vendor's training crawler vs its search crawler) and role-tag definitions.
4. **Policy layer** (`#policy`) — the "AI-aware" ladder (how many domains mention any AI crawler at all → block ≥1 → etc.), **policy archetypes** (distinct robots.txt signatures; one widely-copied template accounts for a large share of all blocks; with/without-template headline pair), signature strips per archetype.
5. **Policy changes** (`#changes`) — every domain×crawler status change between editions; direction-of-travel split (92 more restrictive / 69 less / 46 reversions in latest edition); transition matrix (unlisted→blocked 69, blocked→unlisted 44, …); measurement-noise exclusions (robots.txt reachability churn excluded and stated); full change list (Terminal), filterable by direction/band; named high-rank examples.
6. **Domains** (`#domains`) — Terminal: search any domain → full 18-crawler policy row; filter index by crawler/rank/status; CSV export.
7. **Segments** (`#segments`) — rank-band cuts; suffix-group (ccTLD) cuts WITH the disclaimer (suffix ≠ country/operator/audience); "does one group single out particular crawlers?" (within-group vs index block-rate gaps, diverging bars, band vs suffix confound warning).
8. **Wire evidence** (`#wire`) — "Field notes · exploratory exhibits" with a non-random-probe banner: posted per-crawl prices (n=1: stackoverflow $0.50), HTTP 402 responses (~27 obs: apnews, theatlantic, forbes, telegraph, independent…), token walls (forbes via intermediary), payment headers (wired: payment=free), max-price behaviour flips; per-domain × probe-identity tables; "absence here is not evidence of absence".
9. **Machine payments** (`#bazaar`) — H1 "The Bazaar". Weekly capture of the Coinbase x402 discovery registry: **14,771 real+priced endpoints** across ~1,150 distinct pay-to addresses; composition (API 57% / content 36% / MCP 7%); rail (Base ≈97.6%) & asset (USDC ≈99.9%) shares with separate denominators; price panel (median ask **$0.01**, p25/p75, banded log histogram, $1,000 outlier card, testnet excluded); **the 50k cross-reference**: 23 genuine in-frame domains advertise a machine price (10 content; 1 blocks-crawlers-yet-sells watchlist; 735 beyond frame; hosting platforms excluded); Terminal: full per-domain list. Framing: advertised/opt-in acceptance, never volume/revenue; x402 ≠ Cloudflare pay-per-crawl.
10. **Account & data** (`#account`) — tier display, subscribe €49 / snapshot €29 / billing portal buttons, downloads.

## 4. The complete data inventory (what we actually hold)

- **The census (core)**: weekly, top-50k Tranco frame (moving to a custom Radar/CrUX-free "CPI-50K" frame): per domain × 18 crawlers ∈ {blocked, allowed, partial, unlisted, no_robots}. 27,975 domains currently parse a robots.txt. ~5 weekly editions archived per-domain; every edition retained.
- **NEW — frame reachability (full 50k, measured yesterday)**: alive 40,272 (80.5%) / DNS-dead 6,318 (12.6%) / timeout 3,046 (6.1%, diagnostically verified ~94% genuinely dead) / refused+reset+TLS ~360. Homepage layer: usable HTML 22,984 (46%); **bot-walled 4,902 (9.8%)** — alive, serves robots.txt, but 403/429s an honest crawler → a *declared-vs-enforced* divergence signal nobody else publishes; thin/JS-shell 3,422; disallowed-us-by-robots 1,286 (we obey; becomes "unclassified by policy").
- **NEW — site-evidence signals (full 50k)**: ads.txt present 9,637 (19.3%); platform/CMS fingerprint 7,515 (15.0%); RSS/Atom 4,498 (9.0%); schema.org JSON-LD types 10,326 (20.7%); **self-declared news orgs 693**; adult self-label 484. Union: **39.4% of the frame carries ≥1 self-declared signal.**
- **Role/asymmetry analytics**: per-crawler role tags (training/search/user) → the 14.8:1 asymmetry; per-vendor pairs.
- **Archetypes**: distinct robots.txt signatures; dominant-template share; with/without-template headline pair.
- **Changes**: full domain×crawler transition history between editions, direction-scored, reversions flagged.
- **Wire evidence**: hand-probed exhibits (prices/402s/token walls/headers/max-price flips) per domain × probe identity.
- **Bazaar (x402)**: weekly registry capture, raw archive retained; endpoint-level type/price/asset/network/payTo; first/last-seen index; frame intersection incl. blockers-that-sell; churn feed activates from 2nd capture.
- **Planned (decided, building now)**: positive-only news-publisher flag (GDELT+Wikidata+own signals, precision-gated ≥90%); curated head classification (top 1–2k, two-layer: primary_site_function + verticals); raw evidence columns in the Terminal CSV. Full 50k taxonomy and LLM labels: rejected. Adult: aggregate-only.

**Pricing observed vs machine market — the built-in contrast**: one posted human-web crawl price ($0.50, n=1) vs a functioning machine-payment registry with median ask $0.01 — a 50× gap between the web's one toll booth and the machine market's going rate.

## 5. WHAT WE WANT FROM YOU (be exhaustive; long answers welcome)

**A. Audience identification (blind test).** From the data inventory alone (§3–4), enumerate the audiences this product serves. Be specific (roles, job titles, what they'd pay for, what question they arrive with). We deliberately do not name our assumed audiences — if your list misses one we consider core, or finds one we haven't, both are critical findings. For each audience: which tab/data is their killer feature, what's their willingness-to-pay driver, and what would make them churn.

**B. Site ↔ dashboard alignment audit.** The marketing site was written before most of §4 existed. Identify every place the site undersells, contradicts, or fails to surface the dashboard's actual strengths. Explicitly assess: the $0.50 hero vs the alternatives (census headline %, 14.8:1 asymmetry, reversions, ghost-frame/reachability, bazaar 50× contrast, blockers-that-sell, declared-vs-enforced); where the calculator belongs; what happens to world.html and explore.html's ccTLD framing; whether check.html's "what could your site charge" survives the rigour brand; what's missing entirely (e.g., no page speaks to any audience segment directly).

**C. Page-by-page rebuild briefs.** For EVERY public page (and any new page you propose): keep/kill/merge verdict; purpose in one line; target audience(s) from your §A list; section-by-section proposed layout; the specific **hook/appetizer** per page — a concrete, data-backed teaser (use ONLY data from §4, cite the exact number) that makes its target audience want the Terminal; and the CTA structure. Hooks must respect the copy-guard rules (§1). Aim for at least 2–3 candidate hooks per major page.

**D. Navigation & naming.** Propose the exact navbar: layout per the founder's spec (name left / pages centre with active state / right: Log in + primary CTA), which pages appear in the nav vs footer, and — critically — **naming that a first-time visitor understands**: what should "Free dashboard" and "Get the Terminal" be called? Should "Terminal" survive as the product name at all (argue both ways, then commit)? Give the exact button/label copy.

**E. Homepage v2.** Full section-by-section spec with real numbers in place. One candidate structure already exists internally — census headline → 14.8:1 asymmetry → weekly direction → Bazaar with $0.50-as-contrast → trend → CTAs — challenge it, improve it, or replace it. Include: above-the-fold content, the first sentence, and where the email capture sits.

**F. The appetizer economy.** Rank the 8–10 most compelling free "hooks" across the whole property by (expected conversion power × credibility cost). For each: exact placement, exact copy draft (respecting §1 rules), and what it links to.

**Rules**: cite only numbers from this document; distinguish "measured" vs "estimated"; if a suggestion would violate the copy-guard philosophy, don't make it; if you think a defect we flagged is actually fine, argue it. Depth is wanted — treat this as a paid consulting engagement, not a summary.
