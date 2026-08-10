#!/usr/bin/env node
// Admin plumbing for the alert sender: list active watches, send one alert.
// Both x-admin-token gated, same pattern as /v1/broadcast.
const fs = require("fs");
let s = fs.readFileSync("worker.js", "utf8");
if (s.includes("/v1/watches")) { console.log("already patched - skipping"); process.exit(0); }
const R = 'if (path === "/v1/methodology") return methodologyDoc(env, cors);';
const F = "// admin: subscriber counts";
if (!s.includes(R) || !s.includes(F)) { console.error("anchors missing - aborting"); process.exit(1); }
fs.writeFileSync("worker.js.bak17", s);

s = s.replace(R, R + [
'',
'    if (path === "/v1/watches") return listWatches(request, env, cors);',
'    if (path === "/v1/alert" && request.method === "POST") return sendAlert(request, env, cors);',
].join("\n"));

const fn = [
'// admin: active watches (for the weekly alert job)',
'async function listWatches(request, env, cors) {',
'  if ((request.headers.get("x-admin-token") || "") !== (env.ADMIN_TOKEN || "?")) return json({ error: "unauthorized" }, 401, cors);',
'  const watches = []; let cursor;',
'  do {',
'    const p = await env.KEYS.list({ prefix: "watch:", cursor });',
'    for (const k of p.keys) {',
'      if (!k.metadata || k.metadata.s !== "active") continue;',
'      const rest = k.name.slice(6);',
'      const i = rest.lastIndexOf(":");',
'      if (i > 0) watches.push({ email: rest.slice(0, i), domain: rest.slice(i + 1) });',
'    }',
'    cursor = p.list_complete ? null : p.cursor;',
'  } while (cursor);',
'  return json({ watches, count: watches.length }, 200, cors);',
'}',
'// admin: send one alert email (body composed by the local job)',
'async function sendAlert(request, env, cors) {',
'  if ((request.headers.get("x-admin-token") || "") !== (env.ADMIN_TOKEN || "?")) return json({ error: "unauthorized" }, 401, cors);',
'  let p = {};',
'  try { p = await request.json(); } catch (e) {}',
'  if (!p.email || !p.subject || !p.text) return json({ error: "email, subject and text required" }, 400, cors);',
'  const t = await subToken(env, p.email);',
'  const unsub = "https://api.crawlpriceindex.com/v1/unsubscribe?e=" + encodeURIComponent(p.email) + "&t=" + t;',
'  try {',
'    await sendListEmail(env, p.email, p.subject, p.text + "\\n\\nManage alerts: https://crawlpriceindex.com/check",',
'      (p.html || "<pre>" + p.text + "</pre>") + \'<p style="font-size:11px;color:#6b787d;font-family:ui-monospace,monospace;margin-top:20px"><a href="https://crawlpriceindex.com/check" style="color:#6b787d">Manage alerts</a></p>\');',
'  } catch (e) { return json({ error: "send failed", detail: String(e) }, 502, cors); }',
'  return json({ sent: 1 }, 200, cors);',
'}',
'',
''
].join("\n");
s = s.slice(0, s.indexOf(F)) + fn + s.slice(s.indexOf(F));
fs.writeFileSync("worker.js", s);
console.log("/v1/watches + /v1/alert added (backup worker.js.bak17)");
