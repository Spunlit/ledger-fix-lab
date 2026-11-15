import { SKILL_LABEL } from '../core/explain';
import { generateFile, todaySeed } from '../core/generator';
import { CASES } from '../core/scenarios';
import { skillStats, weakestSkills, type SkillAttempt } from '../core/skills';
import { basicsDone } from './basics';
import { dailyHref, practiceHref } from './routes';
import { gloss } from './terms';
import { dailyStreak, esc, loadDrillRecord, loadTheme, masteryLevel, newSeed, themeButton, weekDays, type Completed } from './util';

const tick = `<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="m5 10.5 3.2 3L15 6.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function path(done: Completed, history: SkillAttempt[]): string {
  const day = todaySeed();
  let daily = null;
  try {
    daily = generateFile(day, { kind: 'daily' }).scenario;
  } catch {
    daily = null; // never let a generator failure blank the home page
  }
  const streak = dailyStreak(done, day);
  const step = (n: string, href: string, title: string, meta: string, isDone: boolean, current: boolean) => `
    <a class="step ${isDone ? 'done' : ''} ${current ? 'current' : ''}" href="${href}">
      <span class="step-n">${isDone ? tick : n}</span>
      <span class="step-body"><span class="step-title">${esc(title)}</span><span class="step-meta">${meta}</span></span>
    </a>`;
  const d1 = Boolean(done[CASES[0].id]);
  const d2 = Boolean(done[CASES[1].id]);
  const dd = daily ? Boolean(done[daily.id]) : false;
  const stats = skillStats(history).filter((st) => st.attempts > 0);
  const week = weekDays(done, day);
  const drillRec = loadDrillRecord();
  const weak = weakestSkills(history, 2);
  // One clear next action, the way a course home does it.
  const zero = !basicsDone() && !d1;
  const next = zero
    ? { href: '#/basics', label: 'Start from zero', note: 'Five ideas in two minutes. No experience needed.' }
    : !d1
    ? { href: `#/case/${CASES[0].id}`, label: 'Start case 1', note: 'Guided, about 6 minutes.' }
    : !d2
      ? { href: `#/case/${CASES[1].id}`, label: 'Continue with case 2', note: 'Guided, about 10 minutes. The one that balances and is still wrong.' }
      : !dd && daily
        ? { href: dailyHref(day), label: "Do today's file", note: `${daily.business}. No hints: it feeds your skill record.` }
        : stats.length
          ? { href: practiceHref(newSeed(), weak), label: 'Practice my weak spots', note: "Today's file is done. A practice file aimed at what you miss most." }
          : { href: '#/drill', label: 'Do a warm-up', note: "Today's file is done. Five quick rounds." };
  return `
  <section class="path-sec" id="practice" aria-labelledby="path-h">
    <h1 id="path-h">Your practice desk</h1>
    <p class="path-sub">Two guided cases, then a new file every day. Your skill record appears after the first file without hints.</p>
    <div class="home-top">
      <a class="home-next" href="${next.href}" data-testid="home-next"><span class="home-next__t"><small>Next up</small><b>${esc(next.label)}</b><span>${esc(next.note)}</span></span><span class="btn primary">${d1 ? 'Continue' : 'Start'}</span></a>
      <div class="home-week" role="img" aria-label="${streak ? `${streak}-day streak. ` : ''}Files of the day done in the last seven days: ${week.filter((w) => w.done).length} of 7">
        <p><b>${streak}</b> day streak</p>
        <div class="home-days">${week.map((w) => `<span class="${w.done ? 'on' : ''} ${w.today ? 'today' : ''}"><i></i>${esc(w.label)}</span>`).join('')}</div>
      </div>
    </div>
    <a class="warm quiet" href="#/basics"><span class="warm-t"><b>Start from zero</b><span>New to bookkeeping? Five ideas in two minutes: statement, books, matching, difference, categories.</span></span><span class="btn">${basicsDone() ? 'Again' : 'Start'}</span></a>
    <a class="warm" href="#/drill"><span class="warm-t"><b>60-second warm-up</b><span>Five quick rounds: tap the line that is wrong. Good on a phone.${drillRec.runs ? ` Best: ${drillRec.best} of 5 on the first tap.` : ''}</span></span><span class="btn primary">Start</span></a>
    <a class="warm quiet" href="#/guide"><span class="warm-t"><b>Field guide</b><span>Seven things to check in any set of books: what you see, how to tell, what to do.</span></span><span class="btn">Read</span></a>
    <a class="warm quiet" href="#/record"><span class="warm-t"><b>Practice record</b><span>Proof of what you have done, on one page you can print. It stays current while you keep practising.</span></span><span class="btn">Open</span></a>
    <div class="path">
      ${step('1', `#/case/${CASES[0].id}`, CASES[0].title, 'Guided, 6 min. Duplicates and categories.', d1, !d1)}
      ${step('2', `#/case/${CASES[1].id}`, CASES[1].title, 'Guided, 10 min. The full reconciliation.', d2, d1 && !d2)}
      ${daily ? step('3', dailyHref(day), "Today's file", `No hints. A new client every day.${streak ? ` <b>${streak}-day streak</b>` : ''}`, dd, d1 && d2 && !dd) : ''}
    </div>
    ${
      stats.length
        ? `<div class="record">
        <h3>Your skill record <small>first-check accuracy on unguided files</small></h3>
        <ul>${stats.map((st) => `<li><span>${gloss(SKILL_LABEL[st.skill])}</span><span class="meter" style="--v:${Math.round((st.firstTry / st.attempts) * 100)}%" aria-hidden="true"></span><span class="num">${st.firstTry}/${st.attempts}</span><em class="lvl ${masteryLevel(st.attempts, st.firstTry).toLowerCase()}">${masteryLevel(st.attempts, st.firstTry)}</em></li>`).join('')}</ul>
        <a class="btn" href="${practiceHref(newSeed(), weakestSkills(history, 2))}">Practice my weak spots</a>
      </div>`
        : ''
    }
  </section>`;
}

/** The app's own home (app.html#/): your path through the cases, today's file and your skill record. */
export function renderDesk(done: Completed, history: SkillAttempt[]): string {
  return `
  <header class="nav">
    <a class="brand" href="./" aria-label="Ledger Fix Lab, back to the main page"><span class="mark" aria-hidden="true"></span>Ledger Fix Lab</a>
    <div class="nav-right"><a class="nav-link" href="#/upgrade">Practice plan</a>${themeButton(loadTheme())}</div>
  </header>
  <main class="home desk-page">
    ${path(done, history)}
  </main>`;
}
