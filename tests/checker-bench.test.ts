import { describe, expect, it } from 'vitest';
import { reconcile, type CsvLine, type FindingKind } from '../src/core/checker';

/**
 * A benchmark, not a model: the checker is fixed rules, so there is nothing to train. What can be measured
 * is how often those rules find a mistake that was planted on purpose. This builds 500 made-up months
 * (a bank list and a books list that agree), plants known mistakes in the books, and counts how many the
 * checker reports with the right kind, and how many findings it reports that were never planted.
 */
const VENDORS: [bank: string, books: string][] = [
  ['SHELL OIL 57444', 'Shell, fuel'],
  ['AMZN MKTP US*2K4RT1', 'Amazon, supplies'],
  ['STRIPE TRANSFER ST-K2L9', 'Stripe payout'],
  ['SQ *BLUE BOTTLE COFFEE', 'Blue Bottle, client meeting'],
  ['COMCAST CABLE COMM', 'Comcast internet'],
  ['VERIZON WIRELESS PMT', 'Verizon, phone'],
  ['ADOBE *CREATIVE CLOUD', 'Adobe Creative Cloud'],
  ['HOME DEPOT #0412', 'Home Depot, materials'],
  ['STATE FARM INSURANCE', 'State Farm insurance'],
  ['ZELLE FROM J MARTINEZ', 'Zelle, J Martinez job'],
  ['USPS PO 1234567', 'USPS postage'],
  ['COSTCO WHSE #0031', 'Costco, supplies'],
  ['GOOGLE *WORKSPACE', 'Google Workspace'],
  ['UBER *TRIP HELP.UBER.COM', 'Uber, client visit'],
  ['CHECKCARD 0503 OFFICE DEPOT', 'Office Depot, paper'],
  ['PAYPAL TRANSFER', 'PayPal payout'],
  ['INTUIT *QUICKBOOKS', 'QuickBooks subscription'],
  ['LOWES #00907', "Lowe's, tools"],
  ['DEPOSIT MOBILE', 'Client check deposit'],
  ['AUTOZONE #3321', 'AutoZone, parts'],
];

function rng(seed: number) {
  let s = seed;
  return (n: number) => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return Math.floor(s / 65536) % n; // the high bits: the low ones of this generator repeat
  };
}
const day = (d: number) => `2026-04-${String(Math.min(28, Math.max(1, d))).padStart(2, '0')}`;

/** Swaps two neighbouring digits that differ, so the amount really changes. */
function transpose(cents: number, r: (n: number) => number): number {
  const sign = Math.sign(cents);
  const d = String(Math.abs(cents)).split('');
  for (let tries = 0; tries < 10; tries++) {
    const i = r(d.length - 1);
    if (d[i] !== d[i + 1] && !(i === 0 && d[i + 1] === '0')) {
      [d[i], d[i + 1]] = [d[i + 1], d[i]];
      return sign * Number(d.join(''));
    }
  }
  return cents + sign * 900;
}

interface Planted { kind: FindingKind; bankRow: number | null; booksRow: number | null }

