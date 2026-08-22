#!/usr/bin/env node
/**
 * CPI — read the RSL licence documents  (v2, after the first run)
 * ===========================================================================
 * v1 got one document out of three and mis-read it.
 *
 * FAULT — I GUESSED THE SCHEMA AND PARSED ONLY ATTRIBUTES.
 *   v1 printed `permits usage` with no values, because it matched
 *   <permits .../> as a self-closing tag and read attributes only. RSL puts
 *   the usage classes in ELEMENT TEXT — <permits type="usage">ai-input,
 *   search</permits> — so v1 silently dropped the single field this whole
 *   exercise exists to read. It also skipped <custom>, which the Guardian
 *   document contains.
 *
 *   v2 stops guessing. These documents are tiny — the Guardian's is 336
 *   bytes — so it walks EVERY element and prints every attribute and every
 *   text value, then interprets on top of that dump rather than instead of
 *   it. If the schema is not what I think it is, the dump still shows the
 *   truth and I can see that I was wrong.
 *
 * A 403 IS A FINDING, NOT AN ERROR.
 *   Two of three documents refused our identified crawler. A publisher that
 *   advertises a licence URL in robots.txt and then blocks the crawler that
 *   comes to read it is the terms-layer version of the declared-versus-
 *   enforced gap we already measure at the homepage (4,902 alive domains
 *   serve robots.txt but refuse an honest crawler). It is recorded as a
 *   state with its status code, not swallowed as a failure.
 *
 * WE DO NOT SPOOF. The honest user-agent is the point. A refusal to
 * CrawlPriceIndexBot IS the measurement.
 *
 * Enumerated field values and source URLs only — no licence prose is
 * reproduced. A licence document can carry protectable expression; its
 * field values are facts.
 *
 * RUN:  node rsl-read.cjs            (URLs from terms-pilot.json)
 *       node rsl-read.cjs URL...
 */
const fs = require("fs");

let urls = process.argv.slice(2);
if (!urls.length) {
  if (!fs.existsSync("terms-pilot.json")) { console.error("run terms-layer-pilot.cjs first"); process.exit(1); }
  const p = JSON.parse(fs.readFileSync("terms-pilot.json", "utf8"));
  urls = [...new Set(p.rows.filter((r) => r.rslLicense).map((r) => r.rslLicense))];
}
if (!urls.length) { console.log("no RSL licence URLs to read"); process.exit(0); }

const UA = "CrawlPriceIndexBot/1.0 (crawl-economy measurement; robots.txt study; contact: hello@crawlpriceindex.com)";

/* A minimal, dependency-free XML walk. Not a conformant parser — a faithful
   dump. Its job is to avoid deciding what matters. */
function walk(xml) {
  xml = xml.replace(/<\?[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "");  // prolog and comments are not structure
  const out = [];
  const re = /<([a-zA-Z][\w:-]*)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*(\/?)>|<\/([a-zA-Z][\w:-]*)\s*>|([^<]+)/g;
  let depth = 0, m;
  while ((m = re.exec(xml))) {
    if (m[1]) {
      const attrs = [...m[2].matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)].map((a) => [a[1], a[2]]);
      out.push({ kind: "open", name: m[1].toLowerCase(), attrs, depth, selfClose: m[3] === "/" });
      if (m[3] !== "/") depth++;
    } else if (m[4]) {
      depth = Math.max(0, depth - 1);
      out.push({ kind: "close", name: m[4].toLowerCase(), depth });
    } else {
      const t = (m[5] || "").trim();
      if (t) out.push({ kind: "text", text: t, depth });
    }
  }
  return out;
}

const RESULTS = [];

