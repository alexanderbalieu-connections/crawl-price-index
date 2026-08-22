# CPI — Morning brief (prepared overnight 2026-08-20 → 21)

## ✅ Done while you slept (on disk, ready to ship)

1. **Reachability → dashboard, fully wired.** `compute-dashboard.cjs` now folds the latest sweep summary into `dashboard.json`, and the Full-detail page gained a **"Frame reachability — is the ranked web even alive?"** panel (alive / DNS-dead / timeout bars, the 93.8%-diagnostic sentence baked in, bot-walled called out as declared-vs-wire divergence). Renders only when sweep data exists — nothing breaks if it's absent. CSS guard: clean.
2. **Homepage:** snapshot €29 CTA added beside the Terminal CTA; Sign-in restyled bold ledger-green (all 17 pages).
3. **Sunday run:** reachability sweep wired in (resumable, non-fatal).
4. **KU Leuven email drafted** — below, ready to paste.

## ▶️ Your morning sequence (in order, ~20 min of clicking)

**1. Check the sweep finished** (Terminal that ran overnight, or):
```
cd ~/crawl-price-index && node sweep-reachability.cjs --status
```
If interrupted: `node sweep-reachability.cjs` resumes where it stopped.

**2. Rebuild + deploy everything pending** (reachability panel, homepage snapshot CTA, sign-in style):
```
cd ~/crawl-price-index
node compute-dashboard.cjs
npx wrangler pages deploy app --project-name=cpi-app --commit-dirty=true
npx wrangler deploy
```
(Then hard-refresh: Cmd+Shift+R.) Full detail should show the new reachability panel with real 50k numbers.

**3. Send the KU Leuven email** (from your normal address, to `tranco@lists.kuleuven.be` — verify the current contact on tranco-list.eu/contact first):

> Subject: Commercial use of a custom Tranco configuration — licence question
>
> Dear Tranco team,
>
> I operate the Crawl Price Index (crawlpriceindex.com), a small commercial research product that publishes a weekly census of robots.txt policy toward AI crawlers across a top-50,000 domain frame. Subscribers can download the per-domain results.
>
> I am aware the default Tranco list incorporates provider sources under differing terms (Cloudflare Radar under CC BY-NC, CrUX under CC BY-SA). To stay clearly within everyone's licences, I intend to generate a **custom Tranco configuration excluding Cloudflare Radar and CrUX**, using only the remaining providers, and to use that ranking solely as a *selection frame* (which 50,000 domains to observe) — I do not republish the ranking itself beyond the rank position alongside my own measurements.
>
> Could you confirm, or point me to the applicable terms: (1) whether commercial use of a custom list configured this way is acceptable from Tranco's side; (2) whether any provider terms still attach to a Radar/CrUX-free configuration that I should be aware of; and (3) how you would like Tranco attributed in a commercial product (I currently cite the Tranco paper).
>
> Happy to share more detail about the product. Thank you for the service — it is the backbone of the project.
>
> Best regards, Alexander Balieu, Luxembourg

**4. Generate the clean frame** at https://tranco-list.eu (log in → Configure a custom list): providers = **Cisco Umbrella + Majestic + Farsight only** (untick Cloudflare Radar and CrUX), 30-day average, top 1M. Note the permalink ID it gives you (e.g. `https://tranco-list.eu/list/XXXXX`) — that ID *is* CPI-50K v1's provenance. Download isn't urgent; the ID is.

**5. Tell me:** (a) sweep result numbers, (b) homepage structure from NEXT-BUILDS.md — approve or amend, (c) the Tranco list ID.

## 🔨 What I build next (no action needed from you)

Once the sweep numbers land: the **news-flag join** (GDELT + Wikidata, positive-only, precision-gated), **site-evidence columns** into the gated CSV, and — on your approval — the **homepage v2 draft**. Then: head-curation prefill (top 1,000 pre-labelled from clean lists for you to verify), GDPR paperwork (LIA/DPIA memo, privacy notice at /privacy, suppression form), Pi headless runner.

## 📋 Standing decisions (all documented in the project)

Category layer = B + curated head + news flag (4-AI unanimous; full taxonomy killed). Adult = aggregate-only. LLM labels = internal-only. No browser spoofing (standard Accept headers OK). Tranco frame regen = P0. x402 self-listing = build dark, launch after accountant answer. Pi 4 (4GB) fine — USB-SSD boot, swap on SSD, concurrency 16.

## ⏳ Pending externals

Timeout diagnostic ✅ done (93.8% confirmed dead — numbers stand). Full sweep ⏳ running. KU Leuven reply ⏳ after you send. Accountant (USDC booking) ⏳ when convenient. Google OAuth consent-screen publish state ❓ still unverified — 60 seconds in console.cloud.google.com when you're near it.
