import { CATEGORIES, category } from '../core/categories';
import { clues } from '../core/clues';
import { canUndo, checkAll, initialState, isLocked, statementLines, type CheckReport } from '../core/engine';
import { explain, shortDate, SKILL_LABEL } from '../core/explain';
import { coachStep, type CoachStep } from '../core/coach';
import { guideTopic } from '../core/guide';
import { gloss } from './terms';
import { progress, type Feedback, type Progress } from '../core/feedback';
import { MATCH_WINDOW_DAYS, matchRows, type RowMatch } from '../core/match';
import { formatCents, formatSignedCents } from '../core/money';
import { cleanupReport } from '../core/report';
import { CASES } from '../core/scenarios';
import { weakestSkills } from '../core/skills';
import { ALL_TOOLS, type CategoryId, type LedgerEntry, type LedgerState, type Scenario, type Session, type SkillId, type StatementLine, type Tool } from '../core/types';
import { dailyHref, practiceHref } from './routes';
import { centsToPlain, esc, loadHistory, loadTheme, newSeed, themeButton } from './util';

/** Per-file UI state. All ledger logic lives in ../core. */
export interface CaseUI {
  session: Session;
  checked: boolean;
  checksRun: number;
  noteOpen: boolean;
  mathOpen: boolean;
  hintOpen: boolean;
  guideOpen: boolean;
  editing: string | null;
  editError: string | null;
  recording: string | null;
  /** UTC day for a file of the day. */
  day?: string;
  /** Skill outcomes of the first check (unguided files only). */
  firstCheck: Partial<Record<SkillId, boolean>> | null;
  /** Instant feedback on the last action (guided cases only). */
  feedback: Feedback | null;
}

export function newCaseUI(session: Session, day?: string): CaseUI {
  return {
    session, checked: false, checksRun: 0, noteOpen: false, mathOpen: false, hintOpen: false, guideOpen: false,
    editing: null, editError: null, recording: null, day, firstCheck: null, feedback: null,
  };
}

export const isGuided = (s: Scenario) => s.kind === 'case';
const toolsOf = (s: Scenario): Set<Tool> => new Set(s.tools ?? ALL_TOOLS);

function badgeText(ui: CaseUI): string {
  const s = ui.session.scenario;
  return s.kind === 'daily' && ui.day ? `File of the day, ${shortDate(ui.day)}` : s.badge;
}

/** Plain-text result to share (no answers in it). */
export function shareText(ui: CaseUI, url: string, streak = 0): string {
  const s = ui.session.scenario;
  const fc = Object.values(ui.firstCheck ?? {});
  return [
    `Ledger Fix Lab: ${badgeText(ui)} (${s.business}, ${s.period})`,
    `Reconciled and right. Checks run: ${ui.checksRun}.${fc.length ? ` First check: ${fc.filter(Boolean).length} of ${fc.length} skills clean.` : ''}${streak > 1 ? ` ${streak}-day streak.` : ''}`,
    url,
  ].join('\n');
}

