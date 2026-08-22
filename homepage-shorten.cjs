#!/usr/bin/env node
/**
 * CPI — homepage: keep one finding, move the weekly edition to /explore
 * ===========================================================================
 * "Homepage is too long. Boxes 4–10 are data findings from the weekly edition
 * right? Is this the place to show it? I let you decide."
 *
 * No, it isn't — and this resolves two open items at once.
 *
 * The homepage has one job: someone arrives knowing nothing, and leaves
 * understanding what this measures, why it matters, and where to go. Seven
 * consecutive edition panels do not serve that job; they serve the visitor who
 * already knows, and that visitor should be on /explore.
 *
 * /explore was also short one thing. It shows the dashboard preview, which
 * answers "what would I be buying" — but not "what does the data say this
 * week", which is what a journalist or a curious reader actually wants and
 * cannot get without an account. These panels are exactly that page.
 *
 * So:
 *   HOMEPAGE keeps 01 Start here, 02 What we measure, 03 This week (three
 *            numbers), 04 Training versus traffic — the one finding that IS
 *            the thesis, and the reason 01 defines training vs search — then
 *            Where to go next.
 *   /EXPLORE gains What changed · Declared versus enforced · Who gets blocked ·
 *            The wall is rising · How the door answers · The machine market,
 *            beneath the dashboard preview, under a heading that says what
 *            they are: this edition, free to cite.
 *
 * Nothing is deleted. Six panels move, and the homepage drops from eleven
 * sections to five.
 */
const fs = require("fs");
const H = "public/index.html";
const E = "public/explore.html";
let h = fs.readFileSync(H, "utf8");
let e = fs.readFileSync(E, "utf8");
if (e.includes("edition-cuts")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(H, H + ".bak-shorten");
fs.copyFileSync(E, E + ".bak-cuts");

/* ---- lift the six edition panels off the homepage ----------------------- */
const cut = (marker, label) => {
  const i = h.indexOf(marker);
  if (i < 0) throw new Error("not found: " + label);
  const a = h.lastIndexOf("  <section", i);
  const b = h.indexOf("</section>", i) + "</section>".length;
  const html = h.slice(a, b);
  h = h.slice(0, a) + h.slice(b);
  return html;
};
const moved = [
  cut('<span class="lead-in">What changed this week</span>', "changes"),
  cut('<span class="lead-in">Declared versus enforced</span>', "reachability"),
  cut('<span class="lead-in">Who gets blocked</span>', "ladder"),
  cut('<span class="lead-in">The wall is rising</span>', "trend"),
  cut('<span class="lead-in">How the door answers</span>', "door"),
  cut('<span class="lead-in">The machine market</span>', "bazaar"),
];
fs.writeFileSync(H, h);

/* ---- and land them on /explore ------------------------------------------ */
const CUTS = `<div class="wrap"><div class="panels" id="edition-cuts">

  <section class="panel wide" id="cuts-head">
    <div class="ix"><span class="lead-in">This edition</span></div>
    <h2>What the data says this week.</h2>
    <p class="lede" style="margin:0">The cuts below are the current edition, in full and free to cite with attribution. They are the same figures behind the dashboard above &mdash; what a subscription adds is the per-domain layer underneath them, not these.</p>
  </section>

${moved.join("\n\n")}

</div></div>

`;

const anchor = '<footer class="sitefoot">';
const at = e.indexOf(anchor);
if (at < 0) throw new Error("explore footer anchor not found");
e = e.slice(0, at) + CUTS + e.slice(at);

/* the panels read /index.json and the homepage's inline #data block; explore
   has neither, so both come with them */
const dataBlock = (h.match(/<script id="data" type="application\/json">[\s\S]*?<\/script>/) || [])[0]
  || (fs.readFileSync(H + ".bak-shorten", "utf8").match(/<script id="data" type="application\/json">[\s\S]*?<\/script>/) || [])[0];
if (!dataBlock) throw new Error("homepage #data block not found");

const homeSrc = fs.readFileSync(H + ".bak-shorten", "utf8");
const grab = (startMark, endMark, label) => {
  const a = homeSrc.indexOf(startMark);
  if (a < 0) throw new Error("not found on homepage: " + label);
  const b = homeSrc.indexOf(endMark, a);
  if (b < 0) throw new Error("end not found: " + label);
  return homeSrc.slice(a, b + endMark.length);
};
const staticRenderers = grab("var D = {};", "})();\n\n\n</script>", "static renderers");
const v2loader = grab('<script id="v2-loader">', "</scr" + "ipt>", "v2 loader");

e = e.replace(anchor,
  dataBlock + "\n<script>\n" + staticRenderers + "\n</script>\n" + v2loader + "\n" + anchor);

fs.writeFileSync(E, e);

/* ---- verify -------------------------------------------------------------- */
const H2 = fs.readFileSync(H, "utf8");
const E2 = fs.readFileSync(E, "utf8");
const hBody = H2.slice(0, H2.indexOf('<footer class="sitefoot">'));
const eBody = E2.slice(0, E2.indexOf('<footer class="sitefoot">'));

for (const g of ["What changed this week", "Declared versus enforced", "Who gets blocked",
                 "The wall is rising", "How the door answers", "The machine market"]) {
  if (hBody.includes(g)) throw new Error("still on the homepage: " + g);
  if (!eBody.includes(g)) throw new Error("did not land on /explore: " + g);
}
for (const k of ["Start here", "What we measure", "This week", "Training versus traffic", "Where to go next"])
  if (!hBody.includes(k)) throw new Error("homepage lost: " + k);

const homePanels = (hBody.match(/<section class="panel/g) || []).length;
if (homePanels !== 5) throw new Error("expected 5 homepage panels, found " + homePanels);
for (const f of [H2, E2])
  if ((f.match(/<section[\s>]/g) || []).length !== (f.match(/<\/section>/g) || []).length)
    throw new Error("section tags unbalanced");
if ((E2.match(/id="v2-loader"/g) || []).length !== 1) throw new Error("loader duplicated on /explore");
if ((E2.match(/id="data"/g) || []).length !== 1) throw new Error("data block duplicated on /explore");

console.log("homepage: 11 sections -> 5");
console.log("  kept  Start here · What we measure · This week · Training versus traffic · Where next");
console.log("  Training versus traffic stays because it IS the thesis, and section 01");
console.log("  exists to make it land");
console.log("");
console.log("/explore: gained the six edition cuts under 'What the data says this week'");
console.log("  which also answers the findings-page question — the preview shows what you");
console.log("  would buy, these show what the data says, and neither needed a new page");
