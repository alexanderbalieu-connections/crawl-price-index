#!/usr/bin/env node
/**
 * LOCAL PREVIEW — serves the customer app with the Clerk gate stubbed out, so
 * the dashboard can be eyeballed before anything is deployed. Read-only: it
 * copies app/ to .preview/ and never touches the real files. Ctrl+C to stop.
 * The gated /api/domains route is served straight from private/domains.json
 * here; on the real deployment that route verifies a Clerk JWT first.
 */
const fs = require("fs"), http = require("http"), path = require("path");
const SRC = "app", OUT = ".preview";
if (!fs.existsSync(path.join(SRC, "dashboard.html"))) {
  console.error("run this from the repo root (app/ not found)");
  process.exit(1);
}
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(SRC, OUT, { recursive: true });
let h = fs.readFileSync(path.join(SRC, "dashboard.html"), "utf8");
h = h.replace(/<script[^>]*clerk-loader\.js[^>]*><\/script>/g, "")
     .replace(/<script[^>]*config\.js[^>]*><\/script>/g, "")
     .replace("window.CPI_ON_CLERK_READY = function (clerk) {", "window.__previewUnused = function (clerk) {")
     .replace("</body>", '<script>window.addEventListener("load",function(){window.CPI_BOOT();});</script>\n</body>');
fs.writeFileSync(path.join(OUT, "dashboard.html"), h);

const TYPES = { ".html":"text/html", ".js":"text/javascript", ".json":"application/json", ".css":"text/css", ".svg":"image/svg+xml" };
const PORT = 8100 + Math.floor(Math.random() * 1200);
http.createServer(function (req, res) {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/dashboard.html";
  if (p === "/api/domains") {
    const f = "private/domains.json";
    if (!fs.existsSync(f)) {
      res.writeHead(404, { "content-type": "application/json" });
      return res.end('{"error":"private/domains.json not built - run node compute-domains.cjs"}');
    }
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    return res.end(fs.readFileSync(f));
  }
  const file = path.join(OUT, p);
  if (path.relative(OUT, file).startsWith("..")) { res.writeHead(403); return res.end("no"); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
  res.end(fs.readFileSync(file));
}).listen(PORT, function () {
  console.log("");
  console.log("  PREVIEW (auth stubbed, nothing deployed)");
  console.log("  http://127.0.0.1:" + PORT + "/dashboard.html");
  console.log("");
  console.log("  New tab: Policy layer. New sections at the bottom of Crawlers.");
  console.log("  Ctrl+C to stop, then run the deploy block.");
  console.log("");
});
