const fs = require("fs");
let n = 0;

// 1. theme.css — bold, ledger-green, no box
const T = "public/theme.css";
let t = fs.readFileSync(T, "utf8");
if (!t.includes("a.lnk.signin")) {
  const anchor = ".masthead nav a.lnk:hover{color:var(--fg)}";
  if (!t.includes(anchor)) throw new Error("theme anchor missing");
  t = t.replace(anchor, anchor +
    "\n.masthead nav a.lnk.signin{color:var(--signal);font-weight:700}" +
    "\n.masthead nav a.lnk.signin:hover{color:var(--signal);text-decoration:underline;text-underline-offset:3px}");
  fs.writeFileSync(T, t); n++; console.log("theme.css: .signin style added");
} else console.log("theme.css: already styled");

// 2. patch-nav.cjs — generator emits the class
const P = "patch-nav.cjs";
let p = fs.readFileSync(P, "utf8");
const oldLink = `'    <a class="lnk" href="https://app.crawlpriceindex.com">Sign in</a>',`;
const newLink = `'    <a class="lnk signin" href="https://app.crawlpriceindex.com">Sign in</a>',`;
if (p.includes(oldLink)) { p = p.replace(oldLink, newLink); fs.writeFileSync(P, p); n++; console.log("patch-nav.cjs: class added"); }
else console.log("patch-nav.cjs: already updated");

// 3. index.html — direct patch (generator skips it)
const H = "public/index.html";
let h = fs.readFileSync(H, "utf8");
const oh = `<a class="lnk" href="https://app.crawlpriceindex.com">Sign in</a>`;
if (h.includes(oh)) { h = h.replace(oh, `<a class="lnk signin" href="https://app.crawlpriceindex.com">Sign in</a>`); fs.writeFileSync(H, h); n++; console.log("index.html: class added"); }
else console.log("index.html: already updated");

console.log(n + " file(s) changed");
