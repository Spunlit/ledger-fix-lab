// End-to-end UI check of both cases in a real headless Chrome/Edge via the DevTools protocol.
// No extra npm dependencies (Node >= 22: built-in fetch + WebSocket). Fresh browser profile per run.
//
// Usage: node scripts/e2e.mjs [baseUrl] [screenshotDir]
//   baseUrl defaults to http://localhost:4173/ledger-fix-lab/ (run `npm run build && npm run preview`)
//   CHROME env var overrides the browser path.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = (process.argv[2] ?? 'http://localhost:4173/ledger-fix-lab/').replace(/#.*$/, '');
const shotDir = process.argv[3];
const browserPath = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => p && existsSync(p));
if (!browserPath) throw new Error('No Chrome/Edge found; set CHROME=/path/to/browser');

const port = 9333 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), 'lfl-e2e-'));
const browser = spawn(browserPath, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', 'about:blank'], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EXPECTED_CHECKS = 49; // a run that stops early must not count as green
let failures = 0;
let ran = 0;
const ok = (cond, msg) => {
  ran++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failures++;
};
const watchdog = setTimeout(() => {
  console.error('FAIL  e2e timed out after 150s');
  browser.kill();
  process.exit(1);
}, 150_000);

async function main() {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
    } catch { await sleep(200); }
  }
  if (!target) throw new Error('Browser did not start');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map();
  const consoleErrors = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id).resolve(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') consoleErrors.push(msg.params.exceptionDetails?.text);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') consoleErrors.push(JSON.stringify(msg.params.args?.[0]?.value));
  };
  const failPending = (why) => { for (const p of pending.values()) p.reject(new Error(why)); pending.clear(); };
  ws.onclose = () => failPending('DevTools socket closed before the run finished');
  ws.onerror = () => failPending('DevTools socket error');
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    if (ws.readyState !== WebSocket.OPEN) return reject(new Error(`DevTools socket not open (${method})`));
    const n = ++id;
    pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  const evaluate = async (expr) => {
    const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (res.result?.exceptionDetails) throw new Error(`eval failed: ${expr}\n${JSON.stringify(res.result.exceptionDetails).slice(0, 500)}`);
    return res.result?.result?.value;
  };
  const shot = async (name, full = true) => {
    if (!shotDir) return;
    mkdirSync(shotDir, { recursive: true });
    const res = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full });
    writeFileSync(join(shotDir, `${name}.png`), Buffer.from(res.result.data, 'base64'));
  };
  // '' is the landing page (index.html); '#/...' is a route in the app (app.html).
  const go = async (hash) => {
    await send('Page.navigate', { url: hash ? `${base}app.html${hash}` : base });
    const ready = hash ? `!!document.querySelector('#app > *')` : `!!document.querySelector('[data-hero-pick]') && document.documentElement.dataset.ready === '1'`;
    for (let i = 0; i < 50; i++) { if (await evaluate(ready)) break; await sleep(100); }
    await sleep(150);
  };
  const js = (code) => evaluate(`(async () => { const $ = (s) => document.querySelector(s); ${code} })()`);
  const diff = () => js(`return $('[data-testid=difference] .num').textContent`);
  const cls = (k) => js(`return ($('[data-testid=check-${k}]') || {}).className || 'absent'`);
  const text = (sel) => js(`return ($(${JSON.stringify(sel)}) || {}).textContent || ''`);
  const click = (sel) => js(`$(${JSON.stringify(sel)}).click()`);
  const choose = (sel, value) => js(`const s = $(${JSON.stringify(sel)}); s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change', { bubbles: true }))`);
  const submitAmount = (entry, value) => js(`if (!$('[data-amt-form=${entry}]')) $('[data-edit=${entry}]').click(); await new Promise(r => setTimeout(r, 30)); const f = $('[data-amt-form=${entry}]'); f.querySelector('input').value = ${JSON.stringify(value)}; f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))`);
  const record = (txn, cat) => js(`$('[data-record=${txn}]').click(); await new Promise(r => setTimeout(r, 30)); const f = $('[data-record-form=${txn}]'); f.querySelector('select').value = ${JSON.stringify(cat)}; f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))`);
  const clue = () => text('.hint');
  const toast = () => text('[data-testid=feedback]');

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  const M = '−';

  // ---------- landing page: the live books window ("one line is wrong"), graded by the engine
  await go('');
  ok((await text('[data-testid=hero-recon]')).includes('$0.00') && (await text('[data-testid=hero-profit]')) === '$10,410.76', 'landing shows the paradox: difference $0.00, profit $10,410.76');
  await click('[data-hero-pick=E14]');
  ok((await text('[data-hero-pick=E14] small')).includes('checks out') && (await text('[data-hero-task]')).includes("hasn't cleared"), 'checking the uncleared check: it checks out, real but not cleared');
  await click('[data-hero-pick=E06]');
  await sleep(300);
  ok((await text('[data-testid=hero-profit]')) === '$5,410.76' && (await js(`return $('[data-hero-pick=E06]').classList.contains('is-liar')`)), 'catching the owner transfer: line marked, profit corrected to $5,410.76');
  ok((await text('[data-testid=hero-verdict]')).includes("owner's money, not a sale"), 'verdict explains the lesson');
  await click('[data-theme-toggle]');
  ok((await evaluate('document.documentElement.dataset.theme')) === 'light' && (await evaluate(`localStorage.getItem('ledger-fix-lab:theme')`)) === 'light', 'landing day/night switch works and is remembered');
  await click('[data-theme-toggle]');
  ok((await js(`return [...document.querySelectorAll('a[href^="app.html"]')].length`)) >= 6, 'landing links into the app');
  await shot('0-home', false);

  // ---------- case 1 (guided: instant feedback, delete + category only)
  await go('#/case/maple-pine-oct');
  ok((await diff()) === '+$412.50', `case 1 starts at +$412.50 (got ${await diff()})`);
  ok((await js(`return document.querySelectorAll('[data-clear], [data-edit], [data-record]').length`)) === 0, 'case 1 shows only delete and category tools');
  ok((await cls('integrity')) === 'absent', 'review hidden before the first check');
  await click('[data-act=toggle-hint]');
  ok((await clue()).includes('3 ticked rows'), 'hint points at the three $412.50 rows');
  await click('[data-del=E14]');
  ok((await diff()) === '$0.00' && (await toast()).includes('real'), 'deleting the real payment: $0.00 and an instant warning');
  await click('[data-act=check]');
  const integ = await text('[data-testid=check-integrity]');
  ok(integ.includes('Missing') && integ.includes('Duplicate'), 'review names the missing payment and the duplicate');
  ok((await text('.review h2')).includes('difference is $0.00'), 'verdict says balanced is not right');
  await click('[data-act=undo]');
  ok((await diff()) === '+$412.50' && (await js(`return !!$('tr[data-entry=E14]')`)), 'undo restores the deleted row');
  await click('[data-del=E10]');
  ok((await toast()).includes('1 of 3'), 'deleting the duplicate: instant "Fixed, 1 of 3"');
  await choose('select[data-cat=E03]', 'software');
  await choose('select[data-cat=E11]', 'car');
  ok((await diff()) === '$0.00' && (await js(`return !!$('[data-testid=success]')`)), 'case 1 solved: success panel shown');
  ok((await text('.summary')).includes('Removed a duplicate entry'), 'cleanup summary lists the duplicate removal');
  await shot('1-case1-solved', false);
  await click('[data-del=E06]');
  ok((await cls('integrity')).includes('fail') && (await diff()) === `${M}$12.50`, 'deleting one of two identical coffees fails (−$12.50)');
  await click('[data-act=undo]');
  ok(await js(`return !!$('[data-testid=success]')`), 'undo returns to the solved state');

  // ---------- case 2 (guided, all tools)
  await go('#/case/rivera-mar');
  ok((await diff()) === `${M}$99.37`, `case 2 starts at −$99.37 (got ${await diff()})`);
  await click('[data-act=toggle-hint]');
  ok((await clue()).includes("doesn't match any single item"), 'first hint: more than one thing is off');
  await record('R13', 'bankfees');
  ok((await diff()) === `${M}$84.37` && (await clue()).includes('bank line') && (await toast()).includes('1 of 4'), 'recording the bank fee: −$84.37, progress 1 of 4, hint points at a bank line');
  await click('[data-clear=E03]');
  ok((await diff()) === `${M}$36.00` && (await clue()).includes('divides evenly by 9'), 'ticking Verizon: −$36.00, transposition hint');
  await submitAmount('E03', 'abc');
  ok((await text('.amt-form .err')).includes('Enter an amount') && (await diff()) === `${M}$36.00`, 'invalid amount is rejected without changing the books');
  await submitAmount('E03', '84.37');
  ok((await diff()) === '$0.00', 'fixing the transposed amount: $0.00');
  await click('[data-del=E09]');
  await click('[data-act=check]');
  ok((await text('.review h2')).includes('difference is $0.00, but one check fails'), 'headline trap: $0.00 but one check fails');
  ok((await text('[data-testid=check-categories]')).includes('overstated by $5,000.00'), 'review shows profit overstated by $5,000.00');
  await shot('2-case2-trap', false);
  await click('[data-del=E14]');
  ok((await toast()).includes("hasn't reached the bank yet"), 'deleting the outstanding check: instant warning that it is real but uncleared');
  await click('[data-act=undo]');
  await choose('select[data-cat=E06]', 'ownerContribution');
  ok(await js(`return !!$('[data-testid=success]')`), 'case 2 solved after reclassifying the owner transfer');
  const sum = await text('.summary');
  ok(sum.includes("Owner's contribution") && sum.includes('outstanding'), 'summary covers the reclassification and the outstanding check');
  ok((await text('.beforeafter')).includes('$5,410.76'), 'before/after shows corrected net profit');
  ok(await js(`return !!$('.solved-actions a[href^="#/daily/"]')`), "case 2 completion offers today's file");
  await shot('3-case2-solved', false);
  await click('[data-act=reset]');
  ok((await diff()) === `${M}$99.37` && (await cls('integrity')) === 'absent', 'start over returns to the handed-over books');

  // ---------- file of the day (exam: no hints, no instant feedback; feeds the skill record)
  await go('#/daily');
  ok((await text('.badge')).startsWith('File of the day') && !(await js(`return !!$('[data-act=toggle-hint]')`)), 'file of the day opens in exam mode (no hint button)');
  await js(`$('tr[data-entry] [data-del]').click()`);
  ok(!(await js(`return !!$('[data-testid=feedback]')`)), 'no instant feedback in exam mode');
  await click('[data-act=check]');
  ok(await js(`return !!$('.review') || !!$('.solved')`), 'checking the file of the day shows the review');

  await go('#/');
  ok((await js(`return document.querySelectorAll('.step.done').length`)) === 2, 'home path marks both guided cases completed');
  ok((await js(`return document.querySelectorAll('.record li').length`)) >= 2, 'skill record appears after the first unguided file');
  const practice = await js(`return $('.record a.btn').getAttribute('href')`);
  ok(/^#\/practice\/[a-z0-9]+\//.test(practice), `weak-spot practice link targets missed skills (${practice})`);
  await go(practice);
  ok((await text('.badge')) === 'Practice file' && (await js(`return document.querySelectorAll('tr[data-entry]').length`)) >= 10, 'practice file renders a generated client file');

  // ---------- paywall: free tier allows one practice file, then the Practice plan (demo checkout)
  await go('#/practice/zzz999/timing');
  ok(await js(`return !!$('.pw-card')`) && (await text('.pill')).includes('free practice file'), 'a second practice file opens the paywall');
  await click('[data-pw=yearly]');
  ok((await text('[data-testid=pw-price]')).includes('$96'), 'yearly price shown ($96/year)');
  await click('[data-pw=checkout]');
  ok((await text('[data-testid=pw-checkout]')).includes('nothing is charged'), 'checkout is clearly labelled as a demo');
  await click('[data-pw=confirm]');
  ok(await js(`return !!$('[data-testid=plan-active]')`), 'demo plan activates');
  await click('[data-pw=open]');
  await sleep(300);
  ok((await text('.badge')) === 'Practice file', 'after upgrading, the requested practice file opens');

  // ---------- phone width
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await go('');
  ok((await evaluate('document.documentElement.scrollWidth')) <= 375, 'landing: no horizontal scroll at 375px');
  await shot('4-home-mobile', false);
  await go('#/case/rivera-mar');
  ok((await evaluate('document.documentElement.scrollWidth')) <= 375, 'case 2: no horizontal scroll at 375px');
  await record('R13', 'bankfees');
  ok((await diff()) === `${M}$84.37`, 'phone: recording from the statement works');
  await shot('5-case2-mobile', false);

  ok(consoleErrors.length === 0, `no console errors (${consoleErrors.join('; ') || 'none'})`);
  ws.close();
}

main()
  .catch((e) => { console.error(e); failures++; })
  .finally(() => {
    clearTimeout(watchdog);
    if (ran !== EXPECTED_CHECKS) {
      console.error(`FAIL  ${ran} of ${EXPECTED_CHECKS} checks ran`);
      failures++;
    }
    browser.kill();
    setTimeout(() => { try { rmSync(profile, { recursive: true, force: true }); } catch { /* still locked */ } }, 500);
    console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll UI checks passed');
    process.exitCode = failures ? 1 : 0;
  });
