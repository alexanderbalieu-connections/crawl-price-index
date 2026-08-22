#!/usr/bin/env node
/**
 * CPI — preview charts, second correction pass (node fix-viz2.cjs)
 * ===========================================================================
 *  1. The subset connector ran the FULL height of its row, so with one subset
 *     row it drew a bracket rather than an elbow, and with a normal row
 *     following it the line pointed down at a row that is not a subset. The
 *     line now stops at the elbow.
 *  2. Colour was carrying two meanings at once. A subset bar should be the
 *     colour of the thing it is a subset OF — a green slice hanging under a
 *     blue bar reads as a different measurement, not a part of it.
 */
const fs = require("fs");
const P = "public/index.html";
const T = "public/theme.css";

let s = fs.readFileSync(P, "utf8");
if (s.includes("subset connector stops at the elbow")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(P, P + ".bak-viz3");

const sub = (from, to, label) => {
  if (!s.includes(from)) throw new Error("not found: " + label);
  s = s.split(from).join(to);
};

/* the reversions bar is a slice of the blue "away from restriction" side */
sub(
  "              tone: '', sub: true,\n" +
  "              note: 'deliberate edits &mdash; the highest-signal rows in the file' }) +",
  "              tone: 'b', sub: true,\n" +
  "              note: 'deliberate edits &mdash; the highest-signal rows in the file' }) +",
  "reversions tone"
);

/* the content bar is a slice of the participating domains above it */
sub(
  "              v: n(B.in_frame_content), pct: B.in_frame_content / (B.in_frame_domains || 1) * 100,\n" +
  "              tone: 'b', sub: true }) : '') +",
  "              v: n(B.in_frame_content), pct: B.in_frame_content / (B.in_frame_domains || 1) * 100,\n" +
  "              tone: '', sub: true }) : '') +",
  "bazaar content tone"
);

fs.writeFileSync(P, s);

let t = fs.readFileSync(T, "utf8");
if (!t.includes("subset connector stops at the elbow")) {
  t += `
/* ---- subset connector stops at the elbow ----
   Running it the full height of the row drew a bracket, and pointed at the
   next row even when that row is not a subset. */
.dvr.dvsub .dvk:before{top:-11px;height:20px;bottom:auto}
.dvr.dvsub:first-child .dvk:before{top:0;height:9px}
`;
  fs.writeFileSync(T, t);
}

const out = fs.readFileSync(P, "utf8");
if (!out.includes("tone: 'b', sub: true,\n              note: 'deliberate edits"))
  throw new Error("reversions tone not applied");

console.log("subset rows now take their parent's colour; connector stops at the elbow");
