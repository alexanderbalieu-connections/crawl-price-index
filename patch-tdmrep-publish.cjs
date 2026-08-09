const fs = require("fs");
let s = fs.readFileSync("rebuild.cjs", "utf8");
if (s.includes("tdmrep")) { console.log("already patched"); process.exit(0); }
const B = "  gtld_baseline: gtldBaseline,";
if (!s.includes(B)) { console.error("anchor missing — aborting"); process.exit(1); }
fs.writeFileSync("rebuild.cjs.bak4", s);
s = s.replace(B, "  tdmrep: summary.tdmrep || null,\n" + B);
s = s.replace('  full_dataset: "gated', '  tdmrep_headline: summary.tdmrep ? { adoption_pct: summary.tdmrep.adoption_pct, domains_probed: summary.tdmrep.probed } : {},\n  full_dataset: "gated');
fs.writeFileSync("rebuild.cjs", s);
console.log("TDMRep publishing added (backup: rebuild.cjs.bak4)");
