# Dashboard v3 — Consolidated Build Plan
*Crawl Price Index · 2026-08-20 · consolidates 3 independent AI reviews into one sequenced plan*

## The one-line verdict from all three reviewers

> The methodology discipline (stated denominators, archived editions, automated copy-check) is genuinely above average and **is the moat** — don't dilute it. The gap is that the dashboard **under-extracts the data you already hold**. You treat the 18-crawler status as 18 independent numbers when it is really **one policy-posture vector per domain**. Nobody recommended collecting new data. Everything below is computable from Datasets A–C today.

Reviewer 3 put the bottleneck best: *"turning the 50k × 18 matrix into relationships and histories that an analyst cannot trivially get from the headline block-rate chart."*

---

## Unanimous items (all 3 reviewers, independently)

These are not opinions — three separate models converged on each. Treat as settled.

| # | Item | Verdict |
|---|---|---|
| U1 | **Policy changes needs direction + concentration + persistence** | A bare "161 changes" is inert. Split restrictive vs permissive, show which crawlers, show what persists. |
| U2 | **Build a crawler co-blocking / discrimination matrix** | The single best new analysis from existing data. Free to compute. |
| U3 | **Reframe Wire evidence as an evidence lab, demote it** | Weakest panel. Cheap fix, large credibility win. |
| U4 | **Replace the Bazaar N=1 headline with a policy × monetisation 2×2** | Durable as N grows; N=1 as a "killer stat" reads as reaching. |
| U5 | **Kill "Trend" framing on 5 points** | Rename to "Observed weekly block rate", no fitted line, no ↑ arrow, "directional only". |
| U6 | **Three drill-downs only** | transition → domains · crawler delta → contributing domains · Bazaar 23 → the 23 domains. |
| U7 | **Edition comparison: last + first only. No 3-month.** | Grey it out labelled "available after ~12 editions". |

---

## Build sequence

### PHASE 1 — Credibility + legibility (cheap, do first)
These protect the product. Mostly copy, labels, and layout.

1. **Rename the trend panels.** "Trend" → **"Observed weekly block rate"**; show edition dates on the axis; keep "5 editions · directional only"; no regression/fit/arrow. *(both trend panels: This edition, Full detail)*
2. **Wire evidence → "Field notes — exploratory exhibits."** Persistent banner: *"Non-random probe. Counts are exhibits, not prevalence."* Each row annotated: domain · crawler impersonated · what was observed · date · mechanism. Never aggregate to a %. Relabel "27 sites" → **"27 observed responses in this week's probe"**. Demote visually (smaller, below census panels).
3. **Bazaar wording sweep.** "sellers" → **"distinct pay-to addresses"**. "price" → **"advertised price"** everywhere. Composition bars get an explicit *"share of observed advertised endpoints in this week's registry — not market share"*. Penetration: lead with **23 domains** and print **23 / 49,043**; drop the bare "0.05%". "0 in top 1,000" → **"0 of 1,000 in frame"**.
4. **Reachability note.** State plainly that "no robots.txt reachable" is a *separate state from* "no explicit instruction", and that it is never counted as a policy change.
5. **Fix the crawler list.** Version it. Remove any "approximate" language — a €49 product needs a rigid, dated crawler list, and a crawler added in edition 3 must not be silently compared to edition 1.
6. **Group user-initiated agents separately.** ChatGPT-User and Perplexity-User are user-triggered, not bulk crawlers. At minimum group them in the leaderboard; lumping all 18 produces misleading narratives.
7. **Extend the copy guard** to ban causal language: "because", "driven by", "in response to", "reacting to", plus "market share", "market price", "monetisation rate", and "% of the web".

### PHASE 2 — The analytical core (the actual value)

8. **Policy changes, rebuilt** *(U1 — highest immediate Terminal value)*
   - **Direction split**: more-restrictive vs less-restrictive vs lateral, as a single clear breakdown.
   - **Reversions** (Blocked → Allowed / No instruction) called out separately. Reviewer 2's argument: blocking is the default defensive move; *un*blocking is an active strategic choice and may signal a data deal. Highest-signal event in the dataset.
   - **Crawler concentration**: which crawlers absorbed the most changes, with net restrictive change per crawler.
   - **Rank-band contribution**: a swing in the top 100 ≠ a swing in the tail.
   - **Persistence**: of the domains that changed last edition, how many are still changed this edition. This is the noise filter that separates real policy moves from robots.txt flapping. Computable from the 5 archived editions.
   - **Denominator discipline**: edition-over-edition math must run on the **intersection of domains reachable in both editions**, and say so. Otherwise timeouts silently move every block rate.

