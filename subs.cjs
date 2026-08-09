const t = require("fs").readFileSync(".admin-token", "utf8").trim();
fetch("https://api.crawlpriceindex.com/v1/subscribers", { headers: { "x-admin-token": t } })
  .then(r => r.json())
  .then(j => { console.log("Active: " + j.active + "   Pending: " + j.pending); (j.latest || []).forEach(e => console.log("  " + e)); });
