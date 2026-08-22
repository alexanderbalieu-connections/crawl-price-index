# CPI — Next Builds: x402 dogfooding · homepage overhaul · Raspberry Pi
*2026-08-20 · covers Alex's points 3, 4, 5 · decisions needed marked ⚑*

---

## 1. Selling CPI itself over x402 ("the whole payment cycle")

**The idea, and why it's excellent:** CPI becomes a seller in the very market it measures. An endpoint on our own domain advertises a machine-payable price for the snapshot dataset; machines pay in USDC on Base; we appear in the Coinbase discovery registry — which means **CPI shows up in its own Bazaar tab as a genuine in-frame seller**. Marketing, product, and methodological credibility in one move: "we don't just census the machine-payment economy, we participate, and here's what participation looks like from the inside." Also makes us blocker-adjacent commentary: we'd be the frame's most honest data point.

**How the cycle works (x402 protocol):**
1. Machine hits `GET https://api.crawlpriceindex.com/x402/snapshot` with no payment → we respond **HTTP 402** with a JSON body advertising `accepts: [{scheme:"exact", network:"eip155:8453" (Base), asset: USDC contract, amount, payTo: our address, resource, description}]`.
2. Buyer constructs an EIP-3009 `transferWithAuthorization` payment payload, retries with an `X-PAYMENT` header.
3. Our worker forwards the payload to a **facilitator** (Coinbase's hosted facilitator via CDP) which verifies + settles on-chain, returns success.
4. We stream the snapshot CSV. Receipt = the settlement hash.
5. Separately, we register the endpoint in the **CDP x402 discovery registry** ("Bazaar") so it becomes discoverable — and appears in our own weekly capture.

**Build plan (worker-side, ~1 day + accounts):**
- New route in the marketing worker (api.crawlpriceindex.com): `/x402/snapshot` (and later `/x402/lookup/{domain}` at $0.01/query — micro-price per-domain lookups are the natural machine product and match the Bazaar's median).
- Env: `X402_PAYTO` (a fresh dedicated wallet address), `CDP_API_KEY` (facilitator auth). No private keys in the worker — settlement is facilitator-side; we only *receive*.
- Price ⚑: snapshot at **$29** (parity with Stripe) or a machine-native price (e.g. $9)? Recommend **parity ($29)** to avoid undercutting the human tier; per-domain lookup at **$0.01** as the micro product.
- Accounting: x402 sales bypass Stripe → no VAT handling. ⚑ Check with accountant how USDC receipts are booked (Luxembourg; crypto receipts for services). Keep volumes trivial until answered.
- Registry listing: opt-in via CDP once the endpoint is live.
- Guard rails: the Bazaar tab's copy guard already asserts "distinct pay-to addresses > 1" etc. — our own listing changes nothing (one more seller). Add a small honesty note in the Bazaar tab: "CPI itself lists a machine-payable endpoint in this registry (marked in the data)."
- Dashboard: flag `crawlpriceindex.com` rows as `self` in the intersection so we never count ourselves as an independent data point in headlines.

**Sequencing:** after the 20 Sept launch-critical items. It needs a CDP account, a wallet, and an accountant answer — none of which should block reachability/frame work. But the worker route + 402 response can be built and deployed dark (behind an env flag) any time.

---

## 2. Homepage/data overhaul

**The diagnosis is right.** The homepage currently leads with the weakest strong number ($0.50, n=1), buries the census (the actual product), gives a whole above-the-fold section to a speculative calculator, and retains country framing the reviews explicitly flagged. The dashboard meanwhile now has far stronger headline material than the marketing site uses.

**What we now have that's stronger than "$0.50, n=1":**
- **The census headline**: "X% of the top 50,000 domains explicitly block at least one AI crawler" — the defensible flagship number.
- **The asymmetry**: "1,571 domains block a training crawler while blocking no search crawler; 106 do the reverse — 14.8:1." This is *the* editorial finding and it's ours alone.
- **Policy changes with direction**: "161 changes this week: 92 more restrictive, 69 less — and 46 domains walked a block *back*."
- **The Bazaar**: "14,771 endpoints advertise a machine-payable price; median ask $0.01; only 23 of the top 50,000 domains participate." The $0.50 exhibit then lands as *contrast* (posted crawl price vs machine-market median), which is where it actually shines.
- **Declared vs enforced** (new, from the sweep): "N domains declare allow-all in robots.txt yet refuse an honest crawler on the wire."

**Proposed new homepage structure** ⚑ (approve before I rebuild):
1. **Hero**: the census headline % + one-line what-CPI-is. (Same masthead/nav.)
2. **01 The asymmetry** — training vs traffic, 14.8:1, with the copy-guard-approved sentence.
3. **02 What changed this week** — direction split + reversions (auto-updating from data, like the current f-* fields).
4. **03 The machine market** — Bazaar aggregate: endpoints, median ask, 23-of-50k penetration; $0.50 as the contrast exhibit inside this panel.
5. **04 The wall is rising** — block-rate trend (young-series language, "directional only").
6. **CTA row** (check a domain / Terminal / snapshot / free dashboard) + Weekly Crawl box (unchanged).
7. **The calculator moves to `/explore`** as its own page ("Explore: what could a priced crawl-web be worth?"), linked from the nav or from panel 03, framed exactly as it already is (sensitivity tool, no base case). It's good content — it's just not homepage content.
8. **Country/ccTLD framing**: strip from homepage entirely; on the dashboard it stays only as "suffix groups" with the existing disclaimer (that was the agreed line — suffix ≠ country, never "countries" as a headline cut). `/world` page ⚑: either reframe as "editions by suffix group" or fold into methodology. Recommend reframe, don't delete (SEO + inbound links).

**Process**: I draft the full new index.html against this structure (reusing the design system + live data fields), you review, we deploy, and `check-public.cjs` gets new assertions so the homepage numbers stay tethered to the data (e.g. the 14.8:1 sentence gets a guard).

---

## 3. Raspberry Pi migration ("set it and forget it")

**Goal:** the whole weekly pipeline runs unattended on a Pi; the Mac becomes irrelevant; you stop thinking about it until outreach.

**Hardware ⚑:** Pi 5 (8GB) + **NVMe/SSD hat or USB-SSD (mandatory — SD cards die under weekly 50k sweeps + git)** + case/fan + Ethernet. ~€120–150 all-in. (16GB variant if you want headroom; the sweep is network-bound, not memory-bound — 8GB is ample.)

**Compatibility audit (from the repo as it stands):**
- All pipeline scripts are plain Node (`.cjs`) — Node 22 LTS runs fine on ARM64 Raspberry Pi OS. ✔
- `wrangler` deploys: works on ARM64 Linux; needs one interactive `wrangler login` at setup (or an API token via `CLOUDFLARE_API_TOKEN`, better for headless). ✔
- `caffeinate` (macOS-only) → not needed on a Pi (no sleep). Remove/guard in the runner. ✔
- `sunday-run.command` is an interactive zsh script (prompts, `read -k1`) → needs a **headless twin**: `sunday-run-headless.sh` that skips prompts, logs to a dated file, and **emails you the outcome via Resend** (success summary or failure alert). The interactive one stays for manual runs.
- Scheduling: **systemd timer** (better than cron: catches missed runs with `Persistent=true`, restarts on failure). Sunday 06:00 CET.
- Secrets: `.env` on the Pi (Resend key, Cloudflare token, Stripe not needed — worker holds those). chmod 600.
- Git push: deploy key for the repo.
- **Failure visibility is the whole game** when you stop looking: (a) Resend email on non-zero exit, (b) the existing gate-verification curl already emails-worthy — include its output, (c) a dead-man's switch: if no successful run by Monday 09:00, healthchecks.io (free) pings you.

**Migration steps (half a day, most of it waiting):**
1. Flash Raspberry Pi OS Lite 64-bit → SSH on, hostname `cpi-pi`.
2. Install Node 22 (NodeSource ARM64), git, clone repo.
3. `CLOUDFLARE_API_TOKEN` scoped token (Pages:Edit, Workers:Edit) → env; test `npx wrangler whoami`.
4. Copy `editions/`, `history/`, `bazaar/`, state files from the Mac (rsync once).
5. Write `sunday-run-headless.sh` (I'll generate it from the existing script) + systemd service/timer + Resend notifier.
6. **Parallel run**: leave the Mac doing next Sunday manually, let the Pi run the same day; diff the outputs (`editions/<date>.csv.gz` hashes, dashboard.json). Cut over only when they match.
7. Dead-man's switch + a `STATUS.md` the Pi commits after each run so you can check from anywhere.

**One honest caveat:** residential-IP crawling from the Pi is the same network position as the Mac, so scan results should be identical. If your ISP CG-NATs or rate-limits, sweep times may stretch — the checkpoint/resume design already tolerates that.

---

## Order of everything now on the table

1. **Tonight**: full reachability sweep (started manually) — data before decisions.
2. **Launch-critical (before 20 Sept)**: timeout diagnostic → reachability states into pipeline+dashboard → CPI-50K clean frame + KU Leuven email → site-evidence columns → news flag join + gate → head curation → GDPR paperwork (LIA/DPIA memo, privacy notice, suppression form).
3. **Homepage overhaul** — after you ⚑ approve the structure above (draft takes me one pass).
4. **Pi migration** — parallel-run next Sunday, cut over the one after.
5. **x402 dogfooding** — build dark whenever; go live after accountant answer + launch.
