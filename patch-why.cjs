const fs = require("fs");
const F = "public/index.html";
let s = fs.readFileSync(F, "utf8");
if (s.includes('id="why"')) { console.log("already patched"); process.exit(0); }
const A = '<section id="access">';
if (!s.includes(A)) { console.error("anchor missing — aborting"); process.exit(1); }
fs.writeFileSync(F + ".bak3", s);
const sec = `<section id="why">
  <div class="wrap">
    <div class="kicker">Why this exists · the market moment</div>
    <h2>The web is becoming pay-to-read for machines. Nobody was keeping the price list.</h2>
    <p class="body"><a href="https://blog.cloudflare.com/introducing-pay-per-crawl/" rel="noopener">Cloudflare's pay-per-crawl</a> put HTTP 402 payments in front of millions of sites, and from 15 September 2026 AI crawlers are blocked by default across much of the web. <a href="https://tollbit.com" rel="noopener">TollBit</a> gates thousands of publisher sites behind token walls. Every week, more of the internet answers a crawler with a price instead of a page — but those prices are quoted machine-to-machine, invisible unless someone stands at the toll booth and writes them down. That's what we do. Every week. <a href="/methodology.html">Openly documented</a>.</p>
    <div class="cards" style="margin-top:28px">
      <div class="card"><div class="t">Publishers &amp; media</div><div class="big" style="font-size:19px;line-height:1.35">Price your content with evidence</div><div class="d">See what peers charge, gate, or give away before you negotiate an AI licensing deal — or set your own crawl price.</div></div>
      <div class="card"><div class="t">AI &amp; data teams</div><div class="big" style="font-size:19px;line-height:1.35">Know your crawl costs &amp; access</div><div class="d">Who blocks your bots, where enforcement is spreading, and what paid access runs — before it hits your pipeline.</div></div>
      <div class="card"><div class="t">Analysts &amp; journalists</div><div class="big" style="font-size:19px;line-height:1.35">The citable record</div><div class="d">Free headline figures, attribution-friendly, refreshed weekly — the reference point for the crawl economy.</div></div>
    </div>
  </div>
</section>

`;
s = s.replace(A, sec + A);
fs.writeFileSync(F, s);
console.log("why-section added (backup: public/index.html.bak3)");
