import { CATEGORIES, category } from '../core/categories';
import { clues } from '../core/clues';
import { canUndo, checkAll, isLocked, statementLines, type CheckReport } from '../core/engine';
import { explain, shortDate, SKILL_LABEL } from '../core/explain';
import { formatCents, formatSignedCents } from '../core/money';
import { cleanupReport } from '../core/report';
import { CASES } from '../core/scenarios';
import type { CategoryId, LedgerEntry, Session } from '../core/types';
import { centsToPlain, esc } from './util';

/** Per-case UI state. All ledger logic lives in ../core. */
export interface CaseUI {
  session: Session;
  checked: boolean;
  checksRun: number;
  noteOpen: boolean;
  showMatches: boolean;
  editing: string | null;
  editError: string | null;
  recording: string | null;
}

export function newCaseUI(session: Session): CaseUI {
  return { session, checked: false, checksRun: 0, noteOpen: true, showMatches: false, editing: null, editError: null, recording: null };
}

const sourceTag = (e: LedgerEntry) =>
  e.source === 'Bank feed' ? '' : `<span class="src ${e.source === 'Manual entry' ? 'manual' : 'added'}">${e.source === 'Manual entry' ? 'Typed by hand' : 'Recorded from statement'}</span>`;

function categorySelect(attr: string, value: CategoryId | null, label: string): string {
  return `<select ${attr} aria-label="${esc(label)}">
    ${value === null ? '<option value="" selected disabled>Choose a category</option>' : ''}
    <optgroup label="Income">${opts('income', value)}</optgroup>
    <optgroup label="Expenses">${opts('expense', value)}</optgroup>
    <optgroup label="Owner's equity (not profit or loss)">${opts('equity', value)}</optgroup>
  </select>`;
}
const opts = (kind: string, value: CategoryId | null) =>
  CATEGORIES.filter((c) => c.kind === kind)
    .map((c) => `<option value="${c.id}" ${c.id === value ? 'selected' : ''}>${esc(c.name)}</option>`)
    .join('');

