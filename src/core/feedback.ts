import { checkAll, type CheckReport } from './engine';
import { flaggedTxnIds } from './skills';
import type { LedgerState, Scenario } from './types';

/**
 * Instant feedback for guided cases (learning mode): after each action, say whether it fixed a planted
 * problem or created a new one. Exam-mode files (daily / practice) don't use this.
 */
export interface Feedback {
  tone: 'good' | 'warn';
  text: string;
}

/** Planted problems that are actually wrong in the handed-over books (traps are correct as handed over). */
export function fixableTxnIds(s: Scenario, initialReport: CheckReport): string[] {
  const flagged = flaggedTxnIds(initialReport);
  return [...new Set(s.planted.map((p) => p.txnId))].filter((id) => flagged.has(id));
}

export interface Progress {
  fixed: number;
  total: number;
}

export function progress(s: Scenario, initial: LedgerState, now: LedgerState): Progress {
  const fixable = fixableTxnIds(s, checkAll(s, initial));
  const flagged = flaggedTxnIds(checkAll(s, now));
  return { fixed: fixable.filter((id) => !flagged.has(id)).length, total: fixable.length };
}

function newProblemText(report: CheckReport, txnId: string): string {
  const missing = report.integrity.missing.find((t) => t.txnId === txnId);
  if (missing) {
    return missing.onStatement
      ? `That one is real: it's on the bank statement. Undo, and look for the copy instead.`
      : `That one is real: the client issued it, it just hasn't reached the bank yet. Undo it.`;
  }
  if (report.integrity.extra.some((x) => x.txn.txnId === txnId)) return 'Now that transaction is in the books twice.';
  if (report.amounts.wrong.some((w) => w.entry.txnId === txnId)) return "That amount doesn't match the bank.";
  const cl = report.cleared.wrong.find((w) => w.entry.txnId === txnId);
  if (cl) return cl.onStatement ? "It is on this bank statement, so it should be ticked." : "It isn't on this statement yet, so leave it unticked.";
  if (report.categories.wrong.some((w) => w.entry.txnId === txnId)) return "That category doesn't fit its rule. Check the category guide.";
  return 'That made something worse.';
}

export function actionFeedback(s: Scenario, initial: LedgerState, before: LedgerState, after: LedgerState): Feedback | null {
  const rb = checkAll(s, before);
  const ra = checkAll(s, after);
  const fb = flaggedTxnIds(rb);
  const fa = flaggedTxnIds(ra);
  const created = [...fa].filter((id) => !fb.has(id));
  if (created.length) return { tone: 'warn', text: newProblemText(ra, created[0]) };
  const resolved = [...fb].filter((id) => !fa.has(id));
  if (!resolved.length) return null;
  const p = progress(s, initial, after);
  if (ra.ok) return { tone: 'good', text: 'All fixed. Press Check the books to confirm.' };
  return { tone: 'good', text: `Fixed. ${p.fixed} of ${p.total} problems done.` };
}
