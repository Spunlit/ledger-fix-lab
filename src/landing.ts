/**
 * The landing page's two scripts: the hero's "one line is wrong" check, graded by the real engine
 * (heroVerdict runs the category check on case 2), and the day/night switch shared with the app.
 */
import { formatCents } from './core/money';
import { heroVerdict } from './ui/hero';

const THEME_KEY = 'ledger-fix-lab:theme';
const root = document.documentElement;

function setTheme(t: 'dark' | 'light') {
  root.dataset.theme = t;
  root.dataset.tone = t;
  try { localStorage.setItem(THEME_KEY, t); } catch { /* storage blocked: the switch still works for this visit */ }
  document.querySelectorAll<HTMLButtonElement>('.theme-btn').forEach((b) => b.setAttribute('aria-label', t === 'dark' ? 'Switch to day mode' : 'Switch to night mode'));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#070a12' : '#f5f7fb');
}
setTheme(root.dataset.theme === 'light' ? 'light' : 'dark');
document.addEventListener('click', (e) => {
  if ((e.target as Element).closest('[data-theme-toggle]')) setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
});

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
    btn.title = v.why;
    task.innerHTML = `That one is fine: ${v.why}. <b>Try another line.</b>`;
    return;
  }
  caught = true;
  btn.classList.add('is-liar');
  small.innerHTML = `<s>${cat}</s> <em>Owner money</em>`;
  document.querySelectorAll<HTMLButtonElement>('[data-hero-pick]').forEach((b) => (b.disabled = true));
  task.classList.add('is-caught');
  task.setAttribute('data-testid', 'hero-verdict');
  task.innerHTML = `Caught. Dani moved her own savings into the business: <b>owner's money, not a sale</b>. Reconciling alone never shows this.`;
  const card = document.querySelector<HTMLElement>('[data-hero-card]')!;
  card.removeAttribute('data-ly-steps');
  card.classList.add('is-caught');
  card.innerHTML = `
    <div class="lf-card__row"><h3 class="lf-h5">Net profit, March</h3><span class="lf-profit"><s>${formatCents(v.before)}</s><span data-testid="hero-profit">${formatCents(v.after)}</span></span></div>
    <div class="lf-line"><i class="ok">✓</i><span>Bank and books agree, <b>$0.00</b> apart</span></div>
    <div class="lf-line"><i class="ok">✓</i><span>Transfer moved to <b>Owner contribution</b></span></div>
    <div class="lf-line"><i class="ok">✓</i><span>${v.allRight ? 'All four checks pass' : 'Category check passes'}</span></div>`;
}

document.addEventListener('click', (e) => {
  const btn = (e.target as Element).closest<HTMLButtonElement>('[data-hero-pick]');
  if (btn) pick(btn);
});