const ICON = {
  trash: `<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M7 3h6m-9 3h12m-1.5 0-.7 10.1a1.5 1.5 0 0 1-1.5 1.4H7.7a1.5 1.5 0 0 1-1.5-1.4L5.5 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  plus: `<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M10 4v12M4 10h12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  back: `<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M12 4 6 10l6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  link: `<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M8.6 11.4a3 3 0 0 0 4.2 0l2.5-2.5a3 3 0 0 0-4.2-4.2l-1 1m1.3 2.9a3 3 0 0 0-4.2 0l-2.5 2.5a3 3 0 0 0 4.2 4.2l1-1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  reset: `<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M4.5 10a5.5 5.5 0 1 0 1.8-4.1M4 3.5v3h3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  check: `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="m5 10.5 3.2 3L15 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

function categorySelect(attr: string, value: CategoryId | null, label: string): string {
  const opts = (kind: string) =>
    CATEGORIES.filter((c) => c.kind === kind)
      .map((c) => `<option value="${c.id}" ${c.id === value ? 'selected' : ''}>${esc(c.name)}</option>`)
      .join('');
  return `<select ${attr} aria-label="${esc(label)}">
    ${value === null ? '<option value="" selected disabled>Choose a category</option>' : ''}
    <optgroup label="Income">${opts('income')}</optgroup>
    <optgroup label="Expenses">${opts('expense')}</optgroup>
    <optgroup label="Owner's money (not profit or loss)">${opts('equity')}</optgroup>
  </select>`;
}

/** One line of the guided reconcile table: a books row, a bank line, or the two paired up. */
interface PairRow {
  entry: LedgerEntry | null;
  line: StatementLine | null;
}

/**
 * Lays the books and the statement out as one list in date order. A matched row shares a line with its
 * bank line; a row with no bank match, or a bank line with nothing in the books, stands alone.
 */
function pairRows(entries: LedgerEntry[], lines: StatementLine[], m: RowMatch): PairRow[] {
  const lineById = new Map(lines.map((l) => [l.txnId, l]));
  const rows: (PairRow & { date: string; seq: number })[] = entries.map((entry, seq) => {
    const lineId = m.entryMatch.get(entry.entryId) ?? null;
    return { entry, line: lineId === null ? null : lineById.get(lineId) ?? null, date: entry.date, seq };
  });
  lines
    .filter((l) => (m.lineMatch.get(l.txnId) ?? null) === null)
    .forEach((line, i) => rows.push({ entry: null, line, date: line.date, seq: entries.length + i }));
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.seq - b.seq).map(({ entry, line }) => ({ entry, line }));
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The single "what to do next" line. Guided cases point at the unmatched lines; exam files give nothing away. */
function coachText(report: CheckReport, pairs: PairRow[] | null): string {
  if (!pairs) return 'No hints and no suggested matches in this file. Fix everything you find, then check the books.';
  if (report.ok) return 'Everything checks out. Press Check the books to confirm.';
  const d = report.recon.differenceCents;
  const notInBooks = pairs.filter((p) => !p.entry).length;
  const unmatched = pairs.filter((p) => !p.entry || !p.line).length;
  if (d !== 0) {
    const gap = `The books are ${formatCents(Math.abs(d))} away from the bank.`;
    if (unmatched === 0) return `${gap} Every line has a match, so look at the Cleared ticks.`;
    return `${gap} Start with the ${unmatched === 1 ? 'one line that has' : `${unmatched} lines that have`} no match.`;
  }
  if (notInBooks > 0) return `The difference is $0.00, but ${plural(notInBooks, 'bank line is', 'bank lines are')} not in the books. Balanced isn't the same as right.`;
  return "The difference is $0.00, but something is still wrong. Read the client's note and check the categories.";
}

/**
 * What the previous render of a guided case showed. The page is redrawn from scratch on every action,
 * so this is how the next render knows which rows just found their bank line (they flash once) and
 * whether a progress dot was just earned. Presentation only: it never feeds back into the ledger.
 */
let shown: { scenarioId: string; state: LedgerState; matched: Set<string>; fixed: number } | null = null;

/** Everything a row needs to draw itself. */
interface View {
  ui: CaseUI;
  tools: Set<Tool>;
  /** Number of table columns on the books side. */
  bookCols: number;
  /** Rows and bank lines the open hint points at. */
  hintEntries: Set<string>;
  hintLines: Set<string>;
  /** Rows and bank lines the coach's current step is about (guided cases). */
  coachEntries: Set<string>;
  coachLines: Set<string>;
  /** After a check: the cell that fails, per row. Empty before the first check. */
  badAmount: Set<string>;
  badCategory: Set<string>;
  badCleared: Set<string>;
  /** Bank lines the user has added to the books from the statement. */
  recorded: Set<string>;
  /** Rows that became matched with the action just taken. */
  joined: Set<string>;
}

interface NextStep {
  href: string;
  label: string;
}

/** Where a finished file leads: the next case, then today's file, then weak-spot practice. */
function nextStep(s: Scenario): NextStep {
  const next = CASES.find((c) => c.number === s.number + 1);
  if (s.kind === 'case' && next) return { href: `#/case/${next.id}`, label: 'Next case' };
  if (s.kind === 'case') return { href: dailyHref(), label: "Try today's file, no hints" };
  return { href: practiceHref(newSeed(), weakestSkills(loadHistory(), 2)), label: 'Practice my weak spots' };
}

export function renderWorkbench(ui: CaseUI): string {
  const { scenario: s, state } = ui.session;
  const report = checkAll(s, state);
  const r = report.recon;
  const guided = isGuided(s);
  const tools = toolsOf(s);
  const lines = statementLines(s);
  const cl = clues(s, state);
  const showHint = guided && ui.hintOpen && cl.length > 0;
  const solved = ui.checked && report.ok;
  const step: CoachStep | null = guided && !solved ? coachStep(s, state, report) : null;
  const prog = guided ? progress(s, initialState(s), state) : null;
  const hasOutstanding = r.outstandingPaymentsCents !== 0 || r.depositsInTransitCents !== 0;
  const teaser = s.note.paragraphs[1] ?? s.note.paragraphs[0];
  const next = nextStep(s);
  // Suggested matches are a guided-case aid. Exam files show the two raw lists.
  const pairs = guided ? pairRows(state.entries, lines, matchRows(s, state)) : null;
  const matchedNow = new Set((pairs ?? []).filter((p) => p.entry && p.line).map((p) => p.entry!.entryId));
  const before = shown && shown.scenarioId === s.id && shown.state !== state ? shown : null;
  const joined = new Set(before ? [...matchedNow].filter((id) => !before.matched.has(id)) : []);
  const earnedDot = Boolean(before && prog && prog.fixed > before.fixed);
  shown = guided ? { scenarioId: s.id, state, matched: matchedNow, fixed: prog?.fixed ?? 0 } : null;
  const failing = (list: { entry: LedgerEntry }[]) => new Set(ui.checked ? list.map((w) => w.entry.entryId) : []);
  const view: View = {
    ui,
    tools,
    bookCols: 4 + (tools.has('cleared') ? 1 : 0),
    hintEntries: new Set(showHint ? cl.flatMap((c) => c.entryIds) : []),
    hintLines: new Set(showHint ? cl.flatMap((c) => c.txnIds) : []),
    coachEntries: new Set(step?.entryIds ?? []),
    coachLines: new Set(step?.txnIds ?? []),
    badAmount: failing(report.amounts.wrong),
    badCategory: failing(report.categories.wrong),
    badCleared: failing(report.cleared.wrong),
    recorded: new Set(state.entries.filter((e) => e.source === 'Added from statement').map((e) => e.txnId)),
    joined,
  };
  const guide = `<button type="button" class="link small guide-toggle" data-act="toggle-guide" aria-expanded="${ui.guideOpen}">${ui.guideOpen ? 'Hide category guide' : 'Category guide'}</button>`;
  const guideList = ui.guideOpen ? `<dl class="guide">${CATEGORIES.map((c) => `<div><dt>${esc(c.name)}</dt><dd>${esc(c.rule)}</dd></div>`).join('')}</dl>` : '';

  return `
  <header class="wb-top">
    <a class="back" href="#/" aria-label="Back to home">${ICON.back}<span class="mark" aria-hidden="true"></span></a>
    <div class="wb-title">
      <span class="badge ${guided ? '' : 'exam'}">${esc(badgeText(ui))}</span>
      <h1>${esc(s.kind === 'case' ? s.title : s.business)}</h1>
      <span class="wb-sub">${esc(s.kind === 'case' ? `${s.business}, ${s.period}` : s.period)}</span>
    </div>
    <button type="button" class="btn ghost small reset" data-act="reset" ${canUndo(ui.session) ? '' : 'disabled'} aria-label="Start over" title="Start over">${ICON.reset}<span>Start over</span></button>
    ${themeButton(loadTheme())}
  </header>

  <main class="bench">
    <section class="status" aria-label="Reconciliation" aria-live="polite">
      <div class="figs">
        <div class="fig"><span class="fig-label">Bank${hasOutstanding ? '<small> after <button type="button" class="term" data-term="cleared">uncleared</button> items</small>' : ''}</span><strong class="num">${formatCents(r.adjustedBankCents)}</strong></div>
        <span class="op" aria-hidden="true">−</span>
        <div class="fig"><span class="fig-label">Books</span><strong class="num">${formatCents(r.bookBalanceCents)}</strong></div>
        <span class="op" aria-hidden="true">=</span>
        <div class="fig diff ${report.balanced ? 'zero' : 'off'} ${before ? 'tick' : ''}" data-testid="difference"><span class="fig-label"><button type="button" class="term" data-term="difference">Difference</button></span><strong class="num">${formatSignedCents(r.differenceCents)}</strong></div>
      </div>
      <button type="button" class="math-toggle" data-act="toggle-math" aria-expanded="${ui.mathOpen}" aria-controls="math"><span class="q" aria-hidden="true">?</span><span class="lbl">${ui.mathOpen ? 'Hide the math' : 'How is this calculated?'}</span></button>
    </section>
    ${
        ui.mathOpen
          ? `<p class="math" id="math">Statement ending ${formatCents(r.statementEndingCents)} − outstanding payments ${formatCents(-r.outstandingPaymentsCents)} + deposits in transit ${formatCents(r.depositsInTransitCents)} = adjusted bank ${formatCents(r.adjustedBankCents)}. Books: opening ${formatCents(s.openingBalanceCents)} plus every row = ${formatCents(r.bookBalanceCents)}. Unticked rows are the outstanding items.</p>`
          : ''
      }

    <section class="coach ${solved ? 'is-done' : ''}" aria-live="polite">
      ${
        solved
          ? ''
          : step && prog
            ? `<div class="next step-${step.kind}" data-testid="coach"><span class="next-n">${step.kind === 'done' ? 'Done' : `Problem ${Math.min(prog.fixed + 1, prog.total)} of ${prog.total}`}</span><p class="next-t">${gloss(step.title)}</p><p class="next-a">${gloss(step.action)}${step.entryIds.length + step.txnIds.length ? ' <button type="button" class="link" data-act="show-target">Show me the row</button>' : ''}</p>${step.topic ? `<details class="why"><summary>Why?</summary><p>${gloss(guideTopic(step.topic).why)}</p><p><b>How to tell:</b> ${gloss(guideTopic(step.topic).tell)} <a href="#/guide/${step.topic}">Open the guide</a></p></details>` : ''}</div>`
            : `<p class="next">${esc(coachText(report, pairs))}</p>`
      }
      ${guided && cl.length ? `<button type="button" class="btn small" data-act="toggle-hint" aria-expanded="${ui.hintOpen}">${ui.hintOpen ? 'Hide hint' : 'Hint'}</button>` : ''}
      ${showHint ? `<p class="hint">${gloss(cl[0].text)}</p>` : ''}
    </section>

    <aside class="note-strip ${ui.noteOpen ? 'open' : ''}" aria-label="Note from the client">
      <p><b>${esc(s.note.from.split(',')[0])}:</b> ${ui.noteOpen ? '' : `“${esc(teaser)}”`}</p>
      ${ui.noteOpen ? s.note.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('') : ''}
      <button type="button" class="link small" data-act="toggle-note" aria-expanded="${ui.noteOpen}">${ui.noteOpen ? 'Hide note' : 'Read the full note'}</button>
    </aside>

    ${ui.checked ? (solved ? renderSolved(ui, report, next) : renderReview(report)) : ''}

    ${pairs ? renderPairs(view, s, pairs, r.bookBalanceCents, guide, guideList) : renderLists(view, s, state.entries, lines, guide, guideList)}
  </main>

  ${renderDock(ui, prog, solved, next, earnedDot)}`;
}

// ---------------------------------------------------------------- guided cases: books and bank, paired

function renderPairs(v: View, s: Scenario, pairs: PairRow[], bookBalanceCents: number, guide: string, guideList: string): string {
  const matched = pairs.filter((p) => p.entry && p.line).length;
  const open = pairs.length - matched;
  const clr = v.tools.has('cleared');
  const balance = (cls: string, books: string, bookCents: number, bank: string, bankCents: number) =>
    `<tr class="bal ${cls}">${clr ? '<td class="bk c-clr"></td>' : ''}<td class="bk c-desc">${books}</td><td class="bk c-amt r num">${formatCents(bookCents)}</td><td class="bk" colspan="2"></td><td class="c-link"></td><td class="st s-desc">${bank}</td><td class="st s-amt r num">${formatCents(bankCents)}</td></tr>`;
  return `
  <section class="recon" aria-labelledby="recon-h">
    <div class="desk-head">
      <h2 id="recon-h">Books and bank, line by line</h2>
      <span class="counts"><span class="count ${open ? 'open' : ''}">${open} to review</span><span class="count">${matched} matched</span></span>
      ${guide}
    </div>
    <p class="match-note">Unmatched isn't always wrong (an uncleared check is unmatched on purpose). Matched isn't always right (check categories).</p>
    ${guideList}
    <table class="rows pairs ${clr ? 'with-clr' : ''}">
      <thead><tr>
        ${clr ? '<th class="c-clr"><button type="button" class="term" data-term="cleared">Cleared</button></th>' : ''}<th>In the books</th><th class="r">Amount</th><th>Category</th><th><span class="sr">Delete</span></th>
        <th class="c-link"><span class="sr">Match</span></th>
        <th class="st">On the bank statement</th><th class="st r">Amount</th>
      </tr></thead>
      <tbody>
        ${balance('first', 'Opening balance', s.openingBalanceCents, 'Beginning balance', s.openingBalanceCents)}
        ${pairs.map((p) => renderPair(v, p)).join('')}
        ${balance('total', 'Books balance', bookBalanceCents, 'Ending balance', s.statementEndingBalanceCents)}
      </tbody>
    </table>
  </section>`;
}

function renderPair(v: View, { entry: e, line: l }: PairRow): string {
  const hint = `${e && v.hintEntries.has(e.entryId) ? 'hl-b' : ''} ${l && v.hintLines.has(l.txnId) ? 'hl-k' : ''} ${(e && v.coachEntries.has(e.entryId)) || (l && v.coachLines.has(l.txnId)) ? 'co-t' : ''}`;
  if (e && l) {
    return `<tr class="pair matched ${v.joined.has(e.entryId) ? 'joined' : ''} ${rowState(v, e)} ${hint}" data-entry="${esc(e.entryId)}" data-line="${esc(l.txnId)}" data-amt="${e.amountCents}">
      ${bookCells(v, e)}
      <td class="c-link" title="Matched: same amount, dates within ${MATCH_WINDOW_DAYS} days"><span class="lk">${ICON.link}</span><span class="sr">Matched</span></td>
      ${bankCells(l, true, v.tools.has('cleared') && !e.cleared ? 'On the statement, but not ticked as cleared' : '')}
    </tr>`;
  }
  if (e) {
    // Worded from the tick the user can see, not from the answer.
    const why = !v.tools.has('cleared') ? '' : e.cleared ? 'Ticked, but not on the statement' : 'Unticked, so it counts as outstanding';
    return `<tr class="pair only-books ${rowState(v, e)} ${hint}" data-entry="${esc(e.entryId)}" data-amt="${e.amountCents}">
      ${bookCells(v, e)}
      <td class="c-link"></td>
      <td class="st s-gap" colspan="2"><span class="gap-label">No bank match</span>${why ? `<span class="gap-why">${gloss(why)}</span>` : ''}</td>
    </tr>`;
  }
  if (!l) return '';
  const recording = v.ui.recording === l.txnId;
  return `<tr class="pair only-bank ${recording ? 'is-recording' : ''} ${hint}" data-line="${esc(l.txnId)}" data-amt="${l.amountCents}">
    <td class="bk c-gap" colspan="${v.bookCols}">${
      recording
        ? recordForm(l)
        : `<span class="gap-label">Not in books</span>${v.tools.has('record') ? `<button type="button" class="btn small add" data-record="${esc(l.txnId)}" aria-expanded="false" aria-label="Add ${esc(l.description)} to the books">${ICON.plus}Add to the books</button>` : ''}`
    }</td>
    <td class="c-link"></td>
    ${bankCells(l, false)}
  </tr>`;
}

// ---------------------------------------------------------------- exam files: two raw lists, no matching

function renderLists(v: View, s: Scenario, entries: LedgerEntry[], lines: StatementLine[], guide: string, guideList: string): string {
  const clr = v.tools.has('cleared');
  const rec = v.tools.has('record');
  const balance = (label: string, cents: number, cls: string) =>
    `<tr class="bal ${cls}"><td class="st s-desc">${label}</td><td class="st s-amt r num">${formatCents(cents)}</td>${rec ? '<td class="st s-rec"></td>' : ''}</tr>`;
  return `
  <div class="desk">
    <section class="books" aria-labelledby="books-h">
      <div class="desk-head"><h2 id="books-h">Books</h2>${guide}</div>
      ${guideList}
      <table class="rows ledger ${clr ? 'with-clr' : ''}">
        <thead><tr>${clr ? '<th class="c-clr"><button type="button" class="term" data-term="cleared">Cleared</button></th>' : ''}<th>Description</th><th class="r">Amount</th><th>Category</th><th><span class="sr">Delete</span></th></tr></thead>
        <tbody>${
          entries.length
            ? entries.map((e) => `<tr class="${rowState(v, e)}" data-entry="${esc(e.entryId)}" data-amt="${e.amountCents}">${bookCells(v, e)}</tr>`).join('')
            : `<tr class="empty"><td colspan="${v.bookCols}">The books are empty. Undo, or add lines from the statement.</td></tr>`
        }</tbody>
      </table>
    </section>

    <section class="statement" aria-labelledby="stmt-h">
      <div class="desk-head"><h2 id="stmt-h">Bank statement</h2></div>
      <table class="rows stmt">
        <thead><tr><th class="st">Description</th><th class="st r">Amount</th>${rec ? '<th class="st"><span class="sr">Add to the books</span></th>' : ''}</tr></thead>
        <tbody>
          ${balance('Beginning balance', s.openingBalanceCents, 'first')}
          ${lines
            .map((l) => {
              const recording = v.ui.recording === l.txnId;
              const action = v.recorded.has(l.txnId)
                ? '<span class="tag">Added</span>'
                : `<button type="button" class="icon-btn" data-record="${esc(l.txnId)}" aria-expanded="${recording}" aria-label="Add ${esc(l.description)} to the books" title="Add to the books">${ICON.plus}</button>`;
              return `<tr data-line="${esc(l.txnId)}" data-amt="${l.amountCents}">${bankCells(l, false)}${rec ? `<td class="st s-rec">${action}</td>` : ''}</tr>
                ${recording ? `<tr class="record-row"><td class="st" colspan="3">${recordForm(l)}</td></tr>` : ''}`;
            })
            .join('')}
          ${balance('Ending balance', s.statementEndingBalanceCents, 'total')}
        </tbody>
      </table>
    </section>
  </div>`;
}

// ---------------------------------------------------------------- cells shared by both layouts

/** Row classes that depend on the books row alone: flagged by the last check, or being edited. */
function rowState(v: View, e: LedgerEntry): string {
  const flagged = v.badAmount.has(e.entryId) || v.badCategory.has(e.entryId) || v.badCleared.has(e.entryId);
  return `${flagged ? 'flag' : ''} ${v.ui.editing === e.entryId ? 'is-editing' : ''}`;
}

/** The books side of a row: tick, description, amount, category, delete. */
function bookCells(v: View, e: LedgerEntry): string {
  const { ui, tools } = v;
  const id = esc(e.entryId);
  const locked = isLocked(e);
  const label = `${e.description}, ${shortDate(e.date)}`;
  const sign = e.amountCents > 0 ? 'in' : '';
  const source = e.source === 'Manual entry' ? '<span class="tag manual">Typed by hand</span>' : locked ? '<span class="tag">Added from statement</span>' : '';
  const tick = tools.has('cleared')
    ? `<td class="bk c-clr"><label class="tick ${v.badCleared.has(e.entryId) ? 'bad' : ''}" ${locked ? 'title="Added from the statement, so it has cleared"' : ''}><input type="checkbox" data-clear="${id}" ${e.cleared ? 'checked' : ''} ${locked ? 'disabled' : ''} aria-label="Cleared: ${esc(label)}"><span aria-hidden="true"></span></label></td>`
    : '';
  const desc = `<td class="bk c-desc"><span class="d-main">${esc(e.description)}</span><span class="d-meta"><span class="d-date">${shortDate(e.date)}</span>${source}</span></td>`;
  if (ui.editing === e.entryId) {
    // The form takes the place of the amount, category and delete cells until it is saved or cancelled.
    return `${tick}${desc}<td class="bk c-amt" colspan="3">
      <form class="amt-form" data-amt-form="${id}">
        <span aria-hidden="true">${e.amountCents < 0 ? '−$' : '$'}</span>
        <input name="amt" inputmode="decimal" autocomplete="off" value="${centsToPlain(e.amountCents)}" aria-label="New amount for ${esc(label)}" ${ui.editError ? 'aria-invalid="true"' : ''}>
        <button type="submit" class="btn primary small">Save</button><button type="button" class="link small" data-act="cancel-edit">Cancel</button>
        ${ui.editError ? `<span class="err" role="alert">${esc(ui.editError)}</span>` : ''}
      </form></td>`;
  }
  const bad = v.badAmount.has(e.entryId) ? 'bad' : '';
  const amount =
    tools.has('amount') && !locked
      ? `<button type="button" class="amt ${sign} ${bad}" data-edit="${id}" aria-label="Edit amount ${formatSignedCents(e.amountCents)} for ${esc(label)}" title="Click to correct the amount">${formatSignedCents(e.amountCents)}</button>`
      : `<span class="num ${sign} ${bad}">${formatSignedCents(e.amountCents)}</span>`;
  return `${tick}${desc}
    <td class="bk c-amt r">${amount}</td>
    <td class="bk c-cat ${v.badCategory.has(e.entryId) ? 'bad' : ''}"><span class="m-date">${shortDate(e.date)}</span>${tools.has('category') ? categorySelect(`data-cat="${id}"`, e.category, `Category for ${label}`) : esc(category(e.category).name)}</td>
    <td class="bk c-del">${tools.has('delete') ? `<button type="button" class="icon-btn del" data-del="${id}" aria-label="Delete ${esc(label)}" title="Delete">${ICON.trash}</button>` : ''}</td>`;
}

/** The bank side of a row: the statement text and amount exactly as printed. Read-only. */
function bankCells(l: StatementLine, matched: boolean, cue = ''): string {
  return `<td class="st s-desc"><div class="s-in">${matched ? `<span class="m-link">${ICON.link}</span>` : ''}<span class="s-date">${shortDate(l.date)}</span><span class="s-text"><span class="d-main bankdesc">${esc(l.description)}</span>${cue ? `<span class="cue">${cue}</span>` : ''}</span></div></td>
    <td class="st s-amt r num ${l.amountCents > 0 ? 'in' : ''}">${formatSignedCents(l.amountCents)}</td>`;
}

function recordForm(l: StatementLine): string {
  return `<form class="record-form" data-record-form="${esc(l.txnId)}">
    <span>Add ${formatSignedCents(l.amountCents)} to the books as</span>
    ${categorySelect('name="cat" required', null, 'Category for the recorded line')}
    <button type="submit" class="btn primary small">Add</button>
    <button type="button" class="link small" data-act="cancel-record">Cancel</button>
  </form>`;
}

// ---------------------------------------------------------------- bottom action bar

/** Lesson-style bar pinned to the bottom: progress, feedback on the last move, Undo, and the one primary action. */
function renderDock(ui: CaseUI, prog: Progress | null, solved: boolean, next: NextStep, earnedDot: boolean): string {
  const fb = solved ? null : ui.feedback;
  const status = solved
    ? `<p class="dock-status done">${ICON.check}<span>Reconciled and right</span></p>`
    : prog
      ? `<div class="prog" role="img" aria-label="${prog.fixed} of ${prog.total} problems fixed"><span class="dots">${Array.from({ length: prog.total }, (_, i) => `<i class="${i < prog.fixed ? 'on' : ''} ${earnedDot && i === prog.fixed - 1 ? 'pop' : ''}"></i>`).join('')}</span><span class="prog-text">${prog.fixed} of ${prog.total}<span class="wide"> fixed</span></span></div>`
      : '<p class="dock-status"><span>No hints<span class="wide"> until you check</span></span></p>';
  return `
  <footer class="dock ${solved ? 'is-solved' : ''}" aria-label="Case actions">
    <div class="dock-in">
      ${status}
      ${fb ? `<p class="toast ${fb.tone}" role="status" data-testid="feedback">${esc(fb.text)}</p>` : ''}
      <div class="dock-actions">
        <button type="button" class="btn ghost ${fb?.tone === 'warn' ? 'nudge' : ''}" data-act="undo" ${canUndo(ui.session) ? '' : 'disabled'}>Undo</button>
        ${solved ? `<a class="btn primary" href="${next.href}">${esc(next.label)}</a>` : '<button type="button" class="btn primary" data-act="check">Check the books</button>'}
      </div>
    </div>
  </footer>`;
}

// ---------------------------------------------------------------- after a check

function renderReview(report: CheckReport): string {
  const ex = explain(report);
  const rows: [string, string, boolean, string[]][] = [
    ['integrity', 'Each transaction recorded exactly once', report.integrity.ok, ex.integrity],
    ['amounts', 'Amounts match the bank', report.amounts.ok, ex.amounts],
    ['cleared', 'Cleared items ticked correctly', report.cleared.ok, ex.cleared],
    ['categories', 'Categories right', report.categories.ok, ex.categories],
  ];
  const failing = rows.filter((x) => !x[2]);
  const marked = report.amounts.wrong.length + report.cleared.wrong.length + report.categories.wrong.length > 0;
  const verdict = report.balanced
    ? `The difference is $0.00, but ${failing.length === 1 ? 'one check fails' : `${failing.length} checks fail`}. Balanced isn't the same as right.`
    : `Not yet: ${formatSignedCents(report.recon.differenceCents)} to go, and ${failing.length === 1 ? 'one check fails' : `${failing.length} checks fail`}.`;
  const { booked, correct } = report.categories;
  const gap = booked.netIncomeCents - correct.netIncomeCents;
  const max = Math.max(Math.abs(booked.netIncomeCents), Math.abs(correct.netIncomeCents), 1);
  const bars =
    gap !== 0
      ? `<div class="pnl" aria-label="Net profit as booked versus correct">
        <p class="pnl-head">Profit ${gap > 0 ? 'overstated' : 'understated'} by ${formatCents(Math.abs(gap))}</p>
        <div class="pnl-row"><span>As booked</span><span class="pbar bad" style="--w:${Math.round((Math.abs(booked.netIncomeCents) / max) * 100)}%"></span><b class="num">${formatCents(booked.netIncomeCents)}</b></div>
        <div class="pnl-row"><span>Correct</span><span class="pbar good" style="--w:${Math.round((Math.abs(correct.netIncomeCents) / max) * 100)}%"></span><b class="num">${formatCents(correct.netIncomeCents)}</b></div>
      </div>`
      : '';
  return `
  <section class="review" aria-live="polite" aria-labelledby="review-h">
    ${report.balanced ? '<span class="stamp-inline bad">Balanced, but wrong</span>' : ''}
    <h2 id="review-h">${esc(verdict)}</h2>
    ${bars}
    <ul class="checks">
      ${rows
        .map(
          ([key, title, ok, lines]) => `
        <li class="check ${ok ? 'pass' : 'fail'}" data-testid="check-${key}">
          <h3><span class="dot" aria-hidden="true"></span>${title}<span class="st">${ok ? 'Pass' : 'Fix needed'}</span></h3>
          ${ok ? '' : `<ul>${lines.map((l) => `<li>${gloss(l)}</li>`).join('')}</ul>`}
        </li>`,
        )
        .join('')}
    </ul>
    ${marked ? '<p class="review-foot">The rows that fail a check are marked in red below.</p>' : ''}
  </section>`;
}

function renderSolved(ui: CaseUI, report: CheckReport, next: NextStep): string {
  const s = ui.session.scenario;
  const rep = cleanupReport(s, ui.session.state);
  const beforeNet = rep.before.pnl.netIncomeCents;
  const afterNet = rep.after.pnl.netIncomeCents;
  return `
  <section class="solved" data-testid="success" aria-live="polite" aria-labelledby="solved-h">
    <span class="stamp-inline good">Reconciled and right</span>
    <h2 id="solved-h">Books reconciled, and right.</h2>
    <div class="beforeafter">
      <div><span>Difference</span><strong class="num"><s>${formatSignedCents(rep.before.recon.differenceCents)}</s> ${formatSignedCents(report.recon.differenceCents)}</strong></div>
      <div><span>Net profit, ${esc(s.period.split(' ')[0])}</span><strong class="num">${beforeNet === afterNet ? formatCents(afterNet) : `<s>${formatCents(beforeNet)}</s> ${formatCents(afterNet)}`}</strong></div>
      <div><span>Checks run</span><strong class="num">${ui.checksRun}</strong></div>
    </div>
    ${renderFirstCheck(ui)}
    <details class="summary" open>
      <summary>The cleanup summary you'd send ${esc(s.client.split(' ')[0])} (${rep.items.length} fixes)</summary>
      <ul>${rep.items.map((i) => `<li>${esc(i.text)}</li>`).join('')}</ul>
    </details>
    <div class="solved-actions">
      <a class="btn" href="${next.href}">${esc(next.label)}</a>
      <button type="button" class="btn ghost" data-act="copy-report">Copy client summary</button>
      ${isGuided(s) ? '' : '<button type="button" class="btn ghost" data-act="copy-result">Copy my result</button><a class="btn ghost" href="#/">Home</a>'}
    </div>
  </section>`;
}

function renderFirstCheck(ui: CaseUI): string {
  const fc = ui.firstCheck;
  if (!fc || !Object.keys(fc).length) return '';
  const entries = Object.entries(fc) as [SkillId, boolean][];
  const clean = entries.filter(([, ok]) => ok).length;
  return `<div class="firstcheck">
    <h3>First check: ${clean} of ${entries.length} skills clean</h3>
    <ul>${entries.map(([k, ok]) => `<li class="${ok ? 'ok' : 'miss'}"><span aria-hidden="true">${ok ? '✓' : '✗'}</span> ${esc(SKILL_LABEL[k])}</li>`).join('')}</ul>
  </div>`;
}
