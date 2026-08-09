const fs = require("fs");
const f = "run-weekly.command";
let s = fs.readFileSync(f, "utf8");
s = s.replace("cp index.html world.html index.json public/ 2>/dev/null", "cp index.json public/ 2>/dev/null");
if (!s.includes("push-csv.cjs")) {
  s = s.replace("node send-weekly.cjs --send", "node push-csv.cjs || echo csv-push-failed\nnode send-weekly.cjs --send");
}
fs.writeFileSync(f, s);
console.log("cp:", s.includes("cp index.json public/") ? "OK" : "CHECK");
console.log("csv:", s.includes("push-csv.cjs") ? "OK" : "CHECK");
console.log("sample:", s.includes("push-sample.cjs") ? "OK" : "CHECK");
