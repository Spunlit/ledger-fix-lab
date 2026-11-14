import { reconcile, statementLines } from './engine';
import { formatCents } from './money';
import type { LedgerState, Scenario } from './types';

/**
 * Bookkeepers' heuristics for chasing a reconciliation difference. They only *suggest* where to
 * look: several errors at once can combine into a number that matches nothing (or matches by
 * chance), which is why the UI calls them clues, not answers. Matching uses visible amounts only.
 */
export interface Clue {
  kind: 'statementLine' | 'clearedRow' | 'unclearedRow' | 'transposition' | 'general';
  text: string;
  entryIds: string[];
  txnIds: string[];
}

export function clues(s: Scenario, state: LedgerState): Clue[] {
  const d = reconcile(s, state).differenceCents;
  if (d === 0) return [];
  const out: Clue[] = [];
  const amt = formatCents(Math.abs(d));

  // Statement ending − cleared balance = d. A bank line nobody ticked or recorded contributes its amount.
  const lines = statementLines(s).filter((l) => l.amountCents === d);
  if (lines.length) {
    out.push({
      kind: 'statementLine',
      text: `The difference equals a bank line of ${formatCents(d)}. Is that line recorded and ticked in the books?`,
      entryIds: [],
      txnIds: lines.map((l) => l.txnId),
    });
  }
  // A ticked row that should not be there (a duplicate, or not on this statement) contributes −amount.
  const cleared = state.entries.filter((e) => e.cleared && e.amountCents === -d);
  if (cleared.length) {
    out.push({
      kind: 'clearedRow',
      text: `The difference equals ${cleared.length === 1 ? 'a ticked row' : `${cleared.length} ticked rows`} of ${formatCents(-d)}. One of them may be a duplicate or not on this statement. Compare with the bank line by line before deleting anything.`,
      entryIds: cleared.map((e) => e.entryId),
      txnIds: [],
    });
  }
  // Ticking an unticked row changes the difference by its amount.
  const uncleared = state.entries.filter((e) => !e.cleared && e.amountCents === d);
  if (uncleared.length) {
    out.push({
      kind: 'unclearedRow',
      text: `An unticked row of ${formatCents(d)} would close the gap if it is on the statement. Check the bank before ticking it.`,
      entryIds: uncleared.map((e) => e.entryId),
      txnIds: [],
    });
  }
  // Two swapped digits always produce a difference divisible by 9.
  if (Math.abs(d) % 9 === 0) {
    out.push({
      kind: 'transposition',
      text: `${amt} divides evenly by 9, a classic sign of two swapped digits (like 84.37 typed as 48.37). Compare amounts typed by hand with the bank.`,
      entryIds: [],
      txnIds: [],
    });
  }
  if (!out.length) {
    out.push({
      kind: 'general',
      text: `${amt} doesn't match any single item, so more than one thing is probably off. Work down the bank statement line by line.`,
      entryIds: [],
      txnIds: [],
    });
  }
  return out;
}
