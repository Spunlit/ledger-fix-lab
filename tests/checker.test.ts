import { describe, expect, it } from 'vitest';
import { findingsText } from '../src/ui/check';
import { looksSwapped, reconcileAuto, statementMonth, parseCsv, parseDate, parseMoney, reconcile, SAMPLE_BANK, SAMPLE_BOOKS, similarity, splitCsv, type CsvLine } from '../src/core/checker';

const line = (row: number, date: string, text: string, cents: number, category: string | null = null): CsvLine => ({ row, date, text, cents, category });
const effects = (r: ReturnType<typeof reconcile>) => r.findings.reduce((n, f) => n + f.effectCents, 0);

describe('check your own books: reading files', () => {
  it('reads money as whole cents in the usual bank formats', () => {
    expect(parseMoney('$1,234.56')).toBe(123456);
    expect(parseMoney('-45')).toBe(-4500);
    expect(parseMoney('(45.00)')).toBe(-4500);
    expect(parseMoney('45.00-')).toBe(-4500);
    expect(parseMoney('−12.5')).toBe(-1250);
    expect(parseMoney('+0.07')).toBe(7);
    expect(parseMoney('.5')).toBe(50);
    expect(parseMoney('0.1')).toBe(10);
    expect(parseMoney('19.99')).toBe(1999);
  });

  it('refuses text that is not money, and never rounds a third decimal', () => {
    for (const bad of ['', 'abc', '12.345', '1e5', '--5', '$', '12/03/2026']) expect(parseMoney(bad)).toBeNull();
  });

  it('reads ISO, US and month-name dates, and rejects impossible ones', () => {
    expect(parseDate('2026-04-03')).toBe('2026-04-03');
    expect(parseDate('4/3/2026')).toBe('2026-04-03');
    expect(parseDate('04-03-26')).toBe('2026-04-03');
    expect(parseDate('Apr 3, 2026')).toBe('2026-04-03');
    expect(parseDate('2/30/2026')).toBeNull();
    expect(parseDate('soon')).toBeNull();
  });

  it('splits quoted cells with commas, doubled quotes and line breaks', () => {
    expect(splitCsv('a,"b, c","say ""hi"""\r\n1,"two\nlines",3')).toEqual([['a', 'b, c', 'say "hi"'], ['1', 'two\nlines', '3']]);
    expect(splitCsv('a;b;c\n1;2;3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  it('reads separate debit and credit columns, and skips balance rows', () => {
    const p = parseCsv('Posted Date,Details,Debit,Credit\n4/1/2026,Beginning balance,,500.00\n4/2/2026,Coffee,4.50,\n4/3/2026,Client,,200.00\n4/4/2026,Note without money,,', 'bank statement');
    expect(p.error).toBeNull();
    expect(p.lines.map((l) => [l.date, l.text, l.cents])).toEqual([['2026-04-02', 'Coffee', -450], ['2026-04-03', 'Client', 20000]]);
    expect(p.skipped.map((s) => s.row)).toEqual([2, 5]);
  });

  it('reads a file with no header row by what the cells hold', () => {
    const p = parseCsv('4/2/2026,Coffee,-4.50\n4/3/2026,Client,200.00', 'books');
    expect(p.lines.map((l) => [l.date, l.text, l.cents])).toEqual([['2026-04-02', 'Coffee', -450], ['2026-04-03', 'Client', 20000]]);
  });

  it('reads the shapes real banks and ledgers export', () => {
    const got = (csv: string) => parseCsv(csv, 'bank statement').lines.map((l) => [l.date, l.text, l.cents]);
    // a first column of DEBIT/CREDIT next to the real description, and a balance column to ignore
    expect(got('Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #\nDEBIT,04/02/2026,SHELL OIL 5744,-48.20,DEBIT_CARD,951.80,,\nCREDIT,04/03/2026,SQUARE INC,"1,250.00",ACH_CREDIT,"2,201.80",,')).toEqual([
      ['2026-04-02', 'SHELL OIL 5744', -4820],
      ['2026-04-03', 'SQUARE INC', 125000],
    ]);
    // a summary block above the table
    expect(got('Description,,Summary Amt.\nBeginning balance as of 04/01/2026,,"1,000.00"\nTotal credits,,"1,250.00"\n\nDate,Description,Amount,Running Bal.\n04/01/2026,Beginning balance as of 04/01/2026,,"1,000.00"\n04/02/2026,SHELL OIL,-48.20,951.80')).toEqual([
      ['2026-04-02', 'SHELL OIL', -4820],
    ]);
    // no header at all, with a check number that is not the amount
    expect(got('"04/02/2026","-48.20","*","","CHECKCARD SHELL OIL"\n"04/05/2026","-180.00","*","1042","CHECK 1042"')).toEqual([
      ['2026-04-02', 'CHECKCARD SHELL OIL', -4820],
      ['2026-04-05', 'CHECK 1042', -18000],
    ]);
    // a ledger register with separate Payment and Deposit columns
    expect(got('Date,Ref No.,Payee,Memo,Payment,Deposit,Balance\n04/02/2026,,Shell,van fuel,48.20,,951.80\n04/03/2026,,Square,,,"1,250.00","2,201.80"')).toEqual([
      ['2026-04-02', 'Shell', -4820],
      ['2026-04-03', 'Square', 125000],
    ]);
  });

  it('never throws on 400 files of junk: it reads what it can and says what it skipped', () => {
    let seed = 99;
    const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    const bits = ['"', ',', ';', '\n', '\r\n', '\t', '-', '(', ')', '$', '.', '1', '23', '4/5/2026', '2026-13-40', 'Amount', 'Date', 'Debit', 'Credit', 'x', ' ', '<b>', '\u2212', '9'.repeat(30), 'NaN', '1e9', ''];
    for (let i = 0; i < 400; i++) {
      const text = Array.from({ length: rnd(60) }, () => bits[rnd(bits.length)]).join('');
      const bank = parseCsv(text, 'bank statement');
      const books = parseCsv(text.split('').reverse().join(''), 'books');
      for (const l of [...bank.lines, ...books.lines]) expect(Number.isSafeInteger(l.cents)).toBe(true);
      const r = reconcile(bank.lines, books.lines);
      expect(r.findings.reduce((n, f) => n + f.effectCents, 0)).toBe(r.difference);
    }
  });

  it('explains what is missing when a file cannot be used', () => {
    expect(parseCsv('', 'books').error).toContain('empty');
    expect(parseCsv('Name,Notes\nCoffee,nice', 'bank statement').error).toContain('amount column');
  });
});

describe('check your own books: pairing', () => {
  it('finds all five kinds in the sample files, and they add up to the difference', () => {
    const bank = parseCsv(SAMPLE_BANK, 'bank statement');
    const books = parseCsv(SAMPLE_BOOKS, 'books');
    expect(bank.lines).toHaveLength(11);
    expect(books.lines).toHaveLength(12);
    const r = reconcile(bank.lines, books.lines);
    expect(r.bankTotal).toBe(522342);
    expect(r.booksTotal).toBe(498853);
    expect(r.difference).toBe(23489);
    expect(r.matched).toBe(9);
    expect(r.findings.map((f) => f.kind)).toEqual(['duplicate', 'amount', 'missing', 'notAtBank', 'category']);
    const [dup, amt, miss, out, cat] = r.findings;
    expect(dup.books!.text).toContain('Staples');
    expect(dup.twin!.row).not.toBe(dup.books!.row);
    expect([amt.bank!.cents, amt.books!.cents, amt.swapped]).toEqual([-9145, -9415, true]);
    expect(miss.bank!.text).toBe('MONTHLY MAINTENANCE FEE');
    expect(out.books!.text).toContain('Check 1042');
    expect(cat.books!.text).toBe('Transfer from savings');
    expect(effects(r)).toBe(r.difference);
  });

  it('two real identical purchases are not a duplicate', () => {
    const bank = [line(2, '2026-04-02', 'CHECKCARD SHELL OIL', -4000), line(3, '2026-04-02', 'CHECKCARD SHELL OIL', -4000)];
    const books = [line(2, '2026-04-02', 'Shell, van fuel', -4000), line(3, '2026-04-02', 'Shell, van fuel', -4000)];
    const r = reconcile(bank, books);
    expect(r.findings).toEqual([]);
    expect(r.matched).toBe(2);
    expect(r.difference).toBe(0);
  });

  it('an unrelated line with the same amount is "not at the bank yet", not a duplicate', () => {
    const bank = [line(2, '2026-04-02', 'STAPLES #0412', -5000)];
    const books = [line(2, '2026-04-02', 'Staples, toner', -5000), line(3, '2026-04-03', 'Check 88, window cleaner', -5000)];
    const r = reconcile(bank, books);
    expect(r.findings.map((f) => [f.kind, f.books!.row])).toEqual([['notAtBank', 3]]);
  });

  it('balanced files with an owner transfer filed as sales still get a note', () => {
    const bank = [line(2, '2026-04-06', 'ONLINE TRANSFER FROM SAVINGS', 200000)];
    const books = [line(2, '2026-04-06', 'Transfer from savings', 200000, 'Sales income')];
    const r = reconcile(bank, books);
    expect(r.difference).toBe(0);
    expect(r.findings.map((f) => f.kind)).toEqual(['category']);
  });

  it('reads books kept with the signs the other way round, and says so', () => {
    const bank = parseCsv(SAMPLE_BANK, 'bank statement').lines;
    const books = parseCsv(SAMPLE_BOOKS, 'books').lines;
    const turned = books.map((l) => ({ ...l, cents: -l.cents }));
    const a = reconcileAuto(bank, turned);
    expect(a.flipped).toBe(true);
    expect(a.result.matched).toBe(9);
    expect(a.result.difference).toBe(23489);
    expect(reconcileAuto(bank, books).flipped).toBe(false);
    // two short unrelated files are left as they are
    expect(reconcileAuto([line(2, '2026-04-02', 'A', -100)], [line(2, '2026-04-02', 'B', 100)]).flipped).toBe(false);
  });

  it('names the month a statement is for', () => {
    expect(statementMonth(parseCsv(SAMPLE_BANK, 'bank statement').lines)).toBe('2026-04');
    expect(statementMonth([line(2, '2026-03-31', 'a', 1), line(3, '2026-04-01', 'b', 1), line(4, '2026-04-02', 'c', 1)])).toBe('2026-04');
    expect(statementMonth([{ row: 2, date: null, text: 'a', cents: 1, category: null }])).toBeNull();
  });

  it('pairs two files of 2000 lines each, alike and unlike, without stalling', () => {
    const make = (tag: string, shift: number) => Array.from({ length: 2000 }, (_, i) => line(i + 2, `2026-04-${String(1 + (i % 28)).padStart(2, '0')}`, `Vendor ${tag}${i} store`, -(100 + i * 7) - shift));
    const started = Date.now();
    const same = reconcile(make('a', 0), make('a', 0));
    const unlike = reconcile(make('a', 0), make('b', 3));
    expect(same.matched).toBe(2000);
    expect(unlike.findings.reduce((n, f) => n + f.effectCents, 0)).toBe(unlike.difference);
    expect(Date.now() - started).toBeLessThan(10_000);
  });

  it('knows a transposition from an ordinary difference', () => {
    expect(looksSwapped(-9145, -9415)).toBe(true);
    expect(looksSwapped(-9145, -9150)).toBe(false);
    expect(looksSwapped(9145, -9415)).toBe(false);
    expect(similarity('CHECKCARD SHELL OIL', 'Shell, van fuel')).toBeGreaterThanOrEqual(0.5);
  });

  it('on 200 shuffled files, every line is used once and the findings always equal the difference', () => {
    let seed = 7;
    const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    const names = ['Shell fuel', 'Staples paper', 'Verizon phone', 'Square deposit', 'Adobe software', 'Lakeside print', 'Zelle client'];
    for (let run = 0; run < 200; run++) {
      const bank: CsvLine[] = [];
      const books: CsvLine[] = [];
      const n = 3 + rnd(12);
      for (let i = 0; i < n; i++) {
        const cents = (rnd(2) ? 1 : -1) * (100 + rnd(90000));
        const day = `2026-04-${String(1 + rnd(28)).padStart(2, '0')}`;
        const text = names[rnd(names.length)];
        const fate = rnd(10);
        if (fate !== 0) bank.push(line(bank.length + 2, day, text.toUpperCase(), cents));
        if (fate !== 1) books.push(line(books.length + 2, day, text, fate === 2 ? cents + 9 * (1 + rnd(50)) * Math.sign(cents) : cents, 'Sales income'));
        if (fate === 3) books.push(line(books.length + 2, day, text, cents, 'Sales income'));
      }
      const r = reconcile(bank, books);
      expect(effects(r)).toBe(r.difference);
      const used = r.findings.filter((f) => f.kind !== 'category');
      expect(used.filter((f) => f.bank).length + r.matched).toBe(bank.length);
      expect(used.filter((f) => f.books).length + r.matched).toBe(books.length);
    }
  });
});

describe('check your own books: the list as text', () => {
  it('lists every finding of the sample files with its lines and what to do', () => {
    const t = findingsText({ bank: SAMPLE_BANK, books: SAMPLE_BOOKS, sample: true, ran: true }, null);
    expect(t).toContain('difference +$234.89. 9 lines paired.');
    expect(t).toContain('1. In the books twice, at the bank once');
    expect(t).toContain('2. The amounts differ (two digits look swapped)');
    expect(t).toContain('Bank row 12: MONTHLY MAINTENANCE FEE, Apr 30, \u2212$12.00');
    expect(t.split('\n').filter((l) => /^\d\./.test(l))).toHaveLength(5);
  });

  it('copies only the free findings for a person without the plan', () => {
    const t = findingsText({ bank: SAMPLE_BANK, books: SAMPLE_BOOKS, sample: false, ran: true }, null);
    expect(t.split('\n').filter((l) => /^\d\./.test(l))).toHaveLength(3);
  });
});
