import type { SkillId } from './types';

/**
 * The field guide: the seven things the files test, each as what you see, how to tell, what to do and
 * why it matters. One source for the guide page, the coach's "Why?" and the drill's follow-up link.
 * Plain bookkeeping practice for a one-account, cash-basis sole proprietor; nothing here is tax advice.
 */
export type GuideId = 'duplicate' | 'repeat' | 'missing' | 'transposed' | 'outstanding' | 'category' | 'owner';

export interface GuideTopic {
  id: GuideId;
  skill: SkillId;
  title: string;
  /** One line: what it looks like on the page. */
  see: string;
  /** How to tell it apart from a line that is fine. */
  tell: string;
  /** The fix, as an action in the workbench. */
  fix: string;
  /** Why it matters, in money terms. */
  why: string;
  /** A two-line example: the books and the bank. */
  example: { books: string; bank: string };
  /** Does it show up in the reconciliation difference? 'none' = there is nothing wrong to show. */
  inDifference: 'yes' | 'no' | 'none';
  /** A caveat about the difference, when there is one. */
  differenceNote?: string;
  /** Where to practice it. */
  practice: { label: string; href: string };
}

export const GUIDE: GuideTopic[] = [
  {
    id: 'duplicate',
    skill: 'duplicates',
    title: 'Duplicate entry',
    see: 'The same purchase appears twice: same date, same name, same amount.',
    tell: 'The bank shows it once. One of the two rows has no bank line to pair with.',
    fix: 'Delete one copy with the bin icon. Either copy is fine: they record the same payment.',
    why: 'A doubled expense makes the books show less cash and less profit than there really is. It usually comes from a bank feed imported twice, or a row typed by hand and then imported.',
    example: { books: 'Oct 15  Upwork, contractor  −$412.50 (twice)', bank: 'Oct 15  UPWORK  −$412.50 (once)' },
    inDifference: 'yes',
    differenceNote: 'A copy that is not ticked as cleared hides as an outstanding payment, so the difference alone can miss it.',
    practice: { label: 'Case 1', href: '#/case/maple-pine-oct' },
  },
  {
    id: 'repeat',
    skill: 'genuineRepeats',
    title: 'Two real purchases that look alike',
    see: 'Two rows with the same name and amount, sometimes on the same day.',
    tell: 'The bank shows both. Each row has its own bank line.',
    fix: 'Leave both. Deleting one makes the books miss a real payment.',
    why: 'Not every lookalike is a duplicate: two coffees, two months of the same subscription. Check the bank before deleting anything.',
    example: { books: 'Oct 7  Blue Bottle Coffee  −$12.50 (two rows)', bank: 'Oct 7  BLUE BOTTLE  −$12.50 (two lines)' },
    inDifference: 'none',
    practice: { label: 'Case 1', href: '#/case/maple-pine-oct' },
  },
  {
    id: 'missing',
    skill: 'missing',
    title: 'Bank charge missing from the books',
    see: 'A line on the bank statement with nothing next to it in the books.',
    tell: 'Small and regular: a monthly fee, a wire fee, interest. Nobody typed it in because nobody bought anything.',
    fix: 'Press "Add to the books" on the bank line and file it under Bank fees.',
    why: 'The money left the account whether or not the books know. Until it is recorded, the books show more cash than the bank holds.',
    example: { books: '(nothing)', bank: 'Mar 31  MONTHLY MAINTENANCE FEE  −$15.00' },
    inDifference: 'yes',
    practice: { label: 'Case 2', href: '#/case/rivera-mar' },
  },
  {
    id: 'transposed',
    skill: 'transposition',
    title: 'Two digits swapped',
    see: 'A row typed by hand whose amount is close to the bank line, but not equal.',
    tell: 'The gap between the two amounts divides evenly by 9. $84.37 typed as $48.37 is off by $36.00, and 36 = 4 × 9.',
    fix: 'Click the amount in the books and type the amount the bank shows.',
    why: 'The bank is the record of what was paid. A swapped pair of digits can hide a difference of a few cents or a few thousand dollars.',
    example: { books: 'Mar 5  Verizon, business phone  −$48.37', bank: 'Mar 5  VERIZON WIRELESS  −$84.37' },
    inDifference: 'yes',
    differenceNote: 'It shows once the row is ticked as cleared.',
    practice: { label: 'Case 2', href: '#/case/rivera-mar' },
  },
  {
    id: 'outstanding',
    skill: 'timing',
    title: 'Outstanding check',
    see: 'A payment in the books near the end of the month that is not on the bank statement.',
    tell: 'It is real (a check was mailed, a payment was sent), it just has not reached the bank yet.',
    fix: 'Leave it in the books and leave Cleared unticked. It will be on next month\'s statement.',
    why: 'Deleting it makes the difference look better and the books wrong: the money is already promised. Reconciliation handles it by subtracting outstanding payments from the bank\'s ending balance.',
    example: { books: 'Mar 30  Check #1043, Desert Sun  −$650.00 (not cleared)', bank: '(not on the March statement)' },
    inDifference: 'none',
    practice: { label: 'Case 2', href: '#/case/rivera-mar' },
  },
  {
    id: 'category',
    skill: 'categories',
    title: 'Wrong expense category',
    see: 'The amount is right and the row matches the bank, but the category does not describe what was bought.',
    tell: 'Read the name of the row, then the category. Software filed under Office supplies; fuel filed under Business meals.',
    fix: 'Pick the category that fits, using the category guide in the workbench.',
    why: 'Total profit stays the same, but the report by category is what the owner and the tax preparer read. Some categories are treated differently at tax time.',
    example: { books: 'Oct 3  Adobe Creative Cloud  −$59.99  Office supplies', bank: 'Oct 3  ADOBE  −$59.99' },
    inDifference: 'no',
    practice: { label: 'Case 1', href: '#/case/maple-pine-oct' },
  },
  {
    id: 'owner',
    skill: 'ownerEquity',
    title: 'Owner money booked as income',
    see: 'A transfer between the owner\'s personal account and the business, filed under Sales income or an expense.',
    tell: 'The bank line says transfer, not a customer or a vendor. The client\'s note often mentions it.',
    fix: 'Money in from the owner is Owner\'s contribution. Money out to the owner is Owner\'s draw. Neither is income or an expense.',
    why: 'This is the mistake that balances. The bank and the books agree to the cent, and profit is still wrong: $5,000 of savings booked as sales is $5,000 of profit that never existed, and tax on it.',
    example: { books: 'Mar 10  Transfer from savings  +$5,000.00  Sales income', bank: 'Mar 10  ONLINE TRANSFER FROM SAV  +$5,000.00' },
    inDifference: 'no',
    practice: { label: 'Case 2', href: '#/case/rivera-mar' },
  },
];

export function guideTopic(id: GuideId): GuideTopic {
  return GUIDE.find((t) => t.id === id)!;
}

/** The three lines of a bank reconciliation, as the workbench computes it. */
export const RECONCILIATION_STEPS: { label: string; text: string }[] = [
  { label: 'Bank side', text: 'Start from the statement\'s ending balance. Subtract payments that have not cleared yet and add deposits in transit.' },
  { label: 'Book side', text: 'Start from the opening balance and add every row in the books.' },
  { label: 'Compare', text: 'The two figures must be equal. A difference of $0.00 is necessary, but it does not prove the books are right.' },
];
