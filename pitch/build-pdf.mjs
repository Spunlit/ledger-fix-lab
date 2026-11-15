// Prints pitch/slides.html to pitch/LedgerFixLab_pitch.pdf with headless Chrome: node pitch/build-pdf.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const port = 9800 + Math.floor(Math.random() * 90);
const chrome = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'lfl-pdf-'))}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let t;
for (let i = 0; i < 60 && !t; i++) { try { t = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((x) => x.type === 'page'); } catch { await sleep(200); } }
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const p = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (p.has(d.id)) { p.get(d.id)(d); p.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const n = ++id; p.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
await send('Page.enable');
await send('Page.navigate', { url: pathToFileURL(join(here, 'slides.html')).href });
await sleep(1500);
const fonts = await send('Runtime.evaluate', { expression: `document.fonts.ready.then(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family).filter((v, i, a) => a.indexOf(v) === i).join(', '))`, awaitPromise: true, returnByValue: true });
console.log('fonts loaded:', fonts.result.result.value);
const over = await send('Runtime.evaluate', { expression: `[...document.querySelectorAll('.s')].map((s, i) => [i + 1, s.scrollHeight, s.scrollWidth]).filter(([, h, w]) => h > 720 || w > 1280).map(x => x.join(':')).join(' ')`, returnByValue: true });
console.log('overflowing slides:', over.result.result.value || 'none');
const res = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, paperWidth: 1280 / 96, paperHeight: 720 / 96, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 });
writeFileSync(join(here, 'LedgerFixLab_pitch.pdf'), Buffer.from(res.result.data, 'base64'));
console.log('written', join(here, 'LedgerFixLab_pitch.pdf'));
b.kill();
process.exit(0);
