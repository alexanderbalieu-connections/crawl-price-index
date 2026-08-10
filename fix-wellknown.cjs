const fs = require("fs");
let s = fs.readFileSync("wrangler.toml", "utf8");
if (s.includes("run_worker_first")) { console.log("already set"); process.exit(0); }
const A = 'directory = "./public"';
if (!s.includes(A)) { console.error("assets anchor missing - aborting"); process.exit(1); }
fs.writeFileSync("wrangler.toml.bak", s);
s = s.replace(A, A + '\nrun_worker_first = ["/.well-known/*"]');
fs.writeFileSync("wrangler.toml", s);
console.log("wrangler.toml: worker now runs first for /.well-known/*");
