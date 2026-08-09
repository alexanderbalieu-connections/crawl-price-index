const fs = require("fs");
const card = `
    <div style="margin-top:16px;background:var(--panel);border:1px solid var(--line);padding:24px">
      <div style="font-family:'Spline Sans Mono',monospace;font-size:15px;letter-spacing:.04em;color:var(--bright)">ENTERPRISE &amp; FEED LICENSING</div>
      <p class="body" style="margin:10px 0 0;font-size:16px">Using the index inside your own product, dashboard, or research? Feed licensing covers redistribution, custom sector cuts, historical archives, and delivery straight into your pipeline. Priced annually.</p>
      <a class="btn" href="mailto:hello@crawlpriceindex.com?subject=Feed%20licensing%20enquiry">Talk to us &rarr;</a>
    </div>
`;
for (const f of ["public/index.html", "homepage-backups/index.html.bak"]) {
  if (!fs.existsSync(f)) { console.log("skip: " + f); continue; }
  let s = fs.readFileSync(f, "utf8");
  if (s.includes("ENTERPRISE &amp; FEED LICENSING")) { console.log("already patched: " + f); continue; }
  const secStart = s.indexOf('<section id="access">');
  if (secStart === -1) { console.error("access section missing in " + f); continue; }
  const secEnd = s.indexOf("</section>", secStart);
  const plans = s.indexOf('<div class="plans">', secStart);
  if (secEnd === -1 || plans === -1 || plans > secEnd) { console.error("structure unexpected in " + f); continue; }
  const insertAt = s.lastIndexOf("</div>", secEnd);
  if (insertAt === -1 || insertAt < plans) { console.error("insert point not found in " + f); continue; }
  s = s.slice(0, insertAt) + card + s.slice(insertAt);
  const a = s.lastIndexOf("<script>"), b = s.indexOf("</script>", a);
  try { new Function(s.slice(a + 8, b)); } catch (e) { console.error("VALIDATION FAILED script " + f + ": " + e.message); continue; }
  const m = s.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/);
  try { JSON.parse(m[1]); } catch (e) { console.error("VALIDATION FAILED payload " + f + ": " + e.message); continue; }
  fs.writeFileSync(f, s);
  console.log("enterprise card added: " + f);
}