export function renderWorkbench(ui: CaseUI): string {
  const { scenario: s, state } = ui.session;
  const report = checkAll(s, state);
  const r = report.recon;
  const cl = clues(s, state);
  const hlEntries = new Set(ui.showMatches ? cl.flatMap((c) => c.entryIds) : []);
  const hlLines = new Set(ui.showMatches ? cl.flatMap((c) => c.txnIds) : []);
  const recordedByUser = new Set(state.entries.filter((e) => e.source === 'Added from statement').map((e) => e.txnId));
  const solved = ui.checked && report.ok;
  const next = CASES.find((c) => c.number === s.number + 1);

  return `
  <header class="site compact">
    <a class="brand" href="#/" aria-label="All cases"><span class="mark" aria-hidden="true"></span>Ledger Fix Lab</a>
    <div class="case-title">
      <span class="case-badge">Case ${s.number}</span>
      <h1>${esc(s.title)}</h1>
      <span class="case-sub">${esc(s.business)}, ${esc(s.period)}</span>
    </div>
    <div class="top-actions">
      <button type="button" class="btn" data-act="undo" ${canUndo(ui.session) ? '' : 'disabled'}>Undo</button>
      <button type="button" class="btn" data-act="reset" ${canUndo(ui.session) ? '' : 'disabled'}>Start over</button>
    </div>
  </header>

  <main class="bench">
    <section class="brief" aria-label="Client note and your job">
      <article class="note ${ui.noteOpen ? '' : 'closed'}">
        <header>
          <div><span class="note-from">From ${esc(s.note.from)}</span><h2>${esc(s.note.subject)}</h2></div>
          <button type="button" class="link" data-act="toggle-note" aria-expanded="${ui.noteOpen}">${ui.noteOpen ? 'Hide note' : 'Show client note'}</button>
        </header>
        ${ui.noteOpen ? s.note.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('') : ''}
      </article>
      <div class="jobwrap"><ol class="job">
        <li>Compare the books with the bank statement, line by line.</li>
        <li>Fix what's wrong: delete, correct an amount (click it), change a category, tick what's on the statement, or record a bank line that's missing.</li>
        <li>When the difference reads $0.00, press <b>Check the books</b>.</li>
      </ol>
      <p class="job-note">This month hasn't been reconciled yet, so deleting a wrong row is fine here. In real books, never delete a row from a month that's already reconciled.</p></div>
    </section>

    <section class="worksheet" aria-label="Bank reconciliation worksheet" aria-live="polite">
      <div class="eq">
        <div class="term"><span class="op" aria-hidden="true"></span><span class="lbl">Statement ending</span><span class="num">${formatCents(r.statementEndingCents)}</span></div>
        <div class="term"><span class="op" aria-hidden="true">−</span><span class="lbl">Outstanding <small>(unticked payments)</small></span><span class="num">${formatCents(-r.outstandingPaymentsCents)}</span></div>
        <div class="term"><span class="op" aria-hidden="true">+</span><span class="lbl">In transit <small>(unticked deposits)</small></span><span class="num">${formatCents(r.depositsInTransitCents)}</span></div>
        <div class="term strong"><span class="op" aria-hidden="true">=</span><span class="lbl">Adjusted bank</span><span class="num">${formatCents(r.adjustedBankCents)}</span></div>
        <div class="term strong"><span class="op vs" aria-hidden="true">vs</span><span class="lbl">Books</span><span class="num">${formatCents(r.bookBalanceCents)}</span></div>
      </div>
      <div class="diff ${report.balanced ? 'zero' : 'off'}" data-testid="difference"><span class="lbl">Difference</span><span class="num">${formatSignedCents(r.differenceCents)}</span></div>
      <button type="button" class="btn primary big check-btn" data-act="check">Check the books</button>
      ${
        cl.length
          ? `<div class="clue"><p><b>Clue.</b> ${esc(cl[0].text)}${cl.length > 1 ? ` <span class="more">${cl.slice(1).map((c) => esc(c.text)).join(' ')}</span>` : ''}</p>${
              cl.some((c) => c.entryIds.length || c.txnIds.length)
                ? `<button type="button" class="link" data-act="toggle-matches" aria-pressed="${ui.showMatches}">${ui.showMatches ? 'Hide matches' : 'Highlight matches'}</button>`
                : ''
            }</div>`
          : `<div class="clue calm"><p><b>Reconciled to $0.00.</b> That's necessary, not sufficient. Check the books to see whether they're actually right.</p></div>`
      }
    </section>

    ${ui.checked ? (solved ? renderSolved(ui, report, next?.id) : renderReview(ui, report)) : ''}

    <div class="desk">
      <section class="books" aria-labelledby="books-h">
        <h2 id="books-h">The client's books <span class="count">${state.entries.length} rows</span></h2>
        <div class="scroll">
          <table class="ledger">
            <thead><tr><th class="c-clr">Cleared</th><th>Date</th><th>Description</th><th class="r">Amount</th><th>Category</th><th><span class="sr">Actions</span></th></tr></thead>
            <tbody>
              ${state.entries.map((e) => renderRow(ui, e, report, hlEntries.has(e.entryId))).join('')}
            </tbody>
          </table>
        </div>
      </section>

      <aside class="side">
        <section class="statement" aria-labelledby="stmt-h">
          <h2 id="stmt-h">Bank statement <span class="count">${esc(s.account)}</span></h2>
          <table class="stmt">
            <tbody>
              <tr class="muted"><td class="s-desc" colspan="2">Beginning balance</td><td class="r num s-amt">${formatCents(s.openingBalanceCents)}</td><td class="s-rec"></td></tr>
              ${statementLines(s)
                .map((l) => {
                  const recording = ui.recording === l.txnId;
                  return `<tr class="${hlLines.has(l.txnId) ? 'hl' : ''}" data-amt="${l.amountCents}">
                  <td class="nowrap s-date">${shortDate(l.date)}</td><td class="bankdesc s-desc">${esc(l.description)}</td>
                  <td class="r num s-amt ${l.amountCents > 0 ? 'in' : ''}">${formatSignedCents(l.amountCents)}</td>
                  <td class="r s-rec">${
                    recordedByUser.has(l.txnId)
                      ? '<span class="src added">Recorded</span>'
                      : `<button type="button" class="mini ghost rec" data-record="${esc(l.txnId)}" aria-expanded="${recording}" aria-label="Record ${esc(l.description)} in the books">Record</button>`
                  }</td></tr>
                  ${
                    recording
                      ? `<tr class="record-row"><td colspan="4">
                    <form class="record-form" data-record-form="${esc(l.txnId)}">
                      <span>Add ${formatSignedCents(l.amountCents)} to the books as</span>
                      ${categorySelect('name="cat" required', null, 'Category for the recorded line')}
                      <button type="submit" class="btn primary">Add to books</button>
                      <button type="button" class="link" data-act="cancel-record">Cancel</button>
                    </form></td></tr>`
                      : ''
                  }`;
                })
                .join('')}
              <tr class="total"><td class="s-desc" colspan="2">Ending balance</td><td class="r num s-amt">${formatCents(s.statementEndingBalanceCents)}</td><td class="s-rec"></td></tr>
            </tbody>
          </table>
        </section>
        <details class="guide">
          <summary>Category guide</summary>
          <dl>${CATEGORIES.map((c) => `<div><dt>${esc(c.name)}</dt><dd>${esc(c.rule)}</dd></div>`).join('')}</dl>
        </details>
      </aside>
    </div>
  </main>
  <footer class="site-foot"><p>${esc(s.business)} and ${esc(s.client)} are fictional. Synthetic practice data, simplified one-account model.</p></footer>`;
}

