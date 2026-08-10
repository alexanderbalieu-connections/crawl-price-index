#!/usr/bin/env node
// Adds the change-alert signup to the checker page: the recurring workflow.
// Appears once a domain has been looked up, pre-filled with that domain.
const fs = require("fs");
const F = "public/check.html";
let s = fs.readFileSync(F, "utf8");
if (s.includes("wa-form")) { console.log("already patched"); process.exit(0); }

const A = '  <div class="card" id="setup">';
const B = '  function renderFingerprint(j){';
if (!s.includes(A) || !s.includes(B)) { console.error("anchors missing - aborting"); process.exit(1); }
fs.writeFileSync(F + ".bak4", s);

const card = `  <div class="card hide" id="watch">
    <div class="k">Step 3 · get told when this changes</div>
    <p style="margin:0 0 4px;font-size:16px">AI-crawler policy is not static — domains flip between blocked and allowed every week. We scan the whole top 50,000 weekly. If anything changes for <span class="mono" id="wdom">your domain</span>, you get one email naming exactly what changed. Nothing else.</p>
    <form id="wa-form" style="margin-top:12px">
      <div class="row">
        <input type="text" id="wa-email" placeholder="you@company.com" autocomplete="email">
        <button class="go" type="submit">Watch this domain →</button>
      </div>
      <div class="msg" id="wa-msg"></div>
    </form>
  </div>

`;
s = s.replace(A, card + A);

// reveal + prefill on a successful lookup
s = s.replace(B, B + '\n    document.getElementById("watch").classList.remove("hide");\n    document.getElementById("wdom").textContent = j.domain;');

// wire the form
const W = '  $("wk").addEventListener("submit", function(e){';
if (!s.includes(W)) { console.error("wire anchor missing - aborting"); process.exit(1); }
s = s.replace(W, `  $("wa-form").addEventListener("submit", function(e){
    e.preventDefault();
    var email = $("wa-email").value.trim();
    if (!email || !state.domain) return;
    $("wa-msg").textContent = "sending…";
    fetch(API + '/v1/watch', { method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ email: email, domain: state.domain }) })
      .then(function(r){ return r.json(); })
      .then(function(j){ $("wa-msg").textContent = j.message || j.error || 'something went wrong'; })
      .catch(function(){ $("wa-msg").textContent = 'network error — try again'; });
  });

` + W);

const i = s.lastIndexOf("<script>"), j2 = s.indexOf("</script>", i);
try { new Function(s.slice(i + 8, j2)); } catch (e) { console.error("VALIDATION FAILED: " + e.message); process.exit(1); }
fs.writeFileSync(F, s);
console.log("checker: change-alert signup added (backup check.html.bak4)");
