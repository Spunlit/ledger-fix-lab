import { describe, expect, it } from 'vitest';
import { applyAction, checkAll, createSession, initialState, statementLines } from '../src/core/engine';
import { generateFile } from '../src/core/generator';
import { matchRows, MATCH_WINDOW_DAYS, type RowMatch } from '../src/core/match';
import { CASE_1, CASE_2 } from '../src/core/scenarios';
import type { Action, LedgerState, Scenario } from '../src/core/types';

const unmatchedEntries = (m: RowMatch) => [...m.entryMatch].filter(([, line]) => line === null).map(([id]) => id);
const unmatchedLines = (m: RowMatch) => [...m.lineMatch].filter(([, entry]) => entry === null).map(([id]) => id);
const play = (s: Scenario, actions: Action[]) => actions.reduce((sess, a) => applyAction(sess, a), createSession(s)).state;
const dayOf = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);

/** Structural rules every result must obey, whatever the books look like. */
function expectConsistent(s: Scenario, state: LedgerState, m: RowMatch, label = ''): void {
  const lines = new Map(statementLines(s).map((l) => [l.txnId, l]));
  const entries = new Map(state.entries.map((e) => [e.entryId, e]));
  expect([...m.entryMatch.keys()].sort(), label).toEqual([...entries.keys()].sort());
  expect([...m.lineMatch.keys()].sort(), label).toEqual([...lines.keys()].sort());
  for (const [entryId, lineId] of m.entryMatch) {
    if (lineId === null) continue;
    const e = entries.get(entryId)!;
    const l = lines.get(lineId)!;
    expect(m.lineMatch.get(lineId), label).toBe(entryId); // one-to-one, both directions agree
    expect(e.amountCents, label).toBe(l.amountCents);
    expect(Math.abs(dayOf(e.date) - dayOf(l.date)), label).toBeLessThanOrEqual(MATCH_WINDOW_DAYS);
  }
  for (const [lineId, entryId] of m.lineMatch) {
    if (entryId !== null) expect(m.entryMatch.get(entryId), label).toBe(lineId);
  }
}

describe('matchRows: case 1 as handed over', () => {
  const state = initialState(CASE_1);
  const m = matchRows(CASE_1, state);

  it('leaves exactly one copy of the doubled Upwork payment unmatched', () => {
    expectConsistent(CASE_1, state, m);
    const un = unmatchedEntries(m);
    expect(un).toHaveLength(1);
    expect(['E09', 'E10']).toContain(un[0]);
  });

  it('matches every statement line, including the second real Upwork payment two weeks later', () => {
    expect(unmatchedLines(m)).toEqual([]);
    expect(m.entryMatch.get('E14')).toBe('T13');
  });

  it('matches both genuine identical coffees (two bank lines, two rows)', () => {
    expect(new Set([m.entryMatch.get('E05'), m.entryMatch.get('E06')])).toEqual(new Set(['T05', 'T06']));
  });

  it('treats the two copies as interchangeable: deleting either leaves the other matched', () => {
    for (const entryId of ['E09', 'E10']) {
      const after = play(CASE_1, [{ type: 'delete', entryId }]);
      const ma = matchRows(CASE_1, after);
      expectConsistent(CASE_1, after, ma);
      expect(unmatchedEntries(ma)).toEqual([]);
      expect(unmatchedLines(ma)).toEqual([]);
    }
  });

  it('exposes the trap: deleting the real later payment leaves its bank line with nothing in the books', () => {
    const after = play(CASE_1, [{ type: 'delete', entryId: 'E14' }]);
    const ma = matchRows(CASE_1, after);
    expect(unmatchedLines(ma)).toEqual(['T13']);
    expect(unmatchedEntries(ma)).toHaveLength(1); // the copy dated two weeks earlier is outside the window
  });
});

describe('matchRows: case 2 as handed over', () => {
  const state = initialState(CASE_2);
  const m = matchRows(CASE_2, state);

  it('flags the transposed amount on both sides', () => {
    expectConsistent(CASE_2, state, m);
    expect(m.entryMatch.get('E03')).toBeNull(); // books say 48.37
    expect(m.lineMatch.get('R03')).toBeNull(); // bank says 84.37
  });

  it('flags the bank fee nobody recorded', () => {
    expect(m.lineMatch.get('R13')).toBeNull();
    expect(unmatchedLines(m).sort()).toEqual(['R03', 'R13']);
  });

  it('leaves one AutoZone copy unmatched and prefers the ticked one', () => {
    expect(m.entryMatch.get('E08')).toBe('R08');
    expect(m.entryMatch.get('E09')).toBeNull();
  });

  it('leaves the outstanding check unmatched: it is real, it is just not on the statement yet', () => {
    expect(m.entryMatch.get('E14')).toBeNull();
    expect(unmatchedEntries(m).sort()).toEqual(['E03', 'E09', 'E14']);
  });

  it('matches the owner transfer booked as sales: a wrong category is invisible to matching', () => {
    expect(m.entryMatch.get('E06')).toBe('R06');
    expect(checkAll(CASE_2, state).categories.wrong.map((w) => w.entry.entryId)).toContain('E06');
  });

  it('follows the cleanup step by step', () => {
    const fixedAmount = play(CASE_2, [{ type: 'setAmount', entryId: 'E03', magnitudeCents: 8437 }]);
    expect(matchRows(CASE_2, fixedAmount).entryMatch.get('E03')).toBe('R03');

    const recorded = play(CASE_2, [{ type: 'record', txnId: 'R13', category: 'bankfees' }]);
    expect(matchRows(CASE_2, recorded).lineMatch.get('R13')).toBe('ADD1');

    const keptTheOtherCopy = play(CASE_2, [{ type: 'delete', entryId: 'E08' }]);
    expect(matchRows(CASE_2, keptTheOtherCopy).entryMatch.get('E09')).toBe('R08');

    const solved = play(CASE_2, [
      { type: 'record', txnId: 'R13', category: 'bankfees' },
      { type: 'setAmount', entryId: 'E03', magnitudeCents: 8437 },
      { type: 'setCleared', entryId: 'E03', cleared: true },
      { type: 'delete', entryId: 'E09' },
      { type: 'recategorize', entryId: 'E06', category: 'ownerContribution' },
    ]);
    expect(checkAll(CASE_2, solved).ok).toBe(true);
    const ms = matchRows(CASE_2, solved);
    expectConsistent(CASE_2, solved, ms);
    expect(unmatchedLines(ms)).toEqual([]);
    expect(unmatchedEntries(ms)).toEqual(['E14']); // correct books still have an unmatched row
  });
});

