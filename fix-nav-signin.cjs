const fs = require("fs");
const P = process.argv[2];
let s = fs.readFileSync(P, "utf8");
const old = `    item("/methodology", "Methodology"),
    '    <a class="ghost" href="https://app.crawlpriceindex.com">Free dashboard</a>',`;
const nu = `    item("/methodology", "Methodology"),
    '    <a class="lnk" href="https://app.crawlpriceindex.com">Sign in</a>',
    '    <a class="ghost" href="https://app.crawlpriceindex.com">Free dashboard</a>',`;
if (s.indexOf(old) < 0) throw new Error("nav anchor not found");
if (s.indexOf('>Sign in<') >= 0) { console.log("already present"); process.exit(0); }
s = s.replace(old, nu);
fs.writeFileSync(P, s);
console.log("patch-nav.cjs updated: Sign in link added");