function renderRow(ui: CaseUI, e: LedgerEntry, report: CheckReport, hl: boolean): string {
  const flagged =
    ui.checked &&
    (report.amounts.wrong.some((w) => w.entry.entryId === e.entryId) ||
      report.categories.wrong.some((w) => w.entry.entryId === e.entryId) ||
      report.cleared.wrong.some((w) => w.entry.entryId === e.entryId));
  const locked = isLocked(e);
  const editing = ui.editing === e.entryId;
  const label = `${e.description}, ${shortDate(e.date)}`;
  return `<tr data-entry="${esc(e.entryId)}" data-amt="${e.amountCents}" class="${hl ? 'hl' : ''} ${flagged ? 'flag' : ''}">
    <td class="c-clr"><label class="tick"><input type="checkbox" data-clear="${esc(e.entryId)}" ${e.cleared ? 'checked' : ''} ${locked ? 'disabled' : ''} aria-label="Cleared: ${esc(label)}"><span aria-hidden="true"></span></label></td>
    <td class="nowrap c-date">${shortDate(e.date)}</td>
    <td class="c-desc">${esc(e.description)} ${sourceTag(e)}</td>
    <td class="r c-amt">${
      editing
        ? `<form class="amt-form" data-amt-form="${esc(e.entryId)}">
            <span class="sign" aria-hidden="true">${e.amountCents < 0 ? '−$' : '$'}</span>
            <input name="amt" inputmode="decimal" autocomplete="off" value="${centsToPlain(e.amountCents)}" aria-label="New amount for ${esc(label)}" ${ui.editError ? 'aria-invalid="true"' : ''}>
            <button type="submit" class="mini">Save</button><button type="button" class="mini ghost" data-act="cancel-edit">Cancel</button>
            ${ui.editError ? `<span class="err" role="alert">${esc(ui.editError)}</span>` : ''}
          </form>`
        : `<button type="button" class="amt ${e.amountCents > 0 ? 'in' : ''}" data-edit="${esc(e.entryId)}" aria-label="Edit amount ${formatSignedCents(e.amountCents)} for ${esc(label)}" ${locked ? 'disabled' : ''}>${formatSignedCents(e.amountCents)}</button>`
    }</td>
    <td class="c-cat">${categorySelect(`data-cat="${esc(e.entryId)}"`, e.category, `Category for ${label}`)}</td>
    <td class="c-del"><button type="button" class="mini ghost del" data-del="${esc(e.entryId)}" aria-label="Delete ${esc(label)}">Delete</button></td>
  </tr>`;
}

