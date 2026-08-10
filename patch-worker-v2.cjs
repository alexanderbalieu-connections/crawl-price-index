#!/usr/bin/env node
// Adds two things the reviews (correctly) said were missing:
//   GET  /v1/methodology   machine-readable provenance model - lets any
//                          third party verify HOW we measure, not just what
//   POST /v1/watch         per-domain change alerts: the recurring workflow
//                          that turns a dashboard into an owned decision
//   GET  /v1/watch/confirm  double opt-in, HMAC-signed, same as the list
const fs = require("fs");
let s = fs.readFileSync("worker.js", "utf8");
if (s.includes("/v1/methodology")) { console.log("worker already patched - skipping"); process.exit(0); }

const R = 'if (path === "/v1/check") return checkDomain(url, env, cors);';
const F = "// admin: subscriber counts";
if (!s.includes(R) || !s.includes(F)) { console.error("anchors missing - aborting, worker untouched"); process.exit(1); }
fs.writeFileSync("worker.js.bak16", s);

s = s.replace(R, R + [
'',
'    if (path === "/v1/methodology") return methodologyDoc(env, cors);',
'    if (path === "/v1/watch" && request.method === "POST") return addWatch(request, env, cors);',
'    if (path === "/v1/watch/confirm") return confirmWatch(url, env, cors);',
'    if (path === "/v1/watch/stop") return stopWatch(url, env, cors);',
].join("\n"));

