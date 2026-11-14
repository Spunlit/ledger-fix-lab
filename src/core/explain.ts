import { category, categoryName } from './categories';
import type { CheckReport } from './engine';
import { formatCents, formatSignedCents } from './money';
import type { LedgerEntry, SkillId } from './types';

/** Human explanations, phrased in what the user can see (dates, descriptions, amounts). */
export interface Explanations {
  integrity: string[];
  amounts: string[];
  cleared: string[];
  categories: string[];
  balance: string[];
}

export const SKILL_LABEL: Record<SkillId, string> = {
  duplicates: 'Spotting duplicate entries',
  genuineRepeats: 'Keeping genuine repeat purchases',
  missing: 'Recording bank charges missing from the books',
  transposition: 'Catching transposed amounts',
  timing: 'Leaving outstanding checks in place',
  categories: 'Choosing the right expense category',
  ownerEquity: 'Separating owner money from income',
};

export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${d}`;
}

const q = (e: { description: string; date: string }) => `"${e.description}" (${shortDate(e.date)})`;
const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);

export function explain(report: CheckReport): Explanations {
  const integrity: string[] = [];
  for (const t of report.integrity.missing) {
    integrity.push(
      t.onStatement
        ? `Missing: the bank shows ${formatCents(t.amountCents)} on ${shortDate(t.date)} ("${t.bankDescription}"), but nothing in the books records it. Record it from the statement.`
        : `Missing: ${q(t)} for ${formatCents(t.amountCents)} was deleted, but it is real. It hasn't reached the bank yet, so it belongs in the books, unticked, until it clears.`,
    );
  }
  for (const { txn, count } of report.integrity.extra) {
    integrity.push(
      `Duplicate: ${q(txn)} for ${formatCents(txn.amountCents)} is in the books ${times(count)}, but it happened once. Keep one copy (either one) and delete the rest.`,
    );
  }
  for (const e of report.integrity.unknown) integrity.push(`Unknown row: ${q(e)} matches no real transaction.`);

  const amounts = report.amounts.wrong.map(
    ({ entry, expectedCents }) =>
      `${q(entry)} is booked at ${formatCents(Math.abs(entry.amountCents))}, but the source shows ${formatCents(Math.abs(expectedCents))}. Fix the amount to match the bank.`,
  );

  const cleared = report.cleared.wrong.map(({ entry, onStatement }) =>
    onStatement
      ? `${q(entry)} is on this bank statement, so tick it as cleared.`
      : `${q(entry)} is ticked, but it isn't on this statement. Leave it unticked: it is outstanding and will clear later.`,
  );

  const categories = report.categories.wrong.map(({ entry }) => {
    const c = category(entry.category);
    return `${q(entry)} is filed under ${c.name} (${c.rule.replace(/\.$/, '')}). That doesn't fit. Check the category guide and the client's note.`;
  });
  const { booked, correct } = report.categories;
  if (!report.categories.ok && booked.netIncomeCents !== correct.netIncomeCents) {
    const gap = booked.netIncomeCents - correct.netIncomeCents;
    categories.push(
      `Because of this, the books show net profit of ${formatCents(booked.netIncomeCents)} instead of ${formatCents(correct.netIncomeCents)}, ${gap > 0 ? 'overstated' : 'understated'} by ${formatCents(Math.abs(gap))}.`,
    );
  }

  const r = report.recon;
  const balance: string[] = [];
  if (!report.balanced) {
    balance.push(
      `Adjusted bank balance ${formatCents(r.adjustedBankCents)} vs. book balance ${formatCents(r.bookBalanceCents)}: difference ${formatSignedCents(r.differenceCents)}.`,
    );
  } else if (!report.ok) {
    balance.push('The difference is $0.00, but that alone doesn\'t prove the books are right. The other checks show what is still wrong.');
  }
  return { integrity, amounts, cleared, categories, balance };
}

export function describeEntry(e: LedgerEntry): string {
  return `${q(e)} ${formatCents(e.amountCents)} in ${categoryName(e.category)}`;
}
