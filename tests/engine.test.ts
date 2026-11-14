import { describe, expect, it } from 'vitest';
import {
  applyAction,
  canUndo,
  checkAll,
  createSession,
  reset,
  undo,
  validateScenario,
} from '../src/core/engine';
import { explain } from '../src/core/explain';
import { formatCents, formatSignedCents, sumCents } from '../src/core/money';
import { SCENARIO_1 } from '../src/core/scenario';
import type { Action, Scenario, Session } from '../src/core/types';

const run = (actions: Action[], start: Session = createSession(SCENARIO_1)) =>
  actions.reduce((s, a) => applyAction(s, a), start);
const report = (s: Session) => checkAll(s.scenario, s.state);

const FIX_CATEGORIES: Action[] = [
  { type: 'recategorize', entryId: 'E03', category: 'software' },
  { type: 'recategorize', entryId: 'E11', category: 'car' },
];

describe('scenario fixture', () => {
  it('is valid and within scope (10–15 rows, cents, consistent statement)', () => {
    expect(validateScenario(SCENARIO_1)).toEqual([]);
    expect(SCENARIO_1.ledger.length).toBeGreaterThanOrEqual(10);
    expect(SCENARIO_1.ledger.length).toBeLessThanOrEqual(15);
  });

  it('starts with all three checks failing and a −$412.50 difference', () => {
    const r = report(createSession(SCENARIO_1));
    expect(r.ok).toBe(false);
    expect(r.integrity.ok).toBe(false);
    expect(r.integrity.extra.map((x) => x.line.txnId)).toEqual(['T09']);
    expect(r.balance.differenceCents).toBe(-41250);
    expect(r.categories.wrong.map((w) => w.entry.entryId).sort()).toEqual(['E03', 'E11']);
  });
});

describe('checks', () => {
  it('correct solution passes all three checks', () => {
    const r = report(run([{ type: 'delete', entryId: 'E10' }, ...FIX_CATEGORIES]));
    expect(r).toMatchObject({ ok: true, integrity: { ok: true }, balance: { ok: true, differenceCents: 0 }, categories: { ok: true } });
  });

  it('equivalent solution (other copy of the duplicate kept) also passes', () => {
    const r = report(run([...FIX_CATEGORIES, { type: 'delete', entryId: 'E09' }]));
    expect(r.ok).toBe(true);
  });

  it('two real identical purchases are not a duplicate', () => {
    const r = report(run([{ type: 'delete', entryId: 'E10' }, ...FIX_CATEGORIES]));
    const blueBottle = run([]).state.entries.filter((e) => e.description.startsWith('Blue Bottle'));
    expect(blueBottle).toHaveLength(2);
    expect(r.integrity.extra).toEqual([]);
  });

  it('deleting a needed record fails integrity and balance', () => {
    const s = run([{ type: 'delete', entryId: 'E10' }, ...FIX_CATEGORIES, { type: 'delete', entryId: 'E06' }]);
    const r = report(s);
    expect(r.ok).toBe(false);
    expect(r.integrity.missing.map((l) => l.txnId)).toEqual(['T06']);
    expect(r.balance.differenceCents).toBe(1250);
    expect(r.categories.ok).toBe(true);
    const ex = explain(s.scenario, s.state, r);
    expect(ex.integrity[0]).toMatch(/Missing record.*Blue Bottle.*twice.*has it once/);
  });

  it('compensating errors: balance matches but integrity fails', () => {
    // Deletes the real Oct 29 Upwork payment instead of the Oct 15 duplicate (same amount).
    const s = run([{ type: 'delete', entryId: 'E14' }, ...FIX_CATEGORIES]);
    const r = report(s);
    expect(r.balance).toMatchObject({ ok: true, differenceCents: 0 });
    expect(r.categories.ok).toBe(true);
    expect(r.integrity.ok).toBe(false);
    expect(r.integrity.missing.map((l) => l.txnId)).toEqual(['T13']);
    expect(r.integrity.extra.map((x) => x.line.txnId)).toEqual(['T09']);
    expect(r.ok).toBe(false);
    const ex = explain(s.scenario, s.state, r);
    expect(ex.balance[0]).toMatch(/errors can cancel out/);
  });

  it('wrong category with zero money difference fails only the category check', () => {
    const s = run([{ type: 'delete', entryId: 'E10' }, { type: 'recategorize', entryId: 'E03', category: 'software' }]);
    const r = report(s);
    expect(r.integrity.ok).toBe(true);
    expect(r.balance.differenceCents).toBe(0);
    expect(r.categories.ok).toBe(false);
    expect(r.categories.wrong).toEqual([{ entry: expect.objectContaining({ entryId: 'E11' }), expected: 'car' }]);
    expect(r.ok).toBe(false);
  });

  it('recategorizing never changes the money difference', () => {
    const before = report(run([])).balance.differenceCents;
    const after = report(run(FIX_CATEGORIES)).balance.differenceCents;
    expect(after).toBe(before);
  });

  it('a correctly categorized row can be broken by recategorizing', () => {
    const r = report(run([{ type: 'delete', entryId: 'E10' }, ...FIX_CATEGORIES, { type: 'recategorize', entryId: 'E02', category: 'office' }]));
    expect(r.categories.wrong.map((w) => w.entry.entryId)).toEqual(['E02']);
  });
});

