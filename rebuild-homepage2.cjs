const fs = require("fs");
let s = fs.readFileSync("homepage-backups/index.html.bak", "utf8");

const C = ".btn:hover{background:var(--signal);color:#000}";
if (!s.includes(C)) { console.error("CSS anchor missing"); process.exit(1); }
s = s.replace(C, C + `
  .cta-row{display:flex;gap:14px;align-items:stretch;margin-top:32px;flex-wrap:wrap}
  .cta-row .btn{margin-top:0;font-size:14px;padding:0 24px;display:inline-flex;align-items:center}
  .btn-solid{font-family:"Spline Sans Mono",monospace;font-size:14px;font-weight:600;letter-spacing:.04em;padding:0 26px;height:52px;background:var(--signal);color:#000;text-decoration:none;display:inline-flex;align-items:center}
  .btn-solid:hover{background:#5df7a1}
  .cta-note{margin-top:14px;font-family:"Spline Sans Mono",monospace;font-size:12px;color:var(--dim)}
  .wk-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
  .wk-in{flex:1;min-width:190px;background:#0b0d0e;border:1px solid var(--line);color:var(--fg);font-family:"Spline Sans Mono",monospace;font-size:13px;padding:11px 12px;outline:none}
  .wk-in:focus{border-color:var(--signal)}
  .wk-btn{margin-top:0;cursor:pointer;background:transparent;font-family:"Spline Sans Mono",monospace;font-size:13px;letter-spacing:.04em;padding:11px 18px;border:1px solid var(--signal);color:var(--signal)}
  .wk-btn:hover{background:var(--signal);color:#000}
  .wk-msg{margin-top:8px;font-family:"Spline Sans Mono",monospace;font-size:12px;color:var(--dim)}
  .wk-lab{margin-top:26px;font-family:"Spline Sans Mono",monospace;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--bright)}`);

const H = '<div class="asof">Baseline scan · <b id="asof">—</b> · <b id="parsed">—</b> domains parsed · Tranco top <b id="topn">—</b></div>';
if (!s.includes(H)) { console.error("hero anchor missing"); process.exit(1); }
const wkForm = (ph) => `<form data-wk style="max-width:430px">
      <div class="wk-row">
        <input class="wk-in" type="email" required placeholder="${ph}">
        <button class="wk-btn" type="submit">Get it free →</button>
      </div>
      <div class="wk-msg" data-msg></div>
    </form>`;
s = s.replace(H, H + `
    <div class="cta-row">
      <a class="btn-solid" href="#access" id="cta-hero">Subscribe — €79/mo →</a>
      <a class="btn" href="#access">What's included ↓</a>
    </div>
    <div class="cta-note">Full per-domain dataset · weekly history · API access · cancel anytime</div>
    <div class="wk-lab">Or start free — data sample + The Weekly Crawl</div>
    ${wkForm("you@company.com")}`);

let a = s.indexOf("(function wireCTA(){");
let b = s.indexOf("})();", a);
if (a === -1 || b === -1) { console.error("wireCTA anchor missing"); process.exit(1); }
s = s.slice(0, a) + `(function wireCTA(){
    const linkReady = STRIPE_LINK && !STRIPE_LINK.startsWith('__');
    for (const cta of document.querySelectorAll('#cta, #cta-hero')) {
      if (linkReady) { cta.href = STRIPE_LINK; }
      else {
        cta.href = 'mailto:' + CONTACT_EMAIL + '?subject=Terminal%20access';
        cta.textContent = 'Request access \\u2192';
      }
    }
  })();` + s.slice(b + 5);

a = s.indexOf("(function wireCTA(){");
b = s.indexOf("})();", a) + 5;
s = s.slice(0, b) + `

  // Weekly Crawl signup — every form marked data-wk
  (function wireWeekly(){
    document.querySelectorAll('form[data-wk]').forEach(function(f){
      const input = f.querySelector('input');
      const msg = f.querySelector('[data-msg]');
      f.addEventListener('submit', async function(e){
        e.preventDefault();
        const email = input.value.trim();
        if (!email) return;
        msg.textContent = 'sending\\u2026';
        try {
          const r = await fetch('https://api.crawlpriceindex.com/v1/subscribe', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
          });
          const j = await r.json();
          msg.textContent = j.message || j.error || 'something went wrong';
        } catch (err) { msg.textContent = 'network error \\u2014 try again'; }
      });
    });
  })();` + s.slice(b);

const LI = "<li>Cite us — attribution appreciated</li>";
const li = s.indexOf(LI);
const ul = li === -1 ? -1 : s.indexOf("</ul>", li);
if (ul === -1) { console.error("observer anchor missing"); process.exit(1); }
const at = ul + "</ul>".length;
s = s.slice(0, at) + `
        <div class="wk-lab">Free data sample + The Weekly Crawl</div>
        ${wkForm("you@company.com")}` + s.slice(at);

const AC = '<section id="access">';
if (!s.includes(AC)) { console.error("access anchor missing"); process.exit(1); }
s = s.replace(AC, `<section id="why">
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

` + AC);

const si = s.lastIndexOf("<script>");
const sj = s.indexOf("</script>", si);
try { new Function(s.slice(si + 8, sj)); } catch (e) { console.error("VALIDATION FAILED (script):", e.message); process.exit(1); }
const m = s.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/);
try { JSON.parse(m[1]); } catch (e) { console.error("VALIDATION FAILED (payload):", e.message); process.exit(1); }
fs.writeFileSync("public/index.html", s);
console.log("homepage v2 — hero signup + observer signup, script OK, payload OK");
