# Cross-check prompt — sector/industry tagging for the Crawl Price Index

*Paste this entire document into another AI. It is self-contained. We want a hard, adversarial critique of a specific proposal — not encouragement. Where you disagree, say so plainly and say what you'd do instead.*

---

## 0. What we are asking you

We have a concrete proposal (§5) to add an **industry/sector tag** to every domain in a 50,000-domain census. We want you to answer four things:

1. **Is the proposal sound** — legally, methodologically, and practically?
2. **What coverage should we actually expect?** Our own estimate is in §6. Tell us if it's wrong and why.
3. **How do we close the coverage gap** using sources or techniques we have missed — legally, and without licence contamination?
4. **What would you do differently?** Including "don't do this at all" if that's your view.

Be concrete. Name sources, name licences, name failure modes. Flag where you're uncertain rather than guessing confidently.

---

## 1. The product (context you need)

**The Crawl Price Index (CPI)** is a weekly census of how the world's most-visited websites declare their policy toward AI crawlers.

- **Frame:** the top **50,000 domains** by Tranco rank, re-swept weekly. Every edition is archived per-domain. We currently hold ~5 weekly editions.
- **Measurement:** for each domain we fetch and parse `robots.txt`, and record for **18 named AI crawlers** (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-Web, anthropic-ai, PerplexityBot, Perplexity-User, Google-Extended, CCBot, Bytespider, Amazonbot, Applebot-Extended, meta-externalagent, cohere-ai, AI2Bot, Timpibot, Diffbot) one of five states: `blocked` / `allowed` / `partial` / `unlisted` (no explicit instruction) / `no_robots` (no readable robots.txt).
- **Business:** solo founder, based in **Luxembourg** (so **EU/GDPR** applies, supervisory authority CNPD). Sold as a **€49/month "Terminal"** subscription plus a €29 one-off snapshot, with a free aggregate dashboard and a free newsletter.
- **⚠️ Commercially critical:** Terminal subscribers **download the per-domain dataset as CSV**. Any label we attach is therefore **redistributed to paying third parties**. This disqualifies almost every commercial data licence, which permit "internal use" only.
- **The moat is methodological discipline.** Every figure states its denominator. We never say "% of the web" — we say "% of the 27,975 domains with a readable robots.txt, from a 50,000-domain Tranco frame". Qualitative claims in the UI are enforced by an automated copy-guard that fails the build on forbidden phrasings. Credibility is the entire product. **A sloppy sector label would do more damage than shipping no sector label at all.**

## 2. Why we want sector tags

The single most-requested analytical cut is: **"do news publishers block AI crawlers more than e-commerce sites do?"** Today we can only segment by Tranco rank band and by TLD/ccTLD, neither of which answers it. Sector would also let us report whether rising block rates are concentrated in particular industries.

The founder also specifically wants **adult-content sites separable**, so that segment can be broken out or excluded rather than silently distorting aggregate rates.

## 3. Hard measured facts about our frame

These are **measured from our actual 2026-08-17 edition**, not estimates:

| Fact | Value |
|---|---|
| Domains in frame | **50,000** |
| With a readable `robots.txt` | **27,975 (55.95%)** |
| **No readable `robots.txt`** | **22,025 (44.05%)** |
| Adult **sponsored TLD** (.xxx/.adult/.porn/.sex) | **65 (0.13%)** |
| Deterministic **gov/edu** by TLD (.gov/.mil/.edu/.gov.xx/.ac.xx) | **2,236 (4.47%)** |
| Obvious **infrastructure/CDN** (conservative matcher) | **138+ (0.28%+, undercount)** |
| TLD mix | .com 48.0% · .net 6.8% · .org 4.5% · .ru 3.8% · .de 2.2% · .io 2.1% · .jp 1.7% · .cn 1.7% · .uk 1.4% · .br 1.2% · .edu 1.1% · .fr 0.9% |

**Two things this reveals:**

