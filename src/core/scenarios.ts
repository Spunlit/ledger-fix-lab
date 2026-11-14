import type { CategoryId, LedgerEntry, Scenario, Txn } from './types';

// All businesses, people, account numbers and transactions below are SYNTHETIC training data.

function txn(
  txnId: string,
  date: string,
  description: string,
  amountCents: number,
  category: CategoryId,
  opts: { bank?: string; onStatement?: boolean } = {},
): Txn {
  return {
    txnId,
    date,
    description,
    bankDescription: opts.bank ?? description,
    amountCents,
    category,
    onStatement: opts.onStatement ?? true,
  };
}

function rows(txns: Txn[], specs: [entryId: string, txnId: string, overrides?: Partial<LedgerEntry>][]): LedgerEntry[] {
  const byId = new Map(txns.map((t) => [t.txnId, t]));
  return specs.map(([entryId, txnId, overrides]) => {
    const t = byId.get(txnId);
    if (!t) throw new Error(`fixture: unknown txn ${txnId}`);
    return {
      entryId,
      txnId,
      date: t.date,
      description: t.description,
      amountCents: t.amountCents,
      category: t.category,
      source: 'Bank feed',
      cleared: t.onStatement,
      ...overrides,
    };
  });
}

// ---------------------------------------------------------------- Case 1 (beginner)
//
// Planted: T09 imported twice by the bank feed (+$412.50 difference); Adobe filed as office supplies;
// Shell fuel filed as meals.
// Traps: two real identical Blue Bottle coffees (T05/T06); a second real Upwork payment for the same
// amount (T13), deleting it instead of the duplicate makes the difference $0.00 with the books wrong.

const C1: Txn[] = [
  txn('T01', '2026-10-01', 'Client payment, Harbor Dental', 240000, 'sales'),
  txn('T02', '2026-10-02', 'Oakline Properties, studio rent', -120000, 'rent'),
  txn('T03', '2026-10-03', 'Adobe Creative Cloud', -5999, 'software'),
  txn('T04', '2026-10-05', 'Staples, printer paper & ink', -8437, 'office'),
  txn('T05', '2026-10-07', 'Blue Bottle Coffee, client meeting', -1250, 'meals'),
  txn('T06', '2026-10-07', 'Blue Bottle Coffee, client meeting', -1250, 'meals'),
  txn('T07', '2026-10-09', 'Comcast Business, internet', -8999, 'utilities'),
  txn('T08', '2026-10-12', 'Client payment, Fernwood Bakery', 85000, 'sales'),
  txn('T09', '2026-10-15', 'Upwork, contractor, logo milestone 1', -41250, 'contract'),
  txn('T10', '2026-10-18', 'Shell, fuel', -4620, 'car'),
  txn('T11', '2026-10-22', 'Monthly service fee', -1500, 'bankfees'),
  txn('T12', '2026-10-28', 'Client payment, Lumen Yoga', 60000, 'sales'),
  txn('T13', '2026-10-29', 'Upwork, contractor, logo milestone 2', -41250, 'contract'),
];

export const CASE_1: Scenario = {
  id: 'maple-pine-oct',
  number: 1,
  kind: 'case',
  badge: 'Case 1',
  tools: ['delete', 'category'],
  title: 'The doubled import',
  client: 'Jordan Pike',
  business: 'Maple & Pine Design Studio',
  entity: 'Sole proprietor',
  account: 'Business checking ending 4821',
  currency: 'USD',
  period: 'October 2026',
  level: 'Beginner',
  minutes: 6,
  skills: ['duplicates', 'genuineRepeats', 'categories'],
  note: {
    from: 'Jordan Pike, owner',
    subject: 'October books',
    paragraphs: [
      'Thanks for taking a look at October before I send it to my accountant.',
      'I reconnected my bank feed in the middle of the month and it pulled some transactions in again, so a few things might be doubled.',
      'My accountant also mentioned that a couple of expenses look like they are in the wrong place. The October statement is attached.',
    ],
  },
  openingBalanceCents: 425000,
  statementEndingBalanceCents: 575445,
  txns: C1,
  ledger: rows(C1, [
    ['E01', 'T01'],
    ['E02', 'T02'],
    ['E03', 'T03', { category: 'office' }],
    ['E04', 'T04'],
    ['E05', 'T05'],
    ['E06', 'T06'],
    ['E07', 'T07'],
    ['E08', 'T08'],
    ['E09', 'T09'],
    ['E10', 'T09'],
    ['E11', 'T10', { category: 'meals' }],
    ['E12', 'T11'],
    ['E13', 'T12'],
    ['E14', 'T13'],
  ]),
  planted: [
    { skill: 'duplicates', txnId: 'T09' },
    { skill: 'genuineRepeats', txnId: 'T05' },
    { skill: 'genuineRepeats', txnId: 'T06' },
    { skill: 'categories', txnId: 'T03' },
    { skill: 'categories', txnId: 'T10' },
  ],
};

