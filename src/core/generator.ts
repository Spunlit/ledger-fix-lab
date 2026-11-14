import { applyAction, checkAll, createSession, validateScenario } from './engine';
import { formatCents } from './money';
import type { Action, CategoryId, LedgerEntry, Planted, Scenario, SkillId, Txn } from './types';

/**
 * Generates fresh, provably solvable client files. Every file is checked by the same engine before
 * it is returned: the scenario validator must pass, the handed-over books must fail, and the
 * reference solution must pass all four checks. All data is synthetic.
 */

// ---------------------------------------------------------------- seeded randomness

function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

export function rng(seed: string): () => number {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;
const int = (r: Rand, min: number, max: number) => min + Math.floor(r() * (max - min + 1));
const pick = <T>(r: Rand, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
function shuffle<T>(r: Rand, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------- business archetypes

interface Vendor {
  desc: string;
  /** Bank text; {md} = MMDD, {n} = store number. */
  bank: string;
  category: CategoryId;
  min: number; // dollars
  max: number;
  /** A plausible wrong category a client might choose (rule-wise clearly wrong). */
  wrong?: CategoryId;
  /** Small purchases that can genuinely repeat on the same day. */
  repeatable?: boolean;
}

interface Archetype {
  business: string;
  owner: string;
  trade: string;
  income: { desc: string; bank: string; min: number; max: number };
  vendors: Vendor[];
  helper: { name: string; work: string };
}

const ARCHETYPES: Archetype[] = [
  {
    business: 'Harbor Line Mobile Grooming',
    owner: 'Maya Okafor',
    trade: 'mobile dog grooming',
    income: { desc: 'Square payout, grooming appointments', bank: 'SQUARE INC DES:SQ{ymd} DEPOSIT', min: 850, max: 2600 },
    vendors: [
      { desc: 'Chewy, shampoo & conditioner', bank: 'CHECKCARD {md} CHEWY.COM', category: 'supplies', min: 60, max: 240, wrong: 'office' },
      { desc: 'Petco, clipper blades', bank: 'CHECKCARD {md} PETCO #{n}', category: 'supplies', min: 30, max: 150, wrong: 'office' },
      { desc: 'T-Mobile, business phone', bank: 'T-MOBILE DES:PCS SVC', category: 'utilities', min: 55, max: 95, wrong: 'software' },
      { desc: 'Next Insurance, liability policy', bank: 'NEXT INSURANCE DES:PREMIUM', category: 'insurance', min: 60, max: 140 },
      { desc: 'Chevron, van fuel', bank: 'CHECKCARD {md} CHEVRON {n}', category: 'car', min: 45, max: 110, wrong: 'meals' },
      { desc: 'MoeGo, booking software', bank: 'MOEGO INC DES:SUBSCR', category: 'software', min: 39, max: 89, wrong: 'office' },
      { desc: 'Starbucks, client coffee', bank: 'CHECKCARD {md} STARBUCKS #{n}', category: 'meals', min: 6, max: 18, repeatable: true },
    ],
    helper: { name: 'Ana Ruiz', work: 'assistant grooming' },
  },
  {
    business: 'Copperleaf Pop-up Bakery',
    owner: 'Sam Delgado',
    trade: 'pop-up bakery',
    income: { desc: 'Stripe payout, online orders', bank: 'STRIPE DES:TRANSFER ST-{ymd}', min: 700, max: 2200 },
    vendors: [
      { desc: 'Restaurant Depot, flour & butter', bank: 'CHECKCARD {md} RESTAURANT DEPOT', category: 'supplies', min: 120, max: 420, wrong: 'office' },
      { desc: 'WebstaurantStore, pastry boxes', bank: 'WEBSTAURANTSTORE DES:ORDER', category: 'supplies', min: 50, max: 180, wrong: 'office' },
      { desc: 'Shopify, online store', bank: 'SHOPIFY DES:SUBSCRIPTION', category: 'software', min: 39, max: 79, wrong: 'office' },
      { desc: 'Comcast, internet', bank: 'COMCAST DES:CABLE PMT', category: 'utilities', min: 60, max: 110, wrong: 'software' },
      { desc: 'State Farm, business liability', bank: 'STATE FARM DES:INS PREM', category: 'insurance', min: 90, max: 180 },
      { desc: 'Shell, van fuel', bank: 'CHECKCARD {md} SHELL OIL {n}', category: 'car', min: 40, max: 95, wrong: 'meals' },
      { desc: "Dunkin', supplier meeting", bank: 'CHECKCARD {md} DUNKIN #{n}', category: 'meals', min: 5, max: 16, repeatable: true },
    ],
    helper: { name: 'Lena Park', work: 'weekend baking' },
  },
  {
    business: 'Northside Bike Repair',
    owner: 'Chris Novak',
    trade: 'bike repair shop',
    income: { desc: 'Square payout, repairs', bank: 'SQUARE INC DES:SQ{ymd} DEPOSIT', min: 900, max: 2400 },
    vendors: [
      { desc: 'Quality Bicycle Products, parts', bank: 'QBP DES:INVOICE PMT', category: 'supplies', min: 150, max: 600, wrong: 'office' },
      { desc: 'Park Tool, truing stand', bank: 'CHECKCARD {md} PARKTOOL.COM', category: 'supplies', min: 40, max: 200 },
      { desc: 'Verizon, business phone', bank: 'VERIZON WIRELESS DES:PAYMENTS', category: 'utilities', min: 55, max: 95, wrong: 'software' },
      { desc: 'Hiscox, shop insurance', bank: 'HISCOX INC DES:PREMIUM', category: 'insurance', min: 70, max: 160 },
      { desc: 'Lightspeed, POS software', bank: 'LIGHTSPEED DES:SUBSCR', category: 'software', min: 69, max: 119, wrong: 'office' },
      { desc: 'Northside Storage, shop rent', bank: 'NORTHSIDE STORAGE DES:ACH', category: 'rent', min: 650, max: 1200, wrong: 'office' },
      { desc: 'Chipotle, team lunch', bank: 'CHECKCARD {md} CHIPOTLE {n}', category: 'meals', min: 14, max: 40, repeatable: true },
    ],
    helper: { name: 'Jordan Bell', work: 'weekend repairs' },
  },
  {
    business: 'Juniper Photo Studio',
    owner: 'Priya Shah',
    trade: 'portrait photography',
    income: { desc: 'Stripe payout, session bookings', bank: 'STRIPE DES:TRANSFER ST-{ymd}', min: 800, max: 2500 },
    vendors: [
      { desc: 'Adobe Creative Cloud', bank: 'ADOBE DES:CREATIVE CLD', category: 'software', min: 55, max: 60, wrong: 'office' },
      { desc: 'B&H Photo, memory cards', bank: 'CHECKCARD {md} B&H PHOTO', category: 'supplies', min: 40, max: 220 },
      { desc: 'Squarespace, portfolio site', bank: 'SQUARESPACE DES:WEBSITE', category: 'software', min: 23, max: 49, wrong: 'office' },
      { desc: 'AT&T, business phone', bank: 'AT&T DES:PAYMENT', category: 'utilities', min: 60, max: 100, wrong: 'software' },
      { desc: 'Hiscox, equipment insurance', bank: 'HISCOX INC DES:PREMIUM', category: 'insurance', min: 40, max: 110 },
      { desc: 'Shell, car fuel for shoots', bank: 'CHECKCARD {md} SHELL OIL {n}', category: 'car', min: 30, max: 70, wrong: 'meals' },
      { desc: 'Blue Bottle, client meeting', bank: 'CHECKCARD {md} BLUE BOTTLE', category: 'meals', min: 7, max: 19, repeatable: true },
    ],
    helper: { name: 'Leo Grant', work: 'second-shooter work' },
  },
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_IN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export type ProblemKind = 'duplicate' | 'transposition' | 'missing' | 'timing' | 'categories' | 'ownerEquity';
const SKILL_OF: Record<ProblemKind, SkillId> = {
  duplicate: 'duplicates',
  transposition: 'transposition',
  missing: 'missing',
  timing: 'timing',
  categories: 'categories',
  ownerEquity: 'ownerEquity',
};
const KIND_OF_SKILL: Partial<Record<SkillId, ProblemKind>> = Object.fromEntries(
  Object.entries(SKILL_OF).map(([k, v]) => [v, k]),
) as Partial<Record<SkillId, ProblemKind>>;

export interface GenOptions {
  kind: 'daily' | 'practice';
  /** Skills to plant first (practice files). */
  focus?: SkillId[];
  /** Total distinct problem kinds to plant (3–5). */
  problems?: number;
}

export interface Generated {
  scenario: Scenario;
  /** One valid solution, used by tests (never shown to the user). */
  solution: Action[];
}

/** Swap two adjacent digits of the cents amount; returns the new amount or null. */
export function transpositions(cents: number): number[] {
  const s = String(cents);
  const out: number[] = [];
  for (let i = 0; i < s.length - 1; i++) {
    if (s[i] === s[i + 1]) continue;
    if (i === 0 && s[i + 1] === '0') continue; // no leading zero
    const t = s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2);
    out.push(Number(t));
  }
  return out;
}

// ---------------------------------------------------------------- generation

function focusKindsCount(opts: GenOptions): number {
  return new Set((opts.focus ?? []).map((k) => KIND_OF_SKILL[k]).filter(Boolean)).size;
}

export function generateFile(seed: string, opts: GenOptions): Generated {
  for (let attempt = 0; attempt < 40; attempt++) {
    const g = tryGenerate(`${seed}#${attempt}`, seed, opts);
    if (g) return g;
  }
  throw new Error(`Could not generate a valid file for seed ${seed}`);
}

function tryGenerate(rseed: string, seed: string, opts: GenOptions): Generated | null {
  const r = rng(rseed);
  const arch = pick(r, ARCHETYPES);
  const m = int(r, 0, 10); // January..November
  const year = 2026;
  const days = DAYS_IN[m];
  const date = (d: number) => `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const md = (d: number) => `${String(m + 1).padStart(2, '0')}${String(d).padStart(2, '0')}`;
  const fill = (tpl: string, d: number) =>
    tpl.replace('{md}', md(d)).replace('{ymd}', `${String(year).slice(2)}${md(d)}`).replace('{n}', String(int(r, 1000, 9899)));
  const used = new Set<number>();
  const amount = (min: number, max: number) => {
    for (let i = 0; i < 50; i++) {
      const c = int(r, min * 100, max * 100);
      if (!used.has(c)) {
        used.add(c);
        return c;
      }
    }
    return null;
  };

  // Problems to plant.
  const n = Math.max(focusKindsCount(opts), Math.min(5, Math.max(3, opts.problems ?? 4)));
  const focusKinds = (opts.focus ?? []).map((k) => KIND_OF_SKILL[k]).filter((k): k is ProblemKind => !!k);
  const rest = shuffle(r, (Object.keys(SKILL_OF) as ProblemKind[]).filter((k) => !focusKinds.includes(k)));
  const kinds = [...new Set([...focusKinds, ...rest])].slice(0, n);
  const genuineRepeat = opts.focus?.includes('genuineRepeats') || r() < 0.5;

  // Real transactions.
  const txns: Txn[] = [];
  let tid = 1;
  const add = (t: Omit<Txn, 'txnId'>) => {
    const txn = { ...t, txnId: `G${String(tid++).padStart(2, '0')}` };
    txns.push(txn);
    return txn;
  };
  const incomeDays = shuffle(r, [2, 6, 9, 13, 16, 20, 23, 26]).slice(0, int(r, 3, 4)).sort((a, b) => a - b);
  for (const d of incomeDays) {
    const c = amount(arch.income.min, arch.income.max);
    if (c === null) return null;
    add({ date: date(d), description: arch.income.desc, bankDescription: fill(arch.income.bank, d), amountCents: c, category: 'sales', onStatement: true });
  }
  const vendors = shuffle(r, arch.vendors).slice(0, int(r, 6, 7));
  if (genuineRepeat && !vendors.some((v) => v.repeatable)) vendors[vendors.length - 1] = arch.vendors.find((v) => v.repeatable)!;
  const vendorTxns: { txn: Txn; v: Vendor }[] = [];
  for (const v of vendors) {
    const d = int(r, 2, 26);
    const c = amount(v.min, v.max);
    if (c === null) return null;
    vendorTxns.push({ txn: add({ date: date(d), description: v.desc, bankDescription: fill(v.bank, d), amountCents: -c, category: v.category, onStatement: true }), v });
  }

  const planted: Planted[] = [];
  const notes: string[] = [];
  const overrides = new Map<string, Partial<LedgerEntry>>();
  const extraCopies: { txnId: string; patch: Partial<LedgerEntry> }[] = [];
  const unrecorded = new Set<string>();
  const solution: Action[] = [];
  const taken = new Set<string>();
  let manualNoted = false;

  // Genuine repeat purchase (trap): a second, real, identical small purchase on the same day.
  if (genuineRepeat) {
    const rep = vendorTxns.find((x) => x.v.repeatable);
    if (rep) {
      const o = rep.txn;
      const twin = add({ date: o.date, description: o.description, bankDescription: o.bankDescription, amountCents: o.amountCents, category: o.category, onStatement: true });
      taken.add(rep.txn.txnId);
      taken.add(twin.txnId);
      planted.push({ skill: 'genuineRepeats', txnId: rep.txn.txnId }, { skill: 'genuineRepeats', txnId: twin.txnId });
    }
  }

  const expenseCandidates = () => vendorTxns.filter((x) => !taken.has(x.txn.txnId));

  for (const kind of kinds) {
    switch (kind) {
      case 'duplicate': {
        const c = pick(r, expenseCandidates().filter((x) => !x.v.repeatable));
        if (!c) return null;
        taken.add(c.txn.txnId);
        const reimport = r() < 0.5;
        extraCopies.push({ txnId: c.txn.txnId, patch: reimport ? { source: 'Bank feed', cleared: true } : { source: 'Manual entry', cleared: false } });
        planted.push({ skill: 'duplicates', txnId: c.txn.txnId });
        if (reimport) notes.push('I reconnected my bank feed partway through the month and it pulled some transactions in a second time.');
        else if (!manualNoted) {
          notes.push('My bank feed dropped out for a few days, so I typed some things in by hand.');
          manualNoted = true;
        }
        solution.push({ type: 'delete', entryId: `COPY:${c.txn.txnId}` });
        break;
      }
      case 'transposition': {
        const cands = shuffle(r, expenseCandidates());
        let done = false;
        for (const c of cands) {
          const a = -c.txn.amountCents;
          const others = new Set(txns.filter((t) => t !== c.txn).map((t) => Math.abs(t.amountCents)));
          const opts2 = transpositions(a).filter((w) => w > 0 && w !== a && !others.has(w) && !others.has(Math.abs(w - a)));
          if (!opts2.length) continue;
          const w = pick(r, opts2);
          taken.add(c.txn.txnId);
          overrides.set(c.txn.txnId, { amountCents: -w, source: 'Manual entry', cleared: false });
          planted.push({ skill: 'transposition', txnId: c.txn.txnId });
          if (!manualNoted) {
            notes.push('My bank feed dropped out for a few days, so I typed some things in by hand.');
            manualNoted = true;
          }
          solution.push({ type: 'setAmount', entryId: `ENTRY:${c.txn.txnId}`, magnitudeCents: a }, { type: 'setCleared', entryId: `ENTRY:${c.txn.txnId}`, cleared: true });
          done = true;
          break;
        }
        if (!done) return null;
        break;
      }
      case 'missing': {
        const fee = pick(r, [
          { desc: 'Monthly maintenance fee', bank: 'MONTHLY MAINTENANCE FEE', cents: pick(r, [1200, 1500, 995, 1000]) },
          { desc: 'Paper statement fee', bank: 'PAPER STATEMENT FEE', cents: pick(r, [300, 500]) },
        ]);
        if (used.has(fee.cents)) return null;
        used.add(fee.cents);
        const t = add({ date: date(days), description: fee.desc, bankDescription: fee.bank, amountCents: -fee.cents, category: 'bankfees', onStatement: true });
        unrecorded.add(t.txnId);
        planted.push({ skill: 'missing', txnId: t.txnId });
        solution.push({ type: 'record', txnId: t.txnId, category: 'bankfees' });
        break;
      }
      case 'timing': {
        const d = int(r, days - 3, days - 1);
        const c = amount(250, 900);
        if (c === null) return null;
        const num = int(r, 1020, 1480);
        const t = add({ date: date(d), description: `Check #${num}, ${arch.helper.name}`, bankDescription: `CHECK ${num}`, amountCents: -c, category: 'contract', onStatement: false });
        overrides.set(t.txnId, { source: 'Manual entry', cleared: false });
        planted.push({ skill: 'timing', txnId: t.txnId });
        notes.push(`I mailed check #${num} to ${arch.helper.name} on the ${ordinal(d)} for ${arch.helper.work}. Not sure it has been cashed yet.`);
        break;
      }
      case 'categories': {
        const c = expenseCandidates().find((x) => x.v.wrong);
        if (!c) return null;
        taken.add(c.txn.txnId);
        overrides.set(c.txn.txnId, { ...overrides.get(c.txn.txnId), category: c.v.wrong! });
        planted.push({ skill: 'categories', txnId: c.txn.txnId });
        notes.push('I set up a couple of the expense categories myself, so they might not all be right.');
        solution.push({ type: 'recategorize', entryId: `ENTRY:${c.txn.txnId}`, category: c.v.category });
        break;
      }
      case 'ownerEquity': {
        const d = int(r, 3, 24);
        const dollars = int(r, 10, 60) * 100;
        if (used.has(dollars * 100)) return null;
        used.add(dollars * 100);
        if (r() < 0.6) {
          const t = add({ date: date(d), description: 'Transfer from savings', bankDescription: `ONLINE TRANSFER FROM SAV ...${int(r, 1000, 9999)}`, amountCents: dollars * 100, category: 'ownerContribution', onStatement: true });
          overrides.set(t.txnId, { category: 'sales' });
          planted.push({ skill: 'ownerEquity', txnId: t.txnId });
          notes.push(`On the ${ordinal(d)} I moved ${formatCents(dollars * 100)} from my personal savings into the business account. It is my own money and I am not paying it back.`);
          solution.push({ type: 'recategorize', entryId: `ENTRY:${t.txnId}`, category: 'ownerContribution' });
        } else {
          const t = add({ date: date(d), description: 'Transfer to personal checking', bankDescription: `ONLINE TRANSFER TO CHK ...${int(r, 1000, 9999)}`, amountCents: -dollars * 100, category: 'ownerDraw', onStatement: true });
          overrides.set(t.txnId, { category: 'contract' });
          planted.push({ skill: 'ownerEquity', txnId: t.txnId });
          notes.push(`On the ${ordinal(d)} I paid myself ${formatCents(dollars * 100)} by moving it to my personal checking account.`);
          solution.push({ type: 'recategorize', entryId: `ENTRY:${t.txnId}`, category: 'ownerDraw' });
        }
        break;
      }
    }
  }

  // Books as handed over, in date order (duplicate copy right after its original).
  txns.sort((a, b) => a.date.localeCompare(b.date) || a.txnId.localeCompare(b.txnId));
  const ledger: LedgerEntry[] = [];
  const entryOf = new Map<string, string>();
  const copyOf = new Map<string, string>();
  for (const t of txns) {
    if (unrecorded.has(t.txnId)) continue;
    const entryId = `E${String(ledger.length + 1).padStart(2, '0')}`;
    entryOf.set(t.txnId, entryId);
    ledger.push({ entryId, txnId: t.txnId, date: t.date, description: t.description, amountCents: t.amountCents, category: t.category, source: 'Bank feed', cleared: t.onStatement, ...overrides.get(t.txnId) });
    for (const x of extraCopies.filter((e) => e.txnId === t.txnId)) {
      const copyId = `E${String(ledger.length + 1).padStart(2, '0')}`;
      copyOf.set(t.txnId, copyId);
      ledger.push({ ...ledger[ledger.length - 1], ...x.patch, entryId: copyId });
    }
  }
  if (ledger.length < 10 || ledger.length > 16) return null;

  const opening = int(r, 2500, 12000) * 100 + int(r, 0, 99);
  const ending = txns.filter((t) => t.onStatement).reduce((sum, t) => sum + t.amountCents, opening);
  const isDaily = opts.kind === 'daily';
  const scenario: Scenario = {
    id: `${opts.kind}-${seed}`,
    number: 0,
    kind: opts.kind,
    badge: isDaily ? 'File of the day' : 'Practice file',
    title: arch.business,
    client: arch.owner,
    business: arch.business,
    entity: 'Sole proprietor',
    account: `Business checking ending ${int(r, 1000, 9999)}`,
    currency: 'USD',
    period: `${MONTHS[m]} ${year}`,
    level: 'Intermediate',
    minutes: 8,
    skills: [...new Set(planted.map((p) => p.skill))],
    note: {
      from: `${arch.owner}, owner`,
      subject: `${MONTHS[m]} books for my ${arch.trade}`,
      paragraphs: [
        pick(r, [
          `Thanks for getting my ${MONTHS[m]} books in shape before my tax preparer looks at them.`,
          `Could you reconcile ${MONTHS[m]} for me? The statement is attached.`,
          `Here is ${MONTHS[m]}. I'd like the books to be right before I apply for a small loan.`,
        ]),
        ...[...new Set(notes)].sort((a, b) => noteRank(a) - noteRank(b)),
        'I run the business as a sole proprietor.',
      ],
    },
    openingBalanceCents: opening,
    statementEndingBalanceCents: ending,
    txns,
    ledger,
    planted,
  };

  // Resolve placeholder entry ids in the reference solution.
  const resolved: Action[] = solution.map((a) => {
    if ('entryId' in a) {
      const [tag, txnId] = a.entryId.split(':');
      const id = tag === 'COPY' ? copyOf.get(txnId) : entryOf.get(txnId);
      return { ...a, entryId: id! };
    }
    return a;
  });

  // Prove it: valid, broken as handed over, solved by the reference solution.
  if (validateScenario(scenario).length) return null;
  let session = createSession(scenario);
  if (checkAll(scenario, session.state).ok) return null;
  try {
    for (const a of resolved) session = applyAction(session, a);
  } catch {
    return null;
  }
  if (!checkAll(scenario, session.state).ok) return null;
  return { scenario, solution: resolved };
}

/** Client notes read in a natural order: bank-feed trouble, categories, owner money, the mailed check. */
function noteRank(n: string): number {
  if (n.includes('bank feed')) return 0;
  if (n.includes('categories')) return 1;
  if (n.includes('savings') || n.includes('paid myself')) return 2;
  return 3;
}

function ordinal(d: number): string {
  const s = d % 100 >= 11 && d % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[d % 10] ?? 'th';
  return `${d}${s}`;
}

/** Today's file is the same for everyone: seeded by the UTC date. */
export function todaySeed(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
