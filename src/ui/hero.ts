import { categoryName } from '../core/categories';
import { applyAction, checkAll, createSession } from '../core/engine';
import { shortDate } from '../core/explain';
import { formatCents, formatSignedCents } from '../core/money';
import { CASE_2 } from '../core/scenarios';
import type { Action, Session } from '../core/types';
import { esc } from './util';

/**
 * The home-page case, drawn as a printed ledger page on the auditor's desk: case 2's books after every
 * fix except one. It already carries a RECONCILED stamp, yet profit is wrong. The visitor taps the line
 * that is lying. Verdicts come from the real engine (the category check), not hard-coded answers.
 */
const PREP: Action[] = [
  { type: 'record', txnId: 'R13', category: 'bankfees' },
  { type: 'setAmount', entryId: 'E03', magnitudeCents: 8437 },
  { type: 'setCleared', entryId: 'E03', cleared: true },
  { type: 'delete', entryId: 'E09' },
];
export const HERO_ROWS = ['E01', 'E03', 'E06', 'E07', 'E14'];

/** The auditor's margin note when an honest line is checked. */
const WHY_HONEST: Record<string, string> = {
  E01: 'real sale, Square deposit on the bank statement',
  E03: 'real phone bill, right category',
  E07: 'real fuel for the van, right category',
  E14: "real check, mailed the 30th, just hasn't cleared",
};

export function heroBase(): Session {
  return PREP.reduce((s, a) => applyAction(s, a), createSession(CASE_2));
}

export interface HeroState {
  tried: string[];
  caught: boolean;
}

export function heroVerdict(entryId: string) {
  const base = heroBase();
  const r = checkAll(CASE_2, base.state);
  const wrong = r.categories.wrong.find((w) => w.entry.entryId === entryId);
  if (!wrong) return { caught: false as const, why: WHY_HONEST[entryId] ?? 'checks out' };
  const fixed = applyAction(base, { type: 'recategorize', entryId, category: wrong.expected });
  const rf = checkAll(CASE_2, fixed.state);
  return { caught: true as const, before: r.categories.booked.netIncomeCents, after: rf.categories.booked.netIncomeCents, allRight: rf.ok };
}

/** A hand-drawn loop around a ledger line (scaled to the row). */
const LOOP = `<svg class="loop" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M10 24 C 3 12, 22 4, 50 4 S 98 9, 96 21 S 78 37, 48 36 S 1 31, 5 17 C 8 9, 22 5, 36 5"/></svg>`;
const TICK = `<svg class="tick-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 13 C 6 15, 8 18, 9 20 C 12 13, 16 7, 22 3"/></svg>`;

export function renderHero(st: HeroState): string {
  const base = heroBase();
  const r = checkAll(CASE_2, base.state);
  const before = r.categories.booked.netIncomeCents;
  const liar = r.categories.wrong[0]?.entry.entryId;
  const v = st.caught && liar ? heroVerdict(liar) : null;
  const after = v && v.caught ? v.after : before;
  const lastWrong = !st.caught && st.tried.length ? st.tried[st.tried.length - 1] : null;
  const rows = HERO_ROWS.map((id) => base.state.entries.find((e) => e.entryId === id)!);

  return `
  <section class="hero ${st.caught ? 'is-caught' : ''}" aria-labelledby="hero-h">
    <div class="hero-copy">
      <h1 id="hero-h">One line on this page is lying.</h1>
      <p class="hero-sub">The bank balances to the cent. The profit is ${formatCents(before - r.categories.correct.netIncomeCents)} too high. Find the line.</p>
      <p class="hero-do" aria-live="polite">${
        st.caught
          ? 'Caught. That is the mistake a $0.00 reconciliation hides, and the one this trainer teaches you to see.'
          : lastWrong
            ? 'That one checks out. Try another line.'
            : 'Tap a line to check it.'
      }</p>
      ${
        st.caught
          ? `<div class="hero-cta" data-testid="hero-verdict"><p>Dani moved her own savings into the business: owner's money, not a sale.</p><a class="btn primary big" href="#/case/maple-pine-oct">Clean up a full client file</a><span class="cta-note">Free, no sign-up, 6 minutes</span></div>`
          : ''
      }
    </div>

    <figure class="sheet-wrap">
      <div class="sheet" aria-label="Ledger page, Rivera Mobile Detailing, March 2026">
        <header class="sheet-head">
          <div><p class="sheet-co">Rivera Mobile Detailing</p><p class="sheet-meta">Books for March 2026, page 3 of 3</p></div>
          <span class="rstamp ok" aria-label="Stamped reconciled, difference $0.00">Reconciled<br><small>diff ${formatSignedCents(r.recon.differenceCents)}</small></span>
          ${st.caught ? '<span class="rstamp bad" data-testid="hero-stamp">But wrong</span>' : ''}
        </header>
        <ol class="lines">
          ${rows
            .map((e) => {
              const tried = st.tried.includes(e.entryId);
              const isLiar = st.caught && e.entryId === liar;
              return `<li class="line ${tried ? 'tried' : ''} ${isLiar ? 'liar' : ''} ${lastWrong === e.entryId ? 'fresh' : ''}">
                <button type="button" data-hero-pick="${e.entryId}" ${st.caught || tried ? 'disabled' : ''} aria-label="${esc(`Check: ${e.description}, ${shortDate(e.date)}, ${formatSignedCents(e.amountCents)}, booked as ${categoryName(e.category)}`)}">
                  <span class="l-date">${shortDate(e.date)}</span>
                  <span class="l-desc">${esc(e.description)}<span class="l-cat">${esc(categoryName(e.category))}</span></span>
                  <span class="l-amt num">${formatSignedCents(e.amountCents)}</span>
                </button>
                ${tried ? `${TICK}<span class="note blue">${esc(WHY_HONEST[e.entryId] ?? 'checks out')}</span>` : ''}
                ${isLiar ? `${LOOP}<span class="note red" data-testid="hero-why">owner's savings, not a sale!</span>` : ''}
              </li>`;
            })
            .join('')}
        </ol>
        <footer class="sheet-total">
          <span>Net profit</span>
          <span class="tot num"><span class="hl ${st.caught ? 'struck' : ''}">${formatCents(before)}</span>${st.caught ? `<span class="pen-fix" data-testid="hero-profit">${formatCents(after)}</span>` : `<span class="sr" data-testid="hero-profit">${formatCents(before)}</span>`}</span>
        </footer>
      </div>
    </figure>
  </section>`;
}
