const fs = require("fs");
let s = fs.readFileSync("rebuild.cjs", "utf8");
if (s.includes("enforcement")) { console.log("already patched"); process.exit(0); }
const A = "for (const d of panelDomains) { const c = classify(d); posture[c] = (posture[c] || 0) + 1; }";
const B = "  gtld_baseline: gtldBaseline,";
if (!s.includes(A) || !s.includes(B)) { console.error("anchors missing — aborting"); process.exit(1); }
fs.writeFileSync("rebuild.cjs.bak3", s);
const calc = A + `

// ---- 2b) enforcement vs declaration (research panel only) -----------------
// Does a site that DECLARES a block in robots.txt actually REFUSE the bot?
// Declared = robots.txt says blocked. Enforced = probe returned 4xx/5xx.
const ENF_MAP = { gptbot: "GPTBot", claudebot: "ClaudeBot" };
const robotsByDomain = {};
for (const r of robots) robotsByDomain[r.domain] = r;
const enforcement = { n: 0, declared: 0, declared_enforced: 0, declared_not_enforced: 0, undeclared_blocked: 0, by_bot: {} };
for (const d of panelDomains) {
  const rr = robotsByDomain[d];
  if (!rr) continue;
  const rows = byDomain[d] || {};
  for (const [test, bot] of Object.entries(ENF_MAP)) {
    const st = parseInt((rows[test] || {}).status || "", 10);
    if (!st) continue;
    const declared = rr[bot] === "blocked";
    const blocked = st >= 400;
    enforcement.n++;
    if (!enforcement.by_bot[bot]) enforcement.by_bot[bot] = { declared: 0, enforced: 0, unenforced: 0, silent: 0 };
    const b = enforcement.by_bot[bot];
    if (declared) {
      enforcement.declared++; b.declared++;
      if (blocked) { enforcement.declared_enforced++; b.enforced++; }
      else { enforcement.declared_not_enforced++; b.unenforced++; }
    } else if (blocked) { enforcement.undeclared_blocked++; b.silent++; }
  }
}
enforcement.enforced_pct = enforcement.declared ? +(100 * enforcement.declared_enforced / enforcement.declared).toFixed(1) : null;
enforcement.note = "Panel-only. Declared = robots.txt directive; enforced = crawler-identified request returned 4xx/5xx. Silent = blocked without declaring.";`;
s = s.replace(A, calc);
s = s.replace(B, "  enforcement,\n" + B);
s = s.replace('  full_dataset: "gated', '  enforcement_headline: enforcement.enforced_pct == null ? {} : { declared_blocks_enforced_pct: enforcement.enforced_pct, panel_checks: enforcement.n },\n  full_dataset: "gated');
s = s.replace('console.log(`  ticker signals:   ${indexPayload.ticker.length}`);',
  'console.log(`  ticker signals:   ${indexPayload.ticker.length}`);\nconsole.log(`  enforcement:      ${enforcement.enforced_pct == null ? "n/a" : enforcement.enforced_pct + "% of declared blocks actually enforced (" + enforcement.n + " checks)"}`);');
fs.writeFileSync("rebuild.cjs", s);
console.log("enforcement metric added (backup: rebuild.cjs.bak3)");
