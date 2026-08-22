#!/usr/bin/env node
/**
 * CPI — stop showing free accounts buttons that only fail
 * ===========================================================================
 * The Data downloads panel offered every account three buttons. Two of them —
 * Per-domain JSON and Per-domain CSV — went straight to a 402 for anyone
 * without a subscription. Pressing a button and getting an error is a worse
 * experience than being told up front what the button needs, and it made the
 * paywall look broken rather than deliberate.
 *
 * They are now disabled for free accounts, with the reason on the button and
 * a line underneath saying what unlocks them. The panel's blurb also stops
 * claiming "your licensed extracts" to someone who has not licensed anything.
 *
 * The three listeners were attached with no null guard, so this deliberately
 * keeps the elements in the DOM (disabled) rather than removing them — and
 * guards them anyway, since a disabled button is one edit away from being an
 * absent one.
 */
const fs = require("fs");
const V = "app/views.js";
let v = fs.readFileSync(V, "utf8");
if (v.includes("dl-locked")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(V, V + ".bak-dlbuttons");

const sub = (from, to, label) => {
  if (!v.includes(from)) throw new Error("not found: " + label);
  v = v.split(from).join(to);
};

sub(
  `      '<p class="sub">Your licensed extracts of the current edition. Per-domain data is licensed to your account and not for redistribution.</p>' +
      '<div class="ctrls">' +
        '<button class="btnx" id="dl-json">Per-domain JSON (current edition)</button>' +
        '<button class="btnx" id="dl-csv">Per-domain CSV (current edition)</button>' +
        '<button class="btnx" id="dl-agg" style="background:#1D4E6F;border-color:#1D4E6F">Aggregate dashboard JSON</button>' +
      '</div><div id="pd-status"></div>' +`,
  `      '<p class="sub">' + (isTerminal
        ? 'Your licensed extracts of the current edition. Per-domain data is licensed to your account and not for redistribution.'
        : 'The aggregate dashboard is yours to download and cite. The per-domain extracts are part of Terminal.') + '</p>' +
      '<div class="ctrls">' +
        '<button class="btnx' + (isTerminal ? '' : ' dl-locked') + '" id="dl-json"' +
          (isTerminal ? '' : ' disabled title="Per-domain JSON needs a Terminal subscription"') +
          '>Per-domain JSON (current edition)' + (isTerminal ? '' : ' &middot; \\u20ac49') + '</button>' +
        '<button class="btnx' + (isTerminal ? '' : ' dl-locked') + '" id="dl-csv"' +
          (isTerminal ? '' : ' disabled title="Per-domain CSV needs a Terminal subscription"') +
          '>Per-domain CSV (current edition)' + (isTerminal ? '' : ' &middot; \\u20ac49') + '</button>' +
        '<button class="btnx" id="dl-agg" style="background:#1D4E6F;border-color:#1D4E6F">Aggregate dashboard JSON</button>' +
      '</div><div id="pd-status"></div>' +
      (isTerminal ? '' :
        '<p class="foot" style="margin-top:10px">The two per-domain extracts unlock with a subscription &mdash; ' +
        'every domain &times; every tracked crawler, as JSON or CSV. ' +
        '<a href="#account" id="dl-upsell" style="color:var(--signal);font-weight:600;text-decoration:none">See what Terminal includes &rarr;</a></p>') +`,
  "downloads panel"
);

/* the listeners were unguarded; a disabled button is one edit from an absent one */
sub(`    EL("dl-agg").addEventListener("click", function () {`,
    `    if (EL("dl-agg")) EL("dl-agg").addEventListener("click", function () {`, "agg guard");
sub(`    EL("dl-json").addEventListener("click", function () {`,
    `    if (EL("dl-json") && !EL("dl-json").disabled) EL("dl-json").addEventListener("click", function () {`, "json guard");
sub(`    EL("dl-csv").addEventListener("click", function () {`,
    `    if (EL("dl-csv") && !EL("dl-csv").disabled) EL("dl-csv").addEventListener("click", function () {`, "csv guard");

/* the upsell link scrolls to the subscription panel above */
sub(
  `    if (EL("acct-retry")) EL("acct-retry").addEventListener("click", function () {`,
  `    if (EL("dl-upsell")) EL("dl-upsell").addEventListener("click", function (e) {
      e.preventDefault();
      var s = document.querySelector(".ctrls #buy-sub");
      if (s) s.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    if (EL("acct-retry")) EL("acct-retry").addEventListener("click", function () {`,
  "upsell wiring"
);

fs.writeFileSync(V, v);
require("child_process").execSync("node --check " + V);

/* the disabled look has to read as locked, not as broken */
const H = "app/dashboard.html";
let h = fs.readFileSync(H, "utf8");
if (!h.includes(".btnx:disabled")) {
  fs.copyFileSync(H, H + ".bak-dlbuttons");
  h = h.replace(
    ".btnx:hover{opacity:.9}",
    ".btnx:hover{opacity:.9}\n" +
    "/* locked, not broken: a paywalled control should look deliberate */\n" +
    ".btnx:disabled,.btnx.dl-locked{background:transparent;color:var(--dim);border-color:var(--line);cursor:not-allowed;opacity:1}\n" +
    ".btnx:disabled:hover,.btnx.dl-locked:hover{opacity:1;border-color:var(--line)}"
  );
  fs.writeFileSync(H, h);
  console.log("dashboard.html: disabled buttons now read as locked rather than broken");
}

const out = fs.readFileSync(V, "utf8");
for (const m of ["dl-locked", "dl-upsell", 'if (EL("dl-json") && !EL("dl-json").disabled)'])
  if (!out.includes(m)) throw new Error("missing after patch: " + m);

console.log("free accounts no longer get two buttons that only produce a 402");
console.log("  disabled, labelled · €49, with a line saying what unlocks them");
console.log("  the panel blurb stops calling them 'your licensed extracts'");
console.log("  all three listeners are now null- and disabled-guarded");
