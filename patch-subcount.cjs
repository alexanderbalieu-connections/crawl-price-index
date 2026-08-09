const fs = require("fs");
let s = fs.readFileSync("worker.js", "utf8");
if (s.includes("/v1/subscribers")) { console.log("already patched"); process.exit(0); }
const R = 'if (path === "/v1/subscribe" && request.method === "POST") return subscribe(request, env, cors);';
const F = "// ---- free tier:";
if (!s.includes(R) || !s.includes(F)) { console.error("anchors missing — aborting"); process.exit(1); }
fs.writeFileSync("worker.js.bak4", s);
s = s.replace(R, R + '\n    if (path === "/v1/subscribers") return listSubs(request, env, cors);');
const fn = `// admin: subscriber counts (x-admin-token)
async function listSubs(request, env, cors) {
  if ((request.headers.get("x-admin-token") || "") !== (env.ADMIN_TOKEN || "?")) return json({ error: "unauthorized" }, 401, cors);
  let active = 0, pending = 0, cursor; const latest = [];
  do {
    const p = await env.KEYS.list({ prefix: "sub:", cursor });
    for (const k of p.keys) {
      if (k.metadata && k.metadata.s === "active") { active++; if (latest.length < 50) latest.push(k.name.slice(4)); }
      else pending++;
    }
    cursor = p.list_complete ? null : p.cursor;
  } while (cursor);
  return json({ active, pending, latest }, 200, cors);
}

`;
s = s.slice(0, s.indexOf(F)) + fn + s.slice(s.indexOf(F));
fs.writeFileSync("worker.js", s);
console.log("subscriber-count endpoint added (backup: worker.js.bak4)");
