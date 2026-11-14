/**
 * "Start from zero": a two-minute lesson for someone who has never kept books. Five ideas, each taught
 * by doing one small thing: what a bank statement is, what the books are, matching, the difference,
 * categories. The content is written by hand (it is a lesson, not a generated file), and the amounts
 * are checked by a unit test so the arithmetic on screen is always right.
 */
export interface BasicsOption {
  id: string;
  title: string;
  detail?: string;
  amount?: string;
}

export interface BasicsStep {
  id: string;
  /** The idea, as a short heading. */
  title: string;
  /** One or two plain sentences that teach it. */
  explain: string;
  /** Lines shown for reference above the choices (not tappable). */
  context?: { label: string; lines: { text: string; amount: string }[] };
  /** What to do. */
  prompt: string;
  options: BasicsOption[];
  answer: string;
  /** Shown after the right tap. */
  right: string;
  /** Shown after a wrong tap. */
  nudge: string;
}

/** The little business used through the lesson. Cents, like everywhere else in the engine. */
export const BASICS_FACTS = {
  opening: 100000,
  deposit: 32000,
  fuel: -4000,
  fee: -1500,
  ownerMoney: 50000,
};
const f = BASICS_FACTS;
/** What the bank holds after its three lines, and what the books show without the fee. */
export const BASICS_BANK = f.opening + f.deposit + f.fuel + f.fee;
export const BASICS_BOOKS = f.opening + f.deposit + f.fuel;

const usd = (cents: number) => `${cents < 0 ? '−' : ''}$${(Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
const signed = (cents: number) => `${cents < 0 ? '−' : '+'}$${(Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export const BASICS: BasicsStep[] = [
  {
    id: 'statement',
    title: 'The bank statement',
    explain: 'The bank keeps a list of everything that goes through the account. That list is the bank statement. Money in has a plus, money out has a minus.',
    prompt: 'Tap the line where customers paid the business.',
    options: [
      { id: 'fuel', title: 'CHECKCARD SHELL OIL', detail: 'Mar 3', amount: signed(f.fuel) },
      { id: 'deposit', title: 'SQUARE INC DEPOSIT', detail: 'Mar 2', amount: signed(f.deposit) },
      { id: 'fee', title: 'MONTHLY MAINTENANCE FEE', detail: 'Mar 31', amount: signed(f.fee) },
    ],
    answer: 'deposit',
    right: 'Yes. A deposit is money coming in. Square is the card reader, so this is what customers paid.',
    nudge: 'That line has a minus: money went out. Look for the plus.',
  },
  {
    id: 'books',
    title: 'The books',
    explain: 'The business keeps its own list, called the books. Each line says in plain words what the money was for, and which category it belongs to.',
    context: { label: 'The bank says', lines: [{ text: 'CHECKCARD SHELL OIL', amount: signed(f.fuel) }] },
    prompt: 'Tap the line in the books that records this payment.',
    options: [
      { id: 'sale', title: 'Square payout, customer payments', detail: 'Sales income', amount: signed(f.deposit) },
      { id: 'fuel', title: 'Shell, van fuel', detail: 'Car & truck', amount: signed(f.fuel) },
      { id: 'wax', title: 'Chemical Guys, wax', detail: 'Job supplies', amount: '−$62.10' },
    ],
    answer: 'fuel',
    right: 'Right. Same amount, and the name fits: the bank writes SHELL OIL, the books write what it was, fuel for the van.',
    nudge: 'Compare the amount first, then the name. The bank line is a $40.00 payment to Shell.',
  },
  {
    id: 'match',
    title: 'Matching',
    explain: 'Checking the books means pairing every bank line with a line in the books. A bank line with no pair is something the books missed.',
    context: {
      label: 'The books have two lines',
      lines: [
        { text: 'Square payout, customer payments', amount: signed(f.deposit) },
        { text: 'Shell, van fuel', amount: signed(f.fuel) },
      ],
    },
    prompt: 'The bank has three lines. Tap the one with no pair in the books.',
    options: [
      { id: 'deposit', title: 'SQUARE INC DEPOSIT', detail: 'Mar 2', amount: signed(f.deposit) },
      { id: 'fuel', title: 'CHECKCARD SHELL OIL', detail: 'Mar 3', amount: signed(f.fuel) },
      { id: 'fee', title: 'MONTHLY MAINTENANCE FEE', detail: 'Mar 31', amount: signed(f.fee) },
    ],
    answer: 'fee',
    right: 'Right. Nobody wrote the bank fee down, because nobody bought anything. You add it to the books.',
    nudge: 'That one has a pair: the same amount is in the books. Find the bank line whose amount is not there.',
  },
  {
    id: 'difference',
    title: 'The difference',
    explain: "The bank's balance minus the books' balance is called the difference. When every line has its pair, the difference is $0.00.",
    context: {
      label: 'After March',
      lines: [
        { text: 'The bank says', amount: usd(BASICS_BANK) },
        { text: 'The books say (the fee is missing)', amount: usd(BASICS_BOOKS) },
      ],
    },
    prompt: 'What is the difference?',
    options: [
      { id: 'zero', title: '$0.00', detail: 'They agree' },
      { id: 'fee', title: usd(BASICS_BANK - BASICS_BOOKS), detail: 'The missing bank fee' },
      { id: 'sum', title: usd(BASICS_BANK + BASICS_BOOKS), detail: 'Both added together' },
    ],
    answer: 'fee',
    right: `Yes: ${usd(BASICS_BANK)} minus ${usd(BASICS_BOOKS)} is ${usd(BASICS_BANK - BASICS_BOOKS)}. The difference often points straight at what is missing. Add the fee and it becomes $0.00.`,
    nudge: 'Subtract the books from the bank. The two numbers are not equal, so it cannot be $0.00.',
  },
  {
    id: 'category',
    title: 'Categories, and the mistake that balances',
    explain: 'A category says what kind of money a line is. Profit and taxes are added up by category, so a wrong category gives a wrong profit even when the bank and the books agree.',
    context: { label: 'A new line', lines: [{ text: 'The owner moves her own savings into the business', amount: signed(f.ownerMoney) }] },
    prompt: 'Which category is right?',
    options: [
      { id: 'sales', title: 'Sales income', detail: 'Money customers paid for the work' },
      { id: 'owner', title: "Owner's contribution", detail: 'The owner puts personal money in' },
      { id: 'fees', title: 'Bank fees', detail: 'What the bank charges the account' },
    ],
    answer: 'owner',
    right: `Right. No customer paid it, so it is not income. Booked as sales, the bank and the books would still agree, and profit would be ${usd(f.ownerMoney)} too high. Catching that is the heart of this trainer.`,
    nudge: 'Ask who paid. It was not a customer and not the bank.',
  },
];
