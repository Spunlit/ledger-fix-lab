import { sumCents } from './money';

/**
 * "Check your own books": the trainer's matching, applied to a person's own two files. It reads a bank
 * statement and a list from the books (both CSV), pairs the lines, and lists what is left to look at:
 * a line entered twice, an amount that differs, a bank line nobody recorded, a line the bank has not
 * seen, and money filed as income that reads like a transfer.
 *
 * It is pure and exact: money is integer cents from the first character to the last, and the findings
 * always add up to the difference between the two totals. It suggests where to look; it is not a grade,
 * because nobody but the owner knows what really happened.
 */

export interface CsvLine {
  /** 1-based row in the pasted file, counting the header. */
  row: number;
  /** ISO day, or null when the date could not be read. */
  date: string | null;
  text: string;
  /** Signed: money in is positive, money out is negative. */
  cents: number;
  category: string | null;
}

export interface ParsedCsv {
  lines: CsvLine[];
  /** Rows left out, with the reason in plain words. */
  skipped: { row: number; why: string }[];
  /** Set when the file as a whole could not be used. */
  error: string | null;
}

export const MAX_LINES = 2000;
/** A bank date and a book date this many days apart can still be the same payment. */
export const WINDOW_DAYS = 5;

// ---------- reading money and dates without floating point

/** "$1,234.56", "-45", "(45.00)", "45.00-", "−12" -> signed integer cents; null when it is not money. */
export function parseMoney(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/[$\s,]/g, '').replace(/(CR|DR)$/i, '');
  if (/^[-−]/.test(s)) { neg = !neg; s = s.slice(1); }
  else if (/[-−]$/.test(s)) { neg = !neg; s = s.slice(0, -1); }
  else if (s.startsWith('+')) s = s.slice(1);
  const m = /^(\d*)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m || (!m[1] && !m[2])) return null;
  const cents = Number(m[1] || '0') * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0');
  if (!Number.isSafeInteger(cents)) return null;
  return neg ? -cents : cents;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function iso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** ISO (2026-04-03), US (4/3/2026, 04-03-26) or "Apr 3, 2026" -> ISO day; null when unreadable. */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(s);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/.exec(s);
  if (m) return iso(Number(m[3]), Number(m[1]), Number(m[2]));
  m = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(s);
  if (m) {
    const k = MONTHS.indexOf(m[1].toLowerCase());
    return k < 0 ? null : iso(Number(m[3]), k + 1, Number(m[2]));
  }
  return null;
}

// ---------- reading a CSV

/** Splits CSV text into rows of cells: quoted cells, doubled quotes and line breaks inside quotes all work. */
export function splitCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const first = src.split(/\r?\n/, 1)[0] ?? '';
  const count = (ch: string) => first.split(ch).length - 1;
  const delim = count('\t') > count(',') && count('\t') >= count(';') ? '\t' : count(';') > count(',') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim()));
}

const has = (h: string, ...words: string[]) => words.some((w) => h.includes(w));
const BALANCE_ROW = /\b(opening|beginning|ending|closing|starting)\s+balance\b|\bbalance (forward|brought)\b|^total\b/i;

interface Columns { date: number; text: number; amount: number; debit: number; credit: number; category: number }

function findColumns(header: string[]): Columns {
  const h = header.map((c) => c.toLowerCase());
  const find = (test: (c: string) => boolean) => h.findIndex(test);
  return {
    date: find((c) => has(c, 'date', 'posted')),
    text: find((c) => has(c, 'description', 'memo', 'payee', 'name', 'details', 'merchant', 'narrative')),
    amount: find((c) => c === 'amount' || (has(c, 'amount') && !has(c, 'debit', 'credit'))),
    debit: find((c) => has(c, 'debit', 'withdraw', 'money out', 'paid out')),
    credit: find((c) => has(c, 'credit', 'deposit', 'money in', 'paid in')),
    category: find((c) => has(c, 'category', 'account')),
  };
}

