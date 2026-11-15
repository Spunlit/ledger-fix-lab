import { parseCsv, reconcile, type CsvLine, type Finding, type FindingKind } from '../core/checker';
import type { GuideId } from '../core/guide';
import { formatCents, formatSignedCents } from '../core/money';
import { esc, loadTheme, themeButton, type Plan } from './util';

/**
 * Check your own books (app.html#/check). Two CSV files, read and paired in this browser by core/checker;
 * nothing is uploaded. The sample files show everything; with a person's own files the first findings are
 * free and the rest come with the Practice plan.
 */
export interface CheckState {
  bank: string;
  books: string;
  /** The texts are the built-in sample files. */
  sample: boolean;
  ran: boolean;
}

export const newCheck = (): CheckState => ({ bank: '', books: '', sample: false, ran: false });
export const FREE_FINDINGS = 3;

const day = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : 'no date');

const KIND: Record<FindingKind, { title: string; fix: string; topic: GuideId }> = {
  duplicate: { title: 'In the books twice, at the bank once', fix: 'Delete one copy. Keep the one that has its bank line.', topic: 'duplicate' },
  amount: { title: 'The amounts differ', fix: 'The bank figure is what really moved. Correct the books to match it.', topic: 'transposed' },
  missing: { title: 'At the bank, not in the books', fix: 'Record it in the books. Bank fees and small charges hide here.', topic: 'missing' },
  notAtBank: { title: 'In the books, not at the bank yet', fix: 'If it is real (a check not cashed yet), keep it. If not, it should not be in the books.', topic: 'outstanding' },
  category: { title: 'Filed as income, reads like a transfer', fix: 'Money you moved in yourself is not sales. Filed as income, it raises profit and tax.', topic: 'owner' },
};

const row = (label: string, l: CsvLine) => `
  <div class="ck-line"><span class="ck-src">${label}, row ${l.row}</span><span class="ck-text">${esc(l.text)}<small>${esc(day(l.date))}${l.category ? `, ${esc(l.category)}` : ''}</small></span><b class="num">${formatSignedCents(l.cents)}</b></div>`;

function card(f: Finding): string {
  const k = KIND[f.kind];
  return `
  <li class="ck-card" data-kind="${f.kind}">
    <h3>${esc(k.title)}${f.kind === 'amount' && f.swapped ? ' <em>two digits look swapped</em>' : ''}</h3>
    ${f.bank ? row('Bank', f.bank) : ''}${f.books ? row('Books', f.books) : ''}${f.twin ? row('Its copy', f.twin) : ''}
    <p>${esc(k.fix)} <a href="#/guide/${k.topic}">Why</a></p>
    ${f.effectCents !== 0 ? `<p class="ck-eff">Explains <b class="num">${formatCents(Math.abs(f.effectCents))}</b> of the difference.</p>` : ''}
  </li>`;
}

const nav = () => `
  <header class="nav">
    <a class="brand" href="./" aria-label="Ledger Fix Lab, back to the main page"><span class="mark" aria-hidden="true"></span>Ledger Fix Lab</a>
    <div class="nav-right"><a class="nav-link" href="#/">Your desk</a>${themeButton(loadTheme())}</div>
  </header>`;

