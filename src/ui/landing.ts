import { SKILL_LABEL } from '../core/explain';
import { generateFile, todaySeed } from '../core/generator';
import { CASES } from '../core/scenarios';
import { skillStats, weakestSkills, type SkillAttempt } from '../core/skills';
import { loadProfile, profileLink } from './account';
import { basicsDone } from './basics';
import { loadCheckRuns, monthName } from './check';
import { dailyHref, practiceHref } from './routes';
import { gloss } from './terms';
import { dailyStreak, esc, FREE_PRACTICE_FILES, FREE_TOPIC_DRILLS, loadDrillRecord, loadOpenedPractice, loadPlan, loadTheme, masteryLevel, newSeed, themeButton, weekDays, type Completed } from './util';

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
  const lock = `<svg viewBox="0 0 20 20" width="13" height="13" aria-hidden="true"><path d="M6.5 9V6.8a3.5 3.5 0 0 1 7 0V9M5 9h10v7.5H5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  const rung = (n: string, href: string, title: string, meta: string, state: 'done' | 'open' | 'locked', tag: string) => `
    <li><a class="step rung ${state === 'done' ? 'done' : ''} ${state === 'locked' ? 'locked' : ''}" href="${state === 'locked' ? '#/upgrade' : href}">
      <span class="step-n">${state === 'done' ? tick : state === 'locked' ? lock : n}</span>
      <span class="step-body"><span class="step-title">${esc(title)}</span><span class="step-meta">${esc(meta)}</span></span>
      <span class="rung-tag ${state}">${esc(state === 'done' ? 'Done' : tag)}</span>
    </a></li>`;
  const plan = loadPlan();
  const freeLeft = Math.max(0, FREE_PRACTICE_FILES - loadOpenedPractice().length);
  const zeroDone = basicsDone();
  const d1 = Boolean(done[CASES[0].id]);
  const d2 = Boolean(done[CASES[1].id]);
  const dd = daily ? Boolean(done[daily.id]) : false;
  const stats = skillStats(history).filter((st) => st.attempts > 0);
  const week = weekDays(done, day);
  const drillRec = loadDrillRecord();
  const lastRun = loadCheckRuns().pop() ?? null;
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
    ${(zeroDone || d1) && !loadProfile() ? `<a class="warm quiet" href="#/signin" data-testid="signin-nudge"><span class="warm-t"><b>Put a name on your progress</b><span>Sign in with an email. No password, and it stays on this device.</span></span><span class="btn">Sign in</span></a>` : ''}
    <a class="warm quiet" href="#/basics"><span class="warm-t"><b>Start from zero</b><span>New to bookkeeping? Five ideas in two minutes: statement, books, matching, difference, categories.</span></span><span class="btn">${basicsDone() ? 'Again' : 'Start'}</span></a>
    <a class="warm" href="#/drill"><span class="warm-t"><b>60-second warm-up</b><span>Five quick rounds: tap the line that is wrong. Good on a phone.${drillRec.runs ? ` Best: ${drillRec.best} of 5 on the first tap.` : ''}</span></span><span class="btn primary">Start</span></a>
    <a class="warm quiet" href="#/guide"><span class="warm-t"><b>Field guide</b><span>Seven things to check in any set of books: what you see, how to tell, what to do.</span></span><span class="btn">Read</span></a>
    <a class="warm quiet" href="#/check" data-testid="check-entry"><span class="warm-t"><b>Check your own books</b><span>${lastRun ? `Last check: ${esc(monthName(lastRun.month))}, ${lastRun.findings} ${lastRun.findings === 1 ? 'line' : 'lines'} to look at. Do the next month when its statement arrives.` : 'Put your bank statement next to your books. Nothing is uploaded. Sample files included.'}</span></span><span class="btn">Open</span></a>
    <a class="warm quiet" href="#/record"><span class="warm-t"><b>Practice record</b><span>Proof of what you have done, on one page you can print. It stays current while you keep practising.</span></span><span class="btn">Open</span></a>
    <h2 class="ladder-h">Your path</h2>
    <ol class="ladder" data-testid="ladder">
      ${rung('0', '#/basics', 'Start from zero', 'Five ideas in two minutes.', zeroDone ? 'done' : 'open', 'Free')}
      ${rung('1', `#/case/${CASES[0].id}`, `Practice 1: ${CASES[0].title}`, 'Guided, 6 min. Duplicates and categories.', d1 ? 'done' : 'open', 'Free')}
      ${rung('2', `#/case/${CASES[1].id}`, `Practice 2: ${CASES[1].title}`, 'Guided, 10 min. The full reconciliation.', d2 ? 'done' : 'open', 'Free')}
      ${daily ? rung('3', dailyHref(day), "Today's file", `No hints. A new client every day.${streak ? ` ${streak}-day streak.` : ''}`, dd ? 'done' : 'open', 'Free, daily') : ''}
      ${rung('4', practiceHref(newSeed(), weak), 'Practice 3: a file aimed at your weak spots', 'No hints. Built from the mistakes you miss.', plan || freeLeft > 0 ? 'open' : 'locked', plan ? 'Practice plan' : freeLeft > 0 ? `${freeLeft} free` : 'Practice plan')}
      ${rung('5', plan ? practiceHref(newSeed(), weak) : '#/upgrade', 'Practice 4 and beyond', 'Unlimited files, and your practice record stays current.', plan ? 'open' : 'locked', 'Practice plan')}
      ${rung('T', '#/guide', 'Theory and topic practice', `Seven topics. All the theory is open; practice rounds are free for ${FREE_TOPIC_DRILLS}, the other ${7 - FREE_TOPIC_DRILLS} come with the plan.`, 'open', plan ? 'All open' : `${FREE_TOPIC_DRILLS} of 7 free`)}
    </ol>
    <p class="ladder-note">Your progress is saved in this browser only. <a href="#/signin">Sign in</a> puts your name on it; accounts that follow you across devices come later.</p>
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
    <div class="nav-right"><a class="nav-link" href="#/upgrade">Practice plan</a>${profileLink(loadProfile())}${themeButton(loadTheme())}</div>
  </header>
  <main class="home desk-page">
    ${path(done, history)}
  </main>`;
}
