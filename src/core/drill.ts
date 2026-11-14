import { category, categoryName } from './categories';
import { checkAll, initialState } from './engine';
import { shortDate } from './explain';
import { generateFile, rng } from './generator';
import { guideTopic, type GuideId } from './guide';
import { formatCents, formatSignedCents } from './money';
import type { LedgerEntry, SkillId } from './types';

/**
 * The warm-up drill: quick one-tap rounds. Two shapes: "tap the line that is wrong" and "what do you
 * do?" with three choices. Each round is cut from a generated practice file, and the right answer comes
 * from the same truth that grades full files (checkAll and the file's transactions), so the drill can
 * never disagree with the grader. Pure: the same seed always gives the same rounds.
 */
export type DrillKind = 'category' | 'duplicate' | 'amount' | 'owner' | 'outstanding' | 'repeat' | 'missing';

export interface DrillRow {
  id: string;
  /** Main text: an entry's description, or a choice. */
  title: string;
  /** Second line: date and category, or what the bank says. Empty for choices. */
  detail: string;
  /** Right-hand figure. Empty for choices. */
  amount: string;
}

export interface DrillRound {
  kind: DrillKind;
  /** 'find' = tap the wrong line among honest ones; 'decide' = pick what to do. */
  shape: 'find' | 'decide';
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

/** The guide topic behind each kind of round. */
export const DRILL_TOPIC: Record<DrillKind, GuideId> = {
  duplicate: 'duplicate', category: 'category', amount: 'transposed', owner: 'owner', outstanding: 'outstanding', repeat: 'repeat', missing: 'missing',
};
const KIND_OF_TOPIC = Object.fromEntries(Object.entries(DRILL_TOPIC).map(([k, v]) => [v, k])) as Record<GuideId, DrillKind>;
const FOCUS: Record<DrillKind, SkillId> = {
  duplicate: 'duplicates', category: 'categories', amount: 'transposition', owner: 'ownerEquity', outstanding: 'timing', repeat: 'genuineRepeats', missing: 'missing',
};
/** The mixed warm-up: five rounds, four of them "find", one "decide". */
const MIXED: DrillKind[] = ['duplicate', 'category', 'outstanding', 'amount', 'owner'];
export const DRILL_ROUNDS = MIXED.length;
/** A topic drill (from the guide) is three rounds of one kind. */
export const TOPIC_ROUNDS = 3;

function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const sig = (e: { date: string; description: string; amountCents: number }) => `${e.date}|${e.description}|${e.amountCents}`;

function build(seed: string, kind: DrillKind): DrillRound | null {
  const s = generateFile(seed, { kind: 'practice', focus: [FOCUS[kind]] }).scenario;
  const state = initialState(s);
  const r = checkAll(s, state);
  const rand = rng(`${seed}:rows`);
  const truth = new Map(s.txns.map((t) => [t.txnId, t]));
  const flagged = new Set<string>([
    ...r.amounts.wrong.map((w) => w.entry.entryId),
    ...r.categories.wrong.map((w) => w.entry.entryId),
    ...r.cleared.wrong.map((w) => w.entry.entryId),
    ...state.entries.filter((e) => r.integrity.extra.some((x) => x.txn.txnId === e.txnId)).map((e) => e.entryId),
  ]);
  // Honest filler lines must look unique: two real identical purchases (a genuine repeat) would be
  // indistinguishable from a duplicate, so lines that share date, name and amount with another are left out.
  const seen = new Map<string, number>();
  for (const e of state.entries) seen.set(sig(e), (seen.get(sig(e)) ?? 0) + 1);
  const clean = shuffle(state.entries.filter((e) => !flagged.has(e.entryId) && seen.get(sig(e)) === 1), rand);
  const base = (e: LedgerEntry): DrillRow => ({
    id: e.entryId,
    title: e.description,
    detail: `${shortDate(e.date)}, ${categoryName(e.category)}`,
    amount: formatSignedCents(e.amountCents),
  });
  const choices = (right: string, wrong: [string, string]): { rows: DrillRow[]; answers: string[] } => ({
    rows: shuffle([{ id: 'right', title: right }, { id: 'w1', title: wrong[0] }, { id: 'w2', title: wrong[1] }], rand).map((c) => ({ ...c, detail: '', amount: '' })),
    answers: ['right'],
  });
  const head = { kind, business: s.business } as const;

  if (kind === 'duplicate') {
    const x = r.integrity.extra[0];
    if (!x || clean.length < 3) return null;
    const copies = state.entries.filter((e) => e.txnId === x.txn.txnId);
    return {
      ...head,
      shape: 'find',
      prompt: 'One purchase is in the books twice. Tap either copy.',
      rows: shuffle([...copies, ...clean.slice(0, 3)], rand).map(base),
      answers: copies.map((e) => e.entryId),
      why: `${x.txn.description} on ${shortDate(x.txn.date)} happened once, for ${formatCents(Math.abs(x.txn.amountCents))}. The bank shows it once, so one copy goes.`,
      nudge: 'That one appears once. Look for two lines with the same date, name and amount.',
    };
  }
  if (kind === 'amount') {
    const w = r.amounts.wrong[0];
    const pool = clean.filter((e) => truth.get(e.txnId)?.onStatement);
    if (!w || pool.length < 3) return null;
    const row = (e: LedgerEntry): DrillRow => ({
      id: e.entryId,
      title: e.description,
      detail: `Bank says ${formatCents(Math.abs(truth.get(e.txnId)?.amountCents ?? e.amountCents))}`,
      amount: formatCents(Math.abs(e.amountCents)),
    });
    return {
      ...head,
      shape: 'find',
      prompt: 'One amount in the books does not match the bank. Tap it.',
      rows: shuffle([w.entry, ...pool.slice(0, 3)], rand).map(row),
      answers: [w.entry.entryId],
      why: `The books say ${formatCents(Math.abs(w.entry.amountCents))}, the bank says ${formatCents(Math.abs(w.expectedCents))}: two digits were swapped. A gap that divides by 9 is the usual sign.`,
      nudge: 'Those two figures agree. Compare each line with what the bank says.',
    };
  }
  if (kind === 'category' || kind === 'owner') {
    const wrong = r.categories.wrong.find((w) => (kind === 'owner') === (category(w.expected).kind === 'equity'));
    if (!wrong || clean.length < 3) return null;
    const right = category(wrong.expected);
    return {
      ...head,
      shape: 'find',
      prompt: kind === 'owner' ? "One line is the owner's own money, booked as business income or cost. Tap it." : 'One line is in the wrong category. Tap it.',
      rows: shuffle([wrong.entry, ...clean.slice(0, 3)], rand).map(base),
      answers: [wrong.entry.entryId],
      why: `${wrong.entry.description} is not ${categoryName(wrong.entry.category)}. It belongs in ${right.name}: ${right.rule}`,
      nudge: kind === 'owner' ? 'That one is ordinary business. Look for money moving between the owner and the business.' : 'That category fits. Read what each line is, then its category.',
    };
  }
  if (kind === 'outstanding') {
    // A real payment the bank has not processed yet: in the books, unticked, and correct as it stands.
    const e = state.entries.find((x) => truth.get(x.txnId)?.onStatement === false && !x.cleared && !flagged.has(x.entryId));
    if (!e) return null;
    return {
      ...head,
      shape: 'decide',
      prompt: `${e.description}, ${formatCents(Math.abs(e.amountCents))} on ${shortDate(e.date)}, is in the books but not on the bank statement. The client confirms the payment was sent. What do you do?`,
      ...choices('Leave it in the books, not ticked as cleared', ['Delete it: the bank does not show it', 'Tick it as cleared so the totals agree']),
      why: guideTopic('outstanding').why,
      nudge: 'The payment is real: the money is promised even though the bank has not processed it yet.',
    };
  }
  if (kind === 'repeat') {
    // Two real, identical-looking purchases: both on the statement, different transactions.
    const pair = state.entries.find((x) => (seen.get(sig(x)) ?? 0) === 2 && state.entries.filter((y) => sig(y) === sig(x)).every((y) => truth.get(y.txnId)?.onStatement && !flagged.has(y.entryId)));
    if (!pair) return null;
    return {
      ...head,
      shape: 'decide',
      prompt: `Two lines in the books say ${pair.description}, ${formatCents(Math.abs(pair.amountCents))} on ${shortDate(pair.date)}. The bank statement also shows two payments like that. What do you do?`,
      ...choices('Keep both: the bank shows two real payments', ['Delete one: it looks like a duplicate', 'Delete both and wait for the client']),
      why: guideTopic('repeat').why,
      nudge: 'Check the bank first. It shows two payments, so both lines record something real.',
    };
  }
  // missing: a bank line the books never recorded
  const m = r.integrity.missing.find((t) => t.onStatement);
  if (!m) return null;
  return {
    ...head,
    shape: 'decide',
    prompt: `The bank statement shows ${m.bankDescription}, ${formatCents(Math.abs(m.amountCents))} on ${shortDate(m.date)}. Nothing in the books matches it. What do you do?`,
    ...choices(`Add it to the books under ${categoryName(m.category)}`, ["Ignore it: the client didn't enter it", "Change another line's amount so the totals agree"]),
    why: guideTopic('missing').why,
    nudge: 'The money left the account. The books have to show it, in its own line.',
  };
}

function rounds(seed: string, kinds: DrillKind[]): DrillRound[] {
  return kinds.map((kind, i) => {
    for (let attempt = 0; attempt < 60; attempt++) {
      const round = build(`drill-${seed}-${i}-${attempt}`, kind);
      if (round) return round;
    }
    throw new Error(`no drill round for ${kind}`);
  });
}

/** The mixed warm-up: five rounds for a seed. A round whose file lacks the needed problem tries the next seed. */
export function drillRounds(seed: string): DrillRound[] {
  return rounds(seed, MIXED);
}

/** Three rounds on one guide topic. */
export function topicRounds(seed: string, topic: GuideId): DrillRound[] {
  return rounds(`${topic}-${seed}`, Array.from({ length: TOPIC_ROUNDS }, () => KIND_OF_TOPIC[topic]));
}
