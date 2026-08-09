const fs = require("fs");
let s = fs.readFileSync("worker.js", "utf8");
const old = 'const sUrl = "https://api.crawlpriceindex.com/v1/sample?e=" + encodeURIComponent(email) + "&t=" + st;';
if (!s.includes(old)) { console.error("anchor missing — aborting"); process.exit(1); }
fs.writeFileSync("worker.js.bak10", s);
s = s.split(old).join('const sUrl = "https://crawlpriceindex.com/sample.html?e=" + encodeURIComponent(email) + "&t=" + st;');
fs.writeFileSync("worker.js", s);
console.log("welcome email now links to the HTML sample viewer (backup: worker.js.bak10)");
