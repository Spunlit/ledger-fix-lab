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
  /** The first header holding the earliest word in the list, so "Description" beats "Details". */
  const pick = (...words: string[]) => {
    for (const w of words) {
      const i = h.findIndex((c) => c.includes(w));
      if (i >= 0) return i;
    }
    return -1;
  };
  const amount = h.indexOf('amount');
  return {
    date: pick('date', 'posted'),
    text: pick('description', 'payee', 'memo', 'name', 'merchant', 'narrative', 'details'),
    amount: amount >= 0 ? amount : h.findIndex((c) => c.includes('amount') && !has(c, 'debit', 'credit')),
    debit: pick('debit', 'withdraw', 'money out', 'paid out', 'payment'),
    credit: pick('credit', 'deposit', 'money in', 'paid in'),
    category: pick('category', 'account'),
  };
}
const usable = (c: Columns) => c.amount >= 0 || (c.debit >= 0 && c.credit >= 0);

/** With no header row: the amount is the last cell written like money, the description the longest other cell. */
function guessColumns(cells: string[]): Columns | null {
  const date = cells.findIndex((x) => parseDate(x) !== null);
  const money = cells.map((x, i) => (i !== date && parseMoney(x) !== null ? i : -1)).filter((i) => i >= 0);
  const amount = money.filter((i) => /[.\-\u2212()$]/.test(cells[i])).pop() ?? money.pop() ?? -1;
  if (amount < 0) return null;
  let text = -1;
  cells.forEach((x, i) => {
    if (i !== amount && i !== date && x.length > (text < 0 ? 0 : cells[text].length)) text = i;
  });
  return { date, text, amount, debit: -1, credit: -1, category: -1 };
}

