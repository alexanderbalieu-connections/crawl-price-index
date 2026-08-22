# Site-Category Layer — Final Spec v2 (post 3-AI cross-check)
*Crawl Price Index · 2026-08-20 · consolidates 3 adversarial reviews of the sector-tagging proposal*

## Decision log — what the cross-check changed vs v1

**Unanimous (all three reviewers, independently):**

1. **LLM labels (T4) never enter the paid CSV at launch.** Internal triage only: classify the tail, flag likely errors, prioritise human review. Reason: subscribers strip confidence flags downstream; "CPI says X is ecommerce" survives, the epistemology doesn't. Revisit per-class publication only after a measured precision bar (≥90–97% per class on a hand-labelled sample). *(This overturns v1, which shipped T4 flagged as `low`.)*
2. **Alpha Quantum: walk away.** The redistribution grant collides with the unilateral "competing product" + "competitor access" clauses; they can deem us a competitor and the licence evaporates. Only revisit with a written, countersigned carve-out naming: CSV download, commercial customers, historical snapshots, survival past termination, waiver of competitor bar. Realistically: skip. The €50 is irrelevant next to the ambiguity.
3. **The Tranco frame contamination is real, and worse than flagged.** Default Tranco ingests Cloudflare Radar (**CC BY-NC**) *and* CrUX (**CC BY-SA**) — a NonCommercial and a ShareAlike input under the whole product. Action: generate a custom Tranco list excluding both, brand it **CPI-50K v1** (a reproducible frame under documented terms), and request a written position from KU Leuven. This protects CPI itself, not just the tag.
4. **`not-a-content-site` is the keystone, and the 138-domain matcher is a severe undercount** (true fraction ~8–15%, concentrated at the head). Deterministic signal: **ASN / IP-ownership mapping** from public-domain BGP data (RIPE RIS / RouteViews) — resolve A/AAAA → ASN; Cloudflare/AWS/Akamai/Fastly ASN + no usable homepage ⇒ infrastructure. Compute this **before** sector tiers run, and let it **suppress** sector emission (never "ecommerce" for amazonaws.com).
5. **No headless browser, ever.** Bot-walled domains get `unclassified_by_policy` — for a robots-compliance index, circumventing bot protection is self-refuting (and CFAA/CMA-adjacent). It's an editorial detail, not a gap.
6. **`ads.txt` is the best addition we missed.** A first-party IAB-standard file declaring programmatic sellers — near-100%-precision *monetisation* signal, perfect fit for the observations-not-judgements epistemic. Publish as **`has_ads_txt` / declares-ads-inventory**, never as "is a publisher". Also fetch `app-ads.txt`.
7. **Split `no_robots` with cheap probes and fold HTTP status into core CPI.** DNS A/AAAA resolution (free, no HTTP) separates likely-alive from dead; the homepage probe then splits `alive_no_robots / dead / blocked / timeout / dns_failure`. Reviewer 3's key point: this **fixes a weakness in CPI's own denominator**, independent of sector — `no_robots` currently conflates "no file" with "unreachable". Add homepage_status etc. to the weekly pipeline as longitudinal fields.

**Majority (2 of 3) — adopted:**

8. **"Higher tier always wins" is wrong.** A stale Wikidata claim must not override fresh multi-source first-party evidence. Replace with: **evidence hierarchy ≠ classification hierarchy** — confidence = f(source authority × recency × corroboration); genuine conflicts route to human review, not a tie-break. Tiers survive as *provenance labels*, not precedence.
9. **UT1-for-aggregates is NOT safely outside ShareAlike.** (v1 assumed it was; 2 of 3 disagreed.) Aggregate outputs may still be adaptations; sui generis database rights add a second trap. Decision: **UT1 never touches production** — pure research benchmark for measuring our own classifier's recall, nothing derived from it published. Zero ambiguity.
10. **Cut for v1:** the NACE/IAB crosswalks (publish later as `taxonomy_version` grows), quarterly accuracy statement (one-time 300-domain validation at launch, quarterly after), human review scope (top-100 weekly + corrections, not top-500).
11. **"Pull once" softened to event-driven freshness.** One full pass; weekly classification of new frame entrants; T3 self-declared signals re-observed with the weekly homepage fetch (it's riding along anyway); annual full re-pass; event-driven reclassification on redirects/redesigns/corrections. Sector is near-static, *sites* are not.

**Legal corrections (reviewer 3, accepted as lawyer-review items):**

12. **Art. 89 is not a lawful basis** — it conditions research/archival processing, it doesn't authorise it. Basis remains Art. 6(1)(f) with a real LIA. **Document a DPIA assessment** (50k domains, systematic recurring collection, publication → at minimum record why a full DPIA is or isn't required). Art. 14(5)(b) discharge needs more than a UA-string notice — keep the notice, don't claim it settles the point.
13. **Soften two overclaims.** (a) "Self-declared ⇒ not Art. 9" is too strong: self-declaration materially reduces inference risk but does not eliminate special-category considerations for natural-person domains — prominent individual-suppression route required, especially for the adult field. (b) "Only judgements are defamable" is too categorical: false factual publication also carries exposure. The working distinction is **observable claim vs inferred characterisation**, with provenance as the mitigation, not immunity.

**Renamed and restructured (reviewer 3, adopted):**

