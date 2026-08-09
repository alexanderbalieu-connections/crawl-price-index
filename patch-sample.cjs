const fs = require("fs");
let s = fs.readFileSync("worker.js", "utf8");
if (s.includes("/v1/sample")) { console.log("already patched"); process.exit(0); }
const R = 'if (path === "/v1/confirm") return confirmSub(url, env);';
const P = 'await env.KEYS.put("sub:" + email, JSON.stringify(rec), { metadata: { s: "active" } });';
const F = "// admin: subscriber counts";
if (!s.includes(R) || !s.includes(P) || !s.includes(F)) { console.error("anchors missing — aborting"); process.exit(1); }
fs.writeFileSync("worker.js.bak5", s);
s = s.replace(R, R + '\n    if (path === "/v1/sample") return sampleData(url, env, cors);');
s = s.replace(P, P + `
  // welcome email: instant free sample link (non-fatal)
  try {
    const st = await subToken(env, email);
    const sUrl = "https://api.crawlpriceindex.com/v1/sample?e=" + encodeURIComponent(email) + "&t=" + st;
    await sendListEmail(env, email, "Your free Crawl Price Index sample",
      "Welcome to The Weekly Crawl.\\n\\nYour free sample — the top 100 domains' full AI-crawler rows, real data from the latest scan:\\n" + sUrl + "\\n\\nEvery week you'll get the movers: which domains changed their AI policy, block-rate shifts, and observed crawl prices.\\n\\nFull dataset (every domain, country editions, history): https://crawlpriceindex.com/#access",
      '<div style="font-family:ui-monospace,Menlo,monospace;max-width:560px;color:#0b0d0e"><p>Welcome to <b>The Weekly Crawl</b>.</p><p>Your free sample — the top 100 domains&#39; complete AI-crawler rows, real data from the latest scan:</p><p><a href="' + sUrl + '" style="display:inline-block;background:#2e9e5b;color:#fff;padding:12px 20px;text-decoration:none">Open your sample &rarr;</a></p><p style="font-size:13px;color:#3b4548">Every week: which domains changed their AI policy, block-rate shifts, observed crawl prices.</p><p style="font-size:12px;color:#6b787d">Full dataset — every domain, country editions, weekly history: <a href="https://crawlpriceindex.com/#access" style="color:#2e9e5b">crawlpriceindex.com</a></p></div>');
  } catch (e) { console.error("welcome email FAILED", String(e)); }`);
const fn = `// gated free sample (confirmed subscribers only)
async function sampleData(url, env, cors) {
  const email = String(url.searchParams.get("e") || "").trim().toLowerCase();
  const t = url.searchParams.get("t") || "";
  if (!email || t !== await subToken(env, email)) return json({ error: "invalid link" }, 401, cors);
  const rec = await env.KEYS.get("sub:" + email, "json");
  if (!rec || rec.status !== "active") return json({ error: "confirm your subscription first" }, 403, cors);
  const raw = await env.DATA.get("sample");
  if (!raw) return json({ error: "sample not yet published — try again shortly" }, 503, cors);
  return new Response(raw, { headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors } });
}

`;
s = s.slice(0, s.indexOf(F)) + fn + s.slice(s.indexOf(F));
fs.writeFileSync("worker.js", s);
console.log("sample endpoint + welcome email added (backup: worker.js.bak5)");
