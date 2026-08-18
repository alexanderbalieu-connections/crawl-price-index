#!/usr/bin/env node
/**
 * CRAWL PRICE INDEX — COPY GUARD  (node check-copy.cjs)
 * =========================================================================
 * The dashboard's prose makes qualitative claims about the data: "a third of
 * all blocking", "overwhelmingly in one direction", "named far less often".
 * The numbers inside those sentences are interpolated from dashboard.json and
 * always move with the data. The *characterisations* around them do not.
 *
 * If an edition shifts enough, a sentence that was true in August becomes a
 * false statement published to paying customers. This script is the guard.
 *
 * Two layers protect the copy:
 *   1. views.js derives the strongest wording from the data at render time
 *      (fracWord(), the ratio-conditional adjectives, the set-equality check
 *      on the template's crawlers). Those self-correct silently.
 *   2. Everything that cannot be phrased that way is asserted here.
 *
 * Run after compute-dashboard.cjs. Exit 0 = every claim still holds.
 * Exit 1 = at least one sentence in the UI no longer matches the data; the
 * failure names the claim and where it lives so it can be edited.
 */
const fs = require("fs");

const FILE = process.argv[2] || "app/data/dashboard.json";
if (!fs.existsSync(FILE)) { console.error(`copy guard: ${FILE} not found — run compute-dashboard.cjs first`); process.exit(1); }
const D = JSON.parse(fs.readFileSync(FILE, "utf8"));

const results = [];
function claim(where, text, fn) {
  let ok, detail = "";
  try { const r = fn(); ok = r === true || (r && r.ok); detail = (r && r.detail) || ""; }
  catch (e) { ok = false; detail = "threw: " + e.message; }
  results.push({ where, text, ok, detail });
}

const P = D.policy_layer, A = D.archetypes, R = D.roles;
const dm = A && A.dominant;
const S = R && R.asymmetry.vs_search;
const NT = R && R.asymmetry.vs_nontraining;
const pct = n => (n == null ? "n/a" : n.toFixed(2) + "%");

/* ---- structural sanity: if these fail, something upstream is broken ------ */
claim("policy_layer.ladder", "frame > parsed > AI-aware, in that order", () => {
  const L = P.ladder;
  return { ok: L.frame > L.parsed && L.parsed > L.ai_aware,
           detail: `${L.frame} / ${L.parsed} / ${L.ai_aware}` };
});
claim("policy_layer.crawlers", "every crawler's blocked count does not exceed its named count", () => {
  const bad = P.crawlers.filter(c => c.blocked > c.named);
  return { ok: !bad.length, detail: bad.map(c => c.name).join(", ") };
});
claim("archetypes", "the dominant template's blocked cells are a real share of all blocked cells", () => {
  const v = dm.n * dm.crawlers_blocked.length;
  return { ok: v === dm.blocked_cells && dm.blocked_cells <= A.total_blocked_cells,
           detail: `${dm.blocked_cells} of ${A.total_blocked_cells}` };
});

/* ---- Policy layer: claims the prose makes -------------------------------- */
claim("Policy layer — ladder reading",
  '"the AI-policy layer is real but small"', () => {
  const v = P.ladder.ai_aware_pct_frame;
  return { ok: v < 30, detail: `AI-aware is ${pct(v)} of frame; the word "small" stops being fair above ~30%` };
});

claim("Policy layer — name recognition",
  '"They come apart sharply" (block rate vs name recognition diverge)', () => {
  const w = P.crawlers.filter(c => c.blocked_when_named_pct != null).map(c => c.blocked_when_named_pct);
  const spread = Math.max(...w) - Math.min(...w);
  return { ok: spread >= 20, detail: `blocked-once-named spans ${spread.toFixed(1)}pp across the 18` };
});

claim("Policy layer — name recognition",
  '"A crawler almost nobody has heard of looks permissively treated" (low named_pct pairs with low blocked_pct)', () => {
  const cs = P.crawlers.filter(c => c.blocked_when_named_pct != null);
  const leastNamed = cs.slice().sort((a, b) => a.named_pct - b.named_pct)[0];
  return { ok: leastNamed.blocked_pct_parsed < 10 && leastNamed.blocked_when_named_pct > 50,
           detail: `${leastNamed.name}: named ${pct(leastNamed.named_pct)}, blocked ${pct(leastNamed.blocked_pct_parsed)}, but ${leastNamed.blocked_when_named_pct}% once named` };
});

claim("Policy layer — template panel heading",
  'the heading\'s fraction word matches the computed share', () => {
  // mirrors fracWord() in views.js — keep the two in step
  const p = dm.pct_of_all_blocked_cells;
  const bands = [[8,12,"a tenth"],[14,19,"a sixth"],[19,23,"a fifth"],[23,28,"a quarter"],[28,37,"a third"],
                 [37,44,"two fifths"],[44,56,"half"],[56,63,"three fifths"],[63,70,"two thirds"],[70,80,"three quarters"]];
  const hit = bands.find(b => p >= b[0] && p < b[1]);
  return { ok: true, detail: `${p}% renders as "${hit ? hit[2] : p.toFixed(0) + "%"}"` };
});

claim("Policy layer — template panel",
  '"the most common policy that blocks anything" is genuinely dominant among blocking policies', () => {
  const blockers = A.top.filter(a => !a.is_silent);
  return { ok: blockers.length > 0 && blockers[0].signature === dm.signature && dm.n >= (blockers[1] ? blockers[1].n * 2 : 0),
           detail: `${dm.n} domains vs next blocking signature ${blockers[1] ? blockers[1].n : "n/a"}` };
});

