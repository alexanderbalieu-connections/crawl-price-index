#!/usr/bin/env node
// Folds wide-probe.json into the product (additive keys only).
// Payload strings travel base64-encoded so no shell/quoting layer can mangle them.
const fs = require("fs");
const { execSync } = require("child_process");
const B = (x) => Buffer.from(x, "base64").toString("utf8");
function apply(path, anchorB64, addB64, marker) {
  let s = fs.readFileSync(path, "utf8");
  if (s.indexOf(marker) !== -1) { console.log(path + ": already patched"); return; }
  const anchor = B(anchorB64), add = B(addB64);
  if (s.split(anchor).length !== 2) { console.error("ABORT: anchor not unique in " + path); process.exit(1); }
  fs.copyFileSync(path, path + ".bak-wide");
  fs.writeFileSync(path, s.replace(anchor, add));
  try { execSync("node --check " + path, { stdio: "pipe" }); console.log(path + ": patched OK"); }
  catch (e) { fs.copyFileSync(path + ".bak-wide", path); console.error(path + ": SYNTAX FAILED, rolled back"); process.exit(1); }
}
apply("rebuild.cjs", "ZnMud3JpdGVGaWxlU3luYygicGFpZC1kYXRhc2V0Lmpzb24iLCBKU09OLnN0cmluZ2lmeShwYWlkRGF0YXNldCkpOw==", "Ly8gd2lkZV9wcm9iZTogaG9uZXN0LWlkZW50aXR5IHNjYW4gb2YgdG9wLU4gKyBhbGwgYmxvY2tlcnMgKGFkZGl0aXZlIGtleSkKaWYgKGZzLmV4aXN0c1N5bmMoIndpZGUtcHJvYmUuanNvbiIpKSB7CiAgdHJ5IHsgcGFpZERhdGFzZXQud2lkZV9wcm9iZSA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKCJ3aWRlLXByb2JlLmpzb24iLCAidXRmOCIpKTsgfSBjYXRjaCAoZSkge30KfQpmcy53cml0ZUZpbGVTeW5jKCJwYWlkLWRhdGFzZXQuanNvbiIsIEpTT04uc3RyaW5naWZ5KHBhaWREYXRhc2V0KSk7", "wide_probe: honest-identity");
apply("archive.cjs", "ICB0b3Bfb2JzZXJ2ZWRfcHJpY2VfdXNkOiB0b3BQcmljZSw=", "ICB0b3Bfb2JzZXJ2ZWRfcHJpY2VfdXNkOiB0b3BQcmljZSwKICB3aWRlX3Byb2JlOiAoZnVuY3Rpb24gKCkgeyB0cnkgeyBjb25zdCB3ID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMoIndpZGUtcHJvYmUuanNvbiIsICJ1dGY4IikpLnN1bW1hcnk7CiAgICByZXR1cm4geyBwcm9iZWQ6IHcucHJvYmVkLCBwNDAyOiB3LnA0MDIsIHByaWNlZDogdy5wcmljZWQubGVuZ3RoLCB0b2xsYml0OiB3LnRvbGxiaXQsCiAgICAgICAgICAgICBjZl9mcm9udGVkOiB3LmNmX2Zyb250ZWQsIG5vYWk6IHcueF9yb2JvdHNfbm9haSwgbGxtc190eHQ6IHcubGxtc190eHQgfTsgfSBjYXRjaCAoZSkgeyByZXR1cm4gbnVsbDsgfSB9KSgpLA==", "wide_probe: (function");
