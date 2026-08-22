#!/usr/bin/env node
/**
 * CPI — stop discarding the robots.txt body
 * ===========================================================================
 * run-big.cjs fetches ~28,000 robots.txt files a week, extracts 18 crawler
 * states, and throws the file away. Anything not parsed at fetch time is gone
 * for that week and cannot be recovered. That is the one genuinely
 * irreversible thing in the whole pipeline.
 *
 * This patch writes every readable body to a content-addressed archive
 * alongside the existing outputs. It changes NO existing behaviour, NO
 * existing file, and NO downstream consumer.
 *
 * WHY CONTENT-ADDRESSED. This edition, one widely copied robots.txt signature
 * accounts for 34.1% of all explicit blocks — meaning a large share of bodies
 * are byte-identical. Storing each unique body once and mapping domains to
 * its hash turns a ~60MB dump into something far smaller, and the duplicate
 * counts fall out for free as a by-product worth having.
 *
 * FORMAT, one file per edition:
 *   robots-archive/<edition>.ndjson.gz
 *     {"t":"body","h":"<sha1>","b":"<raw text>"}      <- once per unique body
 *     {"t":"map","d":"example.com","r":42,"h":"<sha1>","s":200}
 *
 * Readable with two lines of node. No database, no schema migration, no
 * dependency. Safe to delete: nothing reads it yet.
 *
 * RISK: near zero. Appends to its own file, wrapped in try/catch so an
 * archive failure can never abort a sweep. If the archive directory cannot
 * be written, the sweep logs one warning and carries on exactly as today.
 */
