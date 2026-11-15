/**
 * The landing page's script: the day/night switch shared with the app, tappable glossary words, and
 * the page's motion (written here, no animation library): the headline's lines rise out of a mask on
 * load, the scene's frame opens to full width as it scrolls, the statement's words light up as they
 * pass, blocks rise once when they enter, pills lean toward the pointer. All of it rests under
 * prefers-reduced-motion.
 */
import { glossElement, initTerms } from './ui/terms';

const root = document.documentElement;
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

// ---------- theme
const THEME_KEY = 'ledger-fix-lab:theme';
function setTheme(t: 'dark' | 'light') {
  root.dataset.theme = t;
  try { localStorage.setItem(THEME_KEY, t); } catch { /* storage blocked: the switch still works for this visit */ }
  document.querySelectorAll<HTMLButtonElement>('.theme-btn').forEach((b) => b.setAttribute('aria-label', t === 'dark' ? 'Switch to day mode' : 'Switch to night mode'));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#02070A' : '#FCFFFF');
}
setTheme(root.dataset.theme === 'light' ? 'light' : 'dark');
document.addEventListener('click', (e) => {
  if ((e.target as Element).closest('[data-theme-toggle]')) setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
});

// ---------- a returning learner goes straight to the desk
try {
  if (localStorage.getItem('ledger-fix-lab:v23:profile')) {
    const a = document.querySelector<HTMLAnchorElement>('[data-account-link]');
    if (a) {
      a.href = 'app.html#/';
      const roll = a.querySelector<HTMLElement>('.roll');
      if (roll) { roll.dataset.t = 'Your desk'; roll.querySelector('span')!.textContent = 'Your desk'; } else a.textContent = 'Your desk';
    }
  }
} catch { /* storage blocked: the link stays "Sign in" */ }

// ---------- plain words
initTerms('app.html#/guide/words');
document.querySelectorAll<HTMLElement>('[data-gloss]').forEach(glossElement);

// ---------- intro: one orchestrated entrance
document.querySelectorAll<HTMLElement>('[data-intro]').forEach((el, i) => el.style.setProperty('--i', String(i)));
requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-in')));

// ---------- the statement: split into words that light up with the scroll
const say = document.querySelector<HTMLElement>('[data-words]');
const words: HTMLElement[] = [];
if (say) {
  const text = say.textContent ?? '';
  say.setAttribute('aria-label', text);
  say.textContent = '';
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const s = document.createElement('span');
    s.className = 'w';
    s.setAttribute('aria-hidden', 'true');
    s.textContent = `${w} `;
    say.append(s);
    words.push(s);
  }
  if (calm) words.forEach((w) => w.classList.add('on'));
}

// ---------- scroll: nav state, the frame opening, the words
const nav = document.querySelector<HTMLElement>('[data-nav]');
const vista = document.querySelector<HTMLElement>('[data-vista]');
const media = document.querySelector<HTMLElement>('[data-vista-media]');
let ticking = false;
function onScroll() {
  ticking = false;
  const vh = window.innerHeight;
  nav?.classList.toggle('is-scrolled', window.scrollY > 12);
  if (vista && media && !calm) {
    const r = vista.getBoundingClientRect();
    // 0 while the frame's top is low on the screen, 1 when it has reached the top third
    const p = Math.min(1, Math.max(0, (vh * 0.9 - r.top) / (vh * 0.62)));
    const inset = window.innerWidth < 640 ? 12 : 24;
    vista.style.setProperty('--in', `${(inset * (1 - p)).toFixed(1)}px`);
    vista.style.setProperty('--r', `${(20 * (1 - p)).toFixed(1)}px`);
    media.style.setProperty('--sc', (1.16 - 0.16 * p).toFixed(3));
  }
  if (say && words.length && !calm) {
    const r = say.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (vh * 0.82 - r.top) / (r.height + vh * 0.32)));
    const lit = Math.round(p * words.length);
    words.forEach((w, i) => w.classList.toggle('on', i < lit));
  }
}
window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
window.addEventListener('resize', onScroll);
onScroll();

// ---------- blocks rise once when they enter
const rv = [...document.querySelectorAll<HTMLElement>('[data-rv]')];
if ('IntersectionObserver' in window && !calm) {
  const io = new IntersectionObserver((entries, obs) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      obs.unobserve(en.target);
      en.target.classList.add('is-seen');
    }
  }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
  rv.forEach((el) => {
    const sibs = [...(el.parentElement?.children ?? [])].filter((c) => c.hasAttribute('data-rv'));
    el.style.setProperty('--d', `${Math.min(sibs.indexOf(el), 6) * 0.08}s`);
    io.observe(el);
  });
} else rv.forEach((el) => el.classList.add('is-seen'));

// ---------- pointer: the sliding pill under nav links, magnetic pills, a drift in the scene, lit cards
if (fine && !calm) {
  const links = document.querySelector<HTMLElement>('[data-links]');
  if (links) {
    links.querySelectorAll<HTMLElement>('a').forEach((a) => {
      a.addEventListener('pointerenter', () => {
        links.style.setProperty('--lx', `${a.offsetLeft}px`);
        links.style.setProperty('--lw', `${a.offsetWidth}px`);
        links.style.setProperty('--lo', '1');
      });
    });
    links.addEventListener('pointerleave', () => links.style.setProperty('--lo', '0'));
  }
  document.querySelectorAll<HTMLElement>('[data-magnet]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1)}px`);
      el.style.setProperty('--my', `${((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1)}px`);
    });
    el.addEventListener('pointerleave', () => { el.style.setProperty('--mx', '0px'); el.style.setProperty('--my', '0px'); });
  });
  if (vista) {
    const floats = [...vista.querySelectorAll<HTMLElement>('[data-float]')];
    vista.addEventListener('pointermove', (e) => {
      const r = vista.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      floats.forEach((f) => {
        const d = Number(f.dataset.float) || 1;
        f.style.setProperty('--fx', `${(nx * d * 14).toFixed(1)}px`);
        f.style.setProperty('--fy', `${(ny * d * 10).toFixed(1)}px`);
      });
    });
    vista.addEventListener('pointerleave', () => floats.forEach((f) => { f.style.setProperty('--fx', '0px'); f.style.setProperty('--fy', '0px'); }));
  }
  document.querySelectorAll<HTMLElement>('[data-spot]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--px', `${e.clientX - r.left}px`);
      el.style.setProperty('--py', `${e.clientY - r.top}px`);
    }, { passive: true });
  });
}