/** Reads one pasted file. `what` names it in messages ("bank statement", "books"). */
export function parseCsv(text: string, what: string): ParsedCsv {
  const rows = splitCsv(text).map((cells, i) => ({ cells, row: i + 1 })).filter((r) => r.cells.some((c) => c !== ''));
  if (!rows.length) return { lines: [], skipped: [], error: `The ${what} is empty. Paste the rows or choose a CSV file.` };
  // Some banks put a summary above the table, so the header is looked for in the first rows, not only the first.
  // A header holds labels only: a row with a date in it is data, whatever words its description has.
  const headerAt = rows.slice(0, 12).findIndex((r) => usable(findColumns(r.cells)) && !r.cells.some((x) => parseDate(x) !== null));
  let cols: Columns;
  let body: typeof rows;
  if (headerAt >= 0) {
    cols = findColumns(rows[headerAt].cells);
    body = rows.slice(headerAt + 1);
  } else {
    // No header we recognise: read the columns from the first row that holds a date and an amount.
    const first = rows.slice(0, 5).map((r) => guessColumns(r.cells)).find((c) => c && c.date >= 0) ?? guessColumns(rows[0].cells);
    if (!first) return { lines: [], skipped: [], error: `Could not find an amount column in the ${what}. It needs columns like Date, Description, Amount.` };
    cols = first;
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
const tokenCache = new Map<string, Set<string>>();
function tokens(text: string): Set<string> {
  let t = tokenCache.get(text);
  if (!t) {
    t = new Set(text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !STOP.has(w)));
    if (tokenCache.size > 20000) tokenCache.clear();
    tokenCache.set(text, t);
  }
  return t;
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
const digits = (cents: number) => String(Math.abs(cents)).split('').sort().join('');
/** Amounts one typing slip apart: one digit different, or one digit dropped or added (8437 and 843, 8437 and 8497). */
export function oneSlipApart(a: number, b: number): boolean {
  const x = String(Math.abs(a));
  const y = String(Math.abs(b));
  if (x === y) return false;
  if (x.length === y.length) {
    let diff = 0;
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) diff++;
    return diff === 1;
  }
  const [long, short] = x.length > y.length ? [x, y] : [y, x];
  if (long.length - short.length !== 1) return false;
  for (let i = 0; i < long.length; i++) if (long.slice(0, i) + long.slice(i + 1) === short) return true;
  return false;
}

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

  // Day numbers are worked out once; two files of a couple of thousand lines mean millions of comparisons.
  const dayOf = new Map<CsvLine, number | null>();
  for (const l of bank) dayOf.set(l, dayNumber(l.date));
  for (const l of books) dayOf.set(l, dayNumber(l.date));
  const gap = (x: CsvLine, y: CsvLine) => {
    const p = dayOf.get(x)!;
    const q = dayOf.get(y)!;
    return p === null || q === null ? WINDOW_DAYS : Math.abs(p - q);
  };

  // 1. the same amount, close in time: the nearest dates pair first, then the more alike descriptions
  const byCents = new Map<number, CsvLine[]>();
  for (const k of books) {
    const same = byCents.get(k.cents);
    if (same) same.push(k);
    else byCents.set(k.cents, [k]);
  }
  const exact: { b: CsvLine; k: CsvLine; g: number; s: number }[] = [];
  for (const b of bank) for (const k of byCents.get(b.cents) ?? []) {
    const g = gap(b, k);
    if (g <= WINDOW_DAYS) exact.push({ b, k, g, s: similarity(b.text, k.text) });
  }
  exact.sort((x, y) => x.g - y.g || y.s - x.s || x.b.row - y.b.row || x.k.row - y.k.row);
  for (const c of exact) {
    if (!bankFree.has(c.b) || !booksFree.has(c.k)) continue;
    bankFree.delete(c.b);
    booksFree.delete(c.k);
    pairs.push({ bank: c.b, books: c.k });
  }

  // 2. a second copy of a line that already found its bank line. This runs before amounts are compared,
  //    so a spare copy is never mistaken for a mistyped version of some other payment to the same payee.
  const twinsByCents = new Map<number, CsvLine[]>();
  for (const p of pairs) {
    const same = twinsByCents.get(p.books.cents);
    if (same) same.push(p.books);
    else twinsByCents.set(p.books.cents, [p.books]);
  }
  for (const k of books) {
    if (!booksFree.has(k)) continue;
    const twin = (twinsByCents.get(k.cents) ?? []).find((t) => gap(t, k) <= WINDOW_DAYS && similarity(t.text, k.text) >= 0.5) ?? null;
    if (!twin) continue;
    booksFree.delete(k);
    findings.push({ kind: 'duplicate', bank: null, books: k, twin, effectCents: -k.cents, swapped: false });
  }

  // 3. the same payment with a different amount: alike descriptions, close in time, the same direction,
  //    and amounts that look like one typing slip apart. Two unrelated payments to one payee stay apart.
  //    Each bank line keeps only its three best candidates, so the list stays short on large files.
  type Near = { b: CsvLine; k: CsvLine; g: number; s: number; sw: boolean };
  const best = (x: Near, y: Near) => Number(y.sw) - Number(x.sw) || y.s - x.s || x.g - y.g || x.b.row - y.b.row || x.k.row - y.k.row;
  const near: Near[] = [];
  const leftBooks = [...booksFree];
  for (const b of bankFree) {
    const mine: Near[] = [];
    for (const k of leftBooks) {
      if (b.cents < 0 !== k.cents < 0) continue;
      const g = gap(b, k);
      if (g > WINDOW_DAYS) continue;
      const sw = looksSwapped(b.cents, k.cents);
      if (!sw && !oneSlipApart(b.cents, k.cents)) continue;
      const sim = similarity(b.text, k.text);
      if (sim >= 0.5 || (sw && g <= 1)) mine.push({ b, k, g, s: sim, sw });
    }
    near.push(...mine.sort(best).slice(0, 3));
  }
  near.sort(best);
  for (const c of near) {
    if (!bankFree.has(c.b) || !booksFree.has(c.k)) continue;
    bankFree.delete(c.b);
    booksFree.delete(c.k);
    findings.push({ kind: 'amount', bank: c.b, books: c.k, twin: null, effectCents: c.b.cents - c.k.cents, swapped: c.sw });
  }

  // what is left in the books: a line the bank has not seen
  for (const k of books) {
    if (booksFree.has(k)) findings.push({ kind: 'notAtBank', bank: null, books: k, twin: null, effectCents: -k.cents, swapped: false });
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

/**
 * Some ledgers export a bank account the accountant's way round: money in as a debit, or payments as
 * positive numbers. Then almost nothing pairs. When reading the books with every sign turned over pairs
 * far more lines, that reading is used, and the page says so.
 */
export function reconcileAuto(bank: CsvLine[], books: CsvLine[]): { result: CheckResult; flipped: boolean } {
  const straight = reconcile(bank, books);
  if (straight.matched * 2 >= Math.min(bank.length, books.length)) return { result: straight, flipped: false };
  const turned = reconcile(bank, books.map((l) => ({ ...l, cents: -l.cents })));
  return turned.matched >= 3 && turned.matched > straight.matched * 2 ? { result: turned, flipped: true } : { result: straight, flipped: false };
}

/** The month most of the lines fall in, as "2026-04"; null when no date could be read. */
export function statementMonth(lines: CsvLine[]): string | null {
  const count = new Map<string, number>();
  for (const l of lines) if (l.date) count.set(l.date.slice(0, 7), (count.get(l.date.slice(0, 7)) ?? 0) + 1);
  let best: string | null = null;
  for (const [m, n] of count) if (best === null || n > count.get(best)! || (n === count.get(best)! && m > best)) best = m;
  return best;
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
