const fs = require("fs");
let s = fs.readFileSync("worker.js", "utf8");
const A = "// subscription created / paid";
const B = "// cancelled / payment failed";
const a = s.indexOf(A), b = s.indexOf(B);
if (a === -1 || b === -1 || b < a) { console.error("markers not found — aborting, file untouched"); process.exit(1); }
const block = `// subscription created / paid → issue or reactivate a key
  if (type === "checkout.session.completed" || type === "customer.subscription.created" || type === "invoice.paid") {
    const customer = obj.customer || obj.customer_id;
    let email = obj.customer_details?.email || obj.customer_email || "";
    if (customer) {
      let key = await env.KEYS.get("cust:" + customer);
      if (!key) {
        key = "cpi_live_" + crypto.randomUUID().replace(/-/g, "");
        await env.KEYS.put("cust:" + customer, key);
      }
      // fallback: fetch email from the Stripe customer object if the event lacked it
      if (!email && env.STRIPE_SECRET_KEY) {
        try {
          const r = await fetch("https://api.stripe.com/v1/customers/" + customer, {
            headers: { Authorization: "Bearer " + env.STRIPE_SECRET_KEY },
          });
          if (r.ok) email = (await r.json()).email || "";
        } catch (e) { console.error("customer email fetch failed", e); }
      }
      // email->customer map enables key recovery by email
      if (email) await env.KEYS.put("email:" + email.toLowerCase(), customer);
      // preserve created/count/emailed across repeat events (monthly invoice.paid etc.)
      let prev = {};
      try { prev = JSON.parse(await env.KEYS.get(key)) || {}; } catch (e) {}
      const rec = {
        customer,
        email: email || prev.email || "",
        status: "active",
        created: prev.created || new Date().toISOString(),
        month: prev.month || new Date().toISOString().slice(0, 7),
        count: prev.count || 0,
        emailed: !!prev.emailed,
      };
      // send the key once we have an address and haven't sent it yet —
      // whichever event that happens on. Failure never breaks the webhook,
      // but is logged loudly (visible in wrangler tail).
      if (rec.email && !rec.emailed) {
        try { await sendKeyEmail(env, rec.email, key); rec.emailed = true; }
        catch (e) { console.error("sendKeyEmail FAILED", customer, String(e)); }
      }
      await env.KEYS.put(key, JSON.stringify(rec));
    }
  }`;
fs.writeFileSync("worker.js.bak", s);
fs.writeFileSync("worker.js", s.slice(0, a) + block + "\n\n  " + s.slice(b));
console.log("patched OK — backup at worker.js.bak");
