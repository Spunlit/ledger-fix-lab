import { CATEGORIES, category } from '../core/categories';
import { clues } from '../core/clues';
import { canUndo, checkAll, initialState, isLocked, statementLines, type CheckReport } from '../core/engine';
import { explain, shortDate, SKILL_LABEL } from '../core/explain';
import { progress, type Feedback } from '../core/feedback';
import { formatCents, formatSignedCents } from '../core/money';
import { cleanupReport } from '../core/report';
import { CASES } from '../core/scenarios';
import { weakestSkills } from '../core/skills';
import { ALL_TOOLS, type CategoryId, type LedgerEntry, type Scenario, type Session, type SkillId, type Tool } from '../core/types';
import { dailyHref, practiceHref } from './routes';
import { centsToPlain, esc, loadHistory, newSeed } from './util';

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
export function shareText(ui: CaseUI, url: string): string {
  const s = ui.session.scenario;
  const fc = Object.values(ui.firstCheck ?? {});
  return [
    `Ledger Fix Lab: ${badgeText(ui)} (${s.business}, ${s.period})`,
    `Reconciled and right. Checks run: ${ui.checksRun}.${fc.length ? ` First check: ${fc.filter(Boolean).length} of ${fc.length} skills clean.` : ''}`,
    url,
  ].join('\n');
}

