# Deploying the data gate — closing the leak, building the moat

This puts the PAID dataset behind a real access wall. After this, non-payers
get HTTP 402, cancelled subs are auto-revoked, each customer has a rate-limited
watermarked key, and the public site only ever exposes free headline figures.

## What changed already (in the repo, safe to push now)
- rebuild.cjs now writes TWO files:
  - index.json  → PUBLIC, headline only (no per-domain, no full country table)
  - paid-dataset.json → FULL data, gitignored, NEVER published
- world.html now shows top-3 countries free + a locked "Terminal feature" gate
- Added: worker.js (the API gate), wrangler.toml, push-dataset.cjs

Push these normally (paid-dataset.json is gitignored, so it stays private).

## THE GATE — one-time setup (needs you for 3 secret-paste steps)

Prereq: install wrangler once →  `npm install -g wrangler`  then `wrangler login`

### 1. Create the two KV stores (Claude-guided, you run)
    wrangler kv namespace create KEYS
    wrangler kv namespace create DATA
Copy the two returned `id = "..."` values into wrangler.toml (replace the
PASTE_..._KV_ID placeholders).

### 2. Set the secrets (HUMAN STEP — these are yours, never shown to Claude)
    wrangler secret put STRIPE_SECRET_KEY
      → paste your Stripe SECRET key (sk_live_...) from Stripe → Developers → API keys
    wrangler secret put STRIPE_WEBHOOK_SECRET
      → you'll get this in step 4; run this again after creating the webhook
These are stored ENCRYPTED by Cloudflare. They are not in the repo, not in
code, and Claude never sees them. This is the correct, safe way.

### 3. Deploy the Worker
    wrangler deploy
Then add the custom domain api.crawlpriceindex.com (Cloudflare will prompt, or
Workers → your worker → Settings → Domains → Add → api.crawlpriceindex.com).

### 4. Point Stripe at the webhook (HUMAN STEP)
Stripe → Developers → Webhooks → Add endpoint:
  URL: https://api.crawlpriceindex.com/webhook/stripe
  Events: checkout.session.completed, customer.subscription.created,
          invoice.paid, customer.subscription.deleted, invoice.payment_failed
Stripe shows a "Signing secret" (whsec_...). Run:
    wrangler secret put STRIPE_WEBHOOK_SECRET
and paste it. Redeploy: `wrangler deploy`.

### 5. Push the paid dataset behind the gate
    node push-dataset.cjs
(Do this after every scan/rebuild so subscribers get fresh data. Add it to
run-weekly.command later so it's automatic.)

## How a subscriber gets their key
When someone subscribes, the webhook provisions their key automatically. To
deliver it to them: for now, the simplest path is you see the new customer in
Stripe and email them their key (look it up: `wrangler kv key get --binding=KEYS "cust:CUSTOMER_ID"`).
NEXT ITERATION (worth building): auto-email the key on subscribe via a Stripe
email/Zapier or a tiny addition to the success flow. Flagged, not yet built.

## What this does and doesn't do (honest)
DOES: stop non-payers, stop URL-sharing of the raw file, auto-cut cancelled
subs, rate-limit each key, make leaks traceable (watermark), keep the public
site to free-tier only.
DOESN'T: stop a paying customer from copying what they legitimately bought —
impossible for any data business. Mitigated by watermark + ToS + rate caps.

---

## 6. Auto-email the API key on subscribe (HUMAN STEP — email sender)

When someone subscribes, the Worker now emails them their key automatically.
It needs an email sender. Two options:

### Option A — Resend (recommended, 5 min)
1. Sign up at resend.com (free tier ~3,000 emails/mo — plenty).
2. Add & verify your domain crawlpriceindex.com (they give you DNS records;
   add them in Cloudflare DNS — same as you've done before).
3. Create an API key in Resend.
4. Set it on the Worker:
       wrangler secret put RESEND_API_KEY
   (paste the re_... key). Redeploy: wrangler deploy.

### Option B — MailChannels (free, no signup, but fiddlier)
No key needed — the Worker falls back to MailChannels automatically if
RESEND_API_KEY isn't set. BUT you must add SPF/DKIM DNS records for
crawlpriceindex.com so mail isn't marked spam. Resend handles this for you,
which is why it's recommended.

Either way, "from" address is keys@crawlpriceindex.com. Make sure that's
covered by your email setup (Resend domain verification covers it).

## 7. New customer-facing pages (already in the repo — just push)
- terms.html    — the single-subscriber data licence (gives watermark teeth)
- recover.html  — subscribers retrieve a lost key by email
- success.html  — now tells them the key is emailed + how to use the API
These deploy with the normal site push. No secrets needed.

## The complete subscriber flow (once all deployed)
1. Visitor clicks Subscribe → pays €79 on Stripe.
2. Stripe webhook → Worker issues a unique key, stores it, EMAILS it to them.
3. They land on success.html (told to check email).
4. They call api.crawlpriceindex.com/v1/dataset?key=THEIR_KEY → full data,
   rate-limited, watermarked.
5. They cancel → webhook revokes the key → access stops at period end.
6. Lost key → recover.html re-sends it.
Fully hands-off. You never touch a key.
