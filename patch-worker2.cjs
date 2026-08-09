const fs = require("fs");
let s = fs.readFileSync("worker.js", "utf8");
const A = "// fetch the full paid dataset";
const B = "// ---- Stripe webhook: lifecycle";
const a = s.indexOf(A), b = s.indexOf(B);
if (a === -1 || b === -1 || b < a) { console.error("markers not found — aborting, worker untouched"); process.exit(1); }
if (s.includes("string-splice")) { console.log("worker already patched — skipping"); process.exit(0); }
const block = `// fetch the full paid dataset
  let raw = await env.DATA.get("dataset");
  if (!raw) return json({ error: "dataset not yet populated" }, 503, cors);

  // per-customer watermark, stamped by string-splice — no JSON.parse of the
  // multi-MB dataset, so CPU stays tiny as per_domain grows to 50k rows.
  const lic = JSON.stringify({
    issued_to: rec.customer,
    key_fingerprint: await sha256(key).then(h => h.slice(0, 16)),
    terms: "Single-subscriber licence. Redistribution prohibited. Traceable.",
    served: new Date().toISOString(),
  });
  const cut = raw.lastIndexOf("}");
  raw = raw.slice(0, cut) + ',"_license":' + lic + "}";

  return new Response(raw, {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors },
  });
}

`;
fs.writeFileSync("worker.js.bak2", s);
fs.writeFileSync("worker.js", s.slice(0, a) + block + s.slice(b));
console.log("worker.js patched (backup: worker.js.bak2)");