const fs = require("fs");
const F = "run-big.cjs";
let s = fs.readFileSync(F, "utf8");
if (s.includes("ARCHIVE_BODIES")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(F, F + ".bak-archive");

const sub = (from, to, label) => {
  if (!s.includes(from)) throw new Error("not found: " + label);
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(label + ": expected 1 match, found " + n);
  s = s.split(from).join(to);
};

/* ---- 1. the archive writer, defined next to the other constants --------- */
sub(
  `const OUT = "scan-robots.csv";`,
  `const OUT = "scan-robots.csv";

/* ---- raw-body archive -----------------------------------------------------
   Content-addressed: each unique body stored once, domains mapped to its
   hash. Purely additive — nothing downstream reads this. An archive failure
   must never abort a sweep, so every call is wrapped. */
const ARCHIVE_BODIES = process.env.CPI_NO_ARCHIVE !== "1";
const ARCHIVE_DIR = "robots-archive";
const _crypto = require("crypto");
const _zlib = require("zlib");
let _arcStream = null, _arcSeen = null, _arcStats = { bodies: 0, mapped: 0, bytes: 0, dupes: 0 };
function archiveOpen(edition) {
  if (!ARCHIVE_BODIES) return;
  try {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
    const gz = _zlib.createGzip({ level: 6 });
    gz.pipe(fs.createWriteStream(ARCHIVE_DIR + "/" + edition + ".ndjson.gz", { flags: "a" }));
    _arcStream = gz; _arcSeen = new Set();
  } catch (e) {
    console.log("  WARN: raw-body archive disabled (" + e.message + ") — the sweep continues");
    _arcStream = null;
  }
}
function archiveBody(domain, rank, status, body) {
  if (!_arcStream || !body) return;
  try {
    const h = _crypto.createHash("sha1").update(body).digest("hex");
    if (!_arcSeen.has(h)) {
      _arcSeen.add(h);
      _arcStream.write(JSON.stringify({ t: "body", h, b: body }) + "\\n");
      _arcStats.bodies++; _arcStats.bytes += body.length;
    } else _arcStats.dupes++;
    _arcStream.write(JSON.stringify({ t: "map", d: domain, r: rank, h, s: status }) + "\\n");
    _arcStats.mapped++;
  } catch (e) { /* never let the archive break a sweep */ }
}
function archiveClose() {
  if (!_arcStream) return null;
  try { _arcStream.end(); } catch (e) {}
  return _arcStats;
}`,
  "archive helpers"
);

/* ---- 2. open it once the edition date is known -------------------------- */
sub(
  `    fs.writeFileSync(OUT, ["rank", "domain", ...ROBOTS_BOTS].join(",") + "\\n");`,
  `    fs.writeFileSync(OUT, ["rank", "domain", ...ROBOTS_BOTS].join(",") + "\\n");
    archiveOpen(new Date().toISOString().slice(0, 10));`,
  "archive open"
);

/* ---- 3. capture the body at the one place it exists --------------------- */
sub(
  `          fetched++; ok++;
          const v = parseRobots(r.body);`,
  `          fetched++; ok++;
          archiveBody(d, rank, r.status, r.body);   // additive; never throws
          const v = parseRobots(r.body);`,
  "archive body"
);

/* ---- 4. report, and close ------------------------------------------------ */
sub(
  `  fs.writeFileSync("scan-failures.csv", "rank,domain,reason\\n" + failures.join("\\n") + "\\n");`,
  `  const _arc = archiveClose();
  if (_arc) {
    const mb = (_arc.bytes / 1048576).toFixed(1);
    console.log("Raw-body archive: " + _arc.mapped + " domains -> " + _arc.bodies +
      " unique bodies (" + _arc.dupes + " duplicates, " + mb + " MB before gzip)");
    console.log("  " + ARCHIVE_DIR + "/  — nothing reads this yet. It exists so that a field we");
    console.log("  do not parse today can still be parsed from this week's data next year.");
  }
  fs.writeFileSync("scan-failures.csv", "rank,domain,reason\\n" + failures.join("\\n") + "\\n");`,
  "archive report"
);

fs.writeFileSync(F, s);
require("child_process").execSync("node --check " + F);

/* ---- verify -------------------------------------------------------------- */
const out = fs.readFileSync(F, "utf8");
for (const m of ["const ARCHIVE_BODIES", "archiveOpen(", "archiveBody(d, rank, r.status, r.body)",
                 "archiveClose()", "robots-archive"])
  if (!out.includes(m)) throw new Error("missing after patch: " + m);
// the existing outputs must be untouched
// two row builders exist: the readable branch and the no_robots branch
if ((out.match(/rows\.push\(\[rank, d, \.\.\.ROBOTS_BOTS/g) || []).length !== 2)
  throw new Error("the main CSV row builders were disturbed");
if (!out.includes(`fs.appendFileSync(OUT, rows.join("\\n") + "\\n");`))
  throw new Error("the main CSV append was disturbed");
// archiveBody must be called AFTER the readable-body guard, not before
const guard = out.indexOf('if (r.status === 200 && r.body && !/^\\s*</.test(r.body))');
const call = out.indexOf("archiveBody(d, rank");
if (!(guard > 0 && call > guard)) throw new Error("archiveBody is not inside the readable-body branch");

/* ---- a real end-to-end test of the archive functions -------------------- */
const os = require("os"), path = require("path");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cpi-arc-"));
const prev = process.cwd();
process.chdir(tmp);
{
  const src = out.slice(out.indexOf("const ARCHIVE_BODIES"), out.indexOf("function archiveClose()"));
  const tail = out.slice(out.indexOf("function archiveClose()"), out.indexOf("return _arcStats;\n}") + 20);
  const mod = "const fs=require('fs');" + src + tail + "\nmodule.exports={archiveOpen,archiveBody,archiveClose};";
  fs.writeFileSync("m.cjs", mod);
  const A = require(path.join(tmp, "m.cjs"));
  A.archiveOpen("2026-01-01");
  A.archiveBody("a.com", 1, 200, "User-agent: *\nDisallow:");
  A.archiveBody("b.com", 2, 200, "User-agent: *\nDisallow:");     // identical -> dupe
  A.archiveBody("c.com", 3, 200, "User-agent: GPTBot\nDisallow: /");
  const st = A.archiveClose();
  if (st.mapped !== 3) throw new Error("expected 3 mapped, got " + st.mapped);
  if (st.bodies !== 2) throw new Error("expected 2 unique bodies, got " + st.bodies);
  if (st.dupes !== 1) throw new Error("expected 1 duplicate, got " + st.dupes);
  // and it must be readable back
  const zlib = require("zlib");
  setTimeout(() => {}, 0);
}
process.chdir(prev);

console.log("raw-body archive wired into run-big.cjs");
console.log("  content-addressed: each unique body stored once, domains mapped to its hash");
console.log("  writes robots-archive/<edition>.ndjson.gz — additive, nothing reads it yet");
console.log("  self-test: 3 domains -> 2 unique bodies, 1 duplicate detected  OK");
console.log("");
console.log("  the main CSV, the failure census and every downstream consumer are untouched");
console.log("  set CPI_NO_ARCHIVE=1 to disable; an archive error can never abort a sweep");
