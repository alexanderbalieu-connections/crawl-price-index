const fs = require("fs");
const P = "public/index.html";
let s = fs.readFileSync(P, "utf8");
if (s.indexOf('>Sign in</a>') >= 0) { console.log("already present"); process.exit(0); }
const anchor = '    <a class="ghost" href="https://app.crawlpriceindex.com">Free dashboard</a>';
if (s.indexOf(anchor) < 0) throw new Error("anchor not found in index.html");
s = s.replace(anchor,
  '    <a class="lnk" href="https://app.crawlpriceindex.com">Sign in</a>\n' + anchor);
fs.writeFileSync(P, s);
console.log("index.html nav updated");
