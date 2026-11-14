// End-to-end UI check of the demo scenario in a real headless Chrome/Edge, via the DevTools
// protocol. No extra npm dependencies (uses Node's built-in fetch + WebSocket, Node >= 22).
//
// Usage: node scripts/e2e.mjs [url] [screenshotDir]
//   url defaults to http://localhost:4173/ledger-fix-lab/ (run `npm run build && npm run preview` first)
//   CHROME env var overrides the browser path.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] ?? 'http://localhost:4173/ledger-fix-lab/';
const shotDir = process.argv[3];
const candidates = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const browserPath = candidates.find((p) => existsSync(p));
if (!browserPath) throw new Error('No Chrome/Edge found; set CHROME=/path/to/browser');

const port = 9333 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), 'lfl-e2e-'));
const browser = spawn(browserPath, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
let ran = 0;
const EXPECTED_CHECKS = 16; // a run that stops early must not count as green
const ok = (cond, msg) => {
  ran++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failures++;
};
const watchdog = setTimeout(() => {
  console.error('FAIL  e2e timed out after 120s');
  browser.kill();
  process.exit(1);
}, 120_000);

async function main() {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === 'page');
    } catch { await sleep(200); }
  }
  if (!target) throw new Error('Browser did not start');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id).resolve(msg); pending.delete(msg.id); }
  };
  // If the browser or socket dies mid-run, fail loudly instead of hanging or exiting 0.
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
    if (res.result?.exceptionDetails) throw new Error(`eval failed: ${expr}\n${JSON.stringify(res.result.exceptionDetails)}`);
    return res.result?.result?.value;
  };
  const shot = async (name) => {
    if (!shotDir) return;
    mkdirSync(shotDir, { recursive: true });
    const res = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    writeFileSync(join(shotDir, `${name}.png`), Buffer.from(res.result.data, 'base64'));
  };
  const diff = () => evaluate(`document.querySelector('[data-testid=difference] .big').textContent`);
  const status = (k) => evaluate(`(document.querySelector('[data-testid=check-${k}]')||{}).className||'absent'`);
  const text = (k) => evaluate(`(document.querySelector('[data-testid=check-${k}]')||{}).textContent||''`);
  const click = (sel) => evaluate(`document.querySelector(${JSON.stringify(sel)}).click()`);
  const choose = (entry, cat) => evaluate(`(() => { const s = document.querySelector('select[data-cat=${entry}]'); s.value = '${cat}'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  for (let i = 0; i < 50; i++) { if (await evaluate(`!!document.querySelector('[data-testid=difference]')`)) break; await sleep(100); }

  const M = '\u2212';
  ok((await diff()) === `${M}$412.50`, `initial difference is −$412.50 (got ${await diff()})`);
  ok((await status('integrity')) === 'absent', 'details hidden before first check');
  await shot('1-initial');

  await click('[data-act=check]');
  ok((await status('integrity')).includes('fail') && (await status('balance')).includes('fail') && (await status('categories')).includes('fail'), 'first check: all three blocks fail');

  // Compensating error: delete the REAL Oct 29 Upwork payment instead of the duplicate.
  await click('[data-del=E14]');
  ok((await diff()) === '$0.00', 'compensating error: difference shows $0.00');
  ok((await status('balance')).includes('pass') && (await status('integrity')).includes('fail'), 'balance passes but transactions check fails');
  ok((await text('integrity')).includes('Missing record') && (await text('integrity')).includes('Duplicate'), 'explanation names the missing record and the duplicate');
  await shot('2-compensating-error');

  await click('[data-act=undo]');
  ok((await diff()) === `${M}$412.50` && (await evaluate(`!!document.querySelector('tr[data-entry=E14]')`)), 'undo restores the deleted row and the difference');

  // Correct fix.
  await click('[data-del=E10]');
  ok((await diff()) === '$0.00' && (await status('integrity')).includes('pass'), 'deleting the duplicate: $0.00 and transactions pass');
  ok((await status('categories')).includes('fail'), 'categories still fail independently');
  await choose('E03', 'software');
  await choose('E11', 'car');
  ok((await diff()) === '$0.00', 'recategorizing does not change the difference');
  ok((await status('categories')).includes('pass'), 'categories pass after fixes');
  ok(await evaluate(`!!document.querySelector('[data-testid=success]')`), 'success banner shown when all three pass');
  await shot('3-solved');

  // Trap: deleting one of two identical real coffees.
  await click('[data-del=E06]');
  ok((await status('integrity')).includes('fail') && (await diff()) === '+$12.50', 'deleting a real identical purchase fails (+$12.50)');
  await click('[data-act=undo]');
  ok(await evaluate(`!!document.querySelector('[data-testid=success]')`), 'undo returns to solved state');

  await click('[data-act=reset]');
  ok((await diff()) === `${M}$412.50` && (await status('integrity')) === 'absent', 'reset returns to the start');

  // Phone width: no horizontal page scroll.
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 800, deviceScaleFactor: 2, mobile: true });
  await sleep(200);
  const sw = await evaluate('document.documentElement.scrollWidth');
  ok(sw <= 375, `no horizontal page scroll at 375px (scrollWidth ${sw})`);
  await shot('4-mobile');

  ws.close();
}

main()
  .catch((e) => { console.error(e); failures++; })
  .finally(() => {
    clearTimeout(watchdog);
    if (ran !== EXPECTED_CHECKS) {
      console.error(`FAIL  only ${ran} of ${EXPECTED_CHECKS} checks ran`);
      failures++;
    }
    browser.kill();
    setTimeout(() => { try { rmSync(profile, { recursive: true, force: true }); } catch { /* profile still locked */ } }, 500);
    console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll UI checks passed');
    process.exitCode = failures ? 1 : 0;
  });
