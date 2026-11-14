import { category, categoryName } from './categories';
import { checkAll, initialState } from './engine';
import { shortDate } from './explain';
import { generateFile, rng } from './generator';
import type { GuideId } from './guide';
import { formatCents, formatSignedCents } from './money';
import type { SkillId } from './types';

/**
 * The warm-up drill: five quick "tap the line that is wrong" rounds. Each round is cut from a generated
 * practice file, and the answer comes from the same checks that grade full files (checkAll), so the
 * drill can never disagree with the grader. Pure: the same seed always gives the same rounds.
 */
export type DrillKind = 'category' | 'duplicate' | 'amount' | 'owner';

export interface DrillRow {
  id: string;
  /** Main text (the entry's description). */
  title: string;
  /** Second line: date and category, or what the bank says. */
  detail: string;
  /** Right-hand figure. */
  amount: string;
}

export interface DrillRound {
  kind: DrillKind;
  business: string;
  /** The question, as an instruction. */
  prompt: string;
  rows: DrillRow[];
  /** Any of these ids is a right answer (both copies of a duplicate count). */
  answers: string[];
  /** Shown after the right tap: what was wrong and what it should be. */
  why: string;
  /** Shown after a wrong tap. */
  nudge: string;
}

const ORDER: DrillKind[] = ['duplicate', 'category', 'amount', 'owner', 'category'];
export const DRILL_TOPIC: Record<DrillKind, GuideId> = { duplicate: 'duplicate', category: 'category', amount: 'transposed', owner: 'owner' };
const FOCUS: Record<DrillKind, SkillId> = { duplicate: 'duplicates', category: 'categories', amount: 'transposition', owner: 'ownerEquity' };
export const DRILL_ROUNDS = ORDER.length;

function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function build(seed: string, kind: DrillKind): DrillRound | null {
  const s = generateFile(seed, { kind: 'practice', focus: [FOCUS[kind]] }).scenario;
  const state = initialState(s);
  const r = checkAll(s, state);
  const rand = rng(`${seed}:rows`);
  const flagged = new Set<string>([
    ...r.amounts.wrong.map((w) => w.entry.entryId),
    ...r.categories.wrong.map((w) => w.entry.entryId),
    ...r.cleared.wrong.map((w) => w.entry.entryId),
    ...state.entries.filter((e) => r.integrity.extra.some((x) => x.txn.txnId === e.txnId)).map((e) => e.entryId),
  ]);
  // Honest filler lines must look unique: two real identical purchases (a genuine repeat) would be
  // indistinguishable from a duplicate, so lines that share date, name and amount with another are left out.
  const sig = (e: { date: string; description: string; amountCents: number }) => `${e.date}|${e.description}|${e.amountCents}`;
  const seen = new Map<string, number>();
  for (const e of state.entries) seen.set(sig(e), (seen.get(sig(e)) ?? 0) + 1);
  const clean = shuffle(state.entries.filter((e) => !flagged.has(e.entryId) && seen.get(sig(e)) === 1), rand);
  const base = (e: (typeof state.entries)[number]): DrillRow => ({
    id: e.entryId,
    title: e.description,
    detail: `${shortDate(e.date)}, ${categoryName(e.category)}`,
    amount: formatSignedCents(e.amountCents),
  });

  if (kind === 'duplicate') {
    const x = r.integrity.extra[0];
    if (!x || clean.length < 3) return null;
    const copies = state.entries.filter((e) => e.txnId === x.txn.txnId);
    return {
      kind,
      business: s.business,
      prompt: 'One purchase is in the books twice. Tap either copy.',
      rows: shuffle([...copies, ...clean.slice(0, 3)], rand).map(base),
      answers: copies.map((e) => e.entryId),
      why: `${x.txn.description} on ${shortDate(x.txn.date)} happened once, for ${formatCents(Math.abs(x.txn.amountCents))}. The bank shows it once, so one copy goes.`,
      nudge: 'That one appears once. Look for two lines with the same date, name and amount.',
    };
  }
  if (kind === 'amount') {
    const w = r.amounts.wrong[0];
    if (!w || clean.length < 3) return null;
    const truth = new Map(s.txns.map((t) => [t.txnId, t]));
    const row = (e: (typeof state.entries)[number]): DrillRow => ({
      id: e.entryId,
      title: e.description,
      detail: `Bank says ${formatCents(Math.abs(truth.get(e.txnId)?.amountCents ?? e.amountCents))}`,
      amount: formatCents(Math.abs(e.amountCents)),
    });
    const pool = clean.filter((e) => truth.get(e.txnId)?.onStatement);
    if (pool.length < 3) return null;
    return {
      kind,
      business: s.business,
      prompt: 'One amount in the books does not match the bank. Tap it.',
      rows: shuffle([w.entry, ...pool.slice(0, 3)], rand).map(row),
      answers: [w.entry.entryId],
      why: `The books say ${formatCents(Math.abs(w.entry.amountCents))}, the bank says ${formatCents(Math.abs(w.expectedCents))}: two digits were swapped. A gap that divides by 9 is the usual sign.`,
      nudge: 'Those two figures agree. Compare each line with what the bank says.',
    };
  }
  // category and owner rounds: one line sits in the wrong category
  const wrong = r.categories.wrong.find((w) => (kind === 'owner') === (category(w.expected).kind === 'equity'));
  if (!wrong || clean.length < 3) return null;
  const right = category(wrong.expected);
  return {
    kind,
    business: s.business,
    prompt: kind === 'owner' ? 'One line is the owner’s own money, booked as business income or cost. Tap it.' : 'One line is in the wrong category. Tap it.',
    rows: shuffle([wrong.entry, ...clean.slice(0, 3)], rand).map(base),
    answers: [wrong.entry.entryId],
    why: `${wrong.entry.description} is not ${categoryName(wrong.entry.category)}. It belongs in ${right.name}: ${right.rule}`,
    nudge: kind === 'owner' ? 'That one is ordinary business. Look for money moving between the owner and the business.' : 'That category fits. Read what each line is, then its category.',
  };
}

/** Five rounds for a seed. A round whose generated file lacks the needed problem tries the next seed. */
export function drillRounds(seed: string): DrillRound[] {
  return ORDER.map((kind, i) => {
    for (let attempt = 0; attempt < 40; attempt++) {
      const round = build(`drill-${seed}-${i}-${attempt}`, kind);
      if (round) return round;
    }
    throw new Error(`no drill round for ${kind}`);
  });
}
