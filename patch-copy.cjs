const fs = require("fs");
const swaps = [
  ['content="A living observatory of the crawl economy: observed pay-per-crawl prices, AI-bot block rates, and paywall signals across the web. Updated weekly."',
   'content="We track what the web charges AI to read it: observed pay-per-crawl prices, payment signals, and AI-crawler block rates across the Tranco top 50,000. Updated weekly."'],
  ['Block rates · Tranco top 2,000', 'Block rates · across the scanned web'],
  ['Across the top 2,000 sites on the web, fewer than one in five block any given AI crawler in ',
   'Across the tens of thousands of domains we scan each week, fewer than one in six block any given AI crawler in '],
  ['roughly four to five times higher', 'roughly five times higher'],
  ['These are the whole-web figures, refreshed weekly.',
   'Blocking is where this story starts, not where it ends: the sites that gate crawlers hardest are the ones that go on to name a price. These are the whole-web figures, refreshed weekly.'],
  ['aria-label="AI crawler block rates, top 2000 domains"', 'aria-label="AI crawler block rates across the scanned web"'],
  ["k:'of the top 2,000 web domains block GPTBot in robots.txt'",
   "k:'of the '+D.robots_parsed.toLocaleString()+' domains scanned this week block GPTBot in robots.txt'"],
];
for (const f of ["public/index.html", "homepage-backups/index.html.bak"]) {
  if (!fs.existsSync(f)) { console.log("skip (missing): " + f); continue; }
  let s = fs.readFileSync(f, "utf8");
  if (s.includes("across the scanned web")) { console.log("already patched: " + f); continue; }
  let done = 0;
  for (const [a, b] of swaps) { if (s.includes(a)) { s = s.split(a).join(b); done++; } }
  if (done < swaps.length) { console.error("only " + done + "/" + swaps.length + " anchors matched in " + f + " — aborting this file"); continue; }
  const i = s.lastIndexOf("<script>"), j = s.indexOf("</script>", i);
  try { new Function(s.slice(i + 8, j)); } catch (e) { console.error("VALIDATION FAILED script " + f + ": " + e.message); continue; }
  const m = s.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/);
  try { JSON.parse(m[1]); } catch (e) { console.error("VALIDATION FAILED payload " + f + ": " + e.message); continue; }
  fs.writeFileSync(f, s);
  console.log("copy pass applied: " + f);
}