/** Reads one pasted file. `what` names it in messages ("bank statement", "books"). */
export function parseCsv(text: string, what: string): ParsedCsv {
  const rows = splitCsv(text).map((cells, i) => ({ cells, row: i + 1 })).filter((r) => r.cells.some((c) => c !== ''));
  if (!rows.length) return { lines: [], skipped: [], error: `The ${what} is empty. Paste the rows or choose a CSV file.` };
  let cols = findColumns(rows[0].cells);
  let body = rows.slice(1);
  if (cols.amount < 0 && (cols.debit < 0 || cols.credit < 0)) {
    // No header we recognise: read the columns from the first row's contents instead.
    const c = rows[0].cells;
    const amount = c.map((x, i) => (parseMoney(x) !== null && parseDate(x) === null ? i : -1)).filter((i) => i >= 0).pop() ?? -1;
    const date = c.findIndex((x) => parseDate(x) !== null);
    if (amount < 0) return { lines: [], skipped: [], error: `Could not find an amount column in the ${what}. It needs columns like Date, Description, Amount.` };
    cols = { date, text: c.findIndex((x, i) => i !== amount && i !== date && x !== ''), amount, debit: -1, credit: -1, category: -1 };
    body = rows;
  }
  const lines: CsvLine[] = [];
  const skipped: ParsedCsv['skipped'] = [];
  for (const { cells, row } of body) {
    const text = (cols.text >= 0 ? cells[cols.text] : '') ?? '';
    let cents: number | null;
    if (cols.amount >= 0) cents = parseMoney(cells[cols.amount] ?? '');
    else {
      const out = parseMoney(cells[cols.debit] ?? '');
      const inn = parseMoney(cells[cols.credit] ?? '');
      cents = out === null && inn === null ? null : Math.abs(inn ?? 0) - Math.abs(out ?? 0);
    }
    if (BALANCE_ROW.test(text)) { skipped.push({ row, why: 'a balance or total row, not a transaction' }); continue; }
    if (cents === null) { skipped.push({ row, why: 'no amount could be read' }); continue; }
    if (lines.length >= MAX_LINES) { skipped.push({ row, why: `more than ${MAX_LINES} rows` }); continue; }
    lines.push({
      row,
      date: cols.date >= 0 ? parseDate(cells[cols.date] ?? '') : null,
      text: text || '(no description)',
      cents,
      category: cols.category >= 0 ? (cells[cols.category] ?? '') || null : null,
    });
  }
  if (!lines.length) return { lines, skipped, error: `No transactions could be read from the ${what}.` };
  return { lines, skipped, error: null };
}

// ---------- pairing the two lists

export type FindingKind = 'duplicate' | 'amount' | 'missing' | 'notAtBank' | 'category';

export interface Finding {
  kind: FindingKind;
  bank: CsvLine | null;
  books: CsvLine | null;
  /** For a duplicate: the other copy, the one that found its bank line. */
  twin: CsvLine | null;
  /** How much of "bank total minus books total" this line explains. Zero for a category note. */
  effectCents: number;
  /** For an amount difference: the two amounts use the same digits in another order. */
  swapped: boolean;
}

export interface CheckResult {
  bankTotal: number;
  booksTotal: number;
  /** bankTotal - booksTotal, and always the sum of the findings' effects. */
  difference: number;
  matched: number;
  findings: Finding[];
}

const STOP = new Set(['the', 'and', 'inc', 'llc', 'pos', 'card', 'debit', 'purchase', 'checkcard', 'ach', 'online', 'from', 'for']);
function tokens(text: string): Set<string> {
  return new Set(text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter((t) => t.length >= 3 && !/^\d+$/.test(t) && !STOP.has(t)));
}
/** Share of the shorter description's words found in the other one: 0 to 1. */
export function similarity(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let both = 0;
  for (const t of A) if (B.has(t)) both++;
  return both / Math.min(A.size, B.size);
}

function dayNumber(isoDay: string | null): number | null {
  if (!isoDay) return null;
  const [y, m, d] = isoDay.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}
/** Days apart; a missing date counts as the edge of the window, so it can still match by amount. */
function gap(a: CsvLine, b: CsvLine): number {
  const x = dayNumber(a.date);
  const y = dayNumber(b.date);
  return x === null || y === null ? WINDOW_DAYS : Math.abs(x - y);
}
const digits = (cents: number) => String(Math.abs(cents)).split('').sort().join('');
/** 9415 and 9145: the same digits in another order, the classic typing slip. */
export function looksSwapped(a: number, b: number): boolean {
  return a !== b && Math.sign(a) === Math.sign(b) && digits(a) === digits(b);
}

const SUSPECT_INCOME = /\b(sales|income|revenue)\b/i;
const SUSPECT_TEXT = /\b(transfer|savings|owner|loan|capital|contribution)\b/i;

