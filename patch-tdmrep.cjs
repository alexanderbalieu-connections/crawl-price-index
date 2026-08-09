const fs = require("fs");
let s = fs.readFileSync("run-big.cjs", "utf8");
if (s.includes("tdmrep")) { console.log("already patched"); process.exit(0); }
const A = '    return { status: res.status, body };';
const B = '        if (r.status === 429 || r.status === 403) pushback++;';
const C = '    robots_parsed: fetched,';
if (!s.includes(A) || !s.includes(B) || !s.includes(C)) { console.error("anchors missing — aborting"); process.exit(1); }
fs.writeFileSync("run-big.cjs.bak2", s);
s = s.replace(A, '    return { status: res.status, body, tdm: res.headers.get("tdm-reservation"), tdmPolicy: res.headers.get("tdm-policy") };');
s = s.replace('const PROGRESS = ".scan-progress.json";',
  'const PROGRESS = ".scan-progress.json";\nconst TDM_PROBE_N = cfg.tdm_probe_top_n || 2000;\nconst tdm = { probed: 0, well_known: 0, header: 0, policy: 0 };\nasync function probeTDM(domain) {\n  const ctrl = new AbortController();\n  const t = setTimeout(() => ctrl.abort(), 8000);\n  try {\n    const res = await fetch("https://" + domain + "/.well-known/tdmrep.json", { redirect: "follow", signal: ctrl.signal, headers: { "User-Agent": HONEST_UA, Accept: "application/json" } });\n    if (res.status === 200) { const txt = (await res.text()).slice(0, 20000); if (/tdm-?reservation/i.test(txt)) return true; }\n    else { try { res.body?.cancel(); } catch {} }\n  } catch (e) {} finally { clearTimeout(t); }\n  return false;\n}');
s = s.replace(B, B + '\n        if (r.tdm != null) tdm.header++;\n        if (r.tdmPolicy != null) tdm.policy++;\n        if (rank <= TDM_PROBE_N) { tdm.probed++; if (await probeTDM(d)) tdm.well_known++; }');
s = s.replace(C, C + '\n    tdmrep: { probed: tdm.probed, well_known: tdm.well_known, header: tdm.header, policy: tdm.policy,\n      adoption_pct: tdm.probed ? +(100 * (tdm.well_known + tdm.header) / tdm.probed).toFixed(2) : null },');
fs.writeFileSync("run-big.cjs", s);
console.log("TDMRep capture added (backup: run-big.cjs.bak2)");
