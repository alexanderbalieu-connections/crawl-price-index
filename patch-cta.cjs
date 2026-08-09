const fs = require("fs");
const F = "public/index.html";
let s = fs.readFileSync(F, "utf8");
if (s.includes("cta-hero")) { console.log("already patched — skipping"); process.exit(0); }

// 1) CSS after the existing .btn:hover rule
const C = ".btn:hover{background:var(--signal);color:#000}";
// 2) hero CTA row after the as-of line
const H = '<div class="asof">Baseline scan · <b id="asof">—</b> · <b id="parsed">—</b> domains parsed · Tranco top <b id="topn">—</b></div>';
// 3) rewire the CTA function to drive both buttons
const Ja = "(function wireCTA(){";
const ja = s.indexOf(Ja); const jb = s.indexOf("})();", ja);
if (!s.includes(C) || !s.includes(H) || ja === -1 || jb === -1) {
  console.error("anchor(s) not found — aborting, nothing touched"); process.exit(1);
}
fs.writeFileSync(F + ".bak", s);

s = s.replace(C, C + `
  .cta-row{display:flex;gap:14px;align-items:center;margin-top:32px;flex-wrap:wrap}
  .btn-solid{display:inline-block;font-family:"Spline Sans Mono",monospace;font-size:14px;font-weight:600;letter-spacing:.04em;padding:14px 26px;background:var(--signal);color:#000;text-decoration:none}
  .btn-solid:hover{background:#5df7a1}
  .cta-note{margin-top:14px;font-family:"Spline Sans Mono",monospace;font-size:12px;color:var(--dim)}`);

s = s.replace(H, H + `
    <div class="cta-row">
      <a class="btn-solid" href="#access" id="cta-hero">Subscribe — €79/mo →</a>
      <a class="btn" href="#access">What's included ↓</a>
    </div>
    <div class="cta-note">Full per-domain dataset · weekly history · API access · key by email in seconds · cancel anytime</div>`);

const newWire = `(function wireCTA(){
    const linkReady = STRIPE_LINK && !STRIPE_LINK.startsWith('__');
    for (const cta of document.querySelectorAll('#cta, #cta-hero')) {
      if (linkReady) {
        cta.href = STRIPE_LINK;
      } else {
        cta.href = 'mailto:' + CONTACT_EMAIL + '?subject=Terminal%20access%20%E2%80%94%20Crawl%20Price%20Index&body=I%27d%20like%20Terminal%20access%20to%20the%20full%20dataset%20and%20feed.';
        cta.textContent = 'Request access \\u2192';
      }
    }
  })();`;
s = s.slice(0, ja) + newWire + s.slice(jb + 5);

fs.writeFileSync(F, s);
console.log("hero CTA added (backup: public/index.html.bak)");