const fn = [
'// ---- provenance: how we measure, machine-readable ------------------------',
'async function methodologyDoc(env, cors) {',
'  const headers = { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600", ...cors };',
'  const meta = await env.DATA.get("lookup:meta", "json");',
'  const raw = await env.DATA.get("dataset-snapshot");',
'  let ev = null, mv = null;',
'  if (raw) {',
'    // pull just the two fields we need without parsing the whole edition',
'    const mvM = raw.match(/"methodology_version":"([^"]+)"/);',
'    mv = mvM ? mvM[1] : null;',
'    const i = raw.indexOf(\'"evidence":\');',
'    if (i > -1) {',
'      let depth = 0, j = raw.indexOf("{", i);',
'      for (let k = j; k < raw.length && k < j + 20000; k++) {',
'        if (raw[k] === "{") depth++;',
'        else if (raw[k] === "}") { depth--; if (depth === 0) { try { ev = JSON.parse(raw.slice(j, k + 1)); } catch (e) {} break; } }',
'      }',
'    }',
'  }',
'  return new Response(JSON.stringify({',
'    methodology_version: mv,',
'    generated_utc: meta && meta.generated_utc,',
'    coverage: meta ? { tranco_top_n: meta.tranco_top_n, robots_parsed: meta.robots_parsed, crawlers_tracked: (meta.bots || []).length } : null,',
'    evidence: ev,',
'    human_readable: "https://crawlpriceindex.com/methodology.html",',
'    crawler_key_directory: "https://crawlpriceindex.com/.well-known/http-message-signatures-directory",',
'    contact: "hello@crawlpriceindex.com",',
'  }, null, 2), { status: 200, headers });',
'}',
'',
'// ---- change alerts: the recurring workflow -------------------------------',
'// KEYS: watch:<email>:<domain> -> { status, created, last } with metadata',
'// {s} so the weekly diff job can list actives without per-key reads.',
'async function addWatch(request, env, cors) {',
'  let email = "", domain = "";',
'  try { const b = await request.json(); email = b.email || ""; domain = b.domain || ""; } catch (e) {}',
'  email = String(email).trim().toLowerCase();',
'  domain = String(domain).trim().toLowerCase().replace(/^https?:\\/\\//, "").replace(/\\/.*$/, "").replace(/:.*$/, "");',
'  if (!email || !email.includes("@") || email.length > 254) return json({ error: "valid email required" }, 400, cors);',
'  if (!/^[a-z0-9.-]{3,253}$/.test(domain) || !domain.includes(".")) return json({ error: "valid domain required" }, 400, cors);',
'  const id = email + ":" + domain;',
'  const t = await subToken(env, id);',
'  await env.KEYS.put("watch:" + id, JSON.stringify({ status: "pending", email, domain, created: new Date().toISOString() }), { metadata: { s: "pending" } });',
'  const cUrl = "https://api.crawlpriceindex.com/v1/watch/confirm?e=" + encodeURIComponent(email) + "&d=" + encodeURIComponent(domain) + "&t=" + t;',
'  const xUrl = "https://api.crawlpriceindex.com/v1/watch/stop?e=" + encodeURIComponent(email) + "&d=" + encodeURIComponent(domain) + "&t=" + t;',
'  const txt = "Confirm alerts for " + domain + ".\\n\\nWe scan the web weekly. If any AI crawler\'s access to " + domain + " changes - a new block, an unblock, a price or paywall appearing - you get one email naming exactly what changed.\\n\\nConfirm: " + cUrl + "\\n\\nNot you? " + xUrl;',
'  const htm = brandCard("<p style=\\"margin:0 0 6px\\"><b>Confirm alerts for " + domain + "</b></p>"',
'    + "<p style=\\"margin:0\\">We scan the web every week. If any AI crawler&#39;s access to this domain changes &mdash; a new block, an unblock, a price or a paywall appearing &mdash; you get one email naming exactly what changed.</p>"',
'    + btn(cUrl, "Confirm alerts")',
'    + "<p style=\\"font-size:11.5px;color:#6b787d;margin:0\\">Not you? <a href=\\"" + xUrl + "\\" style=\\"color:#6b787d\\">Cancel this request</a>.</p>");',
'  try { await sendListEmail(env, email, "Confirm alerts for " + domain, txt, htm); }',
'  catch (e) { console.error("watch confirm email FAILED", String(e)); }',
'  return json({ message: "Check your inbox to confirm alerts for " + domain + "." }, 200, cors);',
'}',
'async function confirmWatch(url, env, cors) {',
'  const email = String(url.searchParams.get("e") || "").trim().toLowerCase();',
'  const domain = String(url.searchParams.get("d") || "").trim().toLowerCase();',
'  const t = url.searchParams.get("t") || "";',
'  if (!email || !domain || t !== await subToken(env, email + ":" + domain)) return subPage("Invalid link", "This confirmation link is not valid.");',
'  const rec = await env.KEYS.get("watch:" + email + ":" + domain, "json");',
'  if (!rec) return subPage("Invalid link", "This confirmation link is not valid.");',
'  rec.status = "active"; rec.confirmed = new Date().toISOString();',
'  await env.KEYS.put("watch:" + email + ":" + domain, JSON.stringify(rec), { metadata: { s: "active" } });',
'  return subPage("Watching " + domain + ".", "From the next weekly scan, you will be emailed the moment any tracked AI crawler&#39;s access to this domain changes. Nothing else - no newsletter unless you asked for it separately.");',
'}',
'async function stopWatch(url, env, cors) {',
'  const email = String(url.searchParams.get("e") || "").trim().toLowerCase();',
'  const domain = String(url.searchParams.get("d") || "").trim().toLowerCase();',
'  const t = url.searchParams.get("t") || "";',
'  if (!email || !domain || t !== await subToken(env, email + ":" + domain)) return subPage("Invalid link", "This link is not valid.");',
'  await env.KEYS.delete("watch:" + email + ":" + domain);',
'  return subPage("Alerts stopped.", "You will not receive further alerts for " + domain + ".");',
'}',
'',
''
].join("\n");
s = s.slice(0, s.indexOf(F)) + fn + s.slice(s.indexOf(F));

fs.writeFileSync("worker.js", s);
console.log("/v1/methodology + /v1/watch (add, confirm, stop) added (backup worker.js.bak16)");
