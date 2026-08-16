#!/usr/bin/env node
// Adds type-ahead to the checker. Loads /suggest.txt lazily on first keystroke,
// matches by prefix then substring, keyboard navigable. Falls back silently to
// a plain input if the list cannot be fetched.
const fs = require("fs");
const P = "public/check.html";
let s = fs.readFileSync(P, "utf8");
if (s.indexOf("cpi-suggest") !== -1) { console.log("type-ahead already present"); process.exit(0); }
const before = s;

// wrap the input so the dropdown can be positioned against it
const inputRe = /(<input[^>]*id="dom"[^>]*>)/;
if (!inputRe.test(s)) { console.error("ABORT: could not find the #dom input"); process.exit(1); }
s = s.replace(inputRe, '<span class="ac-wrap">$1<div class="ac" id="ac" role="listbox"></div></span>');

const js = `
  /* cpi-suggest — type-ahead over the indexed domain list */
  (function(){
    var input = document.getElementById("dom"), box = document.getElementById("ac");
    if (!input || !box) return;
    var list = null, loading = false, items = [], sel = -1;

    function load(){
      if (list || loading) return;
      loading = true;
      fetch("/suggest.txt").then(function(r){ return r.ok ? r.text() : ""; })
        .then(function(t){ list = t ? t.split("\\n").filter(Boolean) : []; render(); })
        .catch(function(){ list = []; });
    }
    function close(){ box.classList.remove("open"); box.innerHTML = ""; items = []; sel = -1; }
    function choose(v){ input.value = v; close(); var b = document.getElementById("check"); if (b) b.click(); }

    function render(){
      var q = input.value.trim().toLowerCase().replace(/^https?:\\/\\//,"").replace(/\\/.*$/,"");
      if (!list || q.length < 2){ close(); return; }
      var pre = [], sub = [];
      for (var i = 0; i < list.length && pre.length + sub.length < 400; i++){
        var d = list[i];
        if (d.indexOf(q) === 0) pre.push(d);
        else if (d.indexOf(q) > -1) sub.push(d);
      }
      items = pre.concat(sub).slice(0, 8);
      if (!items.length){ close(); return; }
      box.innerHTML = items.map(function(d, i){
        return '<button type="button" role="option" data-i="' + i + '">' + d +
               '<span class="rk">#' + (list.indexOf(d) + 1) + '</span></button>';
      }).join("");
      box.classList.add("open");
      sel = -1;
    }

    input.addEventListener("focus", load);
    input.addEventListener("input", function(){ load(); render(); });
    input.addEventListener("keydown", function(e){
      if (!box.classList.contains("open")) return;
      var btns = box.querySelectorAll("button");
      if (e.key === "ArrowDown" || e.key === "ArrowUp"){
        e.preventDefault();
        sel += (e.key === "ArrowDown" ? 1 : -1);
        if (sel < 0) sel = btns.length - 1;
        if (sel >= btns.length) sel = 0;
        btns.forEach(function(b){ b.classList.remove("sel"); });
        if (btns[sel]){ btns[sel].classList.add("sel"); btns[sel].scrollIntoView({block:"nearest"}); }
      } else if (e.key === "Enter" && sel > -1){
        e.preventDefault(); choose(items[sel]);
      } else if (e.key === "Escape"){ close(); }
    });
    box.addEventListener("click", function(e){
      var b = e.target.closest("button"); if (b) choose(items[+b.getAttribute("data-i")]);
    });
    document.addEventListener("click", function(e){
      if (!box.contains(e.target) && e.target !== input) close();
    });
  })();
`;

const tail = "</script>\n</body>";
const i = s.lastIndexOf(tail);
if (i === -1) { console.error("ABORT: no closing script before </body>"); process.exit(1); }
s = s.slice(0, i) + js + s.slice(i);

if (s === before) { console.log("no change"); process.exit(0); }
fs.copyFileSync(P, P + ".bak-suggest");
fs.writeFileSync(P, s);

const m = s.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
if (m) {
  fs.writeFileSync("/tmp/_s.js", m[1]);
  try { require("child_process").execSync("node --check /tmp/_s.js", { stdio: "pipe" }); }
  catch (e) { fs.copyFileSync(P + ".bak-suggest", P); console.error("JS FAILED — rolled back"); process.exit(1); }
}
console.log("type-ahead added to check.html (backup: check.html.bak-suggest)");