function renderReview(ui: CaseUI, report: CheckReport): string {
  const ex = explain(report);
  const rows: [string, string, boolean, string[], string][] = [
    ['integrity', 'Each transaction recorded exactly once', report.integrity.ok, ex.integrity, 'Nothing missing, nothing doubled.'],
    ['amounts', 'Amounts match the bank', report.amounts.ok, ex.amounts, 'Every amount matches its source.'],
    ['cleared', 'Cleared items ticked correctly', report.cleared.ok, ex.cleared, 'Ticked exactly when it is on this statement.'],
    ['categories', 'Categories right', report.categories.ok, ex.categories, 'Every row fits its category.'],
  ];
  const failing = rows.filter((x) => !x[2]).length;
  const verdict = report.balanced
    ? `Not yet. The difference is $0.00, but ${failing === 1 ? 'one check fails' : `${failing} checks fail`}. Balanced isn't the same as right.`
    : `Not yet. The books are ${formatSignedCents(report.recon.differenceCents)} away from the bank, and ${failing === 1 ? 'one check fails' : `${failing} checks fail`}.`;
  return `
  <section class="review" aria-live="polite" aria-labelledby="review-h">
    <h2 id="review-h">${esc(verdict)}</h2>
    <ul class="checks">
      ${rows
        .map(
          ([key, title, ok, lines, okText]) => `
        <li class="check ${ok ? 'pass' : 'fail'}" data-testid="check-${key}">
          <span class="dot" aria-hidden="true"></span>
          <div><h3>${title} <span class="status">${ok ? 'Pass' : 'Fix needed'}</span></h3>
          ${ok ? `<p>${okText}</p>` : `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`}</div>
        </li>`,
        )
        .join('')}
    </ul>
    <p class="review-foot">Checks run: ${ui.checksRun}. The review updates as you keep working.</p>
  </section>`;
}

function renderSolved(ui: CaseUI, report: CheckReport, nextId: string | undefined): string {
  const s = ui.session.scenario;
  const rep = cleanupReport(s, ui.session.state);
  const beforeNet = rep.before.pnl.netIncomeCents;
  const afterNet = rep.after.pnl.netIncomeCents;
  return `
  <section class="solved" data-testid="success" aria-live="polite" aria-labelledby="solved-h">
    <div class="solved-head">
      <h2 id="solved-h">Books reconciled, and right.</h2>
      <p>All four checks pass after ${ui.checksRun} ${ui.checksRun === 1 ? 'check' : 'checks'}. Here's the summary you'd send ${esc(s.client.split(' ')[0])}.</p>
    </div>
    <div class="beforeafter">
      <div><span>Difference</span><span class="num"><s>${formatSignedCents(rep.before.recon.differenceCents)}</s> ${formatSignedCents(report.recon.differenceCents)}</span></div>
      <div><span>Net profit for ${esc(s.period.split(' ')[0])}</span><span class="num">${beforeNet === afterNet ? formatCents(afterNet) : `<s>${formatCents(beforeNet)}</s> ${formatCents(afterNet)}`}</span></div>
      <div><span>Book balance</span><span class="num">${formatCents(rep.after.recon.bookBalanceCents)}</span></div>
    </div>
    <article class="summary" aria-label="Cleanup summary for the client">
      <h3>${esc(s.business)}: ${esc(s.period)} cleanup summary</h3>
      <ul>${rep.items.map((i) => `<li>${esc(i.text)}</li>`).join('')}</ul>
    </article>
    <div class="solved-actions">
      <button type="button" class="btn" data-act="copy-report">Copy summary</button>
      ${nextId ? `<a class="btn primary" href="#/case/${nextId}">Next case</a>` : '<a class="btn primary" href="#/">All cases</a>'}
    </div>
    <p class="practiced">Practiced: ${s.skills.map((k) => esc(SKILL_LABEL[k].toLowerCase())).join(', ')}.</p>
  </section>`;
}

export function categoryLabel(id: CategoryId): string {
  return category(id).name;
}
