#!/usr/bin/env node
/**
 * CPI — box 2, rebalanced (node fix-viz3.cjs)
 * ===========================================================================
 * The right card ran ~500px taller than the left, leaving a void beside it.
 * Regrouped so the two cards are closer in height AND the split now means
 * something: the left card asks "how big is the gap between the two roles",
 * the right card asks the same question again with the vendor held constant.
 */
const fs = require("fs");
const P = "public/index.html";
let s = fs.readFileSync(P, "utf8");
if (s.includes("Held constant")) { console.log("already applied"); process.exit(0); }
fs.copyFileSync(P, P + ".bak-viz4");

const sub = (from, to, label) => {
  if (!s.includes(from)) throw new Error("not found: " + label);
  s = s.split(from).join(to);
};

/* close the left card AFTER the role medians rather than before them */
sub(
  "        '<div class=\"dvf\">Both bars on one scale, so the sliver is the finding. Of ' + n(A.denominator) +\n" +
  "        ' domains serving a readable robots.txt.</div></div>';",
  "        '<div class=\"dvf\">Both bars on one scale, so the sliver is the finding. Of ' + n(A.denominator) +\n" +
  "        ' domains serving a readable robots.txt.</div>';",
  "left card close"
);

sub(
  "      var right = '<div class=\"dv\">' + head(\"How the roles differ\", \"crawlers\", \"Crawlers tab\") +\n" +
  "        '<div class=\"dvsub2\">Median declared block rate, by crawler role</div>' +",
  "      // the role medians finish the LEFT card — same question, wider lens\n" +
  "      left += '<div class=\"dvsub2\">Median declared block rate, by crawler role</div>' +",
  "role medians move"
);

sub(
  "        }).join('') +\n" +
  "        '<div class=\"dvsub2\">Same vendor, same robots.txt, different answer</div>' +\n" +
  "        pairs.map(function(v){",
  "        }).join('') +\n" +
  "        '<div class=\"dvf\">Median rather than mean, so one unusually walled crawler cannot carry a role. Counts are the crawlers we track in each role.</div></div>';\n" +
  "\n" +
  "      var right = '<div class=\"dv\">' + head(\"Held constant: the vendor\", \"crawlers\", \"Crawlers tab\") +\n" +
  "        '<div style=\"font-size:12.5px;color:var(--dim);margin-bottom:4px\">The same robots.txt files, asked about two crawlers from the <em>same</em> company. Whatever a site thinks of the vendor is held constant; only the crawler&rsquo;s role changes.</div>' +\n" +
  "        pairs.map(function(v){",
  "vendor block split"
);

fs.writeFileSync(P, s);

/* the left card is now built in two statements — declare it with let-style var */
let out = fs.readFileSync(P, "utf8");
if (!/var left = '<div class="dv">'/.test(out)) throw new Error("left card declaration lost");
if (!out.includes("Held constant: the vendor")) throw new Error("right card head missing");
if ((out.match(/var right = /g) || []).length !== 1) throw new Error("right declared " + (out.match(/var right = /g) || []).length + " times");

console.log("box 2 regrouped");
console.log("  left  — the asymmetry ratio, the two shared-scale bars, median by role");
console.log("  right — the same question with the vendor held constant");
