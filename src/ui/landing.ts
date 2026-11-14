import { applyAction, checkIntegrity, createSession, reconcile } from '../core/engine';
import { shortDate, SKILL_LABEL } from '../core/explain';
import { generateFile, todaySeed } from '../core/generator';
import { formatCents, formatSignedCents } from '../core/money';
import { CASES, CASE_1 } from '../core/scenarios';
import { skillStats, weakestSkills, type SkillAttempt } from '../core/skills';
import { dailyHref, practiceHref } from './routes';
import { esc, newSeed, type Completed } from './util';

/** The 30-second challenge on the home page: real case 1 rows, graded by the real engine. */
export const CHALLENGE_ROWS = ['E09', 'E10', 'E14'];

export function challengeResult(deleted: string) {
  const s = applyAction(createSession(CASE_1), { type: 'delete', entryId: deleted });
  const integrity = checkIntegrity(CASE_1, s.state);
  return { difference: reconcile(CASE_1, s.state).differenceCents, right: integrity.ok };
}

const trash = `<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M7 3h6m-9 3h12m-1.5 0-.7 10.1a1.5 1.5 0 0 1-1.5 1.4H7.7a1.5 1.5 0 0 1-1.5-1.4L5.5 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function challenge(deleted: string | null): string {
  const start = reconcile(CASE_1, createSession(CASE_1).state);
  const rows = CASE_1.ledger.filter((e) => CHALLENGE_ROWS.includes(e.entryId));
  const bank = CASE_1.txns.filter((t) => t.txnId === 'T09' || t.txnId === 'T13');
  const res = deleted ? challengeResult(deleted) : null;
  const short = (d: string) => d.replace('Upwork — contractor, logo milestone ', 'Upwork, part ');
  return `
  <div class="challenge ${res ? (res.right ? 'is-right' : 'is-wrong') : ''}" aria-live="polite">
    <div class="ch-head">
      <span class="ch-label">Try it, 30 seconds</span>
      <div class="ch-diff"><span>Difference</span><strong class="num" data-testid="ch-diff" data-from="${res ? start.differenceCents : ''}">${formatSignedCents(res ? res.difference : start.differenceCents)}</strong></div>
    </div>
    <p class="ch-task">The books are <b>$412.50</b> off. One payment was imported twice. Delete the extra copy.</p>
    <div class="ch-cols">
      <div>
        <p class="ch-cap">The books</p>
        <ul class="ch-rows">
          ${rows
            .map((e) => {
              const gone = deleted === e.entryId;
              const dup = res && !res.right && e.txnId === 'T09';
              return `<li class="${gone ? 'gone' : ''} ${dup ? 'dup' : ''}">
              <span class="d">${shortDate(e.date)}</span><span class="t">${esc(short(e.description))}</span><span class="num">${formatCents(e.amountCents)}</span>
              ${res ? '<span class="icon-sp"></span>' : `<button type="button" class="icon-btn" data-ch-del="${e.entryId}" aria-label="Delete ${esc(e.description)}, ${shortDate(e.date)}">${trash}</button>`}
            </li>`;
            })
            .join('')}
        </ul>
      </div>
      <div>
        <p class="ch-cap">The bank statement</p>
        <ul class="ch-rows bank">
          ${bank.map((t) => `<li class="${res && !res.right && t.txnId === 'T13' ? 'proof' : ''}"><span class="d">${shortDate(t.date)}</span><span class="t">${esc(short(t.description))}</span><span class="num">${formatCents(t.amountCents)}</span></li>`).join('')}
        </ul>
      </div>
    </div>
    ${
      res
        ? res.right
          ? `<div class="ch-verdict good" data-testid="ch-verdict"><p class="v-title">Right, and balanced.</p><p>The bank shows the Oct 15 payment once, so one copy had to go. That's the habit: match every line to the bank before you delete anything.</p>
             <div class="ch-actions"><a class="btn primary" href="#/case/${CASES[0].id}">Do the full case</a><button type="button" class="btn ghost" data-ch-reset>Try again</button></div></div>`
          : `<div class="ch-verdict bad" data-testid="ch-verdict"><p class="v-title">Balanced, but wrong.</p><p>The difference is $0.00, yet you deleted the real Oct 29 payment: it's right there on the bank statement, and the duplicate is still in the books. A reconciliation screen would call this done. We don't.</p>
             <div class="ch-actions"><button type="button" class="btn primary" data-ch-reset>Try again</button><a class="btn ghost" href="#/case/${CASES[0].id}">Do the full case</a></div></div>`
        : ''
    }
  </div>`;
}

function practice(done: Completed, history: SkillAttempt[]): string {
  const day = todaySeed();
  let daily = null;
  try {
    daily = generateFile(day, { kind: 'daily' }).scenario;
  } catch {
    daily = null; // never let a generator failure blank the home page
  }
  const stats = skillStats(history).filter((st) => st.attempts > 0);
  const card = (href: string, kicker: string, title: string, body: string, meta: string, isDone: boolean, primary = false) => `
    <a class="card ${primary ? 'primary' : ''}" href="${href}">
      <span class="kicker">${kicker}</span>
      <span class="card-title">${esc(title)}</span>
      <span class="card-body">${body}</span>
      <span class="card-meta">${isDone ? '<span class="done">Completed</span>' : meta}</span>
    </a>`;
  return `
  <section class="practice" id="practice" aria-labelledby="practice-h">
    <h2 id="practice-h">Start guided, then go it alone</h2>
    <div class="cards">
      ${card(`#/case/${CASES[0].id}`, 'Guided case, 6 min', CASES[0].title, 'Duplicate imports, identical real purchases, two wrong categories. Feedback after every move.', 'Start here', Boolean(done[CASES[0].id]), true)}
      ${card(`#/case/${CASES[1].id}`, 'Guided case, 10 min', CASES[1].title, 'A swapped-digit amount, a missing bank fee, an uncleared check, and owner money booked as sales.', 'Next', Boolean(done[CASES[1].id]))}
      ${daily ? card(dailyHref(day), 'File of the day', daily.business, 'A new client file every day, the same for everyone. No hints until you check: the real test.', `${daily.period} books`, Boolean(done[daily.id])) : ''}
    </div>
    ${
      stats.length
        ? `<div class="record">
        <h3>Your skill record <small>caught on the first check, unguided files only</small></h3>
        <ul>${stats.map((st) => `<li><span>${esc(SKILL_LABEL[st.skill])}</span><span class="meter" style="--v:${Math.round((st.firstTry / st.attempts) * 100)}%" aria-hidden="true"></span><span class="num">${st.firstTry}/${st.attempts}</span></li>`).join('')}</ul>
        <a class="btn" href="${practiceHref(newSeed(), weakestSkills(history, 2))}">Practice my weak spots</a>
      </div>`
        : ''
    }
  </section>`;
}

export function renderLanding(done: Completed, history: SkillAttempt[], deleted: string | null = null): string {
  return `
  <header class="nav">
    <a class="brand" href="#/" aria-label="Ledger Fix Lab home"><span class="mark" aria-hidden="true"></span>Ledger Fix Lab</a>
    <nav><a href="#practice">Practice</a><a href="#how">How it works</a><a href="#pricing">Pricing</a></nav>
  </header>

  <main class="home">
    <section class="hero">
      <div class="hero-copy">
        <h1>Your books balance. Are they right?</h1>
        <p class="lede">Practice cleaning up real-looking client books. Every fix is checked instantly, including the mistakes that still add up to $0.00.</p>
        <p class="fine">For new bookkeepers before their first client, and for anyone who keeps their own books. Free, no sign-up.</p>
      </div>
      ${challenge(deleted)}
    </section>

    ${practice(done, history)}

    <section class="how" id="how" aria-labelledby="how-h">
      <h2 id="how-h">How it works</h2>
      <ol class="steps">
        <li><span class="step-n">1</span><h3>Open a client's books</h3><p>A short note from the owner, their books and the bank statement. Synthetic, but realistic.</p></li>
        <li><span class="step-n">2</span><h3>Fix them against the bank</h3><p>Delete duplicates, correct amounts, record missing bank fees, choose the right categories.</p></li>
        <li><span class="step-n">3</span><h3>Get checked on the result</h3><p>Not your clicks: the books you end up with. A $0.00 difference is never enough on its own.</p></li>
      </ol>
    </section>

    <section class="pricing" id="pricing" aria-labelledby="pricing-h">
      <h2 id="pricing-h">Pricing we plan to test</h2>
      <div class="plans">
        <div class="plan"><h3>Free</h3><p class="price">$0</p><p>Both guided cases, the file of the day and your skill record.</p></div>
        <div class="plan pro"><h3>Practice</h3><p class="price">$12<small> a month, planned</small></p><p>Unlimited files aimed at your weak spots, plus month-end tracks: credit cards, payroll, sales tax.</p></div>
      </div>
      <p class="fine">Nothing is for sale yet; during the beta everything is free. For comparison, practice-client files elsewhere sell for $49 to $119 each, and you check your own work.</p>
    </section>
  </main>

  <footer class="foot">
    <p>All businesses, people and numbers are synthetic. Simplified one-account model, not connected to any bank or accounting software. Nothing you do leaves your browser. <a href="https://github.com/Spunlit/ledger-fix-lab">Source on GitHub</a></p>
  </footer>`;
}