// ---------------------------------------------------------------- Case 2 (intermediate)
//
// Planted: R03 Verizon typed by hand as $48.37 instead of $84.37 (transposition, unticked);
// R08 AutoZone in twice (bank feed + manual copy, manual unticked); R13 bank fee on the statement but
// not in the books; R06 $5,000 owner transfer from personal savings booked as Sales income.
// Traps: R14 check #1043 is real but has not cleared (outstanding), it must stay, unticked;
// R10 transfer to personal checking is correctly an owner's draw, not an expense.

const C2: Txn[] = [
  txn('R01', '2026-03-02', 'Square payout, customer payments', 128640, 'sales', { bank: 'SQUARE INC DES:SQ260302 DEPOSIT' }),
  txn('R02', '2026-03-03', 'Chemical Guys, wax & polish', -21285, 'supplies', { bank: 'CHECKCARD 0303 CHEMICAL GUYS CA' }),
  txn('R03', '2026-03-05', 'Verizon, business phone', -8437, 'utilities', { bank: 'VERIZON WIRELESS DES:PAYMENTS' }),
  txn('R04', '2026-03-06', 'Progressive, business liability', -31800, 'insurance', { bank: 'PROGRESSIVE INS DES:INS PREM' }),
  txn('R05', '2026-03-09', 'Square payout, customer payments', 190475, 'sales', { bank: 'SQUARE INC DES:SQ260309 DEPOSIT' }),
  txn('R06', '2026-03-10', 'Transfer from savings', 500000, 'ownerContribution', { bank: 'ONLINE TRANSFER FROM SAV ...1188' }),
  txn('R07', '2026-03-12', 'Shell, van fuel', -7618, 'car', { bank: 'CHECKCARD 0312 SHELL OIL 5744' }),
  txn('R08', '2026-03-14', 'AutoZone, pressure washer hose', -5499, 'supplies', { bank: 'CHECKCARD 0314 AUTOZONE #3321' }),
  txn('R09', '2026-03-16', 'Square payout, customer payments', 211830, 'sales', { bank: 'SQUARE INC DES:SQ260316 DEPOSIT' }),
  txn('R10', '2026-03-20', 'Transfer to personal checking', -150000, 'ownerDraw', { bank: 'ONLINE TRANSFER TO CHK ...4410' }),
  txn('R11', '2026-03-23', 'Square payout, customer payments', 164210, 'sales', { bank: 'SQUARE INC DES:SQ260323 DEPOSIT' }),
  txn('R12', '2026-03-25', 'Detail King, microfiber towels', -12940, 'supplies', { bank: 'CHECKCARD 0325 DETAIL KING PA' }),
  txn('R13', '2026-03-31', 'Monthly maintenance fee', -1500, 'bankfees', { bank: 'MONTHLY MAINTENANCE FEE' }),
  txn('R14', '2026-03-30', 'Check #1043, Desert Sun Mobile Wash', -65000, 'contract', { bank: 'CHECK 1043', onStatement: false }),
];

export const CASE_2: Scenario = {
  id: 'rivera-mar',
  number: 2,
  kind: 'case',
  badge: 'Case 2',
  title: 'Balanced, but wrong',
  client: 'Dani Rivera',
  business: 'Rivera Mobile Detailing',
  entity: 'Sole proprietor',
  account: 'Business checking ending 7302',
  currency: 'USD',
  period: 'March 2026',
  level: 'Intermediate',
  minutes: 10,
  skills: ['missing', 'transposition', 'timing', 'duplicates', 'ownerEquity'],
  note: {
    from: 'Dani Rivera, owner',
    subject: 'March books, before my tax preparer sees them',
    paragraphs: [
      'The bank feed glitched a couple of times in March, so I typed a few things in by hand. Sorry if that made a mess.',
      'On the 10th I moved $5,000 from my personal savings into the business account to cover a van repair. It is my own money and I am not paying it back.',
      'I mailed check #1043 to Desert Sun Mobile Wash on the 30th for subcontract work. Not sure they have cashed it yet.',
      'I run the business as a sole proprietor, if that matters.',
    ],
  },
  openingBalanceCents: 821460,
  statementEndingBalanceCents: 1777536,
  txns: C2,
  ledger: rows(C2, [
    ['E01', 'R01'],
    ['E02', 'R02'],
    ['E03', 'R03', { amountCents: -4837, source: 'Manual entry', cleared: false }],
    ['E04', 'R04'],
    ['E05', 'R05'],
    ['E06', 'R06', { category: 'sales' }],
    ['E07', 'R07'],
    ['E08', 'R08'],
    ['E09', 'R08', { source: 'Manual entry', cleared: false }],
    ['E10', 'R09'],
    ['E11', 'R10'],
    ['E12', 'R11'],
    ['E13', 'R12'],
    ['E14', 'R14', { source: 'Manual entry' }],
  ]),
  planted: [
    { skill: 'missing', txnId: 'R13' },
    { skill: 'transposition', txnId: 'R03' },
    { skill: 'timing', txnId: 'R14' },
    { skill: 'duplicates', txnId: 'R08' },
    { skill: 'ownerEquity', txnId: 'R06' },
  ],
};

export const CASES: Scenario[] = [CASE_1, CASE_2];

export function caseById(id: string): Scenario | undefined {
  return CASES.find((c) => c.id === id);
}
