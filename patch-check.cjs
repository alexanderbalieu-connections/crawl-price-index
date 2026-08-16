#!/usr/bin/env node
// Fixes on public/check.html:
//   1. site masthead at the top, matching the homepage (with a way home)
//   2. result scroll lands on the fingerprint, not past it
//   3. a green confirmation when the domain is found in the index
// Backs up, validates, rolls back on failure. Safe to run twice.
const fs = require("fs");
const P = "public/check.html";
let s = fs.readFileSync(P, "utf8");
const before = s;
const done = [];

// --- 1. masthead -------------------------------------------------------------
if (s.indexOf('class="masthead"') === -1) {
  const bar = [
    '<div class="masthead"><div class="wrap">',
    '  <a class="mark" href="/">The Crawl Price Index<b>.</b></a>',
    '  <nav>',
    '    <a class="lnk" href="/check" aria-current="page">Check a domain</a>',
    '    <a class="lnk" href="/world">Country editions</a>',
    '    <a class="lnk" href="/methodology">Methodology</a>',
    '    <a class="ghost" href="/sample">Weekly email</a>',
    '    <a class="btn" href="/#access">Subscribe</a>',
    '  </nav>',
    '</div></div>'
  ].join("\n");
  s = s.replace("<body>", "<body>\n" + bar);
  done.push("masthead");
}

// the old crumb duplicates the masthead link
s = s.replace('<div class="crumb"><a href="/">← The Crawl Price Index</a> · free tool</div>',
              '<div class="crumb">Free tool</div>');

// --- 2. scroll to the fingerprint when we have one ---------------------------
const oldScroll = 'document.getElementById("est").scrollIntoView({behavior:"smooth", block:"start"});';
const newScroll = 'var _t = document.getElementById("fp");\n' +
  '      if (!_t || _t.classList.contains("hide")) _t = document.getElementById("est");\n' +
  '      var _y = _t.getBoundingClientRect().top + window.pageYOffset - 16;\n' +
  '      window.scrollTo({ top: _y, behavior: "smooth" });';
if (s.indexOf(oldScroll) !== -1) { s = s.replace(oldScroll, newScroll); done.push("scroll target"); }

// --- 3. found confirmation ---------------------------------------------------
const oldOk = '$("cmsg").textContent = "";\n        renderFingerprint(j);';
const newOk = '$("cmsg").innerHTML = \'<span class="ok">\\u2713 Found in this week\\u2019s index\\u2014scanned \' +\n' +
  '          ((j.context && j.context.asof) || (ctx && ctx.asof) || "this week") + \'</span>\';\n' +
  '        renderFingerprint(j);';
if (s.indexOf(oldOk) !== -1) { s = s.replace(oldOk, newOk); done.push("found tick"); }

if (s === before) { console.log("no changes needed — already patched"); process.exit(0); }

fs.copyFileSync(P, P + ".bak-check");
fs.writeFileSync(P, s);

// crude but effective validation: the inline script must still parse
const m = s.match(/<script>([\s\S]*)<\/script>\s*<\/body>/);
if (m) {
  fs.writeFileSync("/tmp/_chk.js", m[1]);
  try {
    require("child_process").execSync("node --check /tmp/_chk.js", { stdio: "pipe" });
  } catch (e) {
    fs.copyFileSync(P + ".bak-check", P);
    console.error("INLINE JS FAILED TO PARSE — check.html rolled back");
    process.exit(1);
  }
}
console.log("patched check.html: " + done.join(", ") + "   (backup: check.html.bak-check)");
