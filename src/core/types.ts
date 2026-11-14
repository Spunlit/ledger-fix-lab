// Pure domain types. No DOM. Money is always integer cents.

export type CategoryId =
  | 'sales'
  | 'rent'
  | 'software'
  | 'office'
  | 'meals'
  | 'utilities'
  | 'contract'
  | 'car'
  | 'bankfees';

export interface Category {
  id: CategoryId;
  name: string;
  /** Plain-language rule shown to the user. */
  rule: string;
}

/** One ledger row (an instance). Several rows may record the same real transaction (a duplicate). */
export interface LedgerEntry {
  /** Unique per row. */
  entryId: string;
  /** Real-world transaction this row records. Hidden from the user; used only by the checker. */
  txnId: string;
  date: string; // ISO yyyy-mm-dd
  description: string;
  /** Signed integer cents: deposit > 0, withdrawal < 0. Immutable. */
  amountCents: number;
  category: CategoryId;
  source: 'Bank feed' | 'Manual entry';
}

/** One line of the bank statement (the external source of truth). */
export interface StatementLine {
  txnId: string;
  date: string;
  description: string;
  amountCents: number;
}

export interface Scenario {
  id: string;
  title: string;
  business: string;
  account: string;
  currency: 'USD';
  period: string;
  openingBalanceCents: number;
  statementClosingBalanceCents: number;
  statement: StatementLine[];
  /** Expected category per real transaction. */
  expectedCategory: Record<string, CategoryId>;
  /** Initial (messy) ledger the user must clean. */
  ledger: LedgerEntry[];
}

/** User-editable state: only which rows remain and their categories. */
export interface LedgerState {
  entries: LedgerEntry[];
}

export type Action =
  | { type: 'delete'; entryId: string }
  | { type: 'recategorize'; entryId: string; category: CategoryId };

export interface Session {
  scenario: Scenario;
  state: LedgerState;
  /** Previous states, most recent last. */
  history: LedgerState[];
}
