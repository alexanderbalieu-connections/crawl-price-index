#!/usr/bin/env node
// Credibility block checks. Run after smoke-test.cjs and smoke-test-v2.cjs.
const SITE = "https://crawlpriceindex.com", API = "https://api.crawlpriceindex.com";
let pass=0,fail=0,warn=0;
const ok=(n,d)=>{pass++;console.log("  PASS  "+n+(d?"  · "+d:""))};
const no=(n,d)=>{fail++;console.log("  FAIL  "+n+(d?"  · "+d:""))};
const wa=(n,d)=>{warn++;console.log("  WARN  "+n+(d?"  · "+d:""))};
async function get(u){const r=await fetch(u);const t=await r.text();let j=null;try{j=JSON.parse(t)}catch(e){};return{status:r.status,text:t,json:j,headers:r.headers}}
(async()=>{
  console.log("CPI credibility block · "+new Date().toISOString()+"\n");

  console.log("1. Legitimacy pages\n"+"-".repeat(20));
  for (const [p, must] of [["/privacy.html","data controller"],["/security.html","disclosure"],["/status.html","Status"],["/changelog.html","Changelog"],["/.well-known/security.txt","Contact:"],["/openapi.json","openapi"]]) {
    const r = await get(SITE+p);
    if (r.status!==200) { no(p, "HTTP "+r.status); continue; }
    r.text.toLowerCase().includes(must.toLowerCase()) ? ok(p, Math.round(r.text.length/1024)+" KB") : no(p, "served but content unexpected");
  }
  const priv = await get(SITE+"/privacy.html");
  priv.text.includes("6(1)(a)") ? ok("privacy states GDPR legal bases") : no("no legal basis stated");
  priv.text.match(/controller/i) ? ok("data controller identified") : no("no controller named");
  priv.text.includes("CNPD") ? ok("supervisory authority named") : wa("no supervisory authority");
  const spec = await get(SITE+"/openapi.json");
  if (spec.json) {
    const paths = Object.keys(spec.json.paths||{});
    paths.length>=8 ? ok("OpenAPI documents the API", paths.length+" paths") : wa("thin spec", paths.length+" paths");
    spec.json.info && spec.json.info.contact ? ok("spec has a contact") : wa("spec has no contact");
  } else no("openapi.json not valid JSON");

  console.log("\n2. Status page reflects real data\n"+"-".repeat(33));
  const st = await get(SITE+"/status.html");
  const ctx = await get(API+"/v1/check?domain=context");
  if (st.status===200 && ctx.json && ctx.json.context) {
    const parsed = Number(ctx.json.context.robots_parsed).toLocaleString();
    st.text.includes(parsed) ? ok("status shows the live parsed count", parsed) : no("status count disagrees with the API — page is stale");
    st.text.includes("enforcement") || st.text.includes("Enforcement") ? ok("enforcement caveat published") : no("no enforcement caveat");
    st.text.match(/50%|62/) ? ok("enforcement variance disclosed") : wa("variance note not found");
  } else no("could not compare status to API");

  console.log("\n3. Row-level provenance\n"+"-".repeat(24));
  const key = process.argv[2];
  if (key) {
    const d = await get(API+"/v1/dataset?key="+key);
    if (d.json && d.json.per_domain && d.json.per_domain.length) {
      const row = d.json.per_domain[0];
      row.observed_at ? ok("rows carry observed_at", row.observed_at) : no("no observed_at on rows");
      row.observed ? ok("rows flag whether they yielded a reading", "observed="+row.observed) : no("no observed flag");
      d.json.freshness ? ok("freshness summary published", d.json.freshness.rows_with_reading+" with reading, "+d.json.freshness.rows_without_reading+" without") : no("no freshness summary");
      d.json.methodology_version ? ok("methodology version on dataset", d.json.methodology_version) : no("no methodology_version");
    } else no("dataset fetch failed", "HTTP "+d.status);
  } else wa("dataset checks skipped", "re-run: node smoke-test-cred.cjs cpi_live_...");

  console.log("\n4. Discoverability\n"+"-".repeat(18));
  const rob = await get(SITE+"/robots.txt");
  rob.text.includes("status.html") ? ok("robots.txt points to documentation") : wa("robots.txt has no doc pointers");
  const llms = await get(SITE+"/llms.txt");
  llms.text.includes("openapi.json") ? ok("llms.txt points machines at the spec") : wa("llms.txt not updated");
  const home = await get(SITE+"/");
  home.text.includes('href="/privacy.html"') ? ok("homepage links the credibility pages") : no("homepage does not link privacy/status");

  console.log("\nRESULT\n------\n  "+pass+" passed · "+fail+" failed · "+warn+" warnings");
  console.log(fail===0?"\n  CREDIBILITY BLOCK GREEN.\n":"\n  FIX FAILURES.\n");
  process.exit(fail===0?0:1);
})();