- **A Tranco list is a DNS-popularity list, not a website-popularity list.** Rank **#3 is `gtld-servers.net`**, **#4 `gstatic.com`**, **#7 `googleapis.com`**, **#9 `amazonaws.com`**, **#13 `akamai.net`**. These have no "industry" at all. Any honest scheme needs a `not-a-content-site` bucket, and it is **not** the same thing as "unclassified".
- **Adult sponsored TLDs are useless as the adult signal** — 65 domains. The large adult sites are on `.com`.

**Important unknown:** our `no_robots` state **conflates "host is alive but serves no robots.txt file" with "host is unreachable/dead"**. We do not currently store the HTTP status separately, so we cannot yet split those 22,025. This is the single biggest uncertainty in our coverage estimate. We have written a probe to measure it (§6).

## 4. What we already ruled out, and why

Please **don't re-recommend these** unless you think our reasoning is wrong — in which case say why.

**Commercial vendors — nearly all forbid redistribution, which is precisely what we need:**

| Vendor | Finding |
|---|---|
| **WhoisXML API** | ToS §4.5/§4.6.1: data is "solely for Customer's internal use"; explicitly bars resale/distribution/use "in any commercial product or service intended for sale". Hard no. |
| **Klazify** | $1,390/mo for 50k calls; bars creating a "competing database"; **commercial rights terminate when the subscription lapses**. Rent forever, own nothing. |
| **Diffbot** | ToS bars sublicensing/reselling/making available to third parties. |
| **DNSFilter / Webshrinker** | $1,000–2,000/mo; no redistribution grant; no-derivative-works clause. |
| **People Data Labs / Coresignal** | Internal-use licences; also person-data → GDPR exposure for an EU seller. |
| **Crunchbase** | Needs separate Applications licence + mandatory visible "Powered by Crunchbase" dofollow link adjacent to the data — unworkable in a CSV. Open Data Map (the old CC BY route) is deprecated. |
| **zvelo / NetSTAR / Cyren-Data443** | True OEM vendors, quote-only, realistically **$25k–$100k+/yr**. At €49/mo that's arithmetically impossible. |
| **Similarweb / Semrush / Brandwatch** | $50k–$150k+/yr, and wrong product shape. |
| **Palo Alto / Zscaler / Forcepoint / Broadcom RuleSpace** | Not sold as a standalone feed. RuleSpace is EOL. |
| **Peer39 / DoubleVerify / IAS / Comscore** | CPM segments inside DSPs; no file delivery exists. |

**The one commercial exception:** **Alpha Quantum** (websitecategorizationapi.com / urlcategorizationdatabase.com). Their API ToS grants data on an *"unlimited, unrestricted, perpetual use basis"* including the right to *"share, distribute, sublicense, and redistribute API data to their clients, partners, end users"*. Roughly **$50 one-time for 50k lookups** at their $0.001/lookup credit rate (their sister site quotes $0.0099/call — the two sites contradict each other, including on whether credits expire). **But** the same ToS also forbids using the data to "supplement any database or dataset intended for use in a competing product", which arguably describes our CSV exactly. Their *offline database* product ($999) is internal-use only — the API credits are the only redistributable path.

**Open sources — licence assessment:**

| Source | Licence | Verdict |
|---|---|---|
| **Wikidata** (P856 official website → P31 instance-of / P452 industry) | **CC0** | ✅ Cleanest available. Coverage of a top-50k **unmeasured** — estimated 15–40%. P452 is far sparser than P31. |
| **Curlie** (DMOZ successor), ~2.9M entries, monthly TSV dump | **CC BY 3.0** (no ShareAlike, no NC) | ✅ Usable, but content is substantially a **2017 DMOZ fossil**; realistic top-50k coverage 20–35%, and it's a topic tree not an industry taxonomy. |
| **GDELT** (Global Frontpage Graph monitors ~50,000 news homepages hourly) | Explicitly **unlimited commercial use** + citation | ✅ Best licence in the news category. |
| **Media Cloud** (25,000+ news sources with country + media_type) | Outputs redistributable, but terms *discourage* commercial use and bar reselling API access | 🟡 Ambiguous — would need written confirmation. |
| **CISA `dotgov-data`** (all US .gov + registrant org) | **CC0** | ✅ Use it. |
| **DINUM** French public-sector domains | Etalab OL 2.0 | ✅ Use it. |
| **Hipolabs university-domains-list** | **MIT** | ✅ Use it. |
| **IAB Tech Lab Content Taxonomy 3.x** | **CC BY 3.0** | ✅ Usable as a taxonomy, but it's ad-topic-shaped, not organisation-shaped. |
| **UT1 Toulouse blacklists** (4.6M domains, 80+ categories incl. adult) | **CC BY-SA 4.0 — ShareAlike** | 🔴 **The trap.** ShareAlike could arguably force our paid CSV open. Decision: **internal validation only, never shipped.** |
| **Cloudflare Radar / Intel API** | **CC BY-NC 4.0**, and 100 API calls/month on non-Enterprise | 🔴 Non-commercial. Disqualified twice over. |
| **Web Data Commons** | "research purposes only" | 🔴 No. |
| **nvidia/domain-classifier** (DeBERTa, 26 classes) | **Apache 2.0** | ✅ Free, local, clean licence. |

