const fs = require("fs");
const F = "public/index.html";
let s = fs.readFileSync(F, "utf8");
if (s.includes("wk-form")) { console.log("already patched — skipping"); process.exit(0); }
const LI = "<li>Cite us — attribution appreciated</li>";
const a = s.indexOf(LI);
const ulEnd = a === -1 ? -1 : s.indexOf("</ul>", a);
const wa = s.indexOf("(function wireCTA(){");
const wb = wa === -1 ? -1 : s.indexOf("})();", wa);
if (a === -1 || ulEnd === -1 || wa === -1 || wb === -1) { console.error("anchors missing — aborting, nothing touched"); process.exit(1); }
fs.writeFileSync(F + ".bak2", s);

const form = `
        <div style="margin-top:18px;font-family:'Spline Sans Mono',monospace;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--bright)">The Weekly Crawl — free, one email a week</div>
        <form id="wk-form" style="margin-top:10px">
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <input id="wk-email" type="email" required placeholder="you@company.com" style="flex:1;min-width:170px;background:#0b0d0e;border:1px solid var(--line);color:var(--fg);font-family:'Spline Sans Mono',monospace;font-size:13px;padding:11px 12px;outline:none">
            <button class="btn" type="submit" style="margin-top:0;cursor:pointer;background:transparent">Get it free →</button>
          </div>
          <div id="wk-msg" style="margin-top:10px;font-family:'Spline Sans Mono',monospace;font-size:12px;color:var(--dim)"></div>
        </form>`;
const insertAt = ulEnd + "</ul>".length;
s = s.slice(0, insertAt) + form + s.slice(insertAt);

const handler = `

  // Weekly Crawl signup
  (function wireWeekly(){
    const f = document.getElementById('wk-form');
    if (!f) return;
    const msg = document.getElementById('wk-msg');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('wk-email').value.trim();
      if (!email) return;
      msg.textContent = 'sending…';
      try {
        const r = await fetch('https://api.crawlpriceindex.com/v1/subscribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const j = await r.json();
        msg.textContent = j.message || j.error || 'something went wrong';
      } catch (err) { msg.textContent = 'network error — try again'; }
    });
  })();`;
const wEnd = s.indexOf("})();", s.indexOf("(function wireCTA(){")) + 5;
s = s.slice(0, wEnd) + handler + s.slice(wEnd);

fs.writeFileSync(F, s);
console.log("Weekly Crawl signup form added (backup: public/index.html.bak2)");
