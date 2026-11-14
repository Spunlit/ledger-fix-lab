import { sumCents } from './money';
import type {
  Action,
  CategoryId,
  LedgerEntry,
  LedgerState,
  Scenario,
  Session,
  StatementLine,
} from './types';

// ---------------------------------------------------------------- session / actions

export function createSession(scenario: Scenario): Session {
  return { scenario, state: initialState(scenario), history: [] };
}

export function initialState(scenario: Scenario): LedgerState {
  return { entries: scenario.ledger.map((e) => ({ ...e })) };
}

/**
 * Pure: returns a new session. Only two actions exist — delete a row, change its category.
 * Amounts, dates and ids are immutable by construction. A no-op action does not create history.
 */
export function applyAction(session: Session, action: Action): Session {
  const { state } = session;
  const idx = state.entries.findIndex((e) => e.entryId === action.entryId);
  if (idx === -1) throw new Error(`Unknown entry ${action.entryId}`);

  let entries: LedgerEntry[];
  switch (action.type) {
    case 'delete':
      entries = state.entries.filter((_, i) => i !== idx);
      break;
    case 'recategorize': {
      if (state.entries[idx].category === action.category) return session;
      entries = state.entries.map((e, i) => (i === idx ? { ...e, category: action.category } : e));
      break;
    }
  }
  return { ...session, state: { entries }, history: [...session.history, state] };
}

export function canUndo(session: Session): boolean {
  return session.history.length > 0;
}

export function undo(session: Session): Session {
  if (!canUndo(session)) return session;
  const history = session.history.slice(0, -1);
  return { ...session, state: session.history[session.history.length - 1], history };
}

export function reset(session: Session): Session {
  return createSession(session.scenario);
}

// ---------------------------------------------------------------- checks

/** (a) Every statement transaction has exactly one ledger row; no unknown rows. */
export interface IntegrityResult {
  ok: boolean;
  /** Statement transactions with no ledger row (a needed record was deleted). */
  missing: StatementLine[];
  /** Statement transactions recorded more than once (duplicates remain). */
  extra: { line: StatementLine; count: number }[];
  /** Ledger rows that match no statement transaction. */
  unknown: LedgerEntry[];
}

/** (b) Opening balance + ledger rows == statement closing balance. */
export interface BalanceResult {
  ok: boolean;
  ledgerBalanceCents: number;
  statementBalanceCents: number;
  /** ledger − statement. Negative: ledger shows less money than the bank. */
  differenceCents: number;
}

/** (c) Every present row has the expected category. Independent of money. */
export interface CategoryResult {
  ok: boolean;
  wrong: { entry: LedgerEntry; expected: CategoryId }[];
}

export interface CheckReport {
  ok: boolean;
  integrity: IntegrityResult;
  balance: BalanceResult;
  categories: CategoryResult;
}

export function checkIntegrity(scenario: Scenario, state: LedgerState): IntegrityResult {
  const counts = new Map<string, number>();
  const unknown: LedgerEntry[] = [];
  const known = new Set(scenario.statement.map((l) => l.txnId));
  for (const e of state.entries) {
    if (!known.has(e.txnId)) unknown.push(e);
    else counts.set(e.txnId, (counts.get(e.txnId) ?? 0) + 1);
  }
  const missing: StatementLine[] = [];
  const extra: { line: StatementLine; count: number }[] = [];
  for (const line of scenario.statement) {
    const n = counts.get(line.txnId) ?? 0;
    if (n === 0) missing.push(line);
    else if (n > 1) extra.push({ line, count: n });
  }
  return { ok: missing.length === 0 && extra.length === 0 && unknown.length === 0, missing, extra, unknown };
}

export function ledgerBalanceCents(scenario: Scenario, state: LedgerState): number {
  return sumCents([scenario.openingBalanceCents, ...state.entries.map((e) => e.amountCents)]);
}

export function checkBalance(scenario: Scenario, state: LedgerState): BalanceResult {
  const ledgerBalance = ledgerBalanceCents(scenario, state);
  const differenceCents = ledgerBalance - scenario.statementClosingBalanceCents;
  return {
    ok: differenceCents === 0,
    ledgerBalanceCents: ledgerBalance,
    statementBalanceCents: scenario.statementClosingBalanceCents,
    differenceCents,
  };
}

export function checkCategories(scenario: Scenario, state: LedgerState): CategoryResult {
  const wrong: CategoryResult['wrong'] = [];
  for (const entry of state.entries) {
    const expected = scenario.expectedCategory[entry.txnId];
    if (expected === undefined) continue; // unknown rows are reported by the integrity check
    if (entry.category !== expected) wrong.push({ entry, expected });
  }
  return { ok: wrong.length === 0, wrong };
}

export function checkAll(scenario: Scenario, state: LedgerState): CheckReport {
  const integrity = checkIntegrity(scenario, state);
  const balance = checkBalance(scenario, state);
  const categories = checkCategories(scenario, state);
  return { ok: integrity.ok && balance.ok && categories.ok, integrity, balance, categories };
}

// ---------------------------------------------------------------- scenario validation

/** Visible signature: what the user can actually see to match a row with the statement. */
export function signature(x: { date: string; description: string; amountCents: number }): string {
  return `${x.date}|${x.description}|${x.amountCents}`;
}

/**
 * Guards against unfair scenarios. Returns a list of problems (empty = valid):
 *  - money must be integer cents, statement closing must equal opening + statement lines;
 *  - every ledger row's visible fields must match its statement line (ids stay hidden);
 *  - a duplicated transaction must not share its visible signature with another statement line,
 *    otherwise the user could not tell which copy is "extra" and equivalent states could fail.
 */
export function validateScenario(s: Scenario): string[] {
  const problems: string[] = [];
  const amounts = [s.openingBalanceCents, s.statementClosingBalanceCents, ...s.statement.map((l) => l.amountCents)];
  if (!amounts.every(Number.isSafeInteger)) problems.push('non-integer cents');
  const computed = sumCents([s.openingBalanceCents, ...s.statement.map((l) => l.amountCents)]);
  if (computed !== s.statementClosingBalanceCents) {
    problems.push(`statement closing ${s.statementClosingBalanceCents} != opening + lines ${computed}`);
  }
  const lines = new Map(s.statement.map((l) => [l.txnId, l]));
  if (lines.size !== s.statement.length) problems.push('duplicate txnId in statement');
  const entryIds = new Set<string>();
  const perTxn = new Map<string, number>();
  for (const e of s.ledger) {
    if (entryIds.has(e.entryId)) problems.push(`duplicate entryId ${e.entryId}`);
    entryIds.add(e.entryId);
    perTxn.set(e.txnId, (perTxn.get(e.txnId) ?? 0) + 1);
    const line = lines.get(e.txnId);
    if (!line) {
      problems.push(`entry ${e.entryId} references unknown transaction ${e.txnId}`);
      continue;
    }
    if (signature(line) !== signature(e)) problems.push(`entry ${e.entryId} does not match statement ${e.txnId}`);
    if (!Number.isSafeInteger(e.amountCents)) problems.push(`entry ${e.entryId} non-integer cents`);
  }
  for (const line of s.statement) {
    if (!(line.txnId in s.expectedCategory)) problems.push(`no expected category for ${line.txnId}`);
  }
  for (const [txnId, n] of perTxn) {
    const line = lines.get(txnId);
    if (n < 2 || !line) continue; // unknown txns already reported above
    const sig = signature(line);
    const clash = s.statement.filter((l) => signature(l) === sig).length;
    if (clash > 1) problems.push(`duplicated ${txnId} is visually indistinguishable from another statement line`);
  }
  return problems;
}
