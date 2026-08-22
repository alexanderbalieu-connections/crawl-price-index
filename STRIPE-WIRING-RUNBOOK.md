# CPI — Stripe wiring runbook

Two files changed: `app/_worker.js` (Checkout, webhook, snapshot, portal, tier gate) and
`app/views.js` (Account-page buttons + return-from-checkout handling). The two price IDs
are baked into the worker; **the publishable key is not used** by this flow (sessions are
created server-side and we redirect to the session URL — simpler and safer, nothing to
paste client-side).

Do these **in order**. Steps 1–3 are required or the gate locks everyone out.

## 1. Set the three Cloudflare secrets (never in chat/git)
From the repo root:
```
npx wrangler pages secret put STRIPE_SECRET_KEY --project-name=cpi-app     # sk_live_…
npx wrangler pages secret put STRIPE_WEBHOOK_SECRET --project-name=cpi-app  # whsec_… (from the webhook endpoint)
npx wrangler pages secret put CLERK_SECRET_KEY --project-name=cpi-app       # Clerk backend key (Clerk → API keys → Secret key)
```

## 2. Give yourself an admin bypass (or you lock yourself out)
The gate now requires an active Terminal subscription. Set your own email(s) so you keep
access without subscribing — also your safety net:
```
npx wrangler pages secret put ADMIN_EMAILS --project-name=cpi-app          # e.g. alexander.balieu@gmail.com
```
(Comma-separate multiple. Requires step 3 so your email reaches the worker.)

## 3. Add tier + email to the Clerk session token
Clerk Dashboard → **Sessions → Customize session token → Edit**, add:
```json
{
  "tier": "{{user.public_metadata.tier}}",
  "email": "{{user.primary_email_address}}"
}
```
Save. This is what lets the worker read `claims.tier` (set by the webhook) and
`claims.email` (for the admin bypass). Without it, nobody gets Terminal access.

## 4. Confirm the Stripe webhook endpoint
Stripe → Developers → Webhooks. The endpoint you created must be:
- URL: `https://app.crawlpriceindex.com/api/stripe-webhook`
- Events: `checkout.session.completed`, `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted`
Its signing secret (`whsec_…`) is what you put in step 1.

## 5. Deploy
```
npx wrangler pages deploy app --project-name=cpi-app --commit-dirty=true
```
Look for `✨ Uploading Worker bundle` (the gate compiled). Then verify the gate still holds:
```
curl -s https://app.crawlpriceindex.com/private/domains.json | head -c 80
curl -s https://app.crawlpriceindex.com/api/domains | head -c 80
```
Want `not accessible directly` and `authentication required`.

## 6. Test the money flow (LIVE — real charges, refundable)
You went straight to live, so there is no test card; use a real card and refund yourself
in Stripe afterward.

**Subscription:** sign in → Account & data → **Subscribe — €49/mo** → pay → you return to
the Account tab; within a few seconds the webhook sets your tier and the panel flips to
"Terminal active". The per-domain downloads and dashboard data now work. Open **Manage
billing** → confirm the Stripe portal opens → cancel there to test cancellation (the
webhook drops your tier).

**Snapshot:** **Buy single snapshot — €29** → pay → you return and the dataset download
starts automatically (also a fallback link). No subscription, no ongoing access — exactly
the one-off.

Refund both test charges in Stripe (Payments → the payment → Refund).

## How access actually works (for later you)
- Purchase → Stripe → `/api/stripe-webhook` (signature-verified) → writes
  `public_metadata.tier` on the Clerk user via the Clerk backend API.
- Clerk puts that `tier` into the session token (step 3).
- `/api/domains` allows the request only if `tier === "terminal"` OR the email is in
  `ADMIN_EMAILS`; otherwise **402 subscription required**.
- Snapshot is a separate one-off: `/api/snapshot?session_id=…` re-verifies the paid
  Checkout session with Stripe and streams the current dataset once. No tier, no webhook.

## Still to do before real customers (not blocking your own test)
- **Clerk production instance.** You're on `pk_test_…`. Swap `app/config.js` to the
  production publishable key and set `CLERK_SECRET_KEY` to the production backend key
  before charging strangers. (The worker's `FRONTEND_API` constant also points at the
  test instance — update it to the production Frontend API host at the same time.)
- Optional: the 24-month founding-rate clause in `terms.html` — say the word.
