const fs = require("fs");
let s = fs.readFileSync("worker.js", "utf8");
if (s.includes('dataset-csv')) { console.log("already patched"); process.exit(0); }
const A = '  let raw = await env.DATA.get("dataset");';
if (!s.includes(A)) { console.error("anchor missing — aborting, worker untouched"); process.exit(1); }
fs.writeFileSync("worker.js.bak9", s);
const csvBranch = `  // CSV flavour of the same gated dataset — pre-built at publish time so we
  // never parse a multi-MB JSON per request (free-plan CPU ceiling).
  if ((url.searchParams.get("format") || "").toLowerCase() === "csv") {
    const csv = await env.DATA.get("dataset-csv");
    if (!csv) return json({ error: "csv not yet published" }, 503, cors);
    const fp = await sha256(key).then(h => h.slice(0, 16));
    const head = "# The Crawl Price Index — single-subscriber licence. Redistribution prohibited. Traceable.\\n"
      + "# issued_to=" + rec.customer + " key_fingerprint=" + fp + " served=" + new Date().toISOString() + "\\n";
    return new Response(head + csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": 'attachment; filename="crawl-price-index.csv"',
        "Cache-Control": "no-store",
        ...cors,
      },
    });
  }

`;
s = s.replace(A, csvBranch + A);
fs.writeFileSync("worker.js", s);
console.log("CSV endpoint added (backup: worker.js.bak9)");