function results(s: CheckState, plan: Plan | null): string {
  const bank = parseCsv(s.bank, 'bank statement');
  const books = parseCsv(s.books, 'books');
  if (bank.error || books.error) {
    return `<section class="ck-out" aria-live="polite"><p class="acct-err" role="alert" data-testid="check-error">${esc(bank.error ?? books.error ?? '')}</p></section>`;
  }
  const r = reconcile(bank.lines, books.lines);
  const money = r.findings.filter((f) => f.kind !== 'category');
  const open = s.sample || plan ? r.findings : r.findings.slice(0, FREE_FINDINGS);
  const locked = r.findings.length - open.length;
  const skipped = bank.skipped.length + books.skipped.length;
  const verdict = !r.findings.length
    ? 'Every line has its pair. Balanced is not the same as right: read the categories once more.'
    : r.difference === 0 && !money.length
      ? 'The totals agree, and there is still something to look at.'
      : r.difference === 0
        ? `The totals agree, but ${money.length} ${money.length === 1 ? 'line does' : 'lines do'} not pair up. Mistakes can cancel each other out.`
        : `The ${formatCents(Math.abs(r.difference))} difference is explained to the cent by the ${money.length} ${money.length === 1 ? 'line' : 'lines'} below.`;
  return `
  <section class="ck-out" aria-live="polite" data-testid="check-result">
    <div class="ck-figs">
      <div><span>Bank, ${bank.lines.length} lines</span><b class="num">${formatSignedCents(r.bankTotal)}</b></div>
      <div><span>Books, ${books.lines.length} lines</span><b class="num">${formatSignedCents(r.booksTotal)}</b></div>
      <div class="${r.difference === 0 ? 'ok' : 'off'}"><span>Difference</span><b class="num" data-testid="check-diff">${formatSignedCents(r.difference)}</b></div>
    </div>
    <p class="ck-verdict" data-testid="check-verdict">${esc(verdict)} <span>${r.matched} ${r.matched === 1 ? 'line' : 'lines'} paired.</span></p>
    <ol class="ck-list">${open.map(card).join('')}</ol>
    ${locked > 0 ? `<a class="ck-lock" href="#/upgrade" data-testid="check-lock"><b>${locked} more ${locked === 1 ? 'finding' : 'findings'}</b><span>The first ${FREE_FINDINGS} are free. All of them come with the Practice plan.</span><span class="btn primary">See the plan</span></a>` : ''}
    ${skipped ? `<p class="acct-fine">${skipped} ${skipped === 1 ? 'row was' : 'rows were'} left out: ${esc([...bank.skipped, ...books.skipped].slice(0, 3).map((k) => `row ${k.row} (${k.why})`).join(', '))}${skipped > 3 ? ', and more' : ''}.</p>` : ''}
    <p class="acct-fine">This points at lines to look at. It does not know what really happened, so the decision on each line is yours.</p>
  </section>`;
}

export function renderCheck(s: CheckState, plan: Plan | null): string {
  const box = (id: 'bank' | 'books', label: string, hint: string, value: string) => `
    <div class="ck-in">
      <div class="ck-in-top"><label for="ck-${id}">${label}</label><label class="ck-file">Choose a CSV file<input type="file" accept=".csv,text/csv,text/plain" data-check-file="${id}"></label></div>
      <textarea id="ck-${id}" data-check-text="${id}" rows="7" spellcheck="false" placeholder="${hint}">${esc(value)}</textarea>
    </div>`;
  return `${nav()}
  <main class="guide-page check-page">
    <header class="guide-head">
      <p class="drill-step">Preview</p>
      <h1>Check your own books</h1>
      <p class="guide-lead">Put your bank statement next to your books. The matching you practiced finds the lines to look at.</p>
    </header>
    <div class="ck-ins">
      ${box('bank', 'Bank statement', 'Date,Description,Amount', s.bank)}
      ${box('books', 'Your books', 'Date,Payee,Category,Amount', s.books)}
    </div>
    <div class="drill-actions">
      <button type="button" class="btn primary big" data-check="run">Check</button>
      <button type="button" class="btn big" data-check="sample" data-testid="check-sample">Try the sample files</button>
      ${s.bank || s.books ? '<button type="button" class="btn big" data-check="clear">Clear</button>' : ''}
    </div>
    <p class="acct-note"><b>Private.</b> Your files are read in this browser and are not uploaded. One account at a time, US dates, amounts in dollars. ${s.sample ? 'The sample files are a made-up business.' : ''}</p>
    ${s.ran ? results(s, plan) : ''}
  </main>`;
}