14. **`site_category`, not "industry".** We measure *what kind of website/service a domain represents*, not the economic industry of a legal entity (amazon.com is commerce+cloud+media). Two fields: **`primary_site_function`** (content / commerce / software / community / infrastructure / government / education / financial_service) and **`site_category`** (the ~11 buckets). Internal ontology separates content_site / service_platform / infrastructure / government / unclassified.

## The revised stack (provenance tiers, not precedence)

- **T0 deterministic:** TLD rules, CISA dotgov (CC0), DINUM (Etalab), Hipolabs (MIT), adult sponsored TLDs, **ASN→infrastructure** (public-domain BGP). Runs first; infra suppresses sector.
- **T1 authoritative open lists:** Wikidata P856→P31 (CC0, cornerstone), GDELT news (unrestricted commercial + citation — open project endpoints only, NOT gdeltcloud; confirm GFG-specific terms), Media Cloud (pending written OK), palewire (confirm data licence).
- **T2 first-party site declaration (our own weekly fetch):** JSON-LD informative subtypes, og:type, platform fingerprints via **pinned MIT wappalyzergo run locally** (NOT HTTP Archive — licence unstated; verify the pinned fingerprint DB's provenance), RSS/Atom, `ads.txt`/`app-ads.txt`, `security.txt` (weak SaaS/finance corroboration), RTA/rating meta. Fetch obeys robots.txt; refusals → `unclassified_by_policy`.
- **T3 model inference — INTERNAL ONLY.** Triage queue for T4 human review; measured precision may later earn per-class publication.
- **T4 human:** top-100 weekly + all corrections; sticky version-controlled overrides.

Confidence: `high` = one extremely strong first-party/authoritative signal (explicit OnlineStore; gov registry; GDELT+MediaCloud agreement) OR ≥2 *genuinely independent* medium signals · `medium` = one strong or several weak · `unclassified` / `unclassified_by_policy` / `not_a_content_site`. Never numeric-looking ("confidence=92" is fake precision). Independence matters: Wikidata and Wikipedia are not two sources.

## Adult content (final)

Field: **`adult_self_declaration: true|false|unknown`** with evidence list (`rta_meta` / `rating_meta` / `sponsored_tld`); `mature` NOT merged into `adult`. Known hard datapoint: **only ~5,383 of the top-1M domains carried an RTA label as of March 2025 (~0.54%)** — so recall will be poor and must be measured (against an internal UT1/manual benchmark), stated, and never extrapolated. Reviewer 1's supplementary signal — adult-industry infrastructure consolidation (ASNs/nameservers) — is an *inference* and therefore stays internal-only if used at all. Aggregate adult-segment statistics: only if derivable without UT1 in the chain (see #9); otherwise wait until self-declaration + human review give a publishable population.

## Ruled out (full list)

Alpha Quantum (unilateral competitor clauses) · UT1 in any production path (ShareAlike) · Cloudflare Radar (CC BY-NC) · Common Crawl-derived labels (non-sublicensable ToU; "cannot republish") · Web Data Commons (research-only) · OpenCorporates (ODbL ShareAlike; paid non-SA licence exists but uneconomic) · app-store publisher mappings (ToS) · sellers.json de-anonymisation (privacy) · national company registries at scale ("a separate company") · CT logs as sector source (DV certs carry no O= field; entity-resolution evidence at most) · RDAP org fields (post-GDPR redaction; weak corroboration only, never ship the org name) · MX/NS-provider-as-sector (noise) · headless browsing (ethos) · Wikipedia category graph (CC BY-SA — Wikidata only) · numeric confidence scores.

## Coverage expectations (to be replaced by probe measurements)

Reviewer estimates: 40–50% / 50–58% / 65–75% high+medium — median ≈ **50–65%**, composition mattering more than the headline. Targets: some-evidence 70–80% · high-confidence 50–65% · not-a-content-site identified 5–10%+ · truly unclassified 15–25% · adult self-declaration high-precision/low-recall. `measure-classifiability.cjs` (500-domain stratified probe, robots-respecting) is running; its outputs replace every estimate here. Note the Consent-in-Crisis anchor is a *floor* not a ceiling — their corpus was content-heavy by construction; ours is infrastructure-heavy.

## Build order

1. **CPI-50K v1 frame** (custom Tranco minus Radar/CrUX) + KU Leuven letter. *(Protects everything; do first.)*
2. **Probe + DNS split of the 22,025** → publish the reachability states into core CPI (`alive_no_robots/dead/blocked/timeout/dns_failure`). *(Improves the flagship dataset immediately.)*
3. **ASN→infrastructure layer** (RIPE RIS/RouteViews) → `not_a_content_site` first-class.
4. **Weekly homepage observation fetch** (T2 signals incl. ads.txt, RTA) riding the existing sweep; longitudinal storage.
5. **T0/T1 joins** (Wikidata dump pass; GDELT; licence memos per source — *no source enters production without one*).
6. **Confidence assembly + CSV fields**: `site_category, category_confidence, category_method, category_observed_at, category_method_version, is_not_content_site, not_content_type, adult_self_declaration, adult_evidence, category_evidence_sources` — auditable by the subscriber, which is the moat.
7. **LLM triage (internal) + top-100 human pass**; one-time 300-domain validation; publish precision/recall at launch.
8. LIA + DPIA-assessment memo + privacy notice + correction/objection form (individual-suppression path prominent).
