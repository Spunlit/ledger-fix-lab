import { BASICS } from '../core/basics';
import { CASES } from '../core/scenarios';
import { gloss } from './terms';
import { esc, loadTheme, themeButton } from './util';

/** "Start from zero" (app.html#/basics): five ideas, one tap each. Shares the drill's look. */
export interface BasicsState {
  i: number;
  missed: string[];
  hit: boolean;
  done: boolean;
}

const KEY = 'ledger-fix-lab:v18:basics-done';
export function basicsDone(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}
function markDone(): void {
  try { localStorage.setItem(KEY, '1'); } catch { /* storage blocked: the lesson can simply be taken again */ }
}

export const newBasics = (): BasicsState => ({ i: 0, missed: [], hit: false, done: false });

export function tapBasics(s: BasicsState, id: string): BasicsState {
  if (s.done || s.hit || s.missed.includes(id)) return s;
  return id === BASICS[s.i].answer ? { ...s, hit: true } : { ...s, missed: [...s.missed, id] };
}

export function nextBasics(s: BasicsState): BasicsState {
  if (!s.hit) return s;
  if (s.i + 1 >= BASICS.length) {
    markDone();
    return { ...s, done: true };
  }
  return { i: s.i + 1, missed: [], hit: false, done: false };
}

const header = () => `
  <header class="nav">
    <a class="brand" href="./" aria-label="Ledger Fix Lab, back to the main page"><span class="mark" aria-hidden="true"></span>Ledger Fix Lab</a>
    <div class="nav-right"><a class="nav-link" href="#/">Your desk</a>${themeButton(loadTheme())}</div>
  </header>`;

export function renderBasics(s: BasicsState): string {
  if (s.done) {
    return `${header()}
  <main class="drill">
    <section class="drill-end" aria-live="polite">
      <p class="drill-step">Start from zero: done</p>
      <h1 data-testid="basics-done">You know the five ideas</h1>
      <p class="drill-sub">A bank statement, the books, matching, the difference, categories. A full case uses exactly these, on fourteen lines, with a coach beside you.</p>
      <div class="drill-actions">
        <a class="btn primary big" href="#/case/${CASES[0].id}">Start case 1</a>
        <a class="btn big" href="#/drill">60-second warm-up</a>
      </div>
      <a class="link" href="#/guide">Read the field guide: seven things to check</a>
    </section>
  </main>`;
  }
  const st = BASICS[s.i];
  const lastMiss = s.missed[s.missed.length - 1];
  return `${header()}
  <main class="drill basics">
    <div class="drill-top">
      <p class="drill-step">Start from zero, ${s.i + 1} of ${BASICS.length}<span>No experience needed</span></p>
      <div class="drill-bar" role="img" aria-label="Step ${s.i + 1} of ${BASICS.length}">${BASICS.map((_, k) => `<i class="${k < s.i || (k === s.i && s.hit) ? 'on' : k === s.i ? 'now' : ''}"></i>`).join('')}</div>
    </div>
    <div class="basics-teach">
      <h1 class="basics-t" data-testid="basics-title">${esc(st.title)}</h1>
      <p class="basics-x">${gloss(st.explain)}</p>
    </div>
    ${
      st.context
        ? `<div class="basics-ctx"><p>${esc(st.context.label)}</p>${st.context.lines.map((l) => `<div><span>${esc(l.text)}</span><b class="num">${esc(l.amount)}</b></div>`).join('')}</div>`
        : ''
    }
    <p class="basics-q" data-testid="basics-prompt">${esc(st.prompt)}</p>
    <ol class="drill-rows">
      ${st.options
        .map((o) => {
          const hit = s.hit && o.id === st.answer;
          const missed = s.missed.includes(o.id);
          return `<li><button type="button" class="drill-row ${hit ? 'is-right' : ''} ${missed ? 'is-wrong' : ''} ${o.id === lastMiss && !s.hit ? 'is-fresh' : ''}" data-basics-pick="${esc(o.id)}" ${s.hit || missed ? 'disabled' : ''}>
            <span class="drill-main"><b>${esc(o.title)}</b>${o.detail ? `<small>${esc(o.detail)}</small>` : ''}</span>
            <span class="drill-amt num">${esc(o.amount ?? '')}</span>
            <span class="drill-mark" aria-hidden="true"></span>
          </button></li>`;
        })
        .join('')}
    </ol>
    <div class="drill-say ${s.hit ? 'good' : s.missed.length ? 'warn' : ''}" role="status" aria-live="polite" data-testid="basics-say">
      ${s.hit ? `<p><b>Right.</b> ${gloss(st.right.replace(/^(Yes|Right)[.:]\s*/, ''))}</p><button type="button" class="btn primary big" data-basics="next">${s.i + 1 >= BASICS.length ? 'Finish' : 'Next idea'}</button>` : s.missed.length ? `<p><b>Not quite.</b> ${gloss(st.nudge)}</p>` : '<p class="quiet">Tap an answer. You can try again if you miss.</p>'}
    </div>
  </main>`;
}
