import { CASES } from '../core/scenarios';
import { DRILL_ROUNDS, DRILL_TOPIC, drillRounds, type DrillRound } from '../core/drill';
import { gloss } from './terms';
import { esc, loadTheme, newSeed, themeButton } from './util';

/** The warm-up drill page (app.html#/drill): five one-tap rounds, made for a phone. */
export interface DrillState {
  seed: string;
  rounds: DrillRound[];
  /** Index of the round on screen. */
  i: number;
  /** Rows tapped wrongly in this round. */
  missed: string[];
  /** The right row tapped in this round (the explanation is showing). */
  hit: string | null;
  /** Rounds answered right on the first tap. */
  firstTry: number;
  done: boolean;
}

export function newDrill(seed = newSeed()): DrillState {
  return { seed, rounds: drillRounds(seed), i: 0, missed: [], hit: null, firstTry: 0, done: false };
}

/** Apply a tap; returns the next state (never mutates). */
export function tapDrill(d: DrillState, rowId: string): DrillState {
  if (d.done || d.hit || d.missed.includes(rowId)) return d;
  const round = d.rounds[d.i];
  if (round.answers.includes(rowId)) return { ...d, hit: rowId, firstTry: d.firstTry + (d.missed.length === 0 ? 1 : 0) };
  return { ...d, missed: [...d.missed, rowId] };
}

export function nextDrill(d: DrillState): DrillState {
  if (!d.hit) return d;
  return d.i + 1 >= d.rounds.length ? { ...d, done: true } : { ...d, i: d.i + 1, missed: [], hit: null };
}

const header = () => `
  <header class="nav">
    <a class="brand" href="./" aria-label="Ledger Fix Lab, back to the main page"><span class="mark" aria-hidden="true"></span>Ledger Fix Lab</a>
    <div class="nav-right"><a class="nav-link" href="#/">Your desk</a>${themeButton(loadTheme())}</div>
  </header>`;

export function renderDrill(d: DrillState): string {
  if (d.done) {
    const all = d.firstTry === DRILL_ROUNDS;
    return `${header()}
  <main class="drill">
    <section class="drill-end" aria-live="polite">
      <p class="drill-step">Warm-up done</p>
      <h1 data-testid="drill-score">${d.firstTry} of ${DRILL_ROUNDS} on the first tap</h1>
      <p class="drill-sub">${all ? 'Clean run. The full cases hide the same mistakes among fourteen lines and a bank statement.' : 'Each miss is a habit to build. The full cases put the same mistakes among fourteen lines and a bank statement.'}</p>
      <div class="drill-actions">
        <a class="btn primary big" href="#/case/${CASES[0].id}">Start case 1</a>
        <button type="button" class="btn big" data-drill="again">Another five</button>
      </div>
      <a class="link" href="#/guide">Read the field guide: seven things to check</a>
    </section>
  </main>`;
  }
  const r = d.rounds[d.i];
  const lastMiss = d.missed[d.missed.length - 1];
  return `${header()}
  <main class="drill">
    <div class="drill-top">
      <p class="drill-step">Warm-up, ${d.i + 1} of ${d.rounds.length}<span>${esc(r.business)}</span></p>
      <div class="drill-bar" role="img" aria-label="Round ${d.i + 1} of ${d.rounds.length}">${d.rounds.map((_, k) => `<i class="${k < d.i || (k === d.i && d.hit) ? 'on' : k === d.i ? 'now' : ''}"></i>`).join('')}</div>
    </div>
    <h1 class="drill-q" data-testid="drill-prompt">${gloss(r.prompt)}</h1>
    <ol class="drill-rows">
      ${r.rows
        .map((row) => {
          const hit = d.hit !== null && r.answers.includes(row.id);
          const missed = d.missed.includes(row.id);
          return `<li><button type="button" class="drill-row ${hit ? 'is-hit' : ''} ${missed ? 'is-miss' : ''} ${row.id === lastMiss && !d.hit ? 'is-fresh' : ''}" data-drill-row="${esc(row.id)}" ${d.hit || missed ? 'disabled' : ''}>
            <span class="drill-main"><b>${esc(row.title)}</b><small>${esc(row.detail)}</small></span>
            <span class="drill-amt num">${esc(row.amount)}</span>
            <span class="drill-mark" aria-hidden="true"></span>
          </button></li>`;
        })
        .join('')}
    </ol>
    <div class="drill-say ${d.hit ? 'good' : d.missed.length ? 'warn' : ''}" role="status" aria-live="polite" data-testid="drill-say">
      ${d.hit ? `<p><b>Right.</b> ${gloss(r.why)} <a href="#/guide/${DRILL_TOPIC[r.kind]}">More in the guide</a></p><button type="button" class="btn primary big" data-drill="next">${d.i + 1 >= d.rounds.length ? 'See my score' : 'Next'}</button>` : d.missed.length ? `<p><b>Not that one.</b> ${gloss(r.nudge)}</p>` : '<p class="quiet">Tap a line. You can try again if you miss.</p>'}
    </div>
  </main>`;
}