**Also flagged:** Tranco itself publishes **no licence** for the composite list, and its default composition includes **Cloudflare Radar (CC BY-NC)**. We are considering regenerating a custom Tranco list excluding Radar and seeking a written position from KU Leuven. *Tell us if you think this is a real problem or over-caution.*

---

## 5. THE PROPOSAL WE WANT YOU TO CRITIQUE

### 5.1 Core principle — publish observations, not judgements

Never assert `sector: ecommerce` as a bare fact. Instead publish a **provenanced observation**:

```json
{ "domain": "example.com",
  "sector": "ecommerce",
  "confidence": "high",
  "evidence": [
    {"source":"self-declared","signal":"schema.org/OnlineStore","observed":"2026-08-17"},
    {"source":"self-declared","signal":"platform:Shopify","observed":"2026-08-17"},
    {"source":"wikidata","entity":"Q123456","property":"P31","observed":"2026-08-01"}
  ],
  "method_version": "cpi-sector-1.0" }
```

Rationale: *"declared `schema.org/OnlineStore` on its homepage on 2026-08-17"* is a **verifiable fact about an observable artefact**. *"Is an e-commerce company"* is a **judgement**. Only the second is defamable. This is the same epistemics the product already uses for robots.txt.

### 5.2 The tiered stack (higher tier always wins; record every tier that fired)

- **T0 — Deterministic** (~5% of frame, ~99% precision). Public Suffix List + TLD rules (.gov/.mil/.edu/.gov.xx/.ac.xx), CISA dotgov (CC0), DINUM (Etalab), Hipolabs universities (MIT), adult sponsored TLDs. **Measured: 2,236 gov/edu + 65 adult.**
- **T1 — Curated authoritative lists.** GDELT-derived news hosts ∪ Media Cloud ∪ palewire. News only, but news is the highest-value category.
- **T2 — Wikidata** (CC0). Local pass over the truthy dump extracting P856 → P31/P452, joined on registrable domain via PSL, gated on the entity being an organisation class.
- **T3 — Self-declared, from our own homepage fetch.** We already fetch `robots.txt` from all 50k weekly; adding one homepage GET is marginal. Extract: JSON-LD `@type` (informative subtypes only — `NewsMediaOrganization`, `OnlineStore`, `CollegeOrUniversity`, `GovernmentOrganization`, `BankOrCreditUnion`, etc.), `og:type`, `<meta generator>` / platform fingerprints (Shopify/WooCommerce/Magento → ecommerce at near-100% precision), RSS/Atom autodiscovery, and the **adult self-label** (see 5.4).
- **T4 — LLM classification**, shipped separately and **flagged as inferred**. Batch pass over homepage title + meta description + H1 + first N words. Estimated **~€3 for a full 50k pass** at batch rates; weekly deltas are cents. Pinned model version, prompt in git, re-run wholesale only on a deliberate taxonomy version bump.
- **T5 — Human**, ~1 hr/week on the top 500 by rank plus all correction requests.

### 5.3 Taxonomy