describe('matchRows: rules', () => {
  it('uses only what the user can see, never which real transaction a row records', () => {
    const state = initialState(CASE_2);
    const scrambled: LedgerState = { ...state, entries: state.entries.map((e) => ({ ...e, txnId: 'hidden' })) };
    expect(matchRows(CASE_2, scrambled)).toEqual(matchRows(CASE_2, state));
  });

  it('accepts a date up to three days off and rejects four', () => {
    const shift = (date: string): LedgerState => {
      const state = initialState(CASE_2);
      return { ...state, entries: state.entries.map((e) => (e.entryId === 'E07' ? { ...e, date } : e)) };
    };
    expect(matchRows(CASE_2, shift('2026-03-15')).entryMatch.get('E07')).toBe('R07'); // bank: Mar 12
    expect(matchRows(CASE_2, shift('2026-03-09')).entryMatch.get('E07')).toBe('R07');
    expect(matchRows(CASE_2, shift('2026-03-16')).entryMatch.get('E07')).toBeNull();
    expect(matchRows(CASE_2, shift('2026-02-28')).entryMatch.get('E07')).toBeNull();
  });

  it('prefers the same date over a ticked row, and a ticked row over a lower id', () => {
    const base = initialState(CASE_2);
    const e08 = base.entries.find((e) => e.entryId === 'E08')!; // AutoZone, Mar 14, ticked
    const withCopies = (copies: Partial<typeof e08>[]): LedgerState => ({
      ...base,
      entries: [...base.entries.filter((e) => e.entryId !== 'E08' && e.entryId !== 'E09'), ...copies.map((c) => ({ ...e08, ...c }))],
    });
    const sameDateWins = withCopies([
      { entryId: 'A1', date: '2026-03-13', cleared: true },
      { entryId: 'A2', date: '2026-03-14', cleared: false },
    ]);
    expect(matchRows(CASE_2, sameDateWins).lineMatch.get('R08')).toBe('A2');
    const tickedWins = withCopies([
      { entryId: 'A1', cleared: false },
      { entryId: 'A2', cleared: true },
    ]);
    expect(matchRows(CASE_2, tickedWins).lineMatch.get('R08')).toBe('A2');
    const lowerIdWins = withCopies([
      { entryId: 'A2', cleared: true },
      { entryId: 'A1', cleared: true },
    ]);
    expect(matchRows(CASE_2, lowerIdWins).lineMatch.get('R08')).toBe('A1');
  });

  it('copes with empty books and unreadable dates without throwing', () => {
    const empty: LedgerState = { entries: [], nextAddedId: 1 };
    const me = matchRows(CASE_1, empty);
    expect(me.entryMatch.size).toBe(0);
    expect(unmatchedLines(me)).toHaveLength(statementLines(CASE_1).length);
    const base = initialState(CASE_1);
    const broken: LedgerState = { ...base, entries: base.entries.map((e, i) => (i === 0 ? { ...e, date: 'not-a-date' } : e)) };
    expect(matchRows(CASE_1, broken).entryMatch.get('E01')).toBeNull();
  });
});

describe('matchRows: generated files', () => {
  const SEEDS = Array.from({ length: 50 }, (_, i) => `match-${i}`);

  it('never throws, stays one-to-one, and matches every statement line once the file is solved', () => {
    for (const seed of SEEDS) {
      const g = generateFile(seed, { kind: 'practice' });
      const s = g.scenario;
      let session = createSession(s);
      expectConsistent(s, session.state, matchRows(s, session.state), seed);
      for (const action of g.solution) {
        session = applyAction(session, action);
        expectConsistent(s, session.state, matchRows(s, session.state), seed); // every intermediate state too
      }
      expect(checkAll(s, session.state).ok, seed).toBe(true);
      expect(unmatchedLines(matchRows(s, session.state)), seed).toEqual([]);
    }
  });
});