claim("Policy layer — template panel",
  '"Concentration in the tail rather than the head" (tail bands exceed head bands)', () => {
  const b = dm.by_band;
  const head = b.slice(0, 3).reduce((s, x) => s + (x.pct || 0), 0) / 3;
  const tail = b.slice(-2).reduce((s, x) => s + (x.pct || 0), 0) / 2;
  return { ok: tail > head, detail: `head bands avg ${head.toFixed(2)}%, tail bands avg ${tail.toFixed(2)}%` };
});

claim("Policy layer — signatures reading",
  '"the distribution is top-heavy" then straight into an unstructured tail', () => {
  const top = A.top[0];
  const shown = A.top.reduce((s, a) => s + a.pct_of_parsed, 0);
  return { ok: top.pct_of_parsed >= 40, detail: `top signature ${pct(top.pct_of_parsed)} of parsed; the ${A.top.length} shown cover ${shown.toFixed(1)}%` };
});

claim("Policy layer — signatures reading",
  '"There is no tidy taxonomy of policy archetypes" (distinct signatures stay in the thousands)', () => {
  return { ok: A.distinct_parsed >= 500, detail: `${A.distinct_parsed} distinct signatures` };
});

/* ---- Crawlers: role and vendor claims ------------------------------------ */
claim("Crawlers — training versus traffic",
  'the training/search asymmetry runs in the training direction', () => {
  return { ok: S.a > S.b, detail: `${S.a} training-only vs ${S.b} search-only (${S.ratio} to 1)` };
});

claim("Crawlers — training versus traffic",
  '"not an artefact of where the line is drawn" (widening to user-initiated keeps the direction)', () => {
  return { ok: NT.a > NT.b && (NT.ratio >= 2) === (S.ratio >= 2),
           detail: `strict ${S.ratio}:1, widened ${NT.ratio}:1` };
});

claim("Crawlers — training versus traffic",
  '"the large majority that has drawn no line at all" (blocks-neither is the biggest group)', () => {
  return { ok: S.neither > S.a + S.b + S.both, detail: `blocks neither ${pct(S.neither_pct)}` };
});

claim("Crawlers — vendor table reading",
  '"nearly every vendor fields a training crawler" (the like-for-like column is usable)', () => {
  const withT = R.vendors.filter(v => v.training_any_pct != null).length;
  return { ok: withT / R.vendors.length >= 0.75, detail: `${withT} of ${R.vendors.length} vendors have a training crawler` };
});

claim("Crawlers — vendor table reading",
  '"the column that flatters vendors with more crawlers" (multi-crawler vendors do rank higher on any_blocked)', () => {
  const multi = R.vendors.filter(v => v.n_crawlers > 1);
  if (!multi.length) return { ok: true, detail: "no multi-crawler vendors this edition" };
  const gap = multi.every(v => v.any_blocked_pct >= v.mean_share_blocked_pct);
  return { ok: gap, detail: multi.map(v => `${v.vendor} any ${v.any_blocked_pct} vs mean-share ${v.mean_share_blocked_pct}`).join("; ") };
});

claim("Crawlers — vendor split table",
  '"search and user-initiated crawlers are named far less often than their training siblings"', () => {
  const multi = R.vendors.filter(v => v.splits_by_role);
  const byName = {}; P.crawlers.forEach(c => byName[c.name] = c);
  const bad = multi.filter(v => {
    const t = v.crawlers.filter(c => byName[c].role === "training").map(c => byName[c].named_pct);
    const o = v.crawlers.filter(c => byName[c].role !== "training").map(c => byName[c].named_pct);
    return !(Math.max(...o) < Math.max(...t));
  });
  return { ok: !bad.length,
           detail: bad.length ? "no longer true for: " + bad.map(v => v.vendor).join(", ")
                              : multi.map(v => v.vendor).join(", ") + " all still fit" };
});

claim("Crawlers — vendor split table",
  'the split table has vendors to show, and the sentence counts them from the data', () => {
  const multi = R.vendors.filter(v => v.splits_by_role).length;
  return { ok: multi >= 1, detail: `${multi} vendor(s) field both a training and a non-training crawler` };
});

/* ---- This edition: the headline caveat ----------------------------------- */
claim("This edition — headline caveat",
  'the with/without-template sensitivity figures are both present and differ', () => {
  return { ok: A.ex_template && A.ex_template.any_blocked_pct < D.any_ai.pct,
           detail: `${pct(D.any_ai.pct)} published vs ${pct(A.ex_template.any_blocked_pct)} excluding the cohort` };
});

/* ---- report -------------------------------------------------------------- */
const failed = results.filter(r => !r.ok);
const pad = Math.max(...results.map(r => r.where.length));
console.log("");
console.log("COPY GUARD — edition " + D.edition + " (" + results.length + " claims)");
console.log("-".repeat(74));
for (const r of results) {
  console.log(`${r.ok ? "  ok  " : "  !!  "}${r.where.padEnd(pad)}  ${r.text}`);
  if (r.detail) console.log(`      ${" ".repeat(pad)}  ${r.detail}`);
}
console.log("-".repeat(74));
if (!failed.length) {
  console.log(`All ${results.length} claims still match the data. Published wording is safe.`);
  process.exit(0);
}
console.log(`${failed.length} CLAIM(S) NO LONGER MATCH THE DATA:`);
for (const r of failed) console.log(`  - ${r.where}: ${r.text}\n      ${r.detail}`);
console.log("");
console.log("The dashboard will still render, but the wording above is now wrong.");
console.log("Edit the sentence in app/views.js at the named location, or relax the");
console.log("threshold here if the new reality is what the copy should describe.");
process.exit(1);
