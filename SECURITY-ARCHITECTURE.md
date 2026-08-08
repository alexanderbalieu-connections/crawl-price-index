# Crawl Price Index — Data Gating & Moat Architecture

## The honest threat model (ranked)

TIER 1 — real, fixed by this build:
1. Public JSON leak — paid data at a public URL → GATED behind Worker + key
2. One sub shared infinitely → per-customer keys + rate limits
3. Cancel doesn't cut access → Stripe webhook revokes key on lapse

TIER 2 — mitigable, not eliminable (true of ALL data businesses):
4. Paying customer redistributes → watermarking (traceable) + ToS + rate caps
5. Competitor rebuilds scanner → not the moat; time-series + citations defend

TIER 3 — less scary than it feels:
6. "Steal once + AI-update" → to stay fresh they must re-scan = become a
   competitor, not a freeloader; stolen snapshot is stale in a week
7. "No IP" → facts aren't copyrightable (nor are Bloomberg's); the IP is
   brand + history + methodology + cited-source reputation

## The moat, stated honestly
NOT: secret data or uncopyable code (impossible).
IS: (a) accumulating weekly time-series a copycat can't backfill,
    (b) being THE cited source (reputation, not in the file),
    (c) freshness — a stolen copy rots within a week,
    (d) brand + canonical position per language sphere.

## Architecture (what gets built)
- FREE tier: headline aggregates only, public at /index.json (cite-bait).
- PAID tier: full per-domain + country history + time-series, served ONLY
  through api.crawlpriceindex.com (Cloudflare Worker) requiring a valid key.
- Keys: one per Stripe customer, stored in Cloudflare KV. Rate-limited.
- Lifecycle: Stripe webhook issues key on subscribe, revokes on cancel/fail.
- Watermark: each customer's payload seeded with traceable micro-variations.
- Secrets: STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET as encrypted Worker
  secrets (never in repo).