~10 buckets: `news_media`, `ecommerce`, `software_saas`, `finance`, `health`, `education`, `government`, `community_forum`, `entertainment`, plus **`not-a-content-site`** (subtypes: infrastructure / api / adtech) and **`unclassified`**. Published crosswalk to **NACE Rev. 2.1** (EU statistical classification) and **IAB CT 3.1 tier-1**.

### 5.4 The adult question specifically

Because sponsored TLDs only catch 65 domains, we propose **self-declaration** as the signal:

- the **RTA label** — `RTA-5042-1996-1400-1577-RTA`, a voluntary adult-industry self-label, present as a `<meta name="RATING">` tag or a `Rating:` HTTP header
- `<meta name="rating" content="adult|mature">`
- adult sponsored TLDs

Published as **`declares_adult_content: true`** — never "is a porn site". Rationale: it's self-declared (so not an Article 9 *inference*), verifiable, and true by construction.

For sites that don't self-declare, use **UT1 internally only** to compute **aggregate** segment statistics ("domains in an adult category block at rate X"), never a per-domain label in the shipped CSV.

**We know this will undercount. We want to know by how much, and whether there's a better lawful signal.**

### 5.5 Legal / ethical design

- **Refuse to publish sensitive categories per-domain**: adult (beyond self-declaration), gambling, religion, political affiliation, extremism, piracy. Reason: **GDPR Art. 9** — inferring these about a domain that may belong to a natural person is special-category processing with no available lawful basis. Plus the defamation asymmetry: a wrong `saas` label costs an email, a wrong `adult` label draws a demand letter.
- **Confidence levels exposed and defined**: `high` (≥2 independent T0/T1/T2 sources agree) / `medium` (single authoritative source, or T3 self-declaration) / `low` (T4 model inference only) / `unclassified` / `not-a-content-site`. Never collapsed in the export.
- **Published accuracy statement**: hand-label a random 300-domain sample quarterly; publish precision/recall per sector and per confidence level with confidence intervals.
- **GDPR**: Art. 6(1)(f) legitimate interest with a written LIA; Art. 14(5)(b) disproportionate-effort reliance discharged via a public privacy notice at a stable URL **cited in the crawler's User-Agent string**; Art. 21 objection route; Art. 30 RoPA (the small-org exemption doesn't apply to regular processing); Art. 89 basis for retaining historical snapshots unaltered with a published corrections log.
- **Correction mechanism**: public form, no account, with a checkbox "this domain is mine as an individual, not a company" routing to the GDPR path; sticky version-controlled overrides that survive reclassification; published corrections changelog.
- **Robots compliance**: we publish a robots-compliance index, so we **must** obey robots.txt on our own homepage fetch. Domains that disallow us are marked `unclassified-by-policy` — which we think is a nice editorial detail rather than a mere gap.

---

## 6. Our coverage estimate — tell us where this is wrong

We have written a probe (stratified sample across rank bands, obeys robots.txt, one request per host) that measures fetch outcome and self-declared signal presence. **It has not been run yet**, so the numbers below are *reasoned estimates*, and the §3 `no_robots` ambiguity is the main source of error.

**Reasoning:**
- 27,975 domains have a readable robots.txt → host is definitely alive. Assume ~90–95% yield usable homepage HTML (some serve robots.txt but 403 the homepage to non-browser agents, or are pure API/infra hosts). → **~25,000–26,500**
- Of the 22,025 with no readable robots.txt, assume roughly half are alive-but-no-file and ~85% of those yield usable HTML. → **~9,000–9,500**
- **Total with usable homepage HTML: ~34,000–36,000 (≈70%)**
- Of those, assume ~85% produce a confident label (excluding parked pages, holding pages, login walls, JS-only shells with no server-rendered text). → **~29,000–30,500**

**Our estimate: ~55–65% classified with reasonable confidence; ~35–45% `unclassified` or `not-a-content-site`.**

For calibration, the closest published precedent — **"Consent in Crisis"** (Data Provenance Initiative, arXiv:2407.14933), the flagship robots.txt/AI-consent study — hand-labelled **14,228 domains using 14 trained crowdworkers at $25–30/hr** into 8 buckets plus "Other", and **still landed 4.7–15% in "Other"**. We are attempting 3.5× the scale with worse inputs.