export function reconcile(bank: CsvLine[], books: CsvLine[]): CheckResult {
  const bankFree = new Set(bank);
  const booksFree = new Set(books);
  const pairs: { bank: CsvLine; books: CsvLine }[] = [];
  const findings: Finding[] = [];

  // 1. the same amount, close in time: the nearest dates pair first, then the more alike descriptions
  const exact: { b: CsvLine; k: CsvLine; g: number; s: number }[] = [];
  for (const b of bank) for (const k of books) if (b.cents === k.cents && gap(b, k) <= WINDOW_DAYS) exact.push({ b, k, g: gap(b, k), s: similarity(b.text, k.text) });
  exact.sort((x, y) => x.g - y.g || y.s - x.s || x.b.row - y.b.row || x.k.row - y.k.row);
  for (const c of exact) {
    if (!bankFree.has(c.b) || !booksFree.has(c.k)) continue;
    bankFree.delete(c.b);
    booksFree.delete(c.k);
    pairs.push({ bank: c.b, books: c.k });
  }

  // 2. the same payment with a different amount: alike descriptions, close in time, the same direction
  const near: { b: CsvLine; k: CsvLine; g: number; s: number; sw: boolean }[] = [];
  for (const b of bankFree) for (const k of booksFree) {
    const s = similarity(b.text, k.text);
    const sw = looksSwapped(b.cents, k.cents);
    if (b.cents !== k.cents && Math.sign(b.cents) === Math.sign(k.cents) && gap(b, k) <= WINDOW_DAYS && s >= 0.5) near.push({ b, k, g: gap(b, k), s, sw });
  }
  near.sort((x, y) => Number(y.sw) - Number(x.sw) || y.s - x.s || x.g - y.g || x.b.row - y.b.row);
  for (const c of near) {
    if (!bankFree.has(c.b) || !booksFree.has(c.k)) continue;
    bankFree.delete(c.b);
    booksFree.delete(c.k);
    findings.push({ kind: 'amount', bank: c.b, books: c.k, twin: null, effectCents: c.b.cents - c.k.cents, swapped: c.sw });
  }

  // 3. what is left in the books: a second copy of a paired line, or a line the bank has not seen
  for (const k of books) {
    if (!booksFree.has(k)) continue;
    const twin = pairs.find((p) => p.books.cents === k.cents && gap(p.books, k) <= WINDOW_DAYS && similarity(p.books.text, k.text) >= 0.5)?.books ?? null;
    findings.push({ kind: twin ? 'duplicate' : 'notAtBank', bank: null, books: k, twin, effectCents: -k.cents, swapped: false });
  }
  // 4. what is left at the bank: nobody recorded it
  for (const b of bank) if (bankFree.has(b)) findings.push({ kind: 'missing', bank: b, books: null, twin: null, effectCents: b.cents, swapped: false });

  // 5. balanced is not the same as right: money filed as income that reads like a transfer or owner money
  for (const k of books) {
    if (k.cents > 0 && k.category && SUSPECT_INCOME.test(k.category) && SUSPECT_TEXT.test(k.text)) {
      findings.push({ kind: 'category', bank: null, books: k, twin: null, effectCents: 0, swapped: false });
    }
  }

  const order: FindingKind[] = ['duplicate', 'amount', 'missing', 'notAtBank', 'category'];
  findings.sort((x, y) => order.indexOf(x.kind) - order.indexOf(y.kind) || (x.books ?? x.bank)!.row - (y.books ?? y.bank)!.row);
  const bankTotal = sumCents(bank.map((l) => l.cents));
  const booksTotal = sumCents(books.map((l) => l.cents));
  return { bankTotal, booksTotal, difference: bankTotal - booksTotal, matched: pairs.length, findings };
}

// ---------- sample files: a made-up business, so the tool can be tried in one press

export const SAMPLE_BANK = `Date,Description,Amount
04/01/2026,SQUARE INC DEPOSIT,"1,250.00"
04/02/2026,CHECKCARD SHELL OIL,-48.20
04/03/2026,STAPLES #0412,-64.19
04/06/2026,ONLINE TRANSFER FROM SAVINGS 4471,"2,000.00"
04/08/2026,VERIZON WIRELESS,-91.45
04/10/2026,SQUARE INC DEPOSIT,860.00
04/14/2026,ZELLE FROM M ORTEGA,300.00
04/17/2026,CHECKCARD SHELL OIL,-52.75
04/21/2026,ADOBE *ACROBAT,-22.99
04/24/2026,SQUARE INC DEPOSIT,"1,105.00"
04/30/2026,MONTHLY MAINTENANCE FEE,-12.00
`;

export const SAMPLE_BOOKS = `Date,Payee,Category,Amount
2026-04-01,Square deposit,Sales income,1250.00
2026-04-02,"Shell, van fuel",Car and truck,-48.20
2026-04-03,"Staples, paper and toner",Office supplies,-64.19
2026-04-03,"Staples, paper and toner",Office supplies,-64.19
2026-04-06,Transfer from savings,Sales income,2000.00
2026-04-08,Verizon wireless,Phone and internet,-94.15
2026-04-10,Square deposit,Sales income,860.00
2026-04-14,Zelle from M Ortega,Sales income,300.00
2026-04-17,"Shell, van fuel",Car and truck,-52.75
2026-04-21,Adobe Acrobat,Software,-22.99
2026-04-24,Square deposit,Sales income,1105.00
2026-04-28,"Check 1042, Lakeside Print Shop",Advertising,-180.00
`;
