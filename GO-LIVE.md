# Final setup — from here to fully hands-off

You've done the hard parts (domain, deploy, Stripe live). These last steps
publish the finished version and make the data refresh itself forever. After
this, you touch nothing.

## STEP 1 — Connect your Mac to the repo (one time, ~5 min, with Claude)
In Terminal, from inside this folder:

    cd ~/Downloads/crawl-price-index        # or wherever this folder is
    git init
    git remote add origin https://github.com/alexanderbalieu-connections/crawl-price-index.git
    git add -A
    git commit -m "Live: payments + automation"
    git branch -M main
    git push -u origin main

If git asks you to sign in to GitHub, do it (browser popup or a token).
Claude will walk you through any prompt. This pushes EVERYTHING live:
the Subscribe button, payment pages, scan + rebuild scripts, and the
auto-refresh workflow.

Cloudflare auto-deploys ~30s after the push. crawlpriceindex.com is now the
finished version with a working Subscribe button.

## STEP 2 — Turn on auto-refresh (two clicks in GitHub web)
1. Go to github.com/alexanderbalieu-connections/crawl-price-index
2. Settings → Actions → General → scroll to "Workflow permissions"
3. Select "Read and write permissions" → Save.

That's it. Every Monday, GitHub runs the scan itself, rebuilds the data, and
commits — Cloudflare redeploys. Your PC is never involved. If a scan is thin,
it safely skips publishing and keeps the good data.

(Optional: Actions tab → "Weekly crawl scan" → "Run workflow" to trigger a
refresh by hand any time. You never have to.)

## STEP 3 — Prove the money works (~2 min)
1. Open crawlpriceindex.com, click Subscribe, pay €79 with your OWN card.
2. Check Stripe → Payments: you'll see the €79 land.
3. Refund it: click the payment → Refund → full. Costs you only a few cents
   of fees, and confirms the whole flow works for real.

## STEP 4 — Inbox (~3 min, anytime)
Cloudflare → crawlpriceindex.com → Email → Email Routing → enable, and forward
hello@crawlpriceindex.com to your normal email. Now enquiries + Stripe
receipts reach you.

---

## After all this, your involvement is: NONE.
- Site: live, self-deploying.
- Payments: live, VAT handled by Stripe.
- Data: refreshes itself weekly in the cloud.
- You: watch your inbox for the first "how do I get the data?" email, and your
  Stripe dashboard for the first subscriber. That's not work — that's the fun part.
