const fs = require("fs"), crypto = require("crypto");
const priv = crypto.createPrivateKey(fs.readFileSync(".wba-private.pem"));
const pub = crypto.createPublicKey(priv);
const kid = JSON.parse(fs.readFileSync("wba-directory.json", "utf8")).keys[0].kid;
const agent = '"https://crawlpriceindex.com"';
function sign(host) {
  const created = Math.floor(Date.now() / 1000), expires = created + 60;
  const params = '("@authority" "signature-agent");created=' + created + ";expires=" + expires + ';keyid="' + kid + '";tag="web-bot-auth"';
  const base = '"@authority": ' + host + "\n" + '"signature-agent": ' + agent + "\n" + '"@signature-params": ' + params;
  const sig = crypto.sign(null, Buffer.from(base), priv).toString("base64");
  return { base, sig, headers: { "Signature-Agent": agent, "Signature-Input": "sig=" + params, "Signature": "sig=:" + sig + ":", "User-Agent": "CrawlPriceIndexBot/1.0 (+https://crawlpriceindex.com)" } };
}
(async () => {
  const host = "http-message-signatures-example.research.cloudflare.com";
  const s = sign(host);
  console.log("1. local signature verify: " + (crypto.verify(null, Buffer.from(s.base), pub, Buffer.from(s.sig, "base64")) ? "PASS" : "FAIL"));
  try {
    const r = await fetch("https://" + host + "/", { headers: s.headers });
    console.log("2. cloudflare validator: HTTP " + r.status);
    const t = await r.text();
    const m = t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    console.log("   says: " + m.slice(0, 220));
  } catch (e) { console.log("2. validator error: " + String(e)); }
  for (const p of ["http-message-signatures-directory", "http-message-signature-directory"]) {
    try {
      const r = await fetch("https://crawlpriceindex.com/.well-known/" + p);
      console.log("3. /" + p + ": HTTP " + r.status + " | type " + r.headers.get("content-type") + " | signed " + (r.headers.get("signature") ? "YES" : "no"));
    } catch (e) { console.log("3. " + p + " error: " + String(e)); }
  }
  console.log("4. kid for the Verified Bots form: " + kid);
  console.log("   directory URL: https://crawlpriceindex.com/.well-known/http-message-signatures-directory");
})();
