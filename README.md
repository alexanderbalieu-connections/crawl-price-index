# The Crawl Price Index

A living observatory of the crawl economy — what the web charges AI to read it.

## Structure
- `index.html` — landing page, renders from an inline JSON payload (self-contained, no build step)
- `methodology.html` — the trust anchor / method page
- `index.json` — machine-readable data feed
- `llms.txt` — machine discovery file
- `robots.txt` — our own crawl policy
- `scan.cjs` — the scanner that regenerates the dataset (Node 18+, run weekly)

## Deploy (same stack as ChainVerdict)
1. Push this folder to a GitHub repo.
2. Render → New Static Site → point at the repo, publish directory = root.
3. Cloudflare DNS → point domain at Render.
4. (Optional) enable Cloudflare pay-per-crawl on `/index.json` so agents pay to read the feed.

## Weekly refresh
1. `node scan.cjs --top 10000` on any machine with Node.
2. Feed the three output files back through the dataset processor to regenerate `index.json` and the inline payload.
3. Commit — Render auto-deploys. The weekly commit history *is* the time-series moat.

## Roadmap
- Country / language editions (needs full `scan-robots.csv` per-domain rows, segmented by ccTLD)
- TDM-reservation (TDMRep) adoption index — EU-native signal class
- Web Bot Auth verified-crawler registration → legitimate price quotes at scale
