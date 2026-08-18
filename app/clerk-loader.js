// Decodes the Clerk frontend-API host from the publishable key and loads clerk-js.
// pk_test_<base64("foo-bar-12.clerk.accounts.dev$")> — strip the trailing $.
(function () {
  var pk = window.CPI_CLERK_PK || "";
  if (!pk || pk.indexOf("__") === 0) {
    document.addEventListener("DOMContentLoaded", function () {
      var el = document.getElementById("auth-slot");
      if (el) el.innerHTML = '<p style="color:var(--dim);font-size:14px">Auth not configured yet — publishable key missing.</p>';
    });
    return;
  }
  var b64 = pk.replace(/^pk_(test|live)_/, "");
  var host = "";
  b64 += "=".repeat((4 - b64.length % 4) % 4);
  try { host = atob(b64).replace(/\$$/, ""); } catch (e) { console.error("Bad Clerk key"); return; }
  var s = document.createElement("script");
  s.async = true; s.crossOrigin = "anonymous";
  s.setAttribute("data-clerk-publishable-key", pk);
  s.src = "https://" + host + "/npm/@clerk/clerk-js@5/dist/clerk.browser.js";
  s.addEventListener("load", async function () {
    await window.Clerk.load();
    if (window.CPI_ON_CLERK_READY) window.CPI_ON_CLERK_READY(window.Clerk);
  });
  document.head.appendChild(s);
})();
