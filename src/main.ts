import './style.css';
import { CATEGORIES, isCategoryId } from './core/categories';
import { applyAction, canUndo, checkAll, createSession, reset, undo, type CheckReport } from './core/engine';
import { explain, shortDate } from './core/explain';
import { formatCents, formatSignedCents } from './core/money';
import { SCENARIO_1 } from './core/scenario';
import type { Action, Session } from './core/types';

// UI state lives here; all ledger logic lives in ./core (pure, unit-tested).
let session: Session = createSession(SCENARIO_1);
/** Detailed check results are revealed after the first "Check my books", then stay live. */
let checked = false;

const app = document.querySelector<HTMLDivElement>('#app')!;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function dispatch(action: Action): void {
  session = applyAction(session, action);
  render();
}

function render(): void {
  const { scenario, state } = session;
  const report = checkAll(scenario, state);
  const diff = report.balance.differenceCents;
  const wrongCat = new Set(checked ? report.categories.wrong.map((w) => w.entry.entryId) : []);

  app.innerHTML = `
  <header class="top">
    <div class="brand">
      <span class="logo" aria-hidden="true">✓</span>
      <div>
        <h1>Ledger Fix Lab</h1>
        <p class="tag">Practice fixing the books before you touch real ones.</p>
      </div>
    </div>
    <span class="pill">Synthetic practice data</span>
  </header>

  <section class="brief card">
    <h2>${esc(scenario.title)}</h2>
    <p class="meta">${esc(scenario.business)} · ${esc(scenario.account)} · ${esc(scenario.period)} · ${scenario.currency}</p>
    <p>The ledger doesn't agree with the bank statement. Clean it up so the books are right, not just balanced.
    You can <b>delete a row</b> or <b>change its category</b>. Amounts and dates can't be edited.
    When you think you're done, press <b>Check my books</b>.</p>
    <p class="note">Simplified reconciliation: one account, no timing differences, no missing entries to add.</p>
  </section>

  <section class="recon card" aria-live="polite">
    <div class="figures">
      <div><span class="label">Statement closing balance</span><span class="num">${formatCents(report.balance.statementBalanceCents)}</span></div>
      <div><span class="label">Ledger balance</span><span class="num">${formatCents(report.balance.ledgerBalanceCents)}</span></div>
      <div class="diff ${diff === 0 ? 'zero' : 'off'}" data-testid="difference">
        <span class="label">Difference</span><span class="num big">${formatSignedCents(diff)}</span>
      </div>
    </div>
    <div class="actions">
      <button type="button" data-act="undo" ${canUndo(session) ? '' : 'disabled'}>Undo${canUndo(session) ? ` (${session.history.length})` : ''}</button>
      <button type="button" data-act="reset" ${canUndo(session) ? '' : 'disabled'}>Reset</button>
      <button type="button" class="primary" data-act="check">Check my books</button>
    </div>
  </section>

  ${checked ? renderResults(report) : ''}

  <div class="grid">
    <section class="card">
      <h2>Ledger <span class="count">${state.entries.length} rows</span></h2>
      <div class="scroll">
        <table class="ledger">
          <thead><tr><th>Date</th><th>Description</th><th>Source</th><th class="r">Amount</th><th>Category</th><th><span class="sr">Delete</span></th></tr></thead>
          <tbody>
          ${state.entries
            .map(
              (e) => `
            <tr data-entry="${e.entryId}" class="${wrongCat.has(e.entryId) ? 'flag' : ''}">
              <td class="nowrap c-date">${shortDate(e.date)}</td>
              <td class="c-desc">${esc(e.description)}</td>
              <td class="muted nowrap c-src">${e.source}</td>
              <td class="r num c-amt ${e.amountCents > 0 ? 'in' : ''}">${formatSignedCents(e.amountCents)}</td>
              <td class="c-cat">
                <select data-cat="${e.entryId}" aria-label="Category for ${esc(e.description)}, ${shortDate(e.date)}">
                  ${CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === e.category ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
                </select>
              </td>
              <td class="c-del"><button type="button" class="del" data-del="${e.entryId}" aria-label="Delete ${esc(e.description)}, ${shortDate(e.date)}">Delete</button></td>
            </tr>`,
            )
            .join('')}
          </tbody>
        </table>
      </div>
    </section>

    <aside class="side">
      <section class="card">
        <h2>Bank statement <span class="count">source of truth</span></h2>
        <div class="scroll">
          <table class="stmt">
            <tbody>
              <tr class="muted"><td colspan="2">Opening balance</td><td class="r num">${formatCents(scenario.openingBalanceCents)}</td></tr>
              ${scenario.statement
                .map(
                  (l) => `<tr><td class="nowrap">${shortDate(l.date)}</td><td>${esc(l.description)}</td><td class="r num ${l.amountCents > 0 ? 'in' : ''}">${formatSignedCents(l.amountCents)}</td></tr>`,
                )
                .join('')}
              <tr class="total"><td colspan="2">Closing balance</td><td class="r num">${formatCents(scenario.statementClosingBalanceCents)}</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <section class="card">
        <h2>Category guide</h2>
        <dl class="guide">
          ${CATEGORIES.map((c) => `<div><dt>${esc(c.name)}</dt><dd>${esc(c.rule)}</dd></div>`).join('')}
        </dl>
      </section>
    </aside>
  </div>

  <footer class="foot">
    All data is synthetic and fictional. Not connected to QuickBooks or any bank. Progress is not saved.
  </footer>`;
}

function renderResults(report: CheckReport): string {
  const ex = explain(session.scenario, session.state, report);
  const card = (key: string, title: string, ok: boolean, okText: string, lines: string[], badText: string) => `
    <div class="check ${ok ? 'pass' : 'fail'}" data-testid="check-${key}">
      <div class="check-head"><span class="dot" aria-hidden="true">${ok ? '✓' : '!'}</span><h3>${title}</h3><span class="status">${ok ? 'Pass' : badText}</span></div>
      ${ok && lines.length === 0 ? `<p>${okText}</p>` : `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`}
    </div>`;
  const i = report.integrity;
  const issues = i.missing.length + i.extra.length + i.unknown.length;
  return `
  <section class="results" aria-live="polite">
    ${report.ok ? `<div class="banner" data-testid="success">Books reconciled. Every transaction is recorded exactly once, the ledger matches the statement, and every category fits its rule.</div>` : ''}
    <div class="checks">
      ${card('integrity', '1 · Transactions', i.ok, 'Every statement transaction is in the ledger exactly once.', ex.integrity, `${issues} issue${issues === 1 ? '' : 's'}`)}
      ${card('balance', '2 · Matches statement', report.balance.ok, 'Ledger balance equals the statement closing balance.', ex.balance, formatSignedCents(report.balance.differenceCents))}
      ${card('categories', '3 · Categories', report.categories.ok, 'Every row is in the category its rule calls for.', ex.categories, `${report.categories.wrong.length} wrong`)}
    </div>
  </section>`;
}

app.addEventListener('click', (ev) => {
  const t = (ev.target as HTMLElement).closest('button');
  if (!t || t.disabled) return;
  if (t.dataset.del) return dispatch({ type: 'delete', entryId: t.dataset.del });
  switch (t.dataset.act) {
    case 'undo':
      session = undo(session);
      return render();
    case 'reset':
      session = reset(session);
      checked = false;
      return render();
    case 'check':
      checked = true;
      render();
      document.querySelector('.results')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
  }
});

app.addEventListener('change', (ev) => {
  const t = ev.target as HTMLSelectElement;
  if (t.dataset.cat && isCategoryId(t.value)) dispatch({ type: 'recategorize', entryId: t.dataset.cat, category: t.value });
});

render();
