import { CATEGORIES, categoryName } from './categories';
import { signature, type CheckReport } from './engine';
import { formatCents, formatSignedCents } from './money';
import type { LedgerState, Scenario } from './types';

/**
 * Human explanations of which invariant is broken. Phrased only in terms the user can see
 * (date, description, amount, statement), never internal ids.
 */
export interface Explanations {
  integrity: string[];
  balance: string[];
  categories: string[];
}

export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[m - 1]} ${d}`;
}

export function explain(scenario: Scenario, state: LedgerState, report: CheckReport): Explanations {
  const stmtCount = (sig: string) => scenario.statement.filter((l) => signature(l) === sig).length;
  const ledgerCount = (sig: string) => state.entries.filter((e) => signature(e) === sig).length;

  const integrity: string[] = [];
  const seen = new Set<string>();
  for (const line of report.integrity.missing) {
    const sig = signature(line);
    if (seen.has(sig)) continue;
    seen.add(sig);
    const s = stmtCount(sig);
    const l = ledgerCount(sig);
    let msg =
      `Missing record: "${line.description}" on ${shortDate(line.date)} for ${formatCents(line.amountCents)}. ` +
      `The bank statement shows it ${times(s)}, the ledger ${l === 0 ? 'has none' : `has it ${times(l)}`}. ` +
      `A real transaction was deleted.`;
    if (s > 1) msg += ' Identical charges on the same day can both be real — the statement is the source of truth.';
    integrity.push(msg);
  }
  for (const { line, count } of report.integrity.extra) {
    integrity.push(
      `Duplicate: "${line.description}" on ${shortDate(line.date)} for ${formatCents(line.amountCents)} ` +
        `is recorded ${times(count)}, but the bank statement shows it once. Keep one copy — either one.`,
    );
  }
  for (const e of report.integrity.unknown) {
    integrity.push(`Unknown record: "${e.description}" on ${shortDate(e.date)} is not on the bank statement.`);
  }

  const b = report.balance;
  const balance: string[] = [];
  if (!b.ok) {
    balance.push(
      `Ledger balance ${formatCents(b.ledgerBalanceCents)} vs. statement closing balance ` +
        `${formatCents(b.statementBalanceCents)}: difference ${formatSignedCents(b.differenceCents)}.`,
    );
    balance.push(
      b.differenceCents < 0
        ? 'The ledger shows less money than the bank: look for an extra withdrawal (e.g. a duplicate) or a missing deposit.'
        : 'The ledger shows more money than the bank: a real withdrawal may have been deleted, or a deposit is recorded twice.',
    );
  } else if (!report.integrity.ok) {
    balance.push(
      'The balance matches, but that alone does not prove the books are right: errors can cancel out. See the transaction check.',
    );
  }

  const categories: string[] = report.categories.wrong.map(({ entry }) => {
    const rule = CATEGORIES.find((c) => c.id === entry.category)?.rule ?? '';
    return (
      `"${entry.description}" (${shortDate(entry.date)}) is filed under ${categoryName(entry.category)} ` +
      `(${rule.replace(/\.$/, '')}). That rule doesn't fit — check the category guide.`
    );
  });

  return { integrity, balance, categories };
}

function times(n: number): string {
  return n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`;
}