const ICON = {
  trash: `<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M7 3h6m-9 3h12m-1.5 0-.7 10.1a1.5 1.5 0 0 1-1.5 1.4H7.7a1.5 1.5 0 0 1-1.5-1.4L5.5 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  plus: `<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M10 4v12M4 10h12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  back: `<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M12 4 6 10l6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
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

function coachText(s: Scenario, report: CheckReport): string {
  if (!isGuided(s)) return 'No hints in this file. Fix everything you find, then press Check the books.';
  if (report.ok) return 'Everything checks out. Press Check the books to confirm.';
  const d = report.recon.differenceCents;
  if (d !== 0) return `The books are ${formatCents(Math.abs(d))} away from the bank. Compare the two lists, line by line.`;
  return "The difference is $0.00, but something is still wrong. Read the client's note and check the categories.";
}

export function renderWorkbench(ui: CaseUI): string {
  const { scenario: s, state } = ui.session;
  const report = checkAll(s, state);
  const r = report.recon;
  const guided = isGuided(s);
  const tools = toolsOf(s);
  const cl = clues(s, state);
  const showHint = guided && ui.hintOpen && cl.length > 0;
  const hlEntries = new Set(showHint ? cl.flatMap((c) => c.entryIds) : []);
  const hlLines = new Set(showHint ? cl.flatMap((c) => c.txnIds) : []);
  const recordedByUser = new Set(state.entries.filter((e) => e.source === 'Added from statement').map((e) => e.txnId));
  const solved = ui.checked && report.ok;
  const prog = guided ? progress(s, initialState(s), state) : null;
  const hasOutstanding = r.outstandingPaymentsCents !== 0 || r.depositsInTransitCents !== 0;
  const teaser = s.note.paragraphs[1] ?? s.note.paragraphs[0];

  return `
  <header class="bar">
    <a class="back" href="#/" aria-label="Back to home">${ICON.back}<span class="mark" aria-hidden="true"></span></a>
    <div class="bar-title"><span class="badge ${guided ? '' : 'exam'}">${esc(badgeText(ui))}</span><h1>${esc(s.kind === 'case' ? s.title : s.business)}</h1></div>
    <div class="bar-actions">
      <button type="button" class="btn ghost" data-act="undo" ${canUndo(ui.session) ? '' : 'disabled'}>Undo</button>
      <button type="button" class="btn ghost" data-act="reset" ${canUndo(ui.session) ? '' : 'disabled'}>Start over</button>
    </div>
  </header>

  <main class="bench">
    <section class="status" aria-label="Reconciliation" aria-live="polite">
      <div class="figs">
        <div class="fig"><span>Bank${hasOutstanding ? ' <small>after uncleared items</small>' : ''}</span><strong class="num">${formatCents(r.adjustedBankCents)}</strong></div>
        <div class="fig"><span>Books</span><strong class="num">${formatCents(r.bookBalanceCents)}</strong></div>
        <div class="fig diff ${report.balanced ? 'zero' : 'off'}" data-testid="difference"><span>Difference</span><strong class="num">${formatSignedCents(r.differenceCents)}</strong></div>
      </div>
      <div class="status-side">
        ${prog ? `<div class="prog" aria-label="${prog.fixed} of ${prog.total} problems fixed"><span class="dots">${Array.from({ length: prog.total }, (_, i) => `<i class="${i < prog.fixed ? 'on' : ''}"></i>`).join('')}</span><span>${prog.fixed} of ${prog.total} fixed</span></div>` : ''}
        <button type="button" class="btn primary" data-act="check">Check the books</button>
      </div>
      <button type="button" class="link small math-toggle" data-act="toggle-math" aria-expanded="${ui.mathOpen}">${ui.mathOpen ? 'Hide the math' : 'How is this calculated?'}</button>
      ${
        ui.mathOpen
          ? `<p class="math">Statement ending ${formatCents(r.statementEndingCents)} − outstanding payments ${formatCents(-r.outstandingPaymentsCents)} + deposits in transit ${formatCents(r.depositsInTransitCents)} = adjusted bank ${formatCents(r.adjustedBankCents)}. Books: opening ${formatCents(s.openingBalanceCents)} plus every row = ${formatCents(r.bookBalanceCents)}. Unticked rows are the outstanding items.</p>`
          : ''
      }
    </section>

    <section class="coach" aria-live="polite">
      <p class="next">${esc(coachText(s, report))}</p>
      ${guided && cl.length ? `<button type="button" class="btn small" data-act="toggle-hint" aria-expanded="${ui.hintOpen}">${ui.hintOpen ? 'Hide hint' : 'Hint'}</button>` : ''}
      ${showHint ? `<p class="hint">${esc(cl[0].text)}</p>` : ''}
      ${ui.feedback ? `<p class="toast ${ui.feedback.tone}" role="status" data-testid="feedback">${esc(ui.feedback.text)}</p>` : ''}
    </section>

    <aside class="note-strip ${ui.noteOpen ? 'open' : ''}">
      <p><b>${esc(s.note.from.split(',')[0])}:</b> ${ui.noteOpen ? '' : `“${esc(teaser)}”`}</p>
      ${ui.noteOpen ? s.note.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('') : ''}
      <button type="button" class="link small" data-act="toggle-note" aria-expanded="${ui.noteOpen}">${ui.noteOpen ? 'Hide note' : 'Read the full note'}</button>
    </aside>

    ${ui.checked ? (solved ? renderSolved(ui, report) : renderReview(report)) : ''}

    <div class="desk">
      <section class="books" aria-labelledby="books-h">
        <h2 id="books-h">Books</h2>
        <table class="ledger ${tools.has('cleared') ? 'with-clr' : ''}">
          <thead><tr>${tools.has('cleared') ? '<th class="c-clr">Cleared</th>' : ''}<th>Date</th><th>Description</th><th class="r">Amount</th><th>Category</th><th><span class="sr">Actions</span></th></tr></thead>
          <tbody>${state.entries.map((e) => renderRow(ui, e, report, tools, hlEntries.has(e.entryId))).join('')}</tbody>
        </table>
        <button type="button" class="link small" data-act="toggle-guide" aria-expanded="${ui.guideOpen}">${ui.guideOpen ? 'Hide category guide' : 'Category guide'}</button>
        ${ui.guideOpen ? `<dl class="guide">${CATEGORIES.map((c) => `<div><dt>${esc(c.name)}</dt><dd>${esc(c.rule)}</dd></div>`).join('')}</dl>` : ''}
      </section>

      <section class="statement" aria-labelledby="stmt-h">
        <h2 id="stmt-h">Bank statement</h2>
        <table class="stmt">
          <tbody>
            <tr class="muted"><td class="s-desc" colspan="2">Beginning balance</td><td class="r num s-amt">${formatCents(s.openingBalanceCents)}</td>${tools.has('record') ? '<td class="s-rec"></td>' : ''}</tr>
            ${statementLines(s)
              .map((l) => {
                const recording = ui.recording === l.txnId;
                return `<tr class="${hlLines.has(l.txnId) ? 'hl' : ''}" data-amt="${l.amountCents}">
                  <td class="nowrap s-date">${shortDate(l.date)}</td><td class="bankdesc s-desc">${esc(l.description)}</td>
                  <td class="r num s-amt ${l.amountCents > 0 ? 'in' : ''}">${formatSignedCents(l.amountCents)}</td>
                  ${
                    tools.has('record')
                      ? `<td class="r s-rec">${recordedByUser.has(l.txnId) ? '<span class="tag">Added</span>' : `<button type="button" class="icon-btn" data-record="${esc(l.txnId)}" aria-expanded="${recording}" aria-label="Record ${esc(l.description)} in the books" title="Record in the books">${ICON.plus}</button>`}</td>`
                      : ''
                  }</tr>
                  ${
                    recording
                      ? `<tr class="record-row"><td colspan="4"><form class="record-form" data-record-form="${esc(l.txnId)}">
                          <span>Add ${formatSignedCents(l.amountCents)} to the books as</span>
                          ${categorySelect('name="cat" required', null, 'Category for the recorded line')}
                          <button type="submit" class="btn primary small">Add</button>
                          <button type="button" class="link small" data-act="cancel-record">Cancel</button>
                        </form></td></tr>`
                      : ''
                  }`;
              })
              .join('')}
            <tr class="total"><td class="s-desc" colspan="2">Ending balance</td><td class="r num s-amt">${formatCents(s.statementEndingBalanceCents)}</td>${tools.has('record') ? '<td class="s-rec"></td>' : ''}</tr>
          </tbody>
        </table>
      </section>
    </div>
  </main>`;
}

function renderRow(ui: CaseUI, e: LedgerEntry, report: CheckReport, tools: Set<Tool>, hl: boolean): string {
  const flagged =
    ui.checked &&
    (report.amounts.wrong.some((w) => w.entry.entryId === e.entryId) ||
      report.categories.wrong.some((w) => w.entry.entryId === e.entryId) ||
      report.cleared.wrong.some((w) => w.entry.entryId === e.entryId));
  const locked = isLocked(e);
  const editing = ui.editing === e.entryId;
  const label = `${e.description}, ${shortDate(e.date)}`;
  const tag = e.source === 'Manual entry' ? '<span class="tag manual">Typed by hand</span>' : e.source === 'Added from statement' ? '<span class="tag">Added</span>' : '';
  const amount = editing
    ? `<form class="amt-form" data-amt-form="${esc(e.entryId)}">
        <span aria-hidden="true">${e.amountCents < 0 ? '−$' : '$'}</span>
        <input name="amt" inputmode="decimal" autocomplete="off" value="${centsToPlain(e.amountCents)}" aria-label="New amount for ${esc(label)}" ${ui.editError ? 'aria-invalid="true"' : ''}>
        <button type="submit" class="btn primary small">Save</button><button type="button" class="link small" data-act="cancel-edit">Cancel</button>
        ${ui.editError ? `<span class="err" role="alert">${esc(ui.editError)}</span>` : ''}
      </form>`
    : tools.has('amount') && !locked
      ? `<button type="button" class="amt ${e.amountCents > 0 ? 'in' : ''}" data-edit="${esc(e.entryId)}" aria-label="Edit amount ${formatSignedCents(e.amountCents)} for ${esc(label)}" title="Click to correct the amount">${formatSignedCents(e.amountCents)}</button>`
      : `<span class="num ${e.amountCents > 0 ? 'in' : ''}">${formatSignedCents(e.amountCents)}</span>`;
  return `<tr data-entry="${esc(e.entryId)}" data-amt="${e.amountCents}" class="${hl ? 'hl' : ''} ${flagged ? 'flag' : ''}">
    ${tools.has('cleared') ? `<td class="c-clr"><label class="tick"><input type="checkbox" data-clear="${esc(e.entryId)}" ${e.cleared ? 'checked' : ''} ${locked ? 'disabled' : ''} aria-label="Cleared: ${esc(label)}"><span aria-hidden="true"></span></label></td>` : ''}
    <td class="nowrap c-date">${shortDate(e.date)}</td>
    <td class="c-desc">${esc(e.description)} ${tag}</td>
    <td class="r c-amt">${amount}</td>
    <td class="c-cat">${tools.has('category') ? categorySelect(`data-cat="${esc(e.entryId)}"`, e.category, `Category for ${label}`) : esc(category(e.category).name)}</td>
    <td class="c-del">${tools.has('delete') ? `<button type="button" class="icon-btn del" data-del="${esc(e.entryId)}" aria-label="Delete ${esc(label)}" title="Delete">${ICON.trash}</button>` : ''}</td>
  </tr>`;
}

function renderReview(report: CheckReport): string {
  const ex = explain(report);
  const rows: [string, string, boolean, string[]][] = [
    ['integrity', 'Each transaction recorded exactly once', report.integrity.ok, ex.integrity],
    ['amounts', 'Amounts match the bank', report.amounts.ok, ex.amounts],
    ['cleared', 'Cleared items ticked correctly', report.cleared.ok, ex.cleared],
    ['categories', 'Categories right', report.categories.ok, ex.categories],
  ];
  const failing = rows.filter((x) => !x[2]);
  const verdict = report.balanced
    ? `The difference is $0.00, but ${failing.length === 1 ? 'one check fails' : `${failing.length} checks fail`}. Balanced isn't the same as right.`
    : `Not yet: ${formatSignedCents(report.recon.differenceCents)} to go, and ${failing.length === 1 ? 'one check fails' : `${failing.length} checks fail`}.`;
  return `
  <section class="review" aria-live="polite" aria-labelledby="review-h">
    <h2 id="review-h">${esc(verdict)}</h2>
    <ul class="checks">
      ${rows
        .map(
          ([key, title, ok, lines]) => `
        <li class="check ${ok ? 'pass' : 'fail'}" data-testid="check-${key}">
          <h3><span class="dot" aria-hidden="true"></span>${title}<span class="st">${ok ? "Pass" : "Fix needed"}</span></h3>
          ${ok ? '' : `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`}
        </li>`,
        )
        .join('')}
    </ul>
  </section>`;
}

