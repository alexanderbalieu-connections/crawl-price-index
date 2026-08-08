# Going live with payments — your 10-minute Stripe step

Everything else is built. This is the ONE thing only you can do (it's tied to
your bank + identity). When you finish, you paste Claude ONE link and the
Subscribe button goes live.

## 1. Create the Stripe account
- Go to stripe.com → Sign up. Use your business/freelancer details (Luxembourg).
- You can start in TEST mode to see it work, then flip to LIVE. For real money,
  you'll complete "Activate account" (bank IBAN + ID). ~10 min.

## 2. Create the product + Payment Link
- Dashboard → Product catalogue → + Add product.
  - Name: Terminal — The Crawl Price Index
  - Price: €79.00, Recurring, Monthly.
  - Save.
- Dashboard → Payment Links → + New → pick the Terminal product.
  - Under "After payment": choose "Don't show confirmation page → Redirect"
    and set the URL to:  https://crawlpriceindex.com/success.html
  - (Optional) There isn't a native cancel-redirect on Payment Links; the
    cancel.html page is there for the checkout-session flow if you upgrade later.
  - Create link. Copy the URL — looks like  https://buy.stripe.com/xxxxxxxx

## 3. Send Claude that link
Paste it in chat. Claude swaps it into the site (replaces the
__STRIPE_PAYMENT_LINK__ placeholder), redeploys, and the button is live.

## What happens then
- Buyer clicks Subscribe → pays €79/mo by card on Stripe's page → lands on your
  success.html → money goes to your bank. Stripe emails them a receipt.
- VAT note: as a Luxembourg seller to EU/global businesses, consider Stripe Tax
  (toggle in Stripe) or a merchant-of-record (Paddle/Lemon Squeezy) later so VAT
  is handled for you. Not needed to start.

## Until you paste the link
The Subscribe button already works as a fallback: it opens a pre-filled enquiry
email to hello@crawlpriceindex.com, so no interested buyer is ever lost.
