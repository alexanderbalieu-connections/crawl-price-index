const fs = require("fs");
let s = fs.readFileSync("worker.js", "utf8");
if (s.includes("Unsubscribe anytime</a>")) { console.log("already patched"); process.exit(0); }
const W1 = "  // welcome email: instant free sample link (non-fatal)";
const W2 = '  } catch (e) { console.error("welcome email FAILED", String(e)); }';
const CI = `'<p style="font-size:11.5px;color:#6b787d;margin:0">If you did not request this, ignore this email.</p>'`;
if (!s.includes(W1) || !s.includes(W2) || !s.includes(CI)) { console.error("anchors missing — aborting"); process.exit(1); }
fs.writeFileSync("worker.js.bak7", s);

// confirm email: add a cancel link (works on pending rows too — unsubscribe deletes the record)
s = s.replace(CI, `'<p style="font-size:11.5px;color:#6b787d;margin:0">If you did not request this, ignore this email or <a href="https://api.crawlpriceindex.com/v1/unsubscribe?e=' + encodeURIComponent(email) + '&t=' + t + '" style="color:#6b787d">cancel the request</a>.</p>'`);

// welcome email: rebuilt with unsubscribe footer (same token signs sample + unsubscribe)
const w1 = s.indexOf(W1), w2 = s.indexOf(W2) + W2.length;
const nw = `  // welcome email: instant free sample link (non-fatal)
  try {
    const st = await subToken(env, email);
    const sUrl = "https://api.crawlpriceindex.com/v1/sample?e=" + encodeURIComponent(email) + "&t=" + st;
    const uUrl = "https://api.crawlpriceindex.com/v1/unsubscribe?e=" + encodeURIComponent(email) + "&t=" + st;
    const wtxt = "You are in.\\n\\nYour free sample — the top 100 domains' complete AI-crawler rows, real data from the latest scan:\\n" + sUrl + "\\n\\nEvery week: which domains changed their AI policy, block-rate shifts, observed crawl prices.\\n\\nFull dataset — every domain, country editions, weekly history: https://crawlpriceindex.com/#access\\n\\nUnsubscribe: " + uUrl;
    const whtm = brandCard('<p style="margin:0 0 6px"><b>You are in.</b></p>'
      + '<p style="margin:0">Here is your free sample — the top-100 domains&#39; complete AI-crawler rows, real data from the latest scan:</p>'
      + btn(sUrl, 'Open your sample')
      + '<p style="margin:0 0 4px">Every week from here: <b>which domains changed their AI policy</b>, block-rate shifts, and observed crawl prices.</p>'
      + '<p style="font-size:12px;color:#6b787d;margin:10px 0 0">Full dataset &mdash; every domain, country editions, weekly history: <a href="https://crawlpriceindex.com/#access" style="color:#2e9e5b">Terminal, &euro;79/mo</a></p>'
      + '<p style="font-size:11px;margin:14px 0 0"><a href="' + uUrl + '" style="color:#9aa5a1">Unsubscribe anytime</a></p>');
    await sendListEmail(env, email, "Your free Crawl Price Index sample", wtxt, whtm);
  } catch (e) { console.error("welcome email FAILED", String(e)); }`;
s = s.slice(0, w1) + nw + s.slice(w2);

fs.writeFileSync("worker.js", s);
console.log("unsubscribe on all list emails (backup: worker.js.bak7)");
