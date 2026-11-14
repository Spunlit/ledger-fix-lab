import { statementLines } from './engine';
import type { LedgerEntry, LedgerState, Scenario, StatementLine } from './types';

/**
 * Suggested matches between the books and the bank statement, the way a bank feed proposes them.
 *
 * Uses ONLY what the user can see: amounts, dates and the Cleared tick. It never reads which real
 * transaction a row records (LedgerEntry.txnId) and never looks at the truth set, so it cannot leak
 * an answer the user could not work out by reading the two lists. That is also why it is not a
 * grade: an unmatched row can be right (an outstanding check), and a matched row can be wrong
 * (right amount, wrong category). Grading stays in engine.ts.
 */

/** A bank date and a book date this many days apart can still be the same payment. */
export const MATCH_WINDOW_DAYS = 3;

export interface RowMatch {
  /** entryId -> id of the statement line it is paired with, or null when nothing on the statement fits. */
  entryMatch: Map<string, string | null>;
  /** Statement line id -> entryId it is paired with, or null when nothing in the books fits. */
  lineMatch: Map<string, string | null>;
}

/** Whole days since 1970-01-01 for an ISO date; NaN for anything unreadable (which then matches nothing). */
function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

interface Candidate {
  entry: LedgerEntry;
  line: StatementLine;
  /** Position of the line on the statement (final tie-break). */
  lineIndex: number;
  /** Days between the book date and the bank date. */
  gapDays: number;
}

const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Pairs each statement line with at most one row of the books and vice versa.
 * A pair needs the same amount in cents and dates within ±MATCH_WINDOW_DAYS.
 * When several pairs compete, the order is deterministic: same date first, then rows ticked as
 * cleared, then the closer date, then the lower entryId, then the earlier statement line.
 */
export function matchRows(s: Scenario, state: LedgerState): RowMatch {
  const lines = statementLines(s);
  const entryMatch = new Map<string, string | null>(state.entries.map((e) => [e.entryId, null]));
  const lineMatch = new Map<string, string | null>(lines.map((l) => [l.txnId, null]));

  const candidates: Candidate[] = [];
  lines.forEach((line, lineIndex) => {
    const lineDay = dayNumber(line.date);
    for (const entry of state.entries) {
      if (entry.amountCents !== line.amountCents) continue;
      const gapDays = Math.abs(dayNumber(entry.date) - lineDay);
      if (!(gapDays <= MATCH_WINDOW_DAYS)) continue; // also rejects NaN
      candidates.push({ entry, line, lineIndex, gapDays });
    }
  });

  candidates.sort(
    (a, b) =>
      Number(a.gapDays !== 0) - Number(b.gapDays !== 0) ||
      Number(!a.entry.cleared) - Number(!b.entry.cleared) ||
      a.gapDays - b.gapDays ||
      byId(a.entry.entryId, b.entry.entryId) ||
      a.lineIndex - b.lineIndex,
  );

  for (const { entry, line } of candidates) {
    if (entryMatch.get(entry.entryId) !== null || lineMatch.get(line.txnId) !== null) continue;
    entryMatch.set(entry.entryId, line.txnId);
    lineMatch.set(line.txnId, entry.entryId);
  }
  return { entryMatch, lineMatch };
}