### Specific questions on coverage

1. Is ~55–65% realistic, optimistic, or pessimistic? What's your number and reasoning?
2. How would you split the 22,025 `no_robots` domains between *alive-no-file* and *dead/unreachable* without a full crawl? Is there a cheaper inference than probing?
3. What fraction of a **top-50k Tranco list** do you think is genuinely `not-a-content-site` (CDN/infra/telemetry/adtech/app-backend)? Our conservative matcher found 138 but we believe the true number is far higher. How would you enumerate them rigorously?
4. Bot-walling: how much of the head of the list will serve a Cloudflare/Akamai challenge or 403 to a non-browser User-Agent, and does that materially change the plan? Would you consider a headless browser, and does that cross a line given we publish a compliance index?

---

## 7. The questions we most need answered

1. **Is the tiered stack the right architecture?** Would you reorder, drop, or add a tier?
2. **Coverage** — see §6.
3. **Closing the gap.** This is the main event. What sources or techniques have we missed that are (a) legally redistributable in a paid product, (b) not ShareAlike or NonCommercial, and (c) actually cover a global top-50k rather than just US/English? Specifically consider: certificate-transparency org fields, WHOIS/RDAP org fields (post-GDPR redaction — is anything left?), ASN/IP-ownership as an infra signal, DNS record patterns (MX provider, NS provider) as weak sector signals, `security.txt`/`humans.txt`, `ads.txt` presence (strong adtech/publisher signal?), app-store/Play-store publisher mappings, national company registries with website fields, OpenCorporates, EU VAT/VIES, Wikipedia category graph as distinct from Wikidata, Common Crawl host-level index, HTTP Archive's Wappalyzer `technologies` array on BigQuery, and anything else we haven't thought of.
4. **The adult problem.** Is self-declaration (RTA + meta rating + sponsored TLD) the right lawful approach? What coverage would it realistically achieve — what share of adult sites in a top-50k actually carry an RTA label in 2026? Is there a better lawful, non-inferential signal? Is our "UT1 internally for aggregates only" split defensible under CC BY-SA, or does computing published aggregate statistics from ShareAlike data already trigger it?
5. **The Alpha Quantum contradiction.** Their ToS grants redistribution but forbids supplementing a "competing" database. Is a domain→sector column inside a robots.txt dataset a "competing product" to a domain-categorisation vendor? Would you buy at $50, and what exact carve-out language would you demand in writing?
6. **GDPR.** Is Art. 6(1)(f) + Art. 14(5)(b) the right basis for publishing an inferred sector label about domains that may belong to natural persons? Anything material we've missed? Is publishing `declares_adult_content` — even when self-declared — an Art. 9 problem in your view?
7. **Model-inferred labels (T4).** Should we ship them at all, given the product's credibility positioning? Options: (a) ship flagged as `low` confidence, (b) use internally to prioritise human review but never publish, (c) don't use LLMs at all. Which, and why?
8. **Is "pull once" right?** Sector is near-static, so we plan one full pass plus incremental classification of new frame entrants (~1–3%/week churn) and an annual refresh. Any reason this is wrong?
9. **What would you cut?** If you think part of this is over-engineered for a solo founder pre-launch, say which part.

---

## 8. Rules for your critique

- Only propose sources you believe are **legally redistributable in a paid product**. State the licence explicitly. If you're unsure of a licence, say so — do not assume permissive.
- Distinguish **cheap fixes** from **real engineering** from **needs-legal-advice**.
- Give **numbers** where you can, and label them as measured, published, or estimated.
- Be willing to say "this part is already right, leave it alone" and "this part is a bad idea, here's why".
- Flag anything that could damage a product whose entire value proposition is methodological rigour.

**Return:** (a) a verdict on the proposal, (b) your coverage estimate with reasoning, (c) a ranked list of gap-closing sources/techniques we missed with licences, (d) answers to §7.1–7.9, (e) any red flags.
