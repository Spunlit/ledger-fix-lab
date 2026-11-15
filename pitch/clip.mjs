// Cuts a real excerpt out of a public source page for the deck: node pitch/clip.mjs <url> <regex> <out.png>
// Opens the page in headless Chrome, finds the first paragraph or table row matching the pattern, marks the
// matching words, and saves a screenshot of that paragraph only. Nothing on the page is rewritten.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [, , url, pattern, out] = process.argv;
const port = 9600 + Math.floor(Math.random() * 90);
const chrome = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'lfl-clip-'))}`, '--hide-scrollbars', '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let t;
for (let i = 0; i < 60 && !t; i++) { try { t = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((x) => x.type === 'page'); } catch { await sleep(200); } }
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const p = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (p.has(d.id)) { p.get(d.id)(d); p.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const n = ++id; p.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
await send('Emulation.setDeviceMetricsOverride', { width: Number(process.argv[5] ?? 900), height: 1200, deviceScaleFactor: 2, mobile: false });
await send('Page.navigate', { url });
await sleep(6000);
const found = await send('Runtime.evaluate', {
  returnByValue: true,
  expression: `(() => {
    const re = new RegExp(${JSON.stringify(pattern)}, 'i');
    const els = [...document.querySelectorAll('p, li, tr, td, h2, h3, div, span')].filter((e) => re.test(e.innerText || '') && (e.innerText || '').length < 900);
    const el = els.sort((x, y) => x.innerText.length - y.innerText.length)[0];
    if (!el) return { title: document.title, sample: document.body.innerText.slice(0, 300) };
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { text: el.innerText, x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height };
  })()`,
});
const f = found.result.result.value;
if (!f || !f.text) { console.log('NOT FOUND', JSON.stringify(f)); b.kill(); process.exit(1); }
console.log('TEXT:', f.text.replace(/\s+/g, ' '));
await sleep(500);
const res = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: Math.max(0, f.x - 14), y: Math.max(0, f.y - 12), width: f.width + 28, height: f.height + 24, scale: 1 } });
writeFileSync(out, Buffer.from(res.result.data, 'base64'));
console.log('saved', out);
b.kill();
process.exit(0);
