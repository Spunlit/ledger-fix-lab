import { checkAll, createSession, applyAction } from '../core/engine';
import { SKILL_LABEL } from '../core/explain';
import { formatCents } from '../core/money';
import { CASES, CASE_2 } from '../core/scenarios';
import { esc, type Completed } from './util';

/** Numbers for the hero come from the real Case 2 engine, not from copy. */
function heroNumbers() {
  let s = createSession(CASE_2);
  for (const a of [
    { type: 'record', txnId: 'R13', category: 'bankfees' },
    { type: 'setAmount', entryId: 'E03', magnitudeCents: 8437 },
    { type: 'setCleared', entryId: 'E03', cleared: true },
    { type: 'delete', entryId: 'E09' },
  ] as const) {
    s = applyAction(s, a);
  }
  const r = checkAll(CASE_2, s.state);
  return { diff: r.recon.differenceCents, booked: r.categories.booked.netIncomeCents, correct: r.categories.correct.netIncomeCents };
}

export function renderLanding(done: Completed): string {
  const h = heroNumbers();
  return `
  <header class="site">
    <a class="brand" href="#/" aria-label="Ledger Fix Lab home"><span class="mark" aria-hidden="true"></span>Ledger Fix Lab</a>
    <nav><a href="#cases">Cases</a><a href="#grading">How grading works</a></nav>
  </header>

  <main class="landing">
    <section class="hero">
      <div class="hero-copy">
        <h1>Practice your first bookkeeping cleanup before a client pays for it.</h1>
        <p class="lede">Realistic client books with the mistakes real books have: duplicate imports, swapped digits, bank fees nobody recorded, checks that haven't cleared, and owner money booked as income. Reconcile them to the bank statement and find out whether the books are actually right, not just balanced.</p>
        <div class="cta-row">
          <a class="btn primary big" href="#/case/${CASES[0].id}">Start case 1</a>
          <a class="textlink" href="#/case/${CASE_2.id}">Or jump to case 2</a>
        </div>
        <p class="fine">Free, no sign-up. About 6 minutes for the first case.</p>
      </div>

      <figure class="hero-sheet" aria-label="Example from case 2">
        <div class="sheet">
          <div class="sheet-row"><span>Reconciliation difference</span><span class="num ok">${formatCents(h.diff)}</span></div>
          <div class="sheet-row"><span>Net profit, as booked</span><span class="num bad">${formatCents(h.booked)}</span></div>
          <div class="sheet-row"><span>Net profit, actually</span><span class="num">${formatCents(h.correct)}</span></div>
        </div>
        <figcaption>From case 2: the bank reconciliation balances perfectly, yet the books overstate profit by ${formatCents(h.booked - h.correct)}, because the owner's own $5,000 transfer was booked as sales. A reconciliation screen only checks the first line.</figcaption>
      </figure>
    </section>

    <section id="cases" class="cases" aria-labelledby="cases-h">
      <h2 id="cases-h">Cases</h2>
      <ol class="case-list">
        ${CASES.map(
          (c) => `
        <li class="case-item">
          <div class="case-num" aria-hidden="true">${c.number}</div>
          <div class="case-body">
            <h3><a href="#/case/${c.id}">${esc(c.title)}</a></h3>
            <p class="case-meta">${esc(c.business)}, ${esc(c.period)}. ${c.level}, about ${c.minutes} minutes.</p>
            <p class="case-skills">Practices: ${c.skills.map((k) => esc(SKILL_LABEL[k].toLowerCase())).join(', ')}.</p>
          </div>
          <div class="case-go">
            ${done[c.id] ? '<span class="done-tag">Completed</span>' : ''}
            <a class="btn ${c.number === 1 ? 'primary' : ''}" href="#/case/${c.id}">${done[c.id] ? 'Play again' : `Start case ${c.number}`}</a>
          </div>
        </li>`,
        ).join('')}
      </ol>
    </section>

    <section id="grading" class="grading" aria-labelledby="grading-h">
      <h2 id="grading-h">We grade the books you end up with, not your clicks</h2>
      <div class="grading-grid">
        <p>Every transaction in the books exactly once: no leftover duplicates, nothing real deleted.</p>
        <p>Every amount matches the bank or the source document.</p>
        <p>Ticked as cleared exactly when it's on this statement; outstanding checks stay unticked.</p>
        <p>Every row in the right category, with the effect on profit shown in dollars.</p>
      </div>
      <p class="grading-note">A $0.00 difference is required but never enough on its own. Any correct end state passes, whichever duplicate copy you delete and in whatever order you work. When something is wrong, you're told which rule broke and why.</p>
    </section>

    <section class="who">
      <h2>Who it's for</h2>
      <p>New freelance bookkeepers who have finished a course or certification and want hands-on practice before their first cleanup client, and anyone who keeps their own books and wants to check their reconciliation habits. The skills aren't tied to one product: they apply in QuickBooks, Xero or a spreadsheet.</p>
    </section>
  </main>

  <footer class="site-foot">
    <p>All businesses, people and numbers are synthetic. Simplified one-account model; not connected to any bank or accounting software. Nothing you do leaves your browser.</p>
    <p><a href="https://github.com/Spunlit/ledger-fix-lab">Source code on GitHub</a></p>
  </footer>`;
}