function month(seed: number) {
  const r = rng(seed);
  const bank: CsvLine[] = [];
  const books: CsvLine[] = [];
  const planted: Planted[] = [];
  let bRow = 2;
  let kRow = 2;
  const n = 18 + r(40);
  const used = new Set<number>();
  for (let i = 0; i < n; i++) {
    const [bn, kn] = VENDORS[r(VENDORS.length)];
    const income = /STRIPE|ZELLE|PAYPAL|DEPOSIT/.test(bn);
    let cents = (income ? 1 : -1) * (500 + r(250000));
    while (used.has(cents)) cents += income ? 1 : -1; // amounts are unique, so every planted mistake has one right answer
    used.add(cents);
    const d = 1 + r(27);
    const fate = r(100);
    const b: CsvLine = { row: bRow, date: day(d), text: bn, cents, category: null };
    const k: CsvLine = { row: kRow, date: day(d - r(3)), text: kn, cents, category: income ? 'Sales income' : 'Expenses' };
    if (fate < 5) {
      // the bank has it, the books do not
      bank.push(b); bRow++;
      planted.push({ kind: 'missing', bankRow: b.row, booksRow: null });
    } else if (fate < 10) {
      // entered twice in the books
      bank.push(b); bRow++;
      books.push(k); kRow++;
      const copy = { ...k, row: kRow };
      books.push(copy); kRow++;
      planted.push({ kind: 'duplicate', bankRow: null, booksRow: -1 }); // either copy may be the one reported
      (planted[planted.length - 1] as Planted & { rows: number[] }).rows = [k.row, copy.row];
    } else if (fate < 16) {
      // two digits swapped in the books
      bank.push(b); bRow++;
      const wrong = { ...k, cents: transpose(cents, r) };
      books.push(wrong); kRow++;
      planted.push({ kind: 'amount', bankRow: b.row, booksRow: wrong.row });
    } else {
      bank.push(b); bRow++;
      books.push(k); kRow++;
    }
  }
  // a check written late in the month that the bank has not paid yet
  if (r(2)) {
    const k: CsvLine = { row: kRow++, date: day(27), text: `Check ${2000 + r(900)}, studio rent`, cents: -(40000 + r(90000)), category: 'Rent' };
    books.push(k);
    planted.push({ kind: 'notAtBank', bankRow: null, booksRow: k.row });
  }
  // the owner's own money, filed as sales: it balances, so only the category note can catch it
  if (r(2)) {
    const cents = 100000 * (1 + r(5));
    bank.push({ row: bRow++, date: day(12), text: 'ONLINE TRANSFER FROM SAV ...8812', cents, category: null });
    const k: CsvLine = { row: kRow++, date: day(12), text: 'Transfer from savings', cents, category: 'Sales income' };
    books.push(k);
    planted.push({ kind: 'category', bankRow: null, booksRow: k.row });
  }
  return { bank, books, planted };
}

describe('check your own books: benchmark on planted mistakes', () => {
  it('finds the planted mistakes in 500 made-up months and raises few false alarms', () => {
    const kinds: FindingKind[] = ['duplicate', 'amount', 'missing', 'notAtBank', 'category'];
    const plantedN = Object.fromEntries(kinds.map((k) => [k, 0])) as Record<FindingKind, number>;
    const foundN = { ...plantedN };
    let findings = 0;
    let falseAlarms = 0;
    let lines = 0;
    for (let seed = 1; seed <= 500; seed++) {
      const m = month(seed);
      lines += m.bank.length + m.books.length;
      const r = reconcile(m.bank, m.books);
      expect(r.findings.reduce((n, f) => n + f.effectCents, 0)).toBe(r.difference);
      const claimed = new Set<number>();
      for (const p of m.planted) {
        plantedN[p.kind]++;
        const rows = (p as Planted & { rows?: number[] }).rows;
        const idx = r.findings.findIndex((f, i) => !claimed.has(i) && f.kind === p.kind
          && (rows ? rows.includes(f.books!.row) : (p.bankRow === null || f.bank?.row === p.bankRow) && (p.booksRow === null || f.books?.row === p.booksRow)));
        if (idx >= 0) { foundN[p.kind]++; claimed.add(idx); }
      }
      findings += r.findings.length;
      falseAlarms += r.findings.length - claimed.size;
    }
    const total = kinds.reduce((n, k) => n + plantedN[k], 0);
    const found = kinds.reduce((n, k) => n + foundN[k], 0);
    console.log(`BENCH months=500 lines=${lines} planted=${total} found=${found} (${((found / total) * 100).toFixed(1)}%) findings=${findings} falseAlarms=${falseAlarms}`);
    console.log('BENCH by kind ' + kinds.map((k) => `${k} ${foundN[k]}/${plantedN[k]}`).join(', '));
    expect(found / total).toBeGreaterThan(0.95);
    expect(falseAlarms / findings).toBeLessThan(0.05);
  });
});
