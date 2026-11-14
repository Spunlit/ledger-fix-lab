import { categoryName } from './categories';
import { checkAll, type CheckReport } from './engine';
import { shortDate } from './explain';
import { formatCents } from './money';
import type { LedgerState, Scenario } from './types';

/**
 * The coach for guided cases: the single next thing to do, in plain words, and the rows it is about.
 * It reads the same checks that grade the file, so it never points at something that is already right
 * (an outstanding check, a genuine repeat purchase). It names the row and the tool, and for categories
 * it gives the reason to look, not the answer. Exam files (daily, practice) never use it.
 */
export interface CoachStep {
  kind: 'restore' | 'record' | 'duplicate' | 'amount' | 'tick' | 'untick' | 'category' | 'done';
  /** One short headline: what is wrong. */
  title: string;
  /** What to click. */
  action: string;
  /** Book rows and bank lines to highlight. */
  entryIds: string[];
  txnIds: string[];
}

const money = (cents: number) => formatCents(Math.abs(cents));

export function coachStep(s: Scenario, state: LedgerState, report: CheckReport = checkAll(s, state)): CoachStep {
  // 1. Something real was deleted: put it back before anything else.
  const gone = report.integrity.missing.find((t) => !t.onStatement || wasHandedOver(s, t.txnId));
  if (gone) {
    return {
      kind: 'restore',
      title: gone.onStatement
        ? `You deleted a real payment: ${money(gone.amountCents)} on ${shortDate(gone.date)} is on the bank statement.`
        : `You deleted a real payment of ${money(gone.amountCents)}. It just has not reached the bank yet.`,
      action: 'Press Undo to put it back.',
      entryIds: [],
      txnIds: gone.onStatement ? [gone.txnId] : [],
    };
  }
  // 2. A bank line the books never recorded.
  const missing = report.integrity.missing.find((t) => t.onStatement);
  if (missing) {
    return {
      kind: 'record',
      title: `The bank took ${money(missing.amountCents)} on ${shortDate(missing.date)}. The books do not have it.`,
      action: 'Press "Add to the books" on that bank line and pick its category.',
      entryIds: [],
      txnIds: [missing.txnId],
    };
  }
  // 3. One purchase entered more than once.
  const extra = report.integrity.extra[0];
  if (extra) {
    const copies = state.entries.filter((e) => e.txnId === extra.txn.txnId);
    return {
      kind: 'duplicate',
      title: `${copies[0]?.description ?? 'One purchase'} is in the books ${extra.count === 2 ? 'twice' : `${extra.count} times`}. The bank has it once.`,
      action: 'Delete one copy with the bin icon on its row.',
      entryIds: copies.map((e) => e.entryId),
      txnIds: [],
    };
  }
  // 4. An amount that does not match the bank.
  const amt = report.amounts.wrong[0];
  if (amt) {
    return {
      kind: 'amount',
      title: `${amt.entry.description}: the books say ${money(amt.entry.amountCents)}, the bank says ${money(amt.expectedCents)}.`,
      action: `Click the amount in the books and type ${(Math.abs(amt.expectedCents) / 100).toFixed(2)}.`,
      entryIds: [amt.entry.entryId],
      txnIds: [],
    };
  }
  // 5. A cleared tick that disagrees with the statement.
  const cl = report.cleared.wrong[0];
  if (cl) {
    return cl.onStatement
      ? {
          kind: 'tick',
          title: `${cl.entry.description} is on the bank statement, but it is not ticked as cleared.`,
          action: 'Tick its Cleared box.',
          entryIds: [cl.entry.entryId],
          txnIds: [cl.entry.txnId],
        }
      : {
          kind: 'untick',
          title: `${cl.entry.description} is ticked as cleared, but the bank has not paid it yet.`,
          action: 'Untick its Cleared box. It stays in the books as outstanding.',
          entryIds: [cl.entry.entryId],
          txnIds: [],
        };
  }
  // 6. Money matches; a category does not.
  const cat = report.categories.wrong[0];
  if (cat) {
    return {
      kind: 'category',
      title: `${cat.entry.description} is booked as ${categoryName(cat.entry.category)}. Is that what it really is?`,
      action: "Read the client's note and the category guide, then change the category on that row.",
      entryIds: [cat.entry.entryId],
      txnIds: [],
    };
  }
  return { kind: 'done', title: 'Everything checks out.', action: 'Press Check the books to confirm.', entryIds: [], txnIds: [] };
}

/** True when the handed-over books contained this transaction (so its absence means the user deleted it). */
function wasHandedOver(s: Scenario, txnId: string): boolean {
  return s.ledger.some((e) => e.txnId === txnId);
}
