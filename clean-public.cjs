#!/usr/bin/env node
/**
 * CPI — 101 backup files were being served from the live site
 * ===========================================================================
 * `public/` is the directory Wrangler deploys. Every patch script written for
 * this project — mine included, all of them — took its safety backup with
 *
 *     fs.copyFileSync(F, F + ".bak-something")
 *
 * where F was a file inside `public/`. Wrangler ships the whole directory, so
 * every one of those backups went live at a fetchable URL. Today's deploy
 * output shows it plainly:
 *
 *     + /robots.txt.bak-selfdecl
 *     + /methodology.html.bak-selfdecl
 *
 * Of 157 files in the deployed directory, only ~53 are real assets. 101 are
 * backups.
 *
 * WHY THIS IS WORSE THAN UNTIDY. Several are pre-correction copies of pages
 * we deliberately fixed:
 *
 *   why.html.bak-correction   the crawler-share text as it read BEFORE the
 *                             correction was published
 *   check.html.bak-revenue    contains the revenue estimate that was
 *                             deliberately removed
 *   why.html.bak-growth       a superseded growth claim
 *
 * A site whose changelog says the archive is never quietly rewritten was
 * simultaneously serving the un-retracted versions at guessable URLs. Anyone
 * could cite a number we had already withdrawn, from our own domain.
 *
 * WHAT THIS DOES
 *   1. Moves every non-deployable file out of public/ into .page-backups/ at
 *      the repo root — outside the deployed directory. Nothing is deleted;
 *      they are genuine rollback points and stay on disk.
 *   2. Writes check-deployable.cjs, a guard that FAILS if public/ ever again
 *      contains a file that is not a deployable asset.
 *   3. Wires that guard into sunday-run.command BEFORE the deploy.
 *
 * A redeploy is required afterwards: Wrangler's manifest only drops the files
 * once they are gone from the directory at deploy time.
 */
const fs = require("fs");
const path = require("path");

const PUB = "public";
const DEST = ".page-backups";
// Everything the site legitimately serves. Anything else is not deployable.
const OK_EXT = new Set([".html", ".json", ".txt", ".xml", ".css", ".js", ".png", ".jpg",
                        ".jpeg", ".svg", ".webp", ".ico", ".gif", ".woff", ".woff2", ".pdf", ".map"]);

function scan(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...scan(p));
    else if (!OK_EXT.has(path.extname(e.name).toLowerCase())) out.push(p);
  }
  return out;
}

const strays = scan(PUB);
console.log("non-deployable files found in " + PUB + "/: " + strays.length);

if (strays.length) {
  fs.mkdirSync(DEST, { recursive: true });
  const moved = [];
  for (const p of strays) {
    const rel = path.relative(PUB, p);
    const to = path.join(DEST, rel.replace(/[\/\\]/g, "__"));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(p, to);
    moved.push(rel);
  }
  console.log("moved to " + DEST + "/ (kept, not deleted):");
  const byPage = {};
  moved.forEach((m) => { const k = m.split(".")[0]; (byPage[k] = byPage[k] || []).push(m); });
  Object.entries(byPage).sort((a, b) => b[1].length - a[1].length)
    .forEach(([k, v]) => console.log("  " + String(v.length).padStart(3) + "  " + k));
  const sensitive = moved.filter((m) => /correction|revenue|growth|v1|v2|v3/.test(m));
  if (sensitive.length) {
    console.log("");
    console.log("  of these, " + sensitive.length + " were superseded copies of corrected or removed content,");
    console.log("  live at fetchable URLs until now:");
    sensitive.slice(0, 12).forEach((m) => console.log("    /" + m));
  }
}

/* ---------- the guard ----------------------------------------------------- */
fs.writeFileSync("check-deployable.cjs", `#!/usr/bin/env node
/**
 * CPI guard — public/ is the deployed directory. Nothing but assets belongs.
 * ===========================================================================
 * Written after 101 patch-script backups were found being served from the
 * live site, including pre-correction copies of pages that had been publicly
 * corrected. Wrangler ships whatever is in public/; a stray file there is a
 * published file.
 *
 * Backups belong in .page-backups/ at the repo root. Patch scripts that touch
 * a file under public/ must write their .bak there, not beside the original.
 */
const fs = require("fs");
const path = require("path");

const OK_EXT = new Set(${JSON.stringify([...OK_EXT])});
const PUB = "public";

function scan(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...scan(p));
    else if (!OK_EXT.has(path.extname(e.name).toLowerCase())) out.push(p);
  }
  return out;
}

const strays = scan(PUB);
const total = (function count(d) {
  let n = 0;
  for (const e of fs.readdirSync(d, { withFileTypes: true }))
    n += e.isDirectory() ? count(path.join(d, e.name)) : 1;
  return n;
})(PUB);

console.log("-".repeat(74));
if (strays.length) {
  console.log("  FAIL  " + strays.length + " non-deployable file(s) in " + PUB + "/ — these WILL be published:");
  strays.slice(0, 25).forEach((p) => console.log("        " + p));
  if (strays.length > 25) console.log("        …and " + (strays.length - 25) + " more");
  console.log("");
  console.log("Move them out of the deployed directory:  node clean-public.cjs");
  process.exit(1);
}
console.log("All " + total + " files in " + PUB + "/ are deployable assets.");
`);
require("child_process").execSync("node --check check-deployable.cjs");

/* ---------- wire it in, before the deploy -------------------------------- */
const S = "sunday-run.command";
let s = fs.readFileSync(S, "utf8");
if (!s.includes("check-deployable.cjs")) {
  fs.copyFileSync(S, S + ".bak-deployable");
  const anchor = `cp trends-public.json public/ 2>/dev/null\n`;
  if (s.split(anchor).length - 1 !== 1) throw new Error("deploy anchor not found exactly once");
  s = s.split(anchor).join(anchor + `
# public/ is what Wrangler ships. A stray backup or scratch file there is a
# published file — 101 of them were once served live, including pre-correction
# copies of pages we had publicly corrected. BLOCKING: do not deploy strays.
node check-deployable.cjs || { echo "DEPLOY BLOCKED — non-deployable files in public/. Run: node clean-public.cjs"; read -r; exit 1; }
`);
  fs.writeFileSync(S, s);
  console.log("");
  console.log("check-deployable.cjs wired into sunday-run.command, BLOCKING, before the deploy");
}

/* ---------- verify -------------------------------------------------------- */
const left = scan(PUB);
if (left.length) throw new Error("strays remain: " + left.length);
const res = require("child_process").spawnSync("node", ["check-deployable.cjs"], { encoding: "utf8" });
process.stdout.write(res.stdout);
if (res.status !== 0) throw new Error("the new guard still fails");
const sr = fs.readFileSync(S, "utf8");
if (!/node check-deployable\.cjs \|\| \{ echo "DEPLOY BLOCKED/.test(sr)) throw new Error("guard not wired blocking");
if (sr.indexOf("check-deployable.cjs") > sr.indexOf("npx wrangler deploy")) throw new Error("guard runs after the deploy");

console.log("");
console.log("REDEPLOY REQUIRED — Wrangler only drops these from the served manifest once");
console.log("they are gone from public/ at deploy time:  npx wrangler deploy");
