import '../tour.css';

/**
 * The first-visit tour of the workbench: it dims the page, lights one part at a time, and says in a
 * sentence or two what that part is and what you do with it. Next / Back / Skip, arrow keys, Esc.
 * The page is redrawn on every action, so steps hold selectors, never elements.
 */
export interface TourStep {
  /** What to light up. Omit for a centred card (welcome, goodbye). */
  target?: string;
  title: string;
  text: string;
}

const KEY = 'ledger-fix-lab:v16:tour-seen';
export function tourSeen(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}
function markSeen(): void {
  try { localStorage.setItem(KEY, '1'); } catch { /* storage blocked: the tour simply shows again next time */ }
}

export const CASE_TOUR: TourStep[] = [
  { title: 'You are the bookkeeper', text: "A client handed you a month of their books. A few lines are wrong. Your job: make the books match the bank and tell the truth. This tour takes 30 seconds." },
  { target: '.note-strip', title: "The client's note", text: 'Clients tell you things the numbers cannot. Read it first: it often explains a strange line.' },
  { target: '.recon, .desk', title: 'The books next to the bank', text: 'Each line shows what the client wrote down and, beside it, what the bank says really happened. A link icon means the two agree.' },
  { target: '.status .figs', title: 'The difference', text: "The bank's balance minus the books' balance. You are done with the numbers when it reads $0.00. Tap any word with a dashed line under it to see what it means." },
  { target: '[data-testid=coach], .coach', title: 'Your coach', text: 'One problem at a time: what is wrong, and what to press. "Why?" explains the reason. "Show me the row" scrolls to the line.' },
  { target: 'tr.co-t, .rows tbody tr:nth-child(2)', title: 'Fixing a line', text: 'Each line has its own tools on the right: the menu changes its category, the bin deletes it. After every fix the coach tells you what changed.' },
  { target: '.dock', title: 'Undo and Check', text: 'Undo takes back any step, so nothing can break. When the coach says everything checks out, press Check the books to get your grade.' },
];

let root: HTMLElement | null = null;
let steps: TourStep[] = [];
let at = 0;
let raf = 0;

const visible = (el: Element | null): el is HTMLElement => !!el && (el as HTMLElement).getClientRects().length > 0;
function find(sel?: string): HTMLElement | null {
  if (!sel) return null;
  for (const one of sel.split(',')) {
    const el = document.querySelector(one.trim());
    if (visible(el)) return el;
  }
  return null;
}

function place(): void {
  if (!root) return;
  const hole = root.querySelector<HTMLElement>('.tour-hole')!;
  const card = root.querySelector<HTMLElement>('.tour-card')!;
  const el = find(steps[at].target);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!el) {
    // no target: the whole page stays dimmed (the dim is the hole's own shadow, so the hole must stay visible)
    hole.style.cssText = `left:${vw / 2}px;top:${vh / 2}px;width:0;height:0;opacity:1`;
    card.dataset.pos = 'center';
    card.style.left = '';
    card.style.top = '';
    return;
  }
  const r = el.getBoundingClientRect();
  const pad = 8;
  const top = Math.max(6, r.top - pad);
  const height = Math.min(vh - top - 6, r.bottom + pad - top);
  hole.style.cssText = `left:${Math.max(6, r.left - pad)}px;top:${top}px;width:${Math.min(vw - 12, r.width + pad * 2)}px;height:${Math.max(0, height)}px;opacity:1`;
  if (vw < 720) {
    // a phone: the card is a sheet at the bottom, or at the top when the lit part is low on the screen
    card.dataset.pos = r.top + r.height / 2 > vh * 0.55 ? 'sheet-top' : 'sheet';
    card.style.left = '';
    card.style.top = '';
    return;
  }
  card.dataset.pos = 'float';
  const cw = card.offsetWidth;
  const ch = card.offsetHeight;
  const below = r.bottom + pad + 14 + ch < vh;
  const y = below ? r.bottom + pad + 14 : Math.max(12, r.top - pad - 14 - ch);
  const x = Math.max(16, Math.min(r.left, vw - cw - 16));
  card.style.left = `${x}px`;
  card.style.top = `${y}px`;
}

function show(i: number): void {
  if (!root) return;
  at = Math.max(0, Math.min(steps.length - 1, i));
  const s = steps[at];
  const card = root.querySelector<HTMLElement>('.tour-card')!;
  card.classList.remove('is-in');
  card.querySelector('.tour-n')!.textContent = `${at + 1} of ${steps.length}`;
  card.querySelector('.tour-t')!.textContent = s.title;
  card.querySelector('.tour-d')!.textContent = s.text;
  card.querySelector<HTMLElement>('[data-tour=back]')!.hidden = at === 0;
  card.querySelector('[data-tour=next]')!.textContent = at === steps.length - 1 ? 'Start working' : 'Next';
  root.querySelector<HTMLElement>('.tour-bar i')!.style.transform = `scaleX(${(at + 1) / steps.length})`;
  const el = find(s.target);
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (el) {
    const r = el.getBoundingClientRect();
    const tall = r.height > window.innerHeight * 0.7;
    el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: tall ? 'start' : 'center' });
  }
  // follow the element while the page scrolls to it, then settle
  const t0 = performance.now();
  cancelAnimationFrame(raf);
  const follow = (now: number) => {
    place();
    if (now - t0 < 700) raf = requestAnimationFrame(follow);
  };
  raf = requestAnimationFrame(follow);
  requestAnimationFrame(() => card.classList.add('is-in'));
  card.querySelector<HTMLElement>('[data-tour=next]')!.focus({ preventScroll: true });
}

export function endTour(): void {
  if (!root) return;
  markSeen();
  cancelAnimationFrame(raf);
  window.removeEventListener('resize', place);
  window.removeEventListener('scroll', place, true);
  document.removeEventListener('keydown', onKey, true);
  const el = root;
  root = null;
  el.classList.add('is-out');
  setTimeout(() => el.remove(), 260);
  window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

function onKey(e: KeyboardEvent): void {
  if (!root) return;
  if (e.key === 'Escape') endTour();
  else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); at === steps.length - 1 ? endTour() : show(at + 1); }
  else if (e.key === 'ArrowLeft') show(at - 1);
}

export function startTour(list: TourStep[] = CASE_TOUR): void {
  if (root) return;
  steps = list;
  root = document.createElement('div');
  root.className = 'tour';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'A short tour of the workbench');
  root.innerHTML = `
    <div class="tour-hole" aria-hidden="true"></div>
    <div class="tour-card" data-testid="tour">
      <div class="tour-bar" aria-hidden="true"><i></i></div>
      <p class="tour-n"></p>
      <h2 class="tour-t"></h2>
      <p class="tour-d"></p>
      <div class="tour-acts">
        <button type="button" class="tour-skip" data-tour="skip">Skip the tour</button>
        <button type="button" class="btn" data-tour="back">Back</button>
        <button type="button" class="btn primary" data-tour="next">Next</button>
      </div>
    </div>`;
  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tour]');
    if (!b) return;
    if (b.dataset.tour === 'skip') endTour();
    else if (b.dataset.tour === 'back') show(at - 1);
    else at === steps.length - 1 ? endTour() : show(at + 1);
  });
  document.body.append(root);
  window.addEventListener('resize', place);
  window.addEventListener('scroll', place, true);
  document.addEventListener('keydown', onKey, true);
  show(0);
}