(async () => {
  for (const url of urls) {
    console.log("");
    console.log("=".repeat(76));
    console.log(url);
    console.log("=".repeat(76));
    const rec = { url, state: null };
    let xml = "";
    try {
      const r = await fetch(url, {
        headers: { "user-agent": UA, accept: "application/xml,text/xml,*/*" },
        redirect: "follow",
      });
      console.log("  HTTP " + r.status + "   " + (r.headers.get("content-type") || "?"));
      if (r.status !== 200) {
        try { r.body?.cancel(); } catch {}
        rec.state = "refused"; rec.status = r.status;
        console.log("  -> REFUSED to our identified crawler. State: advertised-but-unreadable.");
        console.log("     The licence URL is declared in robots.txt; the document behind it is not");
        console.log("     served to the crawler invited to read it. That is a measurement, not a bug.");
        RESULTS.push(rec); continue;
      }
      xml = await r.text();
      if (/<html/i.test(xml.slice(0, 300))) {
        rec.state = "not-xml";
        console.log("  -> 200, but HTML is served at the licence URL. No machine-readable terms.");
        RESULTS.push(rec); continue;
      }
    } catch (e) {
      rec.state = "error"; rec.err = e.cause?.code || e.message;
      console.log("  fetch failed: " + rec.err);
      RESULTS.push(rec); continue;
    }

    rec.state = "read"; rec.bytes = xml.length;
    console.log("  bytes " + xml.length);
    console.log("");
    console.log("  FULL STRUCTURE — every element, attribute and text value:");
    let lastOpen = null;
    for (const n of walk(xml)) {
      const pad = "    " + "  ".repeat(n.depth);
      if (n.kind === "open") {
        console.log(pad + "<" + n.name + ">" +
          (n.attrs.length ? "   " + n.attrs.map(([k, v]) => k + '="' + v + '"').join("  ") : ""));
        lastOpen = n.name;
        for (const [k, v] of n.attrs) {
          if (n.name === "payment" && k.toLowerCase() === "type") rec.payment = v;
          if (n.name === "amount" && k.toLowerCase() === "currency") rec.currency = v;
          if (n.name === "content" && k.toLowerCase() === "url") rec.contentUrl = v;
          // values may also arrive as an attribute rather than as text
          if ((n.name === "permits" || n.name === "prohibits") && k.toLowerCase() === "values") rec[n.name] = v;
        }
      } else if (n.kind === "text") {
        console.log(pad + "  └ " + n.text);
        if (lastOpen === "permits" || lastOpen === "prohibits") rec[lastOpen] = n.text;
        if (lastOpen === "amount") rec.amount = n.text;
      }
    }

    console.log("");
    console.log("  READ AS:");
    console.log("    content url    " + (rec.contentUrl || "—"));
    console.log("    payment type   " + (rec.payment || "none declared"));
    console.log("    amount         " + (rec.amount ? rec.amount + " " + (rec.currency || "") : "NONE STATED"));
    console.log("    permits        " + (rec.permits || "—"));
    console.log("    prohibits      " + (rec.prohibits || "—"));
    if (rec.payment === "use")
      console.log("    ^^ type=use is PER-INFERENCE — a declared pay-per-answer price.");
    else
      console.log("    (type=use would be per-inference. This is not that.)");
    RESULTS.push(rec);
  }

  /* ---- the negatives are the finding here, so summarise them ------------- */
  const read = RESULTS.filter((r) => r.state === "read");
  const refused = RESULTS.filter((r) => r.state === "refused");
  const priced = read.filter((r) => r.amount);
  const perInf = read.filter((r) => r.payment === "use");

  console.log("");
  console.log("=".repeat(76));
  console.log("SUMMARY");
  console.log("=".repeat(76));
  console.log("  licence documents advertised   " + RESULTS.length);
  console.log("  readable by our crawler        " + read.length);
  console.log("  refused our crawler            " + refused.length +
    (refused.length ? "   " + refused.map((r) => r.status + " " + (() => { try { return new URL(r.url).host; } catch { return r.url; } })()).join(", ") : ""));
  console.log("  carrying an AMOUNT             " + priced.length);
  console.log("  per-inference (payment=use)    " + perInf.length);
  console.log("");
  if (!perInf.length) {
    console.log("  NO DECLARED PAY-PER-ANSWER PRICE FOUND.");
    console.log("  The hypothesis that RSL would hand us one does not hold on this sample.");
  }
  if (refused.length) {
    console.log("");
    console.log("  " + refused.length + " of " + RESULTS.length + " advertise a licence URL and then refuse the crawler");
    console.log("  invited to read it. Population-scale licence reading will carry a real");
    console.log("  non-response rate, and that rate is itself worth publishing.");
  }
  fs.writeFileSync("rsl-read.json", JSON.stringify({ generated_utc: new Date().toISOString(), results: RESULTS }, null, 1));
  console.log("");
  console.log("  wrote rsl-read.json");
  console.log("  Field values and source URLs only — no licence prose reproduced.");
})();
