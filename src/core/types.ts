// Pure domain types. No DOM. Money is always signed integer cents (deposit > 0, withdrawal < 0).

export type CategoryKind = 'income' | 'expense' | 'equity';

export type CategoryId =
  | 'sales'
  | 'rent'
  | 'software'
  | 'office'
  | 'supplies'
  | 'meals'
  | 'utilities'
  | 'insurance'
  | 'contract'
  | 'car'
  | 'bankfees'
  | 'ownerContribution'
  | 'ownerDraw';

export interface Category {
  id: CategoryId;
  name: string;
  kind: CategoryKind;
  /** Plain-language rule shown to the user. */
  rule: string;
}

export type SkillId = 'duplicates' | 'genuineRepeats' | 'missing' | 'transposition' | 'timing' | 'categories' | 'ownerEquity';

/**
 * A real-world transaction: the truth the checker grades against. Hidden from the user;
 * the user sees the bank statement (cleared transactions) and the client's books.
 */
export interface Txn {
  txnId: string;
  date: string; // ISO yyyy-mm-dd
  /** How the business describes it in the books. */
  description: string;
  /** How the bank describes it on the statement (often cryptic). */
  bankDescription: string;
  amountCents: number;
  category: CategoryId;
  /** True if it cleared the bank in this period, i.e. it appears on this statement. */
  onStatement: boolean;
}

/** One line of the bank statement, as the user sees it. */
export interface StatementLine {
  txnId: string;
  date: string;
  description: string;
  amountCents: number;
}

export type EntrySource = 'Bank feed' | 'Manual entry' | 'Added from statement';

/** One row in the client's books (an instance). Several rows may record the same Txn (a duplicate). */
export interface LedgerEntry {
  entryId: string;
  /** Real transaction this row records. Hidden from the user. */
  txnId: string;
  date: string;
  description: string;
  amountCents: number;
  category: CategoryId;
  source: EntrySource;
  /** Ticked as cleared in the reconciliation (appears on the statement). */
  cleared: boolean;
}

export interface ClientNote {
  from: string;
  subject: string;
  paragraphs: string[];
}

/** Editing tools a scenario exposes. Guided beginners get fewer (progressive disclosure). */
export type Tool = 'delete' | 'category' | 'amount' | 'cleared' | 'record';
export const ALL_TOOLS: Tool[] = ['delete', 'category', 'amount', 'cleared', 'record'];

/** A problem deliberately planted in a scenario, tied to the transaction a check would flag. */
export interface Planted {
  skill: SkillId;
  txnId: string;
}

export interface Scenario {
  id: string;
  /** Guided cases are numbered; generated files have number 0. */
  number: number;
  kind: 'case' | 'daily' | 'practice';
  /** Short label shown in the header, e.g. "Case 2" or "File of the day". */
  badge: string;
  title: string;
  client: string;
  business: string;
  entity: string;
  account: string;
  currency: 'USD';
  period: string;
  level: 'Beginner' | 'Intermediate';
  minutes: number;
  skills: SkillId[];
  note: ClientNote;
  /** Book and bank agreed at the start of the period (prior month reconciled). */
  openingBalanceCents: number;
  /** As printed on the statement; a validator asserts it equals opening + cleared txns. */
  statementEndingBalanceCents: number;
  txns: Txn[];
  /** The client's books as handed over. */
  ledger: LedgerEntry[];
  /** What was planted, for the skill record. */
  planted: Planted[];
  /** Tools shown for this scenario; all when omitted. */
  tools?: Tool[];
}

export interface LedgerState {
  entries: LedgerEntry[];
  /** Counter for ids of rows the user records from the statement (deterministic). */
  nextAddedId: number;
}

export type Action =
  | { type: 'delete'; entryId: string }
  | { type: 'recategorize'; entryId: string; category: CategoryId }
  | { type: 'setAmount'; entryId: string; magnitudeCents: number }
  | { type: 'setCleared'; entryId: string; cleared: boolean }
  | { type: 'record'; txnId: string; category: CategoryId };

export interface Session {
  scenario: Scenario;
  state: LedgerState;
  /** Previous states, most recent last. */
  history: LedgerState[];
}