9. **Crawler co-blocking / discrimination matrix** *(U2 — the moat analysis)*
   - For every crawler pair: *among domains that explicitly block A, what % also explicitly block B?*
   - Renders as an 18×18 matrix, filterable by rank band and TLD.
   - What it answers: *are these crawlers treated as one policy class or as distinct actors?* If GPTBot and ClaudeBot are ~90% co-blocked they're one category; if Google-Extended diverges sharply, that's a finding. If Perplexity-User is treated differently from PerplexityBot, that's a real distinction between user-initiated and bulk access.
   - Reviewer 3's extension: cluster the 18-status vectors into **named policy archetypes** ("block-all-AI", "block-non-US crawlers", "allow-all", "platform default"), then show archetype prevalence, archetype × rank band, and **week-over-week archetype flow**.

10. **Platform-template vs bespoke split** *(reviewer 2's best original idea)*
    - Group domains by whether robots.txt matches a known platform default (Shopify/Cloudflare/Squarespace etc.) vs a bespoke file, then compare block rates.
    - What it answers: **is the rising block rate corporate strategy, or SaaS platforms changing a default for millions of sites at once?** That distinction is decision-grade for anyone buying this data — and we already compute a dominant-template signature, so the ingredients exist.
    - Requires: publish the signature-matching method in the footer, or "one template = X% of blocks" reads as "one company controls X% of the web".

11. **Segments, upgraded** *(U-partial)*
    - Keep the diverging bar as secondary context.
    - Make the default view **within-group discrimination**: normalise each crawler against *the group's own* baseline, answering "which bots does this group single out" instead of "does this group block a lot" (which is usually a truism).
    - Add the **segment × crawler matrix** so an analyst can spot "restrictive toward Anthropic, permissive toward Google" at a glance.

12. **The three drill-downs** *(U6)*
    - transition bar → the domains behind it (rank, suffix, crawler, template signature)
    - crawler delta → the domains that account for the movement (never "caused")
    - Bazaar 23 → the 23 domains, with type, advertised price, and robots posture
    - Explicitly **not** worth drilling: rank-band bars, price histogram bins (a tooltip does the job).

13. **Bazaar 2×2** *(U4)*
    - Axes: {blocks ≥1 AI crawler} × {advertises a machine price}, at **domain** level, with a content-only subset.
    - The contradiction cell becomes a **tracked watchlist**, not a headline stat. At N=1: *"1 observed domain combines explicit crawler restriction with an advertised machine-payment endpoint"* — an existence proof, not a rate.
    - Reviewer 1's reframe is important: blocking crawlers *and* selling API access isn't a contradiction, it's a coherent strategy — *"don't scrape me free, buy the API."* That's arguably the most interesting economic posture in the data, and the 2×2 lets us say so without over-claiming.

14. **Edition comparison control** *(U7)* — "vs previous edition" and "vs first observed edition" only; 3-month greyed out with the reason shown.

### PHASE 3 — Product hierarchy (reviewer 1's structural note)

Reorganise the Terminal proposition around three questions rather than "what happened this week":
1. **Who blocks whom?** (current policy — Dataset A)
2. **Who changed, and did it stick?** (longitudinal — Dataset A)
3. **What happens when blocking meets monetisation?** (A + B + C)

Practical consequence: **Policy changes becomes more prominent than Wire evidence**, and Wire evidence stays as a deliberately experimental evidence lab.

---

## Explicitly rejected / deferred

- **No new dataset.** All three said the same: Dataset A is under-exploited; adding a fourth source now is the wrong move.
- **No more filters, no industry classification, no predictive scores, no "market share" charts.**
- **No confidence badges.** Instead state historical depth plainly: *"5 editions · directional only"*.
- **No "biggest movements" without a floor.** Reviewer 2: a shift of ~12 domains in 50,000 is noise (often just timeouts). Enforce a minimum delta before calling something a movement.

## Credibility red flags — the standing QA checklist

1. "of the web" leakage — the frame is 50k Tranco domains with a readable robots.txt. Never "the web".
2. "No explicit instruction" is **not** "allowed". Absence of a Disallow is not endorsement.
3. "No robots.txt reachable" must never be silently merged with "no explicit instruction", and reachability churn must not move block rates.
4. Trend language on 5 points.
5. Percentages on tiny counts (23, N=1) — print counts and denominators.
6. x402 = advertised supply in an opt-in registry. Not transactions, volume, revenue, demand, or market share.
7. robots.txt tells you what a site *declares* — not whether a crawler visited, obeyed, or whether revenue was lost.
8. "Changed" = observed robots.txt status change, not "company changed its AI policy". Don't infer motive.
9. "Dominant template" — define the matching method or it implies a single actor controls X% of the web.
10. Wire evidence must never carry the visual weight of the census.

## What all three said to leave alone

Stated denominators, archived weekly editions, and the automated copy-check. The rank-band and ccTLD cuts as first-class dimensions. Gating per-domain and transition detail behind Terminal — that's the correct freemium line, and the "which domains moved" layer is exactly the right upsell.
