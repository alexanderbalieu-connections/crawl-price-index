/**
 * CPI — Account tab & paywall UX across every entitlement state
 * ===========================================================================
 * Renders the REAL dashboard (app/views.js + app/dashboard.html) against a
 * stub server, with Clerk faked, and drives the Account and Domains tabs
 * through the four answers /api/me can give:
 *
 *   FREE        entitled:false, authoritative   -> subscribe
 *   PAID        entitled:true,  subscription    -> manage billing, rows served
 *   ADMIN       entitled:true,  admin-list      -> rows served, and SAYS it is
 *                                                  an admin grant, not a sale
 *   UNVERIFIED  entitled:false, Clerk down      -> retry, and never a purchase
 *                                                  button (a subscriber must
 *                                                  not be sold the same thing
 *                                                  twice because our check
 *                                                  failed)
 *
 * Written after a free account was found holding the paid dataset. Two real
 * defects came out of it: the Account tab could hang forever on "Checking your
 * access…", and the unverifiable state still showed Subscribe — €49/mo.
 *
 * REQUIRES playwright, which is not installed on the Mac — this runs in the
 * build container, not in sunday-run.command:
 *     npm i -D playwright && npx playwright install chromium
 *     node test-account-states.mjs
 * Point `root` at your app/ directory, and stub config.js / clerk-loader.js.
 */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';

const root = '/home/claude/work/app';
let ME = { entitled: false, tier: 'none', via: 'none', authoritative: true };

const srv = http.createServer((q, r) => {
  let p = q.url.split('?')[0];
  if (p === '/api/me') {
    r.writeHead(200, { 'content-type': 'application/json' });
    return r.end(JSON.stringify(ME));
  }
  if (p === '/api/domains') {
    if (!ME.entitled) {
      r.writeHead(ME.authoritative ? 402 : 503, { 'content-type': 'application/json' });
      return r.end(JSON.stringify({ error: ME.authoritative ? 'subscription required' : 'cannot verify your subscription right now' }));
    }
    r.writeHead(200, { 'content-type': 'application/json' });
    return r.end(JSON.stringify({ edition: '2026-08-17', crawlers: ['GPTBot'], legend: { b: 'blocked' }, rows: [[1, 'example.com', 'b']] }));
  }
  if (p === '/') p = '/dashboard.html';
  const f = path.join(root, p);
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end('nf'); }
  const ext = path.extname(f);
  const t = ext === '.css' ? 'text/css' : ext === '.json' ? 'application/json' : ext === '.js' ? 'text/javascript' : 'text/html';
  r.writeHead(200, { 'content-type': t }); r.end(fs.readFileSync(f));
});
await new Promise(res => srv.listen(8891, res));

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function run(label, me) {
  ME = me;
  const pg = await b.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
  const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  // stub Clerk before any page script runs
  await pg.addInitScript(() => {
    window.Clerk = {
      user: { primaryEmailAddress: { emailAddress: 'free@example.com' }, publicMetadata: {}, reload: () => Promise.resolve() },
      session: { getToken: () => Promise.resolve('stub.token.value') },
      mountUserButton: () => {},
    };
    window.__clerkReady = () => window.CPI_ON_CLERK_READY && window.CPI_ON_CLERK_READY(window.Clerk);
  });
  await pg.goto('http://localhost:8891/dashboard.html#account', { waitUntil: 'domcontentloaded' });
  await pg.evaluate(() => window.__clerkReady());
  await pg.waitForTimeout(1400);
  const txt = await pg.$eval('#content', e => e.textContent.replace(/\s+/g, ' ').trim());
  const access = (txt.match(/Access\s*(.*?)\s*Profile/) || [, '(not found)'])[1];
  const stuck = /Checking your access/.test(txt);
  const hasSubBtn = !!(await pg.$('#buy-sub'));
  const hasPortal = !!(await pg.$('#bill-portal'));
  const hasRetry = !!(await pg.$('#acct-retry'));
  // and what the gated Domains tab actually says to this account
  await pg.click('nav.tabs a[data-tab="domains"]').catch(() => {});
  await pg.waitForTimeout(700);
  const dom = await pg.$eval('#content', e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
  const domMsg = /subscription is required/i.test(dom) ? '402 subscribe'
    : /couldn.t check your subscription/i.test(dom) ? '503 retry'
    : /example\.com/.test(dom) ? 'ROWS SERVED' : '(other)';
  console.log(`${label}`);
  console.log(`   access line : ${access}`);
  console.log(`   stuck?      : ${stuck}   subscribe btn: ${hasSubBtn}   portal btn: ${hasPortal}`);
  console.log(`   retry btn   : ${hasRetry}   domains tab  : ${domMsg}`);
  console.log(`   errors      : ${errs.length ? errs.join(' | ') : 'none'}`);
  await pg.screenshot({ path: `/home/claude/work/acct-${label.split(' ')[0].toLowerCase()}.png`, fullPage: false });
  await pg.close();
  return { access, stuck, errs, hasSubBtn, hasPortal, hasRetry, domMsg };
}

const a = await run('FREE      (entitled:false, authoritative)', { entitled: false, tier: 'none', via: 'none', authoritative: true });
const c = await run('PAID      (entitled:true, subscription)', { entitled: true, tier: 'terminal', via: 'subscription', authoritative: true });
const d = await run('ADMIN     (entitled:true, admin-list)', { entitled: true, tier: 'none', via: 'admin-list', authoritative: true });
const e = await run('UNVERIFIED(entitled:false, clerk down)', { entitled: false, tier: 'unknown', via: 'unverified', authoritative: false });

console.log('\nASSERTIONS');
const check = (ok, msg) => console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + msg);
check(!a.stuck && !c.stuck && !d.stuck && !e.stuck, 'the Account tab never hangs on "Checking your access…"');
check(a.hasSubBtn && !a.hasPortal, 'free account is offered Subscribe, not Manage billing');
check(!c.hasSubBtn && c.hasPortal, 'paid account is offered Manage billing, not Subscribe');
check(/admin list/i.test(d.access), 'an admin-list grant says so on the access line');
check(!/admin list/i.test(c.access), 'a real subscription does NOT claim to be an admin grant');
check(/could not be checked/i.test(e.access), 'an unverifiable answer says so rather than reading as free');
check(!e.hasSubBtn && !e.hasPortal && e.hasRetry, 'an unverifiable check offers Try again, never a purchase button');
check(a.domMsg === '402 subscribe', 'free account is told to subscribe on the Domains tab');
check(c.domMsg === 'ROWS SERVED' && d.domMsg === 'ROWS SERVED', 'entitled accounts get rows on the Domains tab');
check(e.domMsg === '503 retry', 'an unverifiable check is told to retry, not to subscribe');
check([a, c, d, e].every(x => x.errs.length === 0), 'no page errors in any state');

await b.close(); srv.close();
