/**
 * The landing page's scripts: the hero's "which line is booked wrong" check, graded by the real engine
 * (heroVerdict runs the category check on case 2), the day/night switch shared with the app, and two
 * small motions: the profit counting to its corrected value, and the workbench demo applying one fix.
 */
import { formatCents } from './core/money';
import { heroVerdict } from './ui/hero';

const THEME_KEY = 'ledger-fix-lab:theme';
const root = document.documentElement;
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function setTheme(t: 'dark' | 'light') {
  root.dataset.theme = t;
  root.dataset.tone = t;
  try { localStorage.setItem(THEME_KEY, t); } catch { /* storage blocked: the switch still works for this visit */ }
  document.querySelectorAll<HTMLButtonElement>('.theme-btn').forEach((b) => b.setAttribute('aria-label', t === 'dark' ? 'Switch to day mode' : 'Switch to night mode'));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#02070A' : '#FCFFFF');
}
setTheme(root.dataset.theme === 'light' ? 'light' : 'dark');
document.addEventListener('click', (e) => {
  if ((e.target as Element).closest('[data-theme-toggle]')) setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
});

/** Count a money figure from one value to another; the final text is always the exact target. */
function countTo(el: HTMLElement, from: number, to: number, ms = 700) {
  if (calm()) { el.textContent = formatCents(to); return; }
  const t0 = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / ms);
    el.textContent = formatCents(k === 1 ? to : Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const tried = new Set<string>();
let caught = false;

function pick(btn: HTMLButtonElement) {
  if (caught) return;
  const id = btn.dataset.heroPick!;
  if (tried.has(id)) return;
  tried.add(id);
  const v = heroVerdict(id);
  const small = btn.querySelector('.lf-desc small')!;
  const cat = small.textContent ?? '';
  const task = document.querySelector<HTMLElement>('[data-hero-task]')!;
  if (!v.caught) {
    btn.classList.add('is-honest');
    btn.disabled = true;
    small.innerHTML = `${cat}, <em>checks out</em>`;
    task.innerHTML = `<b>Not that one.</b> It is a ${v.why}. Try another line.`;
    return;
  }
  caught = true;
  btn.classList.add('is-liar');
  small.innerHTML = `<s>${cat}</s> <em>Owner contribution</em>`;
  document.querySelectorAll<HTMLButtonElement>('[data-hero-pick]').forEach((b) => (b.disabled = true));
  task.classList.add('is-caught');
  task.setAttribute('data-testid', 'hero-verdict');
  task.innerHTML = `<b>That is the one.</b> Dani moved her own savings in: owner's money, not a sale. Moved to Owner contribution, and profit drops by $5,000. Matching the bank never shows this.`;
  const total = document.querySelector<HTMLElement>('[data-hero-card]')!;
  total.classList.add('is-caught');
  total.querySelector<HTMLElement>('[data-hero-was]')!.hidden = false;
  countTo(total.querySelector<HTMLElement>('[data-testid=hero-profit]')!, v.before, v.after);
}

document.addEventListener('click', (e) => {
  const btn = (e.target as Element).closest<HTMLButtonElement>('[data-hero-pick]');
  if (btn) pick(btn);
});

/* The workbench demo: applies the Verizon fix once when it scrolls into view, with the engine's real
   figures (before: bank $17,022.00, books $17,121.37; after fixing the amount and marking it cleared:
   bank $17,070.37, books $17,085.37, difference $15.00). */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function fixDemo(box: HTMLElement) {
  const q = (s: string) => box.querySelector<HTMLElement>(s)!;
  const instant = calm();
  if (!instant) await sleep(900);
  const b1 = q('[data-fix-btn]');
  b1.classList.add('is-pressed');
  if (!instant) await sleep(180);
  b1.classList.remove('is-pressed');
  b1.classList.add('is-done');
  q('[data-fix-amount]').textContent = '−$84.37';
  q('[data-fix-books]').classList.add('is-fixed');
  countTo(q('[data-fix-booksbal]'), 1712137, 1708537, 500);
  if (!instant) await sleep(800);
  const b2 = q('[data-fix-btn2]');
  b2.classList.add('is-pressed');
  if (!instant) await sleep(180);
  b2.classList.remove('is-pressed');
  b2.classList.add('is-done');
  countTo(q('[data-fix-bank]'), 1702200, 1707037, 500);
  countTo(q('[data-fix-diff]'), 9937, 1500, 600);
  const chip = q('[data-fix-chip]');
  chip.textContent = 'Matched';
  chip.className = 'chip chip--ok';
  const lc = document.querySelector<HTMLElement>('[data-fix-listchip]');
  if (lc) { lc.textContent = 'Matched'; lc.className = 'lf-ok'; }
}

const io: IntersectionObserver | null = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries, obs) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        obs.unobserve(en.target);
        en.target.classList.add('lf-in');
        const demo = (en.target as HTMLElement).querySelector<HTMLElement>('[data-fix-demo]');
        if (demo) void fixDemo(demo);
      }
    }, { threshold: 0.45 })
  : null;
document.querySelectorAll<HTMLElement>('.lf-app, .lf-card--wide').forEach((el) => {
  if (!io) { el.classList.add('lf-in'); return; }
  el.classList.add('lf-reveal');
  io.observe(el);
});

/* ---------- light and depth (landing-fx.css): pointer-lit surfaces, a slight tilt on the books window,
   and one reveal per block as it scrolls into view */
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
if (fine) {
  document.querySelectorAll<HTMLElement>('[data-spot]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    }, { passive: true });
  });
  const tryBox = document.querySelector<HTMLElement>('.lf-try');
  const win = tryBox?.querySelector<HTMLElement>('.lf-win');
  if (tryBox && win && !calm()) {
    tryBox.addEventListener('pointermove', (e) => {
      const r = tryBox.getBoundingClientRect();
      win.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width) - 0.5) * 3}deg`);
      win.style.setProperty('--rx', `${(0.5 - ((e.clientY - r.top) / r.height)) * 2}deg`);
    }, { passive: true });
    tryBox.addEventListener('pointerleave', () => { win.style.setProperty('--ry', '0deg'); win.style.setProperty('--rx', '0deg'); });
  }
}
const rv = [...document.querySelectorAll<HTMLElement>('[data-rv]')];
if ('IntersectionObserver' in window) {
  const seen = new IntersectionObserver((entries, obs) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      obs.unobserve(en.target);
      en.target.classList.add('is-seen');
    }
  }, { threshold: 0.25 });
  rv.forEach((el) => {
    const sibs = [...(el.parentElement?.children ?? [])].filter((c) => c.hasAttribute('data-rv'));
    el.style.setProperty('--rv-d', `${sibs.indexOf(el) * 0.08}s`);
    seen.observe(el);
  });
} else rv.forEach((el) => el.classList.add('is-seen'));