describe('undo', () => {
  it('restores the exact previous state (deep equality), step by step back to the start', () => {
    const s0 = createSession(SCENARIO_1);
    const s1 = applyAction(s0, { type: 'delete', entryId: 'E06' });
    const s2 = applyAction(s1, { type: 'recategorize', entryId: 'E03', category: 'software' });
    const s3 = applyAction(s2, { type: 'delete', entryId: 'E14' });

    expect(undo(s3).state).toStrictEqual(s2.state);
    expect(undo(undo(s3)).state).toStrictEqual(s1.state);
    const back = undo(undo(undo(s3)));
    expect(back.state).toStrictEqual(s0.state);
    expect(back.state.entries).toStrictEqual(SCENARIO_1.ledger);
    expect(canUndo(back)).toBe(false);
    expect(undo(back)).toBe(back);
  });

  it('actions never mutate previous states or the scenario', () => {
    const pristine = structuredClone(SCENARIO_1.ledger);
    const s0 = createSession(SCENARIO_1);
    const snapshot = structuredClone(s0.state);
    run([{ type: 'delete', entryId: 'E10' }, ...FIX_CATEGORIES], s0);
    expect(s0.state).toStrictEqual(snapshot);
    expect(SCENARIO_1.ledger).toStrictEqual(pristine);
  });

  it('no-op recategorization does not add history; reset returns to the start', () => {
    const s0 = createSession(SCENARIO_1);
    expect(applyAction(s0, { type: 'recategorize', entryId: 'E02', category: 'rent' })).toBe(s0);
    const s = reset(run([{ type: 'delete', entryId: 'E01' }]));
    expect(s.state).toStrictEqual(s0.state);
    expect(s.history).toEqual([]);
  });

  it('rejects unknown rows', () => {
    expect(() => applyAction(createSession(SCENARIO_1), { type: 'delete', entryId: 'NOPE' })).toThrow();
  });
});

describe('money formatting', () => {
  it('formats integer cents without float math', () => {
    expect(formatCents(-41250)).toBe('−$412.50');
    expect(formatCents(575445)).toBe('$5,754.45');
    expect(formatSignedCents(0)).toBe('$0.00');
    expect(formatSignedCents(1250)).toBe('+$12.50');
    expect(() => formatCents(1.5)).toThrow();
  });

  it('sumCents rejects intermediate overflow instead of silently losing cents', () => {
    expect(() => sumCents([Number.MAX_SAFE_INTEGER, 2, -2])).toThrow();
    expect(sumCents([41250, -41250, 1250])).toBe(1250);
  });
});

describe('exhaustive', () => {
  it('of all 2^14 ways to keep/delete rows, exactly two pass: delete either duplicate copy', () => {
    const fixed = run(FIX_CATEGORIES);
    const all = fixed.state.entries;
    const passing: string[][] = [];
    for (let mask = 0; mask < 1 << all.length; mask++) {
      const entries = all.filter((_, i) => mask & (1 << i));
      if (checkAll(SCENARIO_1, { entries }).ok) {
        passing.push(all.filter((_, i) => !(mask & (1 << i))).map((e) => e.entryId));
      }
    }
    expect(passing.sort()).toEqual([['E09'], ['E10']]);
  });
});

describe('scenario validation (review regressions)', () => {
  it('reports repeated unknown transactions instead of crashing', () => {
    const bad: Scenario = {
      ...SCENARIO_1,
      ledger: [
        ...SCENARIO_1.ledger,
        { ...SCENARIO_1.ledger[0], entryId: 'X1', txnId: 'UNKNOWN' },
        { ...SCENARIO_1.ledger[0], entryId: 'X2', txnId: 'UNKNOWN' },
      ],
    };
    const problems = validateScenario(bad);
    expect(problems).toContain('entry X1 references unknown transaction UNKNOWN');
    expect(problems).toContain('entry X2 references unknown transaction UNKNOWN');
  });
});
