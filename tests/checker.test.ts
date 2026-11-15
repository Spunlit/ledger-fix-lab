import { describe, expect, it } from 'vitest';
import { looksSwapped, parseCsv, parseDate, parseMoney, reconcile, SAMPLE_BANK, SAMPLE_BOOKS, similarity, splitCsv, type CsvLine } from '../src/core/checker';

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
