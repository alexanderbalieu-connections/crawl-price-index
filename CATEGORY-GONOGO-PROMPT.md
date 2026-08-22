# Decision cross-check — should the Crawl Price Index ship a site-category layer at all?

*Paste this whole document into another AI. It is self-contained. This is a GO / NO-GO decision, and we want you to challenge everything in it — the data, the legal reasoning, the cost logic, and especially our appetite. The founder WANTS this feature. Your job is to tell him whether wanting it is enough.*

---

## 0. The decision on the table

The Crawl Price Index (CPI) wants to add a **site-category tag** (news_media, ecommerce, software_saas, finance, education, government, community_forum, entertainment, not-a-content-site, unclassified) to each of the 50,000 domains in its weekly census, so analysts can ask "do news publishers block AI crawlers more than e-commerce sites?"

The founder's decision rule, stated verbatim: *"I really want the categories, but if it's too expensive (above €100), or legally impossible, or simply not available, then we skip. But I would REALLY like it if possible."*

Two full research rounds and one live measurement have already happened. Everything below is what we now know. Your job: **(a) give a GO / NO-GO / GO-WITH-REDUCED-SCOPE verdict, (b) say what the category layer is actually worth commercially at the achievable coverage, (c) challenge any finding you think is wrong, (d) propose any design that beats the ones listed in §6.**

## 1. The product (context)

- Weekly census of the top 50,000 Tranco-ranked domains: robots.txt parsed, declared policy toward 18 named AI crawlers recorded per domain (blocked / allowed / partial / unlisted / no_robots).
- Solo founder, Luxembourg (EU/GDPR, regulator CNPD). €49/month "Terminal" subscription; subscribers **download the per-domain CSV** — so any label is *published and redistributed*, not internal. Launch push is 20 September (cold outreach).
- The moat is methodological rigour: every figure states its denominator, an automated copy-guard bans over-claiming ("% of the web", causal language, market framing). **A sloppy label damages the product more than no label.**
- Prior review consensus (3 independent AIs, unanimous): **LLM-inferred labels may not appear in the paid CSV** — internal triage only; publication per class only after a measured ≥90% precision bar. Also unanimous: no headless browser to bypass bot walls (the product publishes a robots-compliance index; circumvention would be self-refuting).

## 2. MEASURED coverage (live probe, 2026-08-20 — not estimates)

A robots.txt-respecting probe of **1,716 domains** stratified across rank bands (head oversampled, results frame-weighted), with https→www→http fallback:

| Fetch outcome | Share |
|---|---|
| **Classifiable (usable HTML)** | **43.4% raw · 44.4% frame-weighted (~22,200 of 50k)** |
| Timeout | 18.5% |
| Unreachable (incl. 13.0% hard DNS failure = domain dead) | 14.3% |
| Bot-walled (403/429 to an honest crawler UA) | 8.6% |
| Thin / JS-shell (no server-rendered text) | 8.0% |
| HTTP error | 4.0% |
| Disallowed by robots.txt (we obey) | 2.9% |

Self-declared signals (the only evidence usable without inference):

| Signal | Of all sampled | Of classifiable |
|---|---|---|
| Informative schema.org @type (OnlineStore, NewsMediaOrganization, …) | 3.5% | 8.1% |
| Platform/CMS fingerprint (Shopify, WooCommerce, Discourse, …) | 13.2% | 30.5% |
| RSS/Atom feed | 8.4% | 19.4% |
| RTA / adult self-label | 1.0% | — |
| **ANY self-declared signal** | **19.4% (~9,700 of 50k)** | 45.2% |

By rank band, classifiable: top-100 **26.7%** (bot walls), 101–1k 36.8%, 1k–10k 44.6%, 10k–50k 44.5%. The head — the most scrutinised part of the product — is the *worst*-covered.

Deterministic extras already measured: gov/edu by TLD = 4.5% of frame; adult sponsored TLDs = 0.13%.

**The honest arithmetic:** with LLM labels banned from the CSV, published coverage = deterministic TLD (~5%) + curated news lists (est. 5–10%) + Wikidata joins (est. 10–20%, unmeasured) + self-declared (~19%, overlapping the previous) ≈ **realistically 25–35% of the frame carrying a published category**, concentrated away from the head. A further ~10–15% can honestly be labelled `not-a-content-site` (infrastructure/CDN/dead), and ~13% `dead`. The rest is `unclassified`.

## 3. LICENSING (settled — challenge only if you have new facts)

Everything usable must permit **commercial redistribution in a paid CSV**. Findings from a full vendor/source sweep:

- **Killed:** all commercial categorisation vendors (WhoisXML, Klazify, Diffbot, Webshrinker/DNSFilter — internal-use or competing-product clauses; zvelo/NetSTAR — $25k+/yr OEM). **Alpha Quantum** killed by 3-of-3 reviewers: its redistribution grant collides with a unilateral "competing product" clause.
- **Killed:** UT1 Toulouse (CC BY-SA contaminates the CSV; even aggregate use judged unsafe by 2 of 3 reviewers), Cloudflare Radar (CC BY-NC), Common Crawl (non-sublicensable ToU), OpenCorporates (ODbL-SA), Wikipedia categories (CC BY-SA), app-store mappings.
- **Clean and free:** Wikidata (CC0), GDELT (unrestricted commercial + citation), CISA dotgov (CC0), DINUM (Etalab), Hipolabs universities (MIT), IAB taxonomy (CC BY 3.0), own-crawl observations (ads.txt, schema.org, platform fingerprints via pinned MIT wappalyzergo), public-domain BGP/ASN data for infrastructure detection.
- **Separate discovered problem:** the default Tranco list itself ingests Cloudflare Radar (NC) and CrUX (SA) — the frame under the whole product needs regenerating from clean inputs regardless of this decision.

