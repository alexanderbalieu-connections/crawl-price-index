const fs = require("fs");
let s = fs.readFileSync("worker.js", "utf8");
if (s.includes("Unsubscribe anytime</a>")) { console.log("already final — skipping"); process.exit(0); }
const SL = "async function sendListEmail";
const S1 = "async function subscribe(request, env, cors) {";
const S2 = "\nasync function confirmSub";
const W1 = "  // welcome email: instant free sample link (non-fatal)";
const W2 = '  } catch (e) { console.error("welcome email FAILED", String(e)); }';
if (![SL, S1, S2, W1, W2].every(x => s.includes(x))) { console.error("anchors missing — aborting, worker untouched"); process.exit(1); }
fs.writeFileSync("worker.js.bak8", s);

// shared branded shell (skip if a previous partial run added it)
if (!s.includes("function brandCard")) {
  const helper = `function brandCard(bodyHtml) {
  return '<div style="background:#eef2f0;padding:24px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">'
    + '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #dde4e1">'
    + '<tr><td style="background:#0b0d0e;padding:18px 28px"><div style="font-family:ui-monospace,Menlo,monospace;font-size:12px;letter-spacing:.22em;color:#3cf08a">THE WEEKLY CRAWL</div>'
    + '<div style="font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#6b787d;margin-top:4px">what the web charges AI to read it</div></td></tr>'
    + '<tr><td style="padding:26px 28px;font-family:ui-monospace,Menlo,monospace;font-size:13.5px;color:#0b0d0e;line-height:1.7">' + bodyHtml + '</td></tr>'
    + '<tr><td style="padding:0 28px 22px;font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#9aa5a1">The Crawl Price Index &middot; <a href="https://crawlpriceindex.com" style="color:#2e9e5b">crawlpriceindex.com</a></td></tr>'
    + '</table></td></tr></table></div>';
}
const btn = (href, label) => '<p style="margin:18px 0"><a href="' + href + '" style="display:inline-block;background:#2e9e5b;color:#ffffff;font-family:ui-monospace,Menlo,monospace;font-size:13px;padding:12px 22px;text-decoration:none">' + label + ' &rarr;</a></p>';

`;
  s = s.slice(0, s.indexOf(SL)) + helper + s.slice(s.indexOf(SL));
}

// branded confirm email with cancel link
const newSub = `async function subscribe(request, env, cors) {
  let email = "";
  try { email = (await request.json()).email || ""; } catch { }
  email = String(email).trim().toLowerCase();
  if (!email || !email.includes("@") || email.length > 254) return json({ error: "valid email required" }, 400, cors);
  const existing = await env.KEYS.get("sub:" + email, "json");
  if (!existing || existing.status !== "active") {
    await env.KEYS.put("sub:" + email, JSON.stringify({ status: "pending", created: new Date().toISOString() }), { metadata: { s: "pending" } });
    const t = await subToken(env, email);
    const cUrl = "https://api.crawlpriceindex.com/v1/confirm?e=" + encodeURIComponent(email) + "&t=" + t;
    const xUrl = "https://api.crawlpriceindex.com/v1/unsubscribe?e=" + encodeURIComponent(email) + "&t=" + t;
    const txt = "Confirm your free subscription to The Weekly Crawl.\\n\\nYou get: an instant free data sample (top-100 domains, full AI-crawler rows) + one email a week with the movers of the crawl economy.\\n\\nConfirm: " + cUrl + "\\n\\nNot you? Cancel: " + xUrl;
    const htm = brandCard('<p style="margin:0 0 6px"><b>One click and you are in.</b></p>'
      + '<p style="margin:0">Confirming gets you an <b>instant free data sample</b> &mdash; the top-100 domains&#39; complete AI-crawler rows &mdash; plus one email a week with the movers of the crawl economy.</p>'
      + btn(cUrl, 'Confirm subscription')
      + '<p style="font-size:11.5px;color:#6b787d;margin:0">If you did not request this, ignore this email or <a href="' + xUrl + '" style="color:#6b787d">cancel the request</a>.</p>');
    try { await sendListEmail(env, email, "Confirm + get your free data sample", txt, htm); }
    catch (e) { console.error("confirm email FAILED", String(e)); }
  }
  return json({ message: "Check your inbox to confirm your subscription." }, 200, cors);
}
`;
s = s.slice(0, s.indexOf(S1)) + newSub + s.slice(s.indexOf(S2));

// branded welcome email with unsubscribe footer
const w1 = s.indexOf(W1), w2 = s.indexOf(W2) + W2.length;
const nw = `  // welcome email: instant free sample link (non-fatal)
  try {
    const st = await subToken(env, email);
    const sUrl = "https://api.crawlpriceindex.com/v1/sample?e=" + encodeURIComponent(email) + "&t=" + st;
    const uUrl = "https://api.crawlpriceindex.com/v1/unsubscribe?e=" + encodeURIComponent(email) + "&t=" + st;
    const wtxt = "You are in.\\n\\nYour free sample — the top 100 domains' complete AI-crawler rows, real data from the latest scan:\\n" + sUrl + "\\n\\nEvery week: which domains changed their AI policy, block-rate shifts, observed crawl prices.\\n\\nFull dataset — every domain, country editions, weekly history: https://crawlpriceindex.com/#access\\n\\nUnsubscribe: " + uUrl;
    const whtm = brandCard('<p style="margin:0 0 6px"><b>You are in.</b></p>'
      + '<p style="margin:0">Here is your free sample &mdash; the top-100 domains&#39; complete AI-crawler rows, real data from the latest scan:</p>'
      + btn(sUrl, 'Open your sample')
      + '<p style="margin:0 0 4px">Every week from here: <b>which domains changed their AI policy</b>, block-rate shifts, and observed crawl prices.</p>'
      + '<p style="font-size:12px;color:#6b787d;margin:10px 0 0">Full dataset &mdash; every domain, country editions, weekly history: <a href="https://crawlpriceindex.com/#access" style="color:#2e9e5b">Terminal, &euro;79/mo</a></p>'
      + '<p style="font-size:11px;margin:14px 0 0"><a href="' + uUrl + '" style="color:#9aa5a1">Unsubscribe anytime</a></p>');
    await sendListEmail(env, email, "Your free Crawl Price Index sample", wtxt, whtm);
  } catch (e) { console.error("welcome email FAILED", String(e)); }`;
s = s.slice(0, w1) + nw + s.slice(w2);

fs.writeFileSync("worker.js", s);
console.log("FINAL branded emails + unsubscribe everywhere (backup: worker.js.bak8)");
