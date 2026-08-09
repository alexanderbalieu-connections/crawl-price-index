const fs = require("fs"), crypto = require("crypto");
if (fs.existsSync(".wba-private.pem")) { console.log("keys already exist - skipping"); process.exit(0); }
const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
fs.writeFileSync(".wba-private.pem", privateKey.export({ type: "pkcs8", format: "pem" }));
fs.writeFileSync(".wba-private.b64", privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"));
const jwk = publicKey.export({ format: "jwk" });
const kid = crypto.createHash("sha256").update(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x })).digest("base64url");
jwk.kid = kid;
jwk.nbf = Math.floor(Date.now() / 1000);
fs.writeFileSync("wba-directory.json", JSON.stringify({ keys: [jwk] }, null, 2));
console.log("keypair created - kid: " + kid);
