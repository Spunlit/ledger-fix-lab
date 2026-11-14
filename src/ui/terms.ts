import '../terms.css';
import { splitTerms, termById } from '../core/glossary';

/**
 * Tappable glossary words. gloss() marks the bookkeeping words in a piece of text; initTerms() shows a
 * short plain explanation when one is tapped (a small card by the word, a bottom sheet on a phone).
 * Used by both pages: the trainer (app.html) and the landing page.
 */
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => ESC[c]);

/** Escape text and wrap its glossary words in term buttons. Do not use inside a button or a link. */
export function gloss(text: string): string {
  return splitTerms(text)
    .map((p) => (p.term ? `<button type="button" class="term" data-term="${p.term.id}">${escHtml(p.text)}</button>` : escHtml(p.text)))
    .join('');
}

/** Mark glossary words inside existing markup (static pages): walks text nodes, skips links and buttons. */
export function glossElement(root: HTMLElement): void {
  const used = new Set<string>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest('a, button, summary') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    const pieces = splitTerms(node.data);
    if (!pieces.some((p) => p.term && !used.has(p.term.id))) continue;
    const frag = document.createDocumentFragment();
    for (const p of pieces) {
      if (!p.term || used.has(p.term.id)) {
        frag.append(p.text);
        continue;
      }
      used.add(p.term.id);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'term';
      b.dataset.term = p.term.id;
      b.textContent = p.text;
      frag.append(b);
    }
    node.replaceWith(frag);
  }
}

let pop: HTMLElement | null = null;
let openFor: HTMLElement | null = null;

function close(): void {
  if (!pop) return;
  pop.hidden = true;
  openFor?.setAttribute('aria-expanded', 'false');
  openFor = null;
}

function open(btn: HTMLElement, guideHref: string): void {
  const term = termById(btn.dataset.term ?? '');
  if (!term) return;
  if (!pop) {
    pop = document.createElement('div');
    pop.className = 'term-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'What this word means');
    document.body.append(pop);
  }
  pop.innerHTML = `<p class="term-pop__t">${escHtml(term.term)}</p><p class="term-pop__d">${escHtml(term.plain)}</p><a class="term-pop__a" href="${guideHref}">All words explained</a><button type="button" class="term-pop__x" aria-label="Close">Got it</button>`;
  pop.hidden = false;
  openFor = btn;
  btn.setAttribute('aria-expanded', 'true');
  // By the word on wide screens; CSS turns it into a bottom sheet on a phone.
  const r = btn.getBoundingClientRect();
  const w = Math.min(320, window.innerWidth - 24);
  pop.style.setProperty('--tx', `${Math.max(12, Math.min(r.left, window.innerWidth - w - 12))}px`);
  const below = r.bottom + 8 + 170 < window.innerHeight;
  pop.style.setProperty('--ty', `${below ? r.bottom + 8 : Math.max(12, r.top - 8 - pop.offsetHeight)}px`);
}

/** One listener for the whole page. guideHref is where "All words explained" leads. */
export function initTerms(guideHref: string): void {
  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const btn = t.closest<HTMLElement>('.term');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      if (openFor === btn) close();
      else open(btn, guideHref);
      return;
    }
    if (pop && !pop.hidden && (!t.closest('.term-pop') || t.closest('.term-pop__x, .term-pop__a'))) close();
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  window.addEventListener('scroll', () => { if (window.innerWidth >= 640) close(); }, { passive: true });
  window.addEventListener('hashchange', close);
}
