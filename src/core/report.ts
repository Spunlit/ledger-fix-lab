import { categoryName } from './categories';
import { initialState, reconcile, truePnl, bookedPnl, type ProfitAndLoss, type Reconciliation } from './engine';
import { shortDate } from './explain';
import { formatCents } from './money';
import type { LedgerState, Scenario } from './types';

/**
 * The cleanup summary a bookkeeper hands the client. Built by comparing the books as handed over
 * with the books now, transaction by transaction, so it describes the end state, whatever order
 * the user worked in.
 */
export interface CleanupItem {
  kind: 'duplicate' | 'recorded' | 'amount' | 'category' | 'outstanding' | 'cleared';
  text: string;
}

export interface CleanupReport {
  items: CleanupItem[];
  before: { recon: Reconciliation; pnl: ProfitAndLoss };
  after: { recon: Reconciliation; pnl: ProfitAndLoss };
}

export function cleanupReport(s: Scenario, final: LedgerState): CleanupReport {
  const start = initialState(s);
  const items: CleanupItem[] = [];
  for (const t of s.txns) {
    const before = start.entries.filter((e) => e.txnId === t.txnId);
    const after = final.entries.filter((e) => e.txnId === t.txnId);
    const label = `${t.description}, ${shortDate(t.date)}`;
    if (before.length > after.length && after.length > 0) {
      items.push({ kind: 'duplicate', text: `Removed a duplicate entry for ${label} (${formatCents(t.amountCents)}). It was recorded ${before.length === 2 ? "twice" : `${before.length} times`}.` });
    }
    if (before.length === 0 && after.length > 0) {
      items.push({ kind: 'recorded', text: `Recorded ${label} (${formatCents(t.amountCents)}) from the bank statement. It was missing from the books.` });
    }
    const kept = after[0];
    if (!kept) continue;
    const prior = before.find((e) => e.entryId === kept.entryId) ?? before[0];
    if (prior && !before.some((e) => e.amountCents === kept.amountCents)) {
      items.push({ kind: 'amount', text: `Corrected ${label} from ${formatCents(Math.abs(prior.amountCents))} to ${formatCents(Math.abs(kept.amountCents))} to match the bank.` });
    }
    if (prior && !before.some((e) => e.category === kept.category)) {
      items.push({ kind: 'category', text: `Reclassified ${label} from ${categoryName(prior.category)} to ${categoryName(kept.category)}.` });
    }
    if (!t.onStatement && kept.cleared === false) {
      items.push({ kind: 'outstanding', text: `Left ${label} (${formatCents(t.amountCents)}) in the books as outstanding. It was issued but hasn't cleared the bank yet.` });
    }
    if (prior && t.onStatement && !before.some((e) => e.cleared) && kept.cleared && kept.source !== 'Added from statement') {
      items.push({ kind: 'cleared', text: `Matched ${label} to the bank statement and marked it cleared.` });
    }
  }
  return {
    items,
    before: { recon: reconcile(s, start), pnl: bookedPnl(start) },
    after: { recon: reconcile(s, final), pnl: bookedPnl(final) },
  };
}

/** Plain-text version for copying into an email to the client. */
export function reportText(s: Scenario, r: CleanupReport): string {
  const correct = truePnl(s);
  const lines = [
    `${s.business}: ${s.period} bank reconciliation and cleanup`,
    `Account: ${s.account}`,
    '',
    'What I found and fixed:',
    ...r.items.map((i) => `- ${i.text}`),
    '',
    `Statement ending balance: ${formatCents(r.after.recon.statementEndingCents)}`,
    `Outstanding payments: ${formatCents(r.after.recon.outstandingPaymentsCents)}`,
    `Adjusted bank balance: ${formatCents(r.after.recon.adjustedBankCents)}`,
    `Book balance: ${formatCents(r.after.recon.bookBalanceCents)}`,
    `Difference: ${formatCents(r.after.recon.differenceCents)}`,
    '',
    `Net profit for the period: ${formatCents(r.after.pnl.netIncomeCents)} (was ${formatCents(r.before.pnl.netIncomeCents)} before cleanup).`,
  ];
  if (r.after.pnl.netIncomeCents !== correct.netIncomeCents) lines.push('Note: categories still need review.');
  lines.push('', 'Practice file from Ledger Fix Lab. All data is synthetic.');
  return lines.join('\n');
}