**Cost of the legal build path: ~€3–€400/yr** (own crawl + free sources + internal-only LLM triage). The €100 budget is NOT the constraint. Coverage and law are.

## 4. GDPR (researched against primary sources, Aug 2026 — challenge the reasoning, not with vibes)

- 5–15% of a top-50k are natural-person domains (sole traders, personal sites, eponymous micro-companies — *Schecke* C-92/09 para 53/59). For those rows a published label is personal data. **Not a close question.**
- **`site_category` is manageable:** Art 6(1)(f) available (*KNLTB* C-621/22: commercial interest qualifies); the killer reasonable-expectations argument is that robots.txt exists to be fetched; CNIL's June-2025 scraping guidance is satisfiable (named UA, honoured opt-out, no contact-data collection, suppression channel); DPIA required under the CNPD list (days of work, not months). Residual risk: low; worst case corrective order.
- **`adult_self_declaration` per-domain is a bad bet:** fails the *KNLTB* "strictly necessary" limb before Art 9 is even reached; Art 9 caselaw trends expansive (C-252/21 para 68: prohibition bites where output *allows* revelation, intent irrelevant); the Art 9(2)(e) "manifestly made public" fallback is strong on RTA facts but narrowed by *Schrems v Meta* C-446/21, breaks on CMS-set tags, and is not a lawful basis anyway. Asymmetric downside (Art 83(5) tier) for one field. **Decision: aggregate-only or sponsored-TLD-only, never per-row RTA on ordinary TLDs.**
- Wording changes the analysis only where it changes the processing (raw observation with URL+timestamp ≠ controller-assigned flag). "It's public/B2B data" achieves nothing.

## 5. The competing next-best use of the same effort

The probe's by-product: the census's `no_robots` state (44% of the frame!) conflates *alive-but-no-file* with *dead*. Measured split: 67.2% alive, 13.0% DNS-dead, 18.5% timeout. Publishing reachability states (`alive_no_robots / dead / blocked / timeout / dns_failure`) fixes the flagship product's own denominator — zero licensing exposure, zero GDPR exposure, strengthens the rigour moat. This ships before 20 September regardless. The question is whether the category layer ALSO ships, and in what form.

## 6. The candidate designs — rank them, or beat them

**A. Full category layer, evidence-only** (~25–35% coverage, concentrated in the tail; head worst). Everything in §3-clean, per-domain provenance, `unclassified` for the rest.
**B. "Site signals" columns instead of a category judgement.** Publish only raw observations: `has_ads_txt`, `platform`, `schema_types`, `has_feed`, `reachability`, `is_infrastructure(ASN)` — no category column at all. 100% defensible (pure observations), ~19–45% signal coverage, lets sophisticated subscribers derive their own categories. Zero classification liability.
**C. Head-only curated layer.** Hand-label the top 1,000–2,000 domains (the founder + evidence; feasible solo at ~2–3 min/domain over a few weeks), evidence-only for the tail. Gives near-100% coverage exactly where scrutiny and citation value concentrate; the "do news publishers block more?" headline becomes answerable *for the head*, which is where the news publishers actually are.
**D. Aggregate-only.** Category cuts appear in the dashboard (news vs ecommerce block rates) but no per-domain category column in the CSV. Sidesteps redistribution risk almost entirely; sacrifices the Terminal upsell.
**E. Defer entirely.** Ship reachability only; revisit categories post-launch with real subscriber demand data.

## 7. What we want from you

1. **Verdict: GO (which design) / NO-GO / GO-LATER**, with reasoning against the founder's rule (≤€100, legal, actually available) AND against the product's credibility-first positioning.
2. **Commercial value assessment.** At 25–35% coverage concentrated in the tail, does a category column ADD to or SUBTRACT from a €49/mo product's credibility? What coverage threshold flips it? Is "we categorise 30% and say so honestly" a strength (rigour) or a weakness (looks broken)? Would YOU pay more for A, B, C, D, or E?
3. **The head problem.** The top-100 is 26.7% classifiable and it's where BBC, NYT, Amazon live — the domains every analyst will spot-check first. Design C exists because of this. Is any design without a curated head viable at all?
4. **Challenge the measurements.** Anything in §2 that looks wrong or incomplete? (e.g., should we probe with a browser-like Accept-Language? Does the 18.5% timeout rate suggest a probe artefact rather than dead hosts — and how would you distinguish?)
5. **Challenge the legal calls** in §4 if you have caselaw or guidance we missed — cite it. Otherwise accept them as constraints.
6. **The "do news publishers block more?" question specifically:** given GDELT/Media Cloud news lists are the *best-covered* category, could a NEWS-ONLY flag (design C-lite: `is_news_publisher` from 2+ curated lists, nothing else) answer the single most-asked analytical question at high coverage and near-zero risk? Was killing the news-first idea (we did, when "pull once" made full taxonomy look cheap) premature?
7. **Anything we haven't thought of** — a source, a design, a framing that gets the founder more of what he wants inside the constraints.

Rules: distinguish measured / published / estimated numbers. No source suggestions without licence terms. If you disagree with the 3-reviewer consensus (no LLM labels in CSV), you must argue against the specific reason (confidence flags get stripped downstream), not just assert capability. Be willing to tell the founder the thing he wants is not worth having — or that one of these designs gives him 80% of it safely.
