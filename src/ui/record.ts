import { SKILL_LABEL } from '../core/explain';
import { CURRENT_DAYS, practiceRecord } from '../core/record';
import { CASES } from '../core/scenarios';
import type { SkillAttempt } from '../core/skills';
import { basicsDone } from './basics';
import { dailyHref } from './routes';
import { esc, loadTheme, longDate, masteryLevel, themeButton, type Completed } from './util';

/**
 * The practice record page (app.html#/record). Facts from this browser, a "current" status that lapses
 * without practice, and a print button. It says plainly that it is not a certificate.
 */
const NAME_KEY = 'ledger-fix-lab:v20:record-name';
export function loadRecordName(): string {
  try { return (localStorage.getItem(NAME_KEY) ?? '').slice(0, 60); } catch { return ''; }
}
export function saveRecordName(name: string): void {
  try { localStorage.setItem(NAME_KEY, name.slice(0, 60)); } catch { /* storage blocked: the name just is not remembered */ }
}

const tick = `<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="m5 10.5 3.2 3L15 6.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function renderRecord(done: Completed, history: SkillAttempt[], now = new Date()): string {
  const r = practiceRecord({ done, history, basicsDone: basicsDone(), caseIds: CASES.map((c) => c.id), now });
  const name = loadRecordName();
  const status = r.current ? 'current' : r.complete ? 'lapsed' : 'progress';
  const todo = r.requirements.find((q) => !q.done);
  const nextHref = !todo ? dailyHref() : todo.id === 'basics' ? '#/basics' : todo.id === 'case1' ? `#/case/${CASES[0].id}` : todo.id === 'case2' ? `#/case/${CASES[1].id}` : dailyHref();
  return `
  <header class="nav">
    <a class="brand" href="./" aria-label="Ledger Fix Lab, back to the main page"><span class="mark" aria-hidden="true"></span>Ledger Fix Lab</a>
    <div class="nav-right"><a class="nav-link" href="#/">Your desk</a>${themeButton(loadTheme())}</div>
  </header>
  <main class="guide-page record-page">
    <header class="guide-head">
      <p class="drill-step">Practice record</p>
      <h1>Proof of practice, kept current</h1>
      <p class="guide-lead">What you have actually done in the trainer, in one page you can print or save as a PDF. It stays current only while you keep practising.</p>
    </header>

    <section class="rec-sheet" data-testid="record" data-status="${status}">
      <div class="rec-top">
        <div>
          <p class="rec-kicker">Ledger Fix Lab practice record, level 1: bank reconciliation basics</p>
          <label class="rec-name"><span class="sr">Your name (optional, stays in this browser)</span><input type="text" data-record-name value="${esc(name)}" placeholder="Your name (optional)" maxlength="60" autocomplete="name"></label>
        </div>
        <p class="rec-status ${status}" data-testid="record-status">${
          status === 'current'
            ? `Current through ${esc(longDate(r.currentThrough!))}`
            : status === 'lapsed'
              ? `Complete, not current: last practice ${esc(longDate(r.lastPractice!))}`
              : `In progress: ${r.requirements.filter((q) => q.done).length} of ${r.requirements.length}`
        }</p>
      </div>
      <ol class="rec-reqs">
        ${r.requirements.map((q) => `<li class="${q.done ? 'done' : ''}"><span class="rec-box">${q.done ? tick : ''}</span><span>${esc(q.label)}</span><em>${esc(q.detail)}</em></li>`).join('')}
      </ol>
      ${
        r.skills.length
          ? `<div class="rec-skills"><p class="rec-kicker">First-check accuracy on files without hints</p>
          <ul>${r.skills.map((s) => `<li><span>${esc(SKILL_LABEL[s.skill])}</span><b class="num">${s.firstTry} of ${s.attempts}</b><em class="lvl ${masteryLevel(s.attempts, s.firstTry).toLowerCase()}">${masteryLevel(s.attempts, s.firstTry)}</em></li>`).join('')}</ul></div>`
          : ''
      }
      <p class="rec-fine">Files solved without hints: ${r.unguidedSolved}. Right on the first check: ${r.firstCheckSolved}. Printed ${esc(longDate(now.toISOString().slice(0, 10)))}.</p>
      <p class="rec-fine">This is a record of practice kept in the learner's own browser. It is not a professional certification, and Ledger Fix Lab is not an accredited body. "Current" means a file was solved without hints in the last ${CURRENT_DAYS} days.</p>
    </section>

    <div class="drill-actions rec-actions">
      <a class="btn primary big" href="${nextHref}">${!todo ? "Keep it current: today's file" : `Next: ${esc(todo.label)}`}</a>
      <button type="button" class="btn big" data-act-print>Print or save as PDF</button>
    </div>
  </main>`;
}
