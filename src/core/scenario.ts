import type { CategoryId, LedgerEntry, Scenario, StatementLine } from './types';

/**
 * Scenario 1 — SYNTHETIC training data (fictional business, fictional vendors' transactions).
 *
 * Planted problems:
 *  - T09 (Upwork contractor, Oct 15, −$412.50) is recorded twice: once from the bank feed,
 *    once typed in manually. Either copy may be deleted.
 *  - T03 (Adobe) is categorized as Office Supplies; should be Software & Subscriptions.
 *  - T10 (Shell fuel) is categorized as Meals; should be Car & Truck.
 * Traps:
 *  - T05/T06: two real, identical Blue Bottle coffees on the same day. Both are on the
 *    statement. Deleting one is an error, not a dedupe.
 *  - T13: a second, real Upwork payment for the same amount on Oct 29. Deleting it instead of
 *    the Oct 15 duplicate makes the balance match ($0.00) while the books are still wrong.
 */

interface Txn {
  txnId: string;
  date: string;
  description: string;
  amountCents: number;
  expected: CategoryId;
}

const TXNS: Txn[] = [
  { txnId: 'T01', date: '2026-10-01', description: 'Client payment — Harbor Dental', amountCents: 240000, expected: 'sales' },
  { txnId: 'T02', date: '2026-10-02', description: 'Oakline Properties — studio rent', amountCents: -120000, expected: 'rent' },
  { txnId: 'T03', date: '2026-10-03', description: 'Adobe Creative Cloud', amountCents: -5999, expected: 'software' },
  { txnId: 'T04', date: '2026-10-05', description: 'Staples — printer paper & ink', amountCents: -8437, expected: 'office' },
  { txnId: 'T05', date: '2026-10-07', description: 'Blue Bottle Coffee — client meeting', amountCents: -1250, expected: 'meals' },
  { txnId: 'T06', date: '2026-10-07', description: 'Blue Bottle Coffee — client meeting', amountCents: -1250, expected: 'meals' },
  { txnId: 'T07', date: '2026-10-09', description: 'Comcast Business — internet', amountCents: -8999, expected: 'utilities' },
  { txnId: 'T08', date: '2026-10-12', description: 'Client payment — Fernwood Bakery', amountCents: 85000, expected: 'sales' },
  { txnId: 'T09', date: '2026-10-15', description: 'Upwork — contractor, logo milestone 1', amountCents: -41250, expected: 'contract' },
  { txnId: 'T10', date: '2026-10-18', description: 'Shell — fuel', amountCents: -4620, expected: 'car' },
  { txnId: 'T11', date: '2026-10-22', description: 'Monthly service fee', amountCents: -1500, expected: 'bankfees' },
  { txnId: 'T12', date: '2026-10-28', description: 'Client payment — Lumen Yoga', amountCents: 60000, expected: 'sales' },
  { txnId: 'T13', date: '2026-10-29', description: 'Upwork — contractor, logo milestone 2', amountCents: -41250, expected: 'contract' },
];

const OPENING = 425000;

const statement: StatementLine[] = TXNS.map(({ txnId, date, description, amountCents }) => ({
  txnId,
  date,
  description,
  amountCents,
}));

function row(entryId: string, t: Txn, overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    entryId,
    txnId: t.txnId,
    date: t.date,
    description: t.description,
    amountCents: t.amountCents,
    category: t.expected,
    source: 'Bank feed',
    ...overrides,
  };
}

const T = Object.fromEntries(TXNS.map((t) => [t.txnId, t])) as Record<string, Txn>;

const ledger: LedgerEntry[] = [
  row('E01', T.T01),
  row('E02', T.T02),
  row('E03', T.T03, { category: 'office' }),
  row('E04', T.T04),
  row('E05', T.T05),
  row('E06', T.T06),
  row('E07', T.T07),
  row('E08', T.T08),
  row('E09', T.T09),
  row('E10', T.T09, { source: 'Manual entry' }),
  row('E11', T.T10, { category: 'meals' }),
  row('E12', T.T11),
  row('E13', T.T12),
  row('E14', T.T13),
];

export const SCENARIO_1: Scenario = {
  id: 'oct-2026-design-studio',
  title: 'October close: Maple & Pine Design Studio',
  business: 'Maple & Pine Design Studio (fictional sole proprietor)',
  account: 'Business Checking ••4821 (synthetic)',
  currency: 'USD',
  period: 'Oct 1 – Oct 31, 2026',
  openingBalanceCents: OPENING,
  // Stated explicitly as on a real statement; a test asserts it equals opening + statement lines.
  statementClosingBalanceCents: 575445,
  statement,
  expectedCategory: Object.fromEntries(TXNS.map((t) => [t.txnId, t.expected])),
  ledger,
};
