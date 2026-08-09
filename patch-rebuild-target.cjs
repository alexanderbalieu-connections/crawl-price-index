const fs = require("fs");
let s = fs.readFileSync("rebuild.cjs", "utf8");
if (s.includes('"public/index.html"')) { console.log("rebuild: already targets public/"); process.exit(0); }
const a = 'swapPayload("index.html", indexPayload);';
const b = 'swapPayload("world.html", worldPayload);';
if (!s.includes(a) || !s.includes(b)) { console.error("rebuild anchors missing"); process.exit(1); }
fs.writeFileSync("rebuild.cjs.bak2", s);
s = s.replace(a, 'swapPayload(fs.existsSync("public/index.html") ? "public/index.html" : "index.html", indexPayload);');
s = s.replace(b, 'swapPayload(fs.existsSync("public/world.html") ? "public/world.html" : "world.html", worldPayload);');
fs.writeFileSync("rebuild.cjs", s);
console.log("rebuild: now writes into public/");
