import { categoryKind } from './categories';
import { sumCents } from './money';
import type {
  Action,
  CategoryId,
  LedgerEntry,
  LedgerState,
  Scenario,
  Session,
  StatementLine,
  Txn,
} from './types';

// ---------------------------------------------------------------- scenario helpers

/** The bank statement the user sees: transactions that cleared this period, in date order. */
export function statementLines(s: Scenario): StatementLine[] {
  return s.txns
    .filter((t) => t.onStatement)
    .map((t) => ({ txnId: t.txnId, date: t.date, description: t.bankDescription, amountCents: t.amountCents }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.txnId.localeCompare(b.txnId));
}

function txnMap(s: Scenario): Map<string, Txn> {
  return new Map(s.txns.map((t) => [t.txnId, t]));
}

// ---------------------------------------------------------------- session / actions

export function initialState(scenario: Scenario): LedgerState {
  return { entries: scenario.ledger.map((e) => ({ ...e })), nextAddedId: 1 };
}

export function createSession(scenario: Scenario): Session {
  return { scenario, state: initialState(scenario), history: [] };
}

export function isLocked(entry: LedgerEntry): boolean {
  // A row recorded straight from a statement line is cleared by definition.
  return entry.source === 'Added from statement';
}

/**
 * Pure: returns a new session. Dates, descriptions and ids are immutable; an amount can only be
 * changed in magnitude (the sign of a deposit or withdrawal never flips). A no-op creates no history.
 */
export function applyAction(session: Session, action: Action): Session {
  const { state, scenario } = session;
  let entries: LedgerEntry[];
  let nextAddedId = state.nextAddedId;

  if (action.type === 'record') {
    const chosen = txnMap(scenario).get(action.txnId);
    if (!chosen || !chosen.onStatement) throw new Error(`Not a statement line: ${action.txnId}`);
    // Identical bank lines (same date, text, amount) are indistinguishable to the user, so recording one
    // records whichever of them is not yet in the books.
    const same = (t: Txn) => t.onStatement && t.date === chosen.date && t.bankDescription === chosen.bankDescription && t.amountCents === chosen.amountCents;
    const inBooks = new Set(state.entries.map((e) => e.txnId));
    const txn = inBooks.has(chosen.txnId) ? scenario.txns.find((t) => same(t) && !inBooks.has(t.txnId)) ?? chosen : chosen;
    const entry: LedgerEntry = {
      entryId: `ADD${nextAddedId}`,
      txnId: txn.txnId,
      date: txn.date,
      description: txn.bankDescription,
      amountCents: txn.amountCents,
      category: action.category,
      source: 'Added from statement',
      cleared: true,
    };
    nextAddedId += 1;
    entries = [...state.entries, entry];
  } else {
    const idx = state.entries.findIndex((e) => e.entryId === action.entryId);
    if (idx === -1) throw new Error(`Unknown entry ${action.entryId}`);
    const current = state.entries[idx];
    const replace = (patch: Partial<LedgerEntry>) =>
      state.entries.map((e, i) => (i === idx ? { ...e, ...patch } : e));

    switch (action.type) {
      case 'delete':
        entries = state.entries.filter((_, i) => i !== idx);
        break;
      case 'recategorize':
        if (current.category === action.category) return session;
        entries = replace({ category: action.category });
        break;
      case 'setAmount': {
        const m = action.magnitudeCents;
        if (!Number.isSafeInteger(m) || m <= 0) throw new Error(`Amount must be positive integer cents, got ${m}`);
        const amountCents = current.amountCents < 0 ? -m : m;
        if (amountCents === current.amountCents) return session;
        entries = replace({ amountCents });
        break;
      }
      case 'setCleared':
        if (isLocked(current)) throw new Error(`Entry ${current.entryId} is locked as cleared`);
        if (current.cleared === action.cleared) return session;
        entries = replace({ cleared: action.cleared });
        break;
    }
  }
  return { ...session, state: { entries, nextAddedId }, history: [...session.history, state] };
}

export function canUndo(session: Session): boolean {
  return session.history.length > 0;
}

export function undo(session: Session): Session {
  if (!canUndo(session)) return session;
  return { ...session, state: session.history[session.history.length - 1], history: session.history.slice(0, -1) };
}

export function reset(session: Session): Session {
  return createSession(session.scenario);
}

// ---------------------------------------------------------------- reconciliation arithmetic

export interface Reconciliation {
  statementEndingCents: number;
  /** Sum of unticked withdrawals (negative or zero). */
  outstandingPaymentsCents: number;
  /** Sum of unticked deposits (positive or zero). */
  depositsInTransitCents: number;
  /** Statement ending + outstanding payments + deposits in transit. */
  adjustedBankCents: number;
  /** Opening + every row in the books. */
  bookBalanceCents: number;
  /** Opening + ticked rows. */
  clearedBalanceCents: number;
  /** Adjusted bank − book = statement ending − cleared balance. Zero is necessary, not sufficient. */
  differenceCents: number;
}

export function reconcile(s: Scenario, state: LedgerState): Reconciliation {
  const uncleared = state.entries.filter((e) => !e.cleared).map((e) => e.amountCents);
  const outstandingPaymentsCents = sumCents(uncleared.filter((a) => a < 0));
  const depositsInTransitCents = sumCents(uncleared.filter((a) => a > 0));
  const bookBalanceCents = sumCents([s.openingBalanceCents, ...state.entries.map((e) => e.amountCents)]);
  const clearedBalanceCents = sumCents([
    s.openingBalanceCents,
    ...state.entries.filter((e) => e.cleared).map((e) => e.amountCents),
  ]);
  const adjustedBankCents = sumCents([s.statementEndingBalanceCents, outstandingPaymentsCents, depositsInTransitCents]);
  return {
    statementEndingCents: s.statementEndingBalanceCents,
    outstandingPaymentsCents,
    depositsInTransitCents,
    adjustedBankCents,
    bookBalanceCents,
    clearedBalanceCents,
    differenceCents: adjustedBankCents - bookBalanceCents,
  };
}

// ---------------------------------------------------------------- profit & loss

export interface ProfitAndLoss {
  incomeCents: number;
  expensesCents: number; // positive number
  netIncomeCents: number;
}

function pnlOf(items: { amountCents: number; category: CategoryId }[]): ProfitAndLoss {
  let incomeCents = 0;
  let expensesCents = 0;
  for (const it of items) {
    const kind = categoryKind(it.category);
    if (kind === 'income') incomeCents = sumCents([incomeCents, it.amountCents]);
    else if (kind === 'expense') expensesCents = sumCents([expensesCents, -it.amountCents]);
  }
  return { incomeCents, expensesCents, netIncomeCents: incomeCents - expensesCents };
}

export function bookedPnl(state: LedgerState): ProfitAndLoss {
  return pnlOf(state.entries);
}

export function truePnl(s: Scenario): ProfitAndLoss {
  return pnlOf(s.txns);
}

// ---------------------------------------------------------------- checks

/** (1) Every real transaction is in the books exactly once; nothing unknown. */
export interface IntegrityResult {
  ok: boolean;
  missing: Txn[];
  extra: { txn: Txn; count: number }[];
  unknown: LedgerEntry[];
}

/** (2) Each row's amount matches the source document. */
export interface AmountResult {
  ok: boolean;
  wrong: { entry: LedgerEntry; expectedCents: number }[];
}

/** (3) A row is ticked cleared exactly when its transaction is on this statement. */
export interface ClearedResult {
  ok: boolean;
  wrong: { entry: LedgerEntry; onStatement: boolean }[];
}

/** (4) Each row is in the right category. Independent of money. */
export interface CategoryResult {
  ok: boolean;
  wrong: { entry: LedgerEntry; expected: CategoryId }[];
  booked: ProfitAndLoss;
  correct: ProfitAndLoss;
}

export interface CheckReport {
  ok: boolean;
  balanced: boolean;
  recon: Reconciliation;
  integrity: IntegrityResult;
  amounts: AmountResult;
  cleared: ClearedResult;
  categories: CategoryResult;
}

export function checkIntegrity(s: Scenario, state: LedgerState): IntegrityResult {
  const truth = txnMap(s);
  const counts = new Map<string, number>();
  const unknown: LedgerEntry[] = [];
  for (const e of state.entries) {
    if (!truth.has(e.txnId)) unknown.push(e);
    else counts.set(e.txnId, (counts.get(e.txnId) ?? 0) + 1);
  }
  const missing: Txn[] = [];
  const extra: { txn: Txn; count: number }[] = [];
  for (const t of s.txns) {
    const n = counts.get(t.txnId) ?? 0;
    if (n === 0) missing.push(t);
    else if (n > 1) extra.push({ txn: t, count: n });
  }
  return { ok: !missing.length && !extra.length && !unknown.length, missing, extra, unknown };
}

export function checkAmounts(s: Scenario, state: LedgerState): AmountResult {
  const truth = txnMap(s);
  const wrong: AmountResult['wrong'] = [];
  for (const e of state.entries) {
    const t = truth.get(e.txnId);
    if (t && e.amountCents !== t.amountCents) wrong.push({ entry: e, expectedCents: t.amountCents });
  }
  return { ok: !wrong.length, wrong };
}

export function checkCleared(s: Scenario, state: LedgerState): ClearedResult {
  const truth = txnMap(s);
  const wrong: ClearedResult['wrong'] = [];
  for (const e of state.entries) {
    const t = truth.get(e.txnId);
    if (t && e.cleared !== t.onStatement) wrong.push({ entry: e, onStatement: t.onStatement });
  }
  return { ok: !wrong.length, wrong };
}

export function checkCategories(s: Scenario, state: LedgerState): CategoryResult {
  const truth = txnMap(s);
  const wrong: CategoryResult['wrong'] = [];
  for (const e of state.entries) {
    const t = truth.get(e.txnId);
    if (t && e.category !== t.category) wrong.push({ entry: e, expected: t.category });
  }
  return { ok: !wrong.length, wrong, booked: bookedPnl(state), correct: truePnl(s) };
}

export function checkAll(s: Scenario, state: LedgerState): CheckReport {
  const recon = reconcile(s, state);
  const integrity = checkIntegrity(s, state);
  const amounts = checkAmounts(s, state);
  const cleared = checkCleared(s, state);
  const categories = checkCategories(s, state);
  const balanced = recon.differenceCents === 0;
  return {
    ok: balanced && integrity.ok && amounts.ok && cleared.ok && categories.ok,
    balanced,
    recon,
    integrity,
    amounts,
    cleared,
    categories,
  };
}

// ---------------------------------------------------------------- scenario validation

/** What the user can see of a transaction in the books. */
export function signature(x: { date: string; description: string; amountCents: number }): string {
  return `${x.date}|${x.description}|${x.amountCents}`;
}

/** Guards against unfair or inconsistent scenarios. Returns problems; empty means valid. */
export function validateScenario(s: Scenario): string[] {
  const problems: string[] = [];
  const truth = txnMap(s);
  if (truth.size !== s.txns.length) problems.push('duplicate txnId');
  const money = [s.openingBalanceCents, s.statementEndingBalanceCents, ...s.txns.map((t) => t.amountCents)];
  if (!money.every(Number.isSafeInteger)) problems.push('non-integer cents');
  const computed = sumCents([s.openingBalanceCents, ...s.txns.filter((t) => t.onStatement).map((t) => t.amountCents)]);
  if (computed !== s.statementEndingBalanceCents) {
    problems.push(`statement ending ${s.statementEndingBalanceCents} != opening + cleared ${computed}`);
  }
  const ids = new Set<string>();
  const perTxn = new Map<string, number>();
  for (const e of s.ledger) {
    if (ids.has(e.entryId)) problems.push(`duplicate entryId ${e.entryId}`);
    ids.add(e.entryId);
    if (!truth.has(e.txnId)) problems.push(`entry ${e.entryId} references unknown transaction ${e.txnId}`);
    else perTxn.set(e.txnId, (perTxn.get(e.txnId) ?? 0) + 1);
    if (!Number.isSafeInteger(e.amountCents) || e.amountCents === 0) problems.push(`entry ${e.entryId} bad amount`);
    const t = truth.get(e.txnId);
    if (t && Math.sign(t.amountCents) !== Math.sign(e.amountCents)) problems.push(`entry ${e.entryId} sign differs from truth`);
  }
  for (const t of s.txns) {
    const n = perTxn.get(t.txnId) ?? 0;
    // Unrecorded transactions must be recordable from the statement; outstanding ones must be in the books.
    if (n === 0 && !t.onStatement) problems.push(`${t.txnId} is neither in the books nor on the statement`);
    if (n >= 2) {
      const sig = signature(t);
      if (s.txns.filter((u) => signature(u) === sig).length > 1) {
        problems.push(`duplicated ${t.txnId} is indistinguishable from another transaction`);
      }
    }
  }
  return problems;
}