function renderSolved(ui: CaseUI, report: CheckReport): string {
  const s = ui.session.scenario;
  const rep = cleanupReport(s, ui.session.state);
  const beforeNet = rep.before.pnl.netIncomeCents;
  const afterNet = rep.after.pnl.netIncomeCents;
  return `
  <section class="solved" data-testid="success" aria-live="polite" aria-labelledby="solved-h">
    <h2 id="solved-h">Books reconciled, and right.</h2>
    <div class="beforeafter">
      <div><span>Difference</span><strong class="num"><s>${formatSignedCents(rep.before.recon.differenceCents)}</s> ${formatSignedCents(report.recon.differenceCents)}</strong></div>
      <div><span>Net profit, ${esc(s.period.split(' ')[0])}</span><strong class="num">${beforeNet === afterNet ? formatCents(afterNet) : `<s>${formatCents(beforeNet)}</s> ${formatCents(afterNet)}`}</strong></div>
      <div><span>Checks run</span><strong class="num">${ui.checksRun}</strong></div>
    </div>
    ${renderFirstCheck(ui)}
    <details class="summary">
      <summary>The cleanup summary you'd send ${esc(s.client.split(' ')[0])} (${rep.items.length} fixes)</summary>
      <ul>${rep.items.map((i) => `<li>${esc(i.text)}</li>`).join('')}</ul>
    </details>
    <div class="solved-actions">
      ${nextAction(s)}
      <button type="button" class="btn ghost" data-act="copy-report">Copy client summary</button>
      ${isGuided(s) ? '' : '<button type="button" class="btn ghost" data-act="copy-result">Copy my result</button>'}
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

function nextAction(s: Scenario): string {
  const next = CASES.find((c) => c.number === s.number + 1);
  if (s.kind === 'case' && next) return `<a class="btn primary" href="#/case/${next.id}">Next case</a>`;
  if (s.kind === 'case') return `<a class="btn primary" href="${dailyHref()}">Try today's file, no hints</a>`;
  return `<a class="btn primary" href="${practiceHref(newSeed(), weakestSkills(loadHistory(), 2))}">Practice my weak spots</a><a class="btn ghost" href="#/">Home</a>`;
}
