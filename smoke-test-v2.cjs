#!/usr/bin/env node
// Extra checks for the v2 additions. Run after smoke-test.cjs.
const API = "https://api.crawlpriceindex.com", SITE = "https://crawlpriceindex.com";
let pass = 0, fail = 0, warn = 0;
const ok = (n,d)=>{pass++;console.log("  PASS  "+n+(d?"  · "+d:""))};
const no = (n,d)=>{fail++;console.log("  FAIL  "+n+(d?"  · "+d:""))};
const wa = (n,d)=>{warn++;console.log("  WARN  "+n+(d?"  · "+d:""))};
async function get(u,o){const r=await fetch(u,o||{});const t=await r.text();let j=null;try{j=JSON.parse(t)}catch(e){};return{status:r.status,text:t,json:j,headers:r.headers}}
(async()=>{
  console.log("CPI v2 — provenance, methodology, alerts · "+new Date().toISOString()+"\n");

  console.log("1. Methodology (verifiability)\n" + "-".repeat(30));
  const m = await get(API+"/v1/methodology");
  if (m.status===200 && m.json) {
    ok("/v1/methodology serves", "HTTP 200");
    m.json.methodology_version ? ok("version pinned", m.json.methodology_version) : no("no methodology_version — run rebuild + push-snapshot first");
    const ev = m.json.evidence;
    if (ev && ev.signal_classes) {
      const types = Object.values(ev.signal_classes).map(v=>v.evidence_type);
      ok("signal classes labelled", Object.keys(ev.signal_classes).length+" classes");
      types.some(t=>String(t).startsWith("observed")) && types.includes("derived") && types.includes("inferred")
        ? ok("observed / derived / inferred all present") : no("evidence types incomplete", types.join(","));
      ev.not_measured && ev.not_measured.length ? ok("not_measured list published", ev.not_measured.length+" items") : no("not_measured missing");
      ev.corrections_policy ? ok("corrections policy published") : wa("no corrections policy");
    } else no("evidence model missing from /v1/methodology");
  } else no("/v1/methodology", "HTTP "+m.status);
  const mh = await get(SITE+"/methodology.html");
  mh.status===200 && mh.text.includes("What we do not measure") ? ok("methodology.html published", Math.round(mh.text.length/1024)+" KB") : no("methodology.html", "HTTP "+mh.status);
  mh.text.includes("observed") && mh.text.includes("inferred") ? ok("page states the observed/inferred distinction") : wa("distinction not obvious on page");

  console.log("\n2. Change alerts (the recurring workflow)\n" + "-".repeat(40));
  const bad = await get(API+"/v1/watch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"x",domain:"y"})});
  bad.status===400 ? ok("invalid watch rejected") : no("invalid watch accepted", "HTTP "+bad.status);
  const nw = await get(API+"/v1/watches");
  nw.status===401 ? ok("watch list is admin-gated") : no("watch list not gated", "HTTP "+nw.status);
  const na = await get(API+"/v1/alert",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"a@b.c",subject:"x",text:"y"})});
  na.status===401 ? ok("alert send is admin-gated") : no("alert send not gated", "HTTP "+na.status);
  const cw = await get(API+"/v1/watch/confirm?e=a@b.c&d=x.com&t=bogus");
  cw.status===200 && /not valid/i.test(cw.text) ? ok("forged confirm link rejected") : no("confirm link not verified", "HTTP "+cw.status);

  console.log("\n3. Checker page\n" + "-".repeat(15));
  const c = await get(SITE+"/check");
  c.text.includes("wa-form") ? ok("watch signup present on checker") : no("watch signup missing");
  c.text.includes("we do not detect this") ? ok("content-type honesty label present") : wa("honesty label missing");
  const i=c.text.lastIndexOf("<script>");
  try { new Function(c.text.slice(i+8, c.text.indexOf("</script>", i))); ok("checker script parses"); } catch(e){ no("checker script BROKEN", e.message); }

  console.log("\nRESULT\n------\n  "+pass+" passed · "+fail+" failed · "+warn+" warnings");
  console.log(fail===0 ? "\n  v2 GREEN.\n" : "\n  FIX FAILURES.\n");
  process.exit(fail===0?0:1);
})();
