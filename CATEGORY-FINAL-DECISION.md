# Category Layer — FINAL DECISION (4-AI unanimous verdict, 2026-08-20)

## The verdict

**GO — with reduced scope. All four reviewers, independently: ship `B + C + news flag`, kill the full 50k taxonomy.**

The founder's rule (≤€100, legal, available) is satisfied: cost ≈ €0–400/yr, the legal path is clear, and the sources exist. What failed is the *shape* — a full `site_category` column at the measured 25–35% coverage **subtracts** credibility, because the missingness is systematically worst at the head (top-100: 26.7% classifiable), which is exactly where every analyst spot-checks first. "BBC: unclassified" reads as broken, not rigorous. One reviewer's framing that settles it: *"Don't ask 'can we classify enough of the 50,000?' Ask 'can we classify the domains customers most need classified, with a demonstrably high evidence standard?' The answer to that is yes."*

## What ships (the unanimous package)

**1. Reachability states — first, immediately.** `alive / alive_no_robots / dead(dns) / timeout / blocked` into the core census. Fixes the flagship denominator (the 44% `no_robots` conflation). Zero legal surface. **Gate: run the timeout diagnostic first** (see §Measurement flags) — 18.5% timeout is the softest number and must be split into genuinely-dead vs probe-artefact before publication.

**2. Raw site-evidence columns (Design B) — the whole frame.** `has_ads_txt`, `platform`, `schema_types`, `has_feed`, `reachability`, plus raw ASN/hosting evidence. Pure observations with provenance (`source`, `observed_at`, `method_version`). Scored 10/10 credibility by the harshest reviewer. One correction adopted: `is_infrastructure` is a *judgement* — publish the raw ASN evidence, or mark the derived label with provenance; don't present it as an observation.

**3. News-publisher flag (C-lite) — resurrected, all four said killing it was premature.** The highest-value category question ("do news publishers block more?") answered by the best-covered, best-self-declaring, lowest-risk category (news orgs are overwhelmingly legal entities → minimal GDPR surface).
   - **Positive-only, evidence-graded — never boolean false.** `news_publisher_evidence = confirmed_2_sources / single_source / no_clean_evidence`. Downstream users read `false` as "not news"; we never assert that.
   - Sources: **GDELT** (unrestricted commercial + citation) + **Wikidata P31** (CC0) + own-crawl signals (NewsArticle/NewsMediaOrganization JSON-LD, RSS). **Media Cloud is OUT** until written commercial permission — two reviewers independently flagged its terms as not-clean. palewire: confirm data licence before use.
   - **Gated on measurement**: run the join; ship only if precision ≥90% on a hand-checked sample and head coverage is strong. The "60–80% coverage" figure is an inference until measured.

**4. Curated head taxonomy (Design C) — top 1,000–2,000, founder-labelled.** Near-100% coverage exactly where scrutiny and citation value concentrate. ~2 days for top-1,000 core; expandable. One reviewer proposed joining curated head lists (GDELT media, Wikidata major-org classes, gov/edu TLD) *before* hand-labelling to cut the manual load — adopt: pre-fill from clean lists, hand-verify.

**5. Two-layer ontology (adopted from reviewers 1+3, consistent with earlier review):**
   - `primary_site_function` — one of: content_site / service_site / infrastructure / hybrid / unclassified.
   - `verticals` — zero or more of: news_media, ecommerce, software_saas, finance, education, government, community_forum, entertainment. **No forced single category** (Amazon = ecommerce+cloud+media; a 9-way exclusive choice manufactures precision).
   - Reachability is a *dimension*, not a category. `not-a-content-site` dissolves into function=infrastructure + reachability.
   - **Privacy-aware taxonomy rule**: the safest categories are the least sensitive, not the easiest to infer. No health/finance verticals on natural-person domains; adult stays aggregate-only.

**6. Naming and framing:** call the layer **"Domain Classification"**, with the standing sentence: *"CPI publishes classifications only where it has sufficient deterministic evidence. Unclassified means insufficient evidence, not absence of a category."* This turns partial coverage into methodology instead of embarrassment.

## Still banned (re-confirmed unanimously)

Full 50k taxonomy at current coverage · LLM labels in the paid CSV · per-domain adult/sensitive flags (aggregate or sponsored-TLD-only) · headless-browser circumvention · `false` semantics where evidence is merely absent.

## P0 discovered (existential, sequence before/with launch)

**The Tranco frame.** Verified again by two reviewers: the default list ingests Cloudflare Radar (CC BY-NC) and CrUX (CC BY-SA). One put it bluntly: if the frame can't be commercially redistributed, every downstream decision is moot. **Fix: generate a custom Tranco list from clean inputs only (exclude Radar + CrUX), brand it CPI-50K v1, document the composition, and email KU Leuven for a written position.** One reviewer cautioned against stating "contamination" as settled law — fine: we don't litigate it, we just make it moot by regenerating.

## Measurement flags to resolve (before publishing reachability)

1. **Timeout 18.5%**: run a diagnostic re-probe of ~300 timeout domains (longer window, retry after delay, IPv4/IPv6, alternate resolver). If ~80%+ stay dead → publish as-is. If a large share respond → the state machine needs a `slow/flaky` state and the honest label "not fetchable by an honest crawler within X seconds" with the threshold published in the methodology.
2. **schema.org 8.1%-of-classifiable is probably an artefact**: the probe's regex isn't JSON-LD-aware (misses `"@type": ["Org","NewsMediaOrganization"]` arrays and @graph nesting). Re-extract with a real JSON-LD parse before concluding self-declared news signals are rare — if the true rate is higher, the news flag gets cheaper.
3. **13% DNS-dead is high for a top-50k** — consistent with a stale frame snapshot; one more argument for the frame regeneration.
4. **Fetch-time bot-walling (8.6%) is its own finding**: "declares allow-all in robots.txt but 403s honest crawlers at fetch time" is a *separate publishable signal* (declared vs enforced posture) — do not conflate with the category question. This is genuinely new product material.
5. **Accept-Language split decision** (reviewers split 1–1): adopt the middle path — send standard `Accept: text/html` + `Accept-Language: en` as normal HTTP negotiation with the honest UA (not circumvention), but never spoof a browser UA. Document both in the methodology.

## Sequence to 20 September

1. Timeout diagnostic → 2. Reachability states into the weekly pipeline + dashboard → 3. CPI-50K v1 frame + KU Leuven email → 4. Site-evidence columns (B) → 5. News-flag join + precision measurement → 6. Head curation (pre-filled, hand-verified, top-1,000 first) → 7. DPIA/LIA memo + named-UA privacy notice + suppression form (required for B/C under the GDPR analysis) → 8. Dashboard cut: "AI-crawler policy by publisher type" once the news flag clears its gate.

Full taxonomy: revisit post-launch, demand-gated, only if coverage arithmetic materially improves.
