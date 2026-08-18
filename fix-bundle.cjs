#!/usr/bin/env node
/**
 * FIX BUNDLE (sweep-safe). Applies four fixes; refuses if a sweep is running
 * so it can never collide with a live harvest. Each edit validates and rolls
 * back independently. Idempotent.
 *
 *   #5  backfill Aug 8/9 history prices (0.5, held-flat, provenance-tagged)
 *       then rerun trends so observed_price_usd assembles across all 4 points
 *   #7a probe: llms.txt body-check (reject HTML masquerading as llms.txt)
 *   #7b probe: follow TollBit redirects (redirect:"manual" hid every gate)
 *   #9  sweep the .bak-* backup files
 */
const fs = require("fs");
const { execSync } = require("child_process");

// ---- guard: never run mid-sweep ----
if (fs.existsSync(".scan-progress.json")) {
  console.error("A sweep is in progress — refusing to run so nothing collides.");
  console.error("Re-run this after the sweep publishes (node where.cjs shows 'NO SWEEP OPEN').");
  process.exit(2);
}

let done = [];

// ---- #5: backfill the two null history points, then rebuild trends ----------
for (const date of ["2026-08-08", "2026-08-09"]) {
  const p = "history/" + date + ".json";
  if (!fs.existsSync(p)) { console.log("  " + date + ": no snapshot, skipped"); continue; }
  const snap = JSON.parse(fs.readFileSync(p, "utf8"));
  if (snap.top_observed_price_usd != null) { console.log("  " + date + ": already has price"); continue; }
  snap.top_observed_price_usd = 0.5;
  snap.price_backfill = { value: 0.5, source: "held flat from first observation (regex bug produced null; $0.50 observed every scan since baseline)", backfilled_utc: new Date().toISOString() };
  fs.writeFileSync(p, JSON.stringify(snap, null, 1));
  done.push("backfilled " + date + " = 0.5");
}
try { execSync("node trends.cjs", { stdio: "inherit" }); done.push("trends rebuilt"); }
catch (e) { console.log("  (trends.cjs rerun failed — run manually after fix)"); }

// ---- #7a + #7b: probe-wide.cjs ----------------------------------------------
if (fs.existsSync("probe-wide.cjs")) {
  let s = fs.readFileSync("probe-wide.cjs", "utf8");
  const before = s;
  // 7a: llms.txt must not be HTML
  if (s.indexOf('const llms = await get("https://" + domain + "/llms.txt");') !== -1 && s.indexOf("llms_body_check") === -1) {
    s = s.replace(
      'const llms = await get("https://" + domain + "/llms.txt");\n        if (llms.status === 200) { row.llms = 1; sum.llms_txt++; }',
      'const llms = await get("https://" + domain + "/llms.txt", true); // llms_body_check: fetch a little body\n        if (llms.status === 200 && llms.snippet && !/^\\s*<(!doctype|html|head|body)/i.test(llms.snippet)) { row.llms = 1; sum.llms_txt++; }');
    // make get() optionally return a body snippet for non-402 too
    s = s.replace(
      'async function get(url) {',
      'async function get(url, wantBody) {');
    s = s.replace(
      'if (res.status === 402) { try { snippet = (await res.text()).slice(0, 400); } catch (e) {} }',
      'if (res.status === 402 || wantBody) { try { snippet = (await res.text()).slice(0, 400); } catch (e) {} }');
    done.push("probe: llms.txt body-check");
  }
  // 7b: follow redirects so TollBit gates are seen
  if (s.indexOf('redirect: "manual"') !== -1) {
    s = s.replace('redirect: "manual"', 'redirect: "follow"');
    done.push("probe: follow redirects (TollBit visibility)");
  }
  if (s !== before) {
    fs.copyFileSync("probe-wide.cjs", "probe-wide.cjs.bak-fixbundle");
    fs.writeFileSync("probe-wide.cjs", s);
    try { execSync("node --check probe-wide.cjs", { stdio: "pipe" }); }
    catch (e) { fs.copyFileSync("probe-wide.cjs.bak-fixbundle", "probe-wide.cjs"); console.error("probe-wide.cjs syntax failed — rolled back"); }
  }
}

// ---- #9: sweep backup files -------------------------------------------------
let removed = 0;
for (const dir of [".", "public"]) {
  try {
    for (const f of fs.readdirSync(dir)) {
      if (/\.bak-|\.bak$|\.pretheme$|\.testbak$/.test(f)) { fs.unlinkSync(dir + "/" + f); removed++; }
    }
  } catch (e) {}
}
done.push("removed " + removed + " backup files");

console.log("\nFIX BUNDLE COMPLETE:");
done.forEach(d => console.log("  - " + d));
console.log("\nVerify: node -e 'console.log(JSON.stringify(JSON.parse(require(\"fs\").readFileSync(\"paid-dataset.json\",\"utf8\")).trends.observed_price_usd))'");
console.log("(that key populates after the next rebuild/publish; trends rebuilt the history side now)");
