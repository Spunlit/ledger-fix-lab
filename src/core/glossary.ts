/**
 * Plain-language glossary. Every bookkeeping word the trainer uses, explained in one short sentence a
 * person who has never kept books can follow. The UI turns these words into tappable terms.
 */
export interface Term {
  id: string;
  /** How the word is shown in the glossary list. */
  term: string;
  /** One or two short plain sentences. No other jargon inside. */
  plain: string;
  /** Spellings to recognise in running text (lower case, longest first). */
  match: string[];
}

export const GLOSSARY: Term[] = [
  { id: 'books', term: 'Books', plain: "The business's own list of every payment in and out. The bookkeeper keeps it.", match: ['the books'] },
  { id: 'statement', term: 'Bank statement', plain: "The bank's list of everything that went through the account in one month.", match: ['bank statement', 'statement'] },
  { id: 'reconcile', term: 'Reconciliation', plain: 'Checking the books against the bank statement, line by line, until both show the same balance.', match: ['bank reconciliation', 'reconciliation', 'reconciling', 'reconciled', 'reconcile'] },
  { id: 'difference', term: 'Difference', plain: "The bank's balance minus the books' balance. When the books are complete it is $0.00.", match: ['difference'] },
  { id: 'cleared', term: 'Cleared', plain: 'The bank has processed the payment, so it shows on this month\'s statement. You tick it when you find it there.', match: ['not cleared', 'uncleared', 'cleared'] },
  { id: 'outstanding', term: 'Outstanding', plain: 'Written in the books, but not at the bank yet. Normal for a check mailed at the end of the month.', match: ['outstanding payments', 'outstanding check', 'outstanding'] },
  { id: 'transit', term: 'Deposit in transit', plain: 'Money written in the books that the bank has not added to the account yet.', match: ['deposits in transit', 'deposit in transit'] },
  { id: 'duplicate', term: 'Duplicate', plain: 'One payment entered in the books twice.', match: ['duplicate entry', 'duplicates', 'duplicate'] },
  { id: 'swapped', term: 'Swapped digits', plain: 'Two digits typed in the wrong order, like $48.37 instead of $84.37. Bookkeepers call it a transposition.', match: ['swapped digits', 'digits swapped', 'digits were swapped', 'transposed', 'transposition'] },
  { id: 'category', term: 'Category', plain: 'The kind of income or cost a line belongs to, such as Rent or Job supplies. Reports and tax forms add lines up by category.', match: ['expense category', 'category guide', 'categories', 'category'] },
  { id: 'contribution', term: "Owner's contribution", plain: 'The owner puts personal money into the business. It is not income, because no customer paid it.', match: ["owner's contribution", 'owner contribution'] },
  { id: 'draw', term: "Owner's draw", plain: 'The owner takes money out of the business for personal use. It is not a business cost.', match: ["owner's draw"] },
  { id: 'profit', term: 'Net profit', plain: 'Income minus costs. What the business really earned.', match: ['net profit', 'profit'] },
  { id: 'feed', term: 'Bank feed', plain: 'Bank lines copied into the books automatically by the accounting software.', match: ['bank feed'] },
  { id: 'balance', term: 'Balance', plain: 'How much money is in the account at a given moment. Opening balance: at the start of the month. Ending balance: at the end.', match: ['opening balance', 'beginning balance', 'ending balance', 'balance'] },
];

const BY_WORD = new Map<string, Term>();
for (const t of GLOSSARY) for (const m of t.match) BY_WORD.set(m, t);
const WORDS = [...BY_WORD.keys()].sort((a, b) => b.length - a.length);
const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Matches any glossary spelling as a whole word, longest first. */
export const TERM_RE = new RegExp(`(?<![\\w$])(${WORDS.map(esc).join('|')})(?![\\w])`, 'gi');

export interface Piece {
  text: string;
  /** Set when this piece is a glossary word. */
  term?: Term;
}

/** Split running text into plain pieces and glossary words. Each term is marked once per text. */
export function splitTerms(text: string): Piece[] {
  const out: Piece[] = [];
  const used = new Set<string>();
  let last = 0;
  for (const m of text.matchAll(TERM_RE)) {
    const term = BY_WORD.get(m[1].toLowerCase());
    if (!term || used.has(term.id)) continue;
    used.add(term.id);
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[1], term });
    last = m.index! + m[1].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export function termById(id: string): Term | undefined {
  return GLOSSARY.find((t) => t.id === id);
}
