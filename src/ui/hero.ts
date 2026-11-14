import { categoryName } from '../core/categories';
import { applyAction, checkAll, createSession } from '../core/engine';
import { shortDate } from '../core/explain';
import { formatCents, formatSignedCents } from '../core/money';
import { CASE_2 } from '../core/scenarios';
import type { Action, Session } from '../core/types';
import { esc } from './util';

/**
 * The home-page "30-second case": case 2's books after every fix except one. The reconciliation already
 * reads $0.00, yet profit is wrong. The visitor taps the line that is lying. Verdicts come from the real
 * engine (the category check), not from hard-coded answers.
 */
const PREP: Action[] = [
  { type: 'record', txnId: 'R13', category: 'bankfees' },
  { type: 'setAmount', entryId: 'E03', magnitudeCents: 8437 },
  { type: 'setCleared', entryId: 'E03', cleared: true },
  { type: 'delete', entryId: 'E09' },
];
export const HERO_CARDS = ['E01', 'E14', 'E06', 'E03'];

/** Why an honest line is honest (shown when the visitor picks it). */
const WHY_HONEST: Record<string, string> = {
  E01: 'Real income: Square paid out customer payments, and the deposit is on the bank statement.',
  E14: "Real expense: Dani mailed this check on the 30th. It just hasn't reached the bank yet.",
  E03: "Real expense in the right category: it's the business phone bill.",
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
  if (!wrong) return { caught: false as const, why: WHY_HONEST[entryId] ?? 'That line checks out.' };
  const fixed = applyAction(base, { type: 'recategorize', entryId, category: wrong.expected });
  const rf = checkAll(CASE_2, fixed.state);
  return { caught: true as const, before: r.categories.booked.netIncomeCents, after: rf.categories.booked.netIncomeCents, allRight: rf.ok };
}

const check = `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="m5 10.5 3.2 3L15 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function renderHero(st: HeroState): string {
  const base = heroBase();
  const r = checkAll(CASE_2, base.state);
  const before = r.categories.booked.netIncomeCents;
  const liar = r.categories.wrong[0]?.entry.entryId;
  const v = st.caught && liar ? heroVerdict(liar) : null;
  const after = v && v.caught ? v.after : before;
  const lastWrong = !st.caught && st.tried.length ? st.tried[st.tried.length - 1] : null;
  const cards = HERO_CARDS.map((id) => base.state.entries.find((e) => e.entryId === id)!);

  return `
  <section class="hero" aria-labelledby="hero-h">
    <span class="pill">A 30-second case</span>
    <h1 id="hero-h">The books balance.<br>One line is lying.</h1>
    <p class="hero-sub">A bookkeeping trainer that grades the books, not your clicks.</p>

    <div class="case ${st.caught ? 'is-caught' : ''}" aria-live="polite">
      <div class="tiles">
        <div class="tile ok">
          <span class="tile-label">Bank reconciliation</span>
          <strong class="num">${formatSignedCents(r.recon.differenceCents)}</strong>
          <span class="tile-note">${check} Balanced</span>
        </div>
        <div class="tile ${st.caught ? 'fixed' : 'suspect'}">
          <span class="tile-label">Net profit, March</span>
          <strong class="num" data-testid="hero-profit" data-from="${st.caught ? before : ''}" data-to="${after}">${formatCents(after)}</strong>
          <span class="tile-note">${st.caught ? `Was ${formatCents(before)}: overstated by ${formatCents(before - after)}` : 'Looks great. Is it true?'}</span>
        </div>
      </div>

      <p class="prompt">${st.caught ? 'Caught it.' : 'Tap the line that makes the profit wrong.'}</p>

      <div class="evidence">
        ${cards
          .map((e) => {
            const tried = st.tried.includes(e.entryId);
            const isLiar = st.caught && e.entryId === liar;
            const label = isLiar ? categoryName('ownerContribution') : categoryName(e.category);
            return `<button type="button" class="ev ${tried ? 'tried' : ''} ${isLiar ? 'liar' : ''} ${lastWrong === e.entryId ? 'shake' : ''}" data-hero-pick="${e.entryId}" ${st.caught || tried ? 'disabled' : ''} aria-label="${esc(`${e.description}, ${shortDate(e.date)}, ${formatSignedCents(e.amountCents)}, booked as ${categoryName(e.category)}`)}">
              <span class="ev-top"><span>${shortDate(e.date)}</span><span class="chip ${isLiar ? 'fixed' : ''}">${esc(label)}</span></span>
              <span class="ev-desc">${esc(e.description)}${isLiar ? ` <span class="ev-was">was booked as ${esc(categoryName(e.category))}</span>` : ''}</span>
              <span class="ev-amt num ${e.amountCents > 0 ? 'in' : ''}">${formatSignedCents(e.amountCents)}</span>
              ${isLiar ? '<span class="stamp" aria-hidden="true">Caught</span>' : ''}
              ${tried ? '<span class="ev-ok" aria-hidden="true">Checks out</span>' : ''}
            </button>`;
          })
          .join('')}
      </div>

      ${
        st.caught
          ? `<div class="verdict" data-testid="hero-verdict">
              <p><b>Dani moved her own savings into the business.</b> That's owner's money, not a sale. The bank balanced to the cent, and the profit was still $5,000 too high.</p>
              <div class="cta"><a class="btn primary big" href="#/case/maple-pine-oct">Clean up a full client file</a><span class="cta-note">Free, no sign-up, 6 minutes</span></div>
            </div>`
          : lastWrong
            ? `<p class="why" data-testid="hero-why">${esc(WHY_HONEST[lastWrong] ?? 'That line checks out.')} Try another.</p>`
            : `<p class="why muted">Hint: one of these is not what it says it is.</p>`
      }
    </div>
  </section>`;
}
