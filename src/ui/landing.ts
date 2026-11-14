import { SKILL_LABEL } from '../core/explain';
import { generateFile, todaySeed } from '../core/generator';
import { CASES } from '../core/scenarios';
import { skillStats, weakestSkills, type SkillAttempt } from '../core/skills';
import { dailyHref, practiceHref } from './routes';
import { dailyStreak, esc, loadTheme, newSeed, themeButton, type Completed } from './util';

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
  return `
  <section class="path-sec" id="practice" aria-labelledby="path-h">
    <h1 id="path-h">Your practice desk</h1>
    <p class="path-sub">Two guided cases, then a new file every day. Your skill record appears after the first file without hints.</p>
    <div class="path">
      ${step('1', `#/case/${CASES[0].id}`, CASES[0].title, 'Guided, 6 min. Duplicates and categories.', d1, !d1)}
      ${step('2', `#/case/${CASES[1].id}`, CASES[1].title, 'Guided, 10 min. The full reconciliation.', d2, d1 && !d2)}
      ${daily ? step('3', dailyHref(day), "Today's file", `No hints. A new client every day.${streak ? ` <b>${streak}-day streak</b>` : ''}`, dd, d1 && d2 && !dd) : ''}
    </div>
    ${
      stats.length
        ? `<div class="record">
        <h3>Your skill record <small>first-check accuracy on unguided files</small></h3>
        <ul>${stats.map((st) => `<li><span>${esc(SKILL_LABEL[st.skill])}</span><span class="meter" style="--v:${Math.round((st.firstTry / st.attempts) * 100)}%" aria-hidden="true"></span><span class="num">${st.firstTry}/${st.attempts}</span></li>`).join('')}</ul>
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
