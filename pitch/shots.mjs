// Takes the deck's screenshots from the real product (no mock-ups): node pitch/shots.mjs [baseUrl]
// Headless Chrome over the DevTools protocol, fresh profile, 2x pixels. Output: pitch/img/*.png
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.argv[2] ?? 'http://localhost:4177/ledger-fix-lab/';
const out = join(dirname(fileURLToPath(import.meta.url)), 'img');
mkdirSync(out, { recursive: true });
const port = 9900 + Math.floor(Math.random() * 90);
const chrome = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'lfl-deck-'))}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let t;
for (let i = 0; i < 60 && !t; i++) { try { t = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((x) => x.type === 'page'); } catch { await sleep(200); } }
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const p = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (p.has(d.id)) { p.get(d.id)(d); p.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const n = ++id; p.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const js = async (code) => {
  const r = await send('Runtime.evaluate', { expression: `(async () => { const $ = (s) => document.querySelector(s); ${code} })()`, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(`${code}\n${JSON.stringify(r.result.exceptionDetails).slice(0, 400)}`);
  return r.result?.result?.value;
};
const size = (width, height, mobile = false) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile });
const go = async (path) => {
  await send('Page.navigate', { url: base + path });
  await sleep(900);
  await js('await document.fonts.ready');
  await sleep(500);
};
/** Whole viewport, or the box of one element (with a margin). */
const shot = async (name, sel, pad = 0) => {
  let clip;
  if (sel) {
    const r = await js(`const e = $(${JSON.stringify(sel)}); e.scrollIntoView({ block: 'start' }); await new Promise(r => setTimeout(r, 250)); const b = e.getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, width: b.width, height: b.height }`);
    clip = { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: r.width + pad * 2, height: r.height + pad * 2, scale: 1 };
  }
  const res = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: Boolean(clip), ...(clip ? { clip } : {}) });
  writeFileSync(join(out, `${name}.png`), Buffer.from(res.result.data, 'base64'));
  console.log('shot', name);
};
const click = (sel) => js(`$(${JSON.stringify(sel)}).click()`);
const amount = (entry, value) => js(`$('[data-edit=${entry}]').click(); await new Promise(r => setTimeout(r, 40)); const f = $('[data-amt-form=${entry}]'); f.querySelector('input').value = ${JSON.stringify(value)}; f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))`);
const record = (txn, cat) => js(`$('[data-record=${txn}]').click(); await new Promise(r => setTimeout(r, 40)); const f = $('[data-record-form=${txn}]'); f.querySelector('select').value = ${JSON.stringify(cat)}; f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))`);
const choose = (sel, value) => js(`const s = $(${JSON.stringify(sel)}); s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change', { bubbles: true }))`);

await send('Page.enable');
await send('Runtime.enable');

// 1. the landing's first screen
await size(1280, 720);
await go('');
await sleep(1800);
await shot('landing');

// the tour has been seen: the deck shows the working screen itself
await js(`localStorage.setItem('ledger-fix-lab:v16:tour-seen', '1')`);

// 2. the working screen of case 1, with the coach
await size(1280, 800);
await go('app.html#/case/maple-pine-oct');
await shot('work');

// 3. case 2: reach "$0.00 but one check fails" with real moves
await go('app.html#/case/rivera-mar');
await record('R13', 'bankfees');
await click('[data-clear=E03]');
await amount('E03', '84.37');
await click('[data-del=E09]');
await click('[data-act=check]');
await sleep(600);
await shot('trap', '.review', 0);
await js('window.scrollTo(0, 0)');
await sleep(200);
await shot('trap-top');

// 4. solved: the corrected profit and the summary
await choose('select[data-cat=E06]', 'ownerContribution');
await sleep(500);
await shot('solved', '[data-testid=success]', 0);

// 5. solve case 1 too, so the desk shows honest progress
await go('app.html#/case/maple-pine-oct');
for (let i = 0; i < 12; i++) {
  if (await js(`return !!$('[data-testid=success]')`)) break;
  await click('[data-testid=help]'); await click('[data-testid=help]'); await click('[data-testid=help]');
  await sleep(500);
  for (let k = 0; k < 3; k++) { await click('[data-tour=next]'); await sleep(120); }
  await sleep(400);
  if (await js(`return !!$('[data-act=check]') && !$('[data-testid=success]') && !$('tr.co-t')`)) await click('[data-act=check]');
}

// 6. phone: start from zero, the desk, a drill round
await size(390, 844, true);
await go('app.html#/basics');
await shot('phone-basics');
await go('app.html#/');
await shot('phone-desk');
await go('app.html#/drill');
await shot('phone-drill');
await go('app.html#/record');
await shot('phone-record');
await go('app.html#/check');
await click('[data-testid=check-sample]');
await sleep(500);
await js(`document.querySelector('.ck-figs').scrollIntoView({ block: 'start' }); window.scrollBy(0, -14)`);
await sleep(400);
await shot('phone-check');

// the checker on desktop, with the sample files
await size(1280, 800);
await go('app.html#/check');
await click('[data-testid=check-sample]');
await sleep(500);
await shot('check', '.ck-out', 0);

// 7. the desk's ladder on desktop
await size(1280, 800);
await go('app.html#/');
await shot('ladder', '[data-testid=ladder]', 0);

b.kill();
process.exit(0);
