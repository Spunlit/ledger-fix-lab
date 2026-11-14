import { describe, expect, it } from 'vitest';
import { clues } from '../src/core/clues';
import {
  applyAction,
  canUndo,
  checkAll,
  createSession,
  reconcile,
  reset,
  statementLines,
  truePnl,
  undo,
  validateScenario,
} from '../src/core/engine';
import { explain } from '../src/core/explain';
import { formatCents, formatSignedCents, sumCents } from '../src/core/money';
import { cleanupReport, reportText } from '../src/core/report';
import { CASES, CASE_1, CASE_2 } from '../src/core/scenarios';
import type { Action, LedgerState, Scenario, Session } from '../src/core/types';

const run = (s: Scenario, actions: Action[], start: Session = createSession(s)) =>
  actions.reduce((acc, a) => applyAction(acc, a), start);
const report = (x: Session) => checkAll(x.scenario, x.state);

// Reference solutions (one of several valid ones).
const C1_FIX_CATS: Action[] = [
  { type: 'recategorize', entryId: 'E03', category: 'software' },
  { type: 'recategorize', entryId: 'E11', category: 'car' },
];
const C1_SOLVE: Action[] = [{ type: 'delete', entryId: 'E10' }, ...C1_FIX_CATS];

const C2_FIX_VERIZON: Action[] = [
  { type: 'setAmount', entryId: 'E03', magnitudeCents: 8437 },
  { type: 'setCleared', entryId: 'E03', cleared: true },
];
const C2_FIX_TRANSFER: Action = { type: 'recategorize', entryId: 'E06', category: 'ownerContribution' };
const C2_RECORD_FEE: Action = { type: 'record', txnId: 'R13', category: 'bankfees' };
const C2_SOLVE: Action[] = [C2_RECORD_FEE, ...C2_FIX_VERIZON, { type: 'delete', entryId: 'E09' }, C2_FIX_TRANSFER];

describe('scenarios', () => {
  it.each(CASES.map((c) => [c.id, c]))('%s is valid and within scope', (_id, c) => {
    expect(validateScenario(c)).toEqual([]);
    expect(c.ledger.length).toBeGreaterThanOrEqual(10);
    expect(c.ledger.length).toBeLessThanOrEqual(15);
  });

  it('statement shows only cleared transactions, with bank descriptions', () => {
    const lines = statementLines(CASE_2);
    expect(lines.map((l) => l.txnId)).not.toContain('R14');
    expect(lines.find((l) => l.txnId === 'R13')?.description).toBe('MONTHLY MAINTENANCE FEE');
  });

  it('case 1 starts $412.50 off with three failing checks', () => {
    const r = report(createSession(CASE_1));
    expect(r.recon.differenceCents).toBe(41250);
    expect(r.integrity.extra.map((x) => x.txn.txnId)).toEqual(['T09']);
    expect(r.categories.wrong.map((w) => w.entry.entryId).sort()).toEqual(['E03', 'E11']);
    expect(r.amounts.ok && r.cleared.ok).toBe(true);
  });

  it('case 2 starts −$99.37 off; the duplicate and the transfer are invisible in the difference', () => {
    const r = report(createSession(CASE_2));
    expect(r.recon.differenceCents).toBe(-9937);
    expect(r.integrity.missing.map((t) => t.txnId)).toEqual(['R13']);
    expect(r.integrity.extra.map((x) => x.txn.txnId)).toEqual(['R08']);
    expect(r.amounts.wrong.map((w) => w.entry.entryId)).toEqual(['E03']);
    // The manual duplicate copy is also on the statement but unticked.
    expect(r.cleared.wrong.map((w) => w.entry.entryId)).toEqual(['E03', 'E09']);
    expect(r.categories.wrong.map((w) => w.entry.entryId)).toEqual(['E06']);
  });
});

describe('case 1 — duplicates', () => {
  it('reference and equivalent solutions pass', () => {
    expect(report(run(CASE_1, C1_SOLVE)).ok).toBe(true);
    expect(report(run(CASE_1, [...C1_FIX_CATS, { type: 'delete', entryId: 'E09' }])).ok).toBe(true);
  });

  it('two identical real coffees are not a duplicate', () => {
    const s = run(CASE_1, [...C1_SOLVE, { type: 'delete', entryId: 'E06' }]);
    const r = report(s);
    expect(r.integrity.missing.map((t) => t.txnId)).toEqual(['T06']);
    expect(r.recon.differenceCents).toBe(-1250);
  });

  it('compensating error: deleting the real Oct 29 payment balances but fails', () => {
    const r = report(run(CASE_1, [{ type: 'delete', entryId: 'E14' }, ...C1_FIX_CATS]));
    expect(r.balanced).toBe(true);
    expect(r.ok).toBe(false);
    expect(r.integrity.missing.map((t) => t.txnId)).toEqual(['T13']);
    expect(r.integrity.extra.map((x) => x.txn.txnId)).toEqual(['T09']);
    expect(explain(r).balance[0]).toMatch(/doesn't prove/);
  });

  it('unticking a duplicate instead of deleting it still fails', () => {
    const r = report(run(CASE_1, [...C1_FIX_CATS, { type: 'setCleared', entryId: 'E10', cleared: false }]));
    expect(r.balanced).toBe(true);
    expect(r.integrity.ok).toBe(false);
    expect(r.cleared.ok).toBe(false);
  });

  it('exhaustive: of all 2^14 delete subsets, only deleting one duplicate copy passes', () => {
    const fixed = run(CASE_1, C1_FIX_CATS).state;
    const passing: string[][] = [];
    for (let mask = 0; mask < 1 << fixed.entries.length; mask++) {
      const entries = fixed.entries.filter((_, i) => mask & (1 << i));
      if (checkAll(CASE_1, { entries, nextAddedId: 1 }).ok) {
        passing.push(fixed.entries.filter((_, i) => !(mask & (1 << i))).map((e) => e.entryId));
      }
    }
    expect(passing.sort()).toEqual([['E09'], ['E10']]);
  });
});

describe('case 2 — balanced, but wrong', () => {
  it('reference solution passes with the right numbers', () => {
    const s = run(CASE_2, C2_SOLVE);
    const r = report(s);
    expect(r.ok).toBe(true);
    expect(r.recon).toMatchObject({
      statementEndingCents: 1777536,
      outstandingPaymentsCents: -65000,
      depositsInTransitCents: 0,
      adjustedBankCents: 1712536,
      bookBalanceCents: 1712536,
      differenceCents: 0,
    });
    expect(truePnl(CASE_2)).toEqual({ incomeCents: 695155, expensesCents: 154079, netIncomeCents: 541076 });
    expect(r.categories.booked).toEqual(truePnl(CASE_2));
  });

  it('equivalent solutions pass: other duplicate copy; re-record the transposed row', () => {
    expect(
      report(run(CASE_2, [C2_RECORD_FEE, ...C2_FIX_VERIZON, { type: 'delete', entryId: 'E08' }, { type: 'setCleared', entryId: 'E09', cleared: true }, C2_FIX_TRANSFER])).ok,
    ).toBe(true);
    expect(
      report(run(CASE_2, [C2_RECORD_FEE, { type: 'delete', entryId: 'E03' }, { type: 'record', txnId: 'R03', category: 'utilities' }, { type: 'delete', entryId: 'E09' }, C2_FIX_TRANSFER])).ok,
    ).toBe(true);
  });

  it('the headline trap: reconciled to $0.00 while profit is overstated by $5,000', () => {
    const s = run(CASE_2, C2_SOLVE.filter((a) => a !== C2_FIX_TRANSFER));
    const r = report(s);
    expect(r.balanced && r.integrity.ok && r.amounts.ok && r.cleared.ok).toBe(true);
    expect(r.categories.ok).toBe(false);
    expect(r.categories.booked.netIncomeCents - r.categories.correct.netIncomeCents).toBe(500000);
    expect(explain(r).categories.join(' ')).toMatch(/overstated by \$5,000\.00/);
  });

  it('deleting the outstanding check: difference unchanged, but a real transaction is gone', () => {
    const r = report(run(CASE_2, [...C2_SOLVE, { type: 'delete', entryId: 'E14' }]));
    expect(r.balanced).toBe(true);
    expect(r.integrity.missing.map((t) => t.txnId)).toEqual(['R14']);
    expect(r.ok).toBe(false);
    expect(explain(r).integrity[0]).toMatch(/hasn't reached the bank yet/);
  });

  it('ticking the outstanding check as cleared is caught (and unbalances by $650)', () => {
    const r = report(run(CASE_2, [...C2_SOLVE, { type: 'setCleared', entryId: 'E14', cleared: true }]));
    expect(r.recon.differenceCents).toBe(65000);
    expect(r.cleared.wrong.map((w) => w.entry.entryId)).toEqual(['E14']);
  });

  it('plugging the difference with another amount is caught by the amount check', () => {
    // Tick Verizon at the wrong $48.37, then inflate Chemical Guys by $36.00 to force $0.00.
    const s = run(CASE_2, [C2_RECORD_FEE, { type: 'setCleared', entryId: 'E03', cleared: true }, { type: 'setAmount', entryId: 'E02', magnitudeCents: 21285 + 3600 }, { type: 'delete', entryId: 'E09' }, C2_FIX_TRANSFER]);
    const r = report(s);
    expect(r.balanced).toBe(true);
    expect(r.amounts.wrong.map((w) => w.entry.entryId).sort()).toEqual(['E02', 'E03']);
    expect(r.ok).toBe(false);
  });

  it('recording a statement line that is already in the books creates a duplicate', () => {
    const r = report(run(CASE_2, [...C2_SOLVE, { type: 'record', txnId: 'R13', category: 'bankfees' }]));
    expect(r.integrity.extra.map((x) => x.txn.txnId)).toEqual(['R13']);
    expect(r.recon.differenceCents).toBe(1500);
  });

  it('calling the owner draw an expense is a category error that understates profit', () => {
    const r = report(run(CASE_2, [...C2_SOLVE, { type: 'recategorize', entryId: 'E11', category: 'contract' }]));
    expect(r.balanced).toBe(true);
    expect(r.categories.booked.netIncomeCents - r.categories.correct.netIncomeCents).toBe(-150000);
  });

  it('exhaustive: deletes × fee recorded × ticks — only the two equivalent states pass', () => {
    const base = run(CASE_2, [...C2_FIX_VERIZON, C2_FIX_TRANSFER]).state;
    const fee = run(CASE_2, [C2_RECORD_FEE]).state.entries.at(-1)!;
    const toggles = ['E03', 'E08', 'E09', 'E14'];
    const passing: string[] = [];
    let balancedButWrong = 0;
    for (let mask = 0; mask < 1 << base.entries.length; mask++) {
      const kept = base.entries.filter((_, i) => mask & (1 << i));
      for (const withFee of [false, true]) {
        for (let t = 0; t < 1 << toggles.length; t++) {
          const entries = kept.map((e) => {
            const k = toggles.indexOf(e.entryId);
            return k === -1 ? e : { ...e, cleared: Boolean(t & (1 << k)) };
          });
          const state: LedgerState = { entries: withFee ? [...entries, fee] : entries, nextAddedId: 2 };
          const r = checkAll(CASE_2, state);
          if (r.ok) {
            const deleted = base.entries.filter((_, i) => !(mask & (1 << i))).map((e) => e.entryId).join(',');
            const ticked = state.entries.filter((e) => e.cleared && toggles.includes(e.entryId)).map((e) => e.entryId).join(',');
            passing.push(`del:${deleted} tick:${ticked} fee:${withFee}`);
          } else if (r.balanced) balancedButWrong++;
        }
      }
    }
    // Tick bits of deleted rows don't change the state, so dedupe.
    expect([...new Set(passing)].sort()).toEqual(['del:E08 tick:E03,E09 fee:true', 'del:E09 tick:E03,E08 fee:true']);
    expect(balancedButWrong).toBeGreaterThan(0); // $0.00 is necessary, not sufficient
  });
});

describe('actions and undo', () => {
  it('undo restores each exact previous state across every action type', () => {
    const states: Session[] = [createSession(CASE_2)];
    for (const a of [C2_RECORD_FEE, ...C2_FIX_VERIZON, { type: 'delete', entryId: 'E09' } as Action, C2_FIX_TRANSFER]) {
      states.push(applyAction(states.at(-1)!, a));
    }
    let s = states.at(-1)!;
    for (let i = states.length - 2; i >= 0; i--) {
      s = undo(s);
      expect(s.state).toStrictEqual(states[i].state);
    }
    expect(s.state.entries).toStrictEqual(CASE_2.ledger);
    expect(canUndo(s)).toBe(false);
    expect(undo(s)).toBe(s);
  });

  it('never mutates earlier states or the scenario', () => {
    const pristine = structuredClone(CASE_2.ledger);
    const s0 = createSession(CASE_2);
    const snap = structuredClone(s0.state);
    run(CASE_2, C2_SOLVE, s0);
    expect(s0.state).toStrictEqual(snap);
    expect(CASE_2.ledger).toStrictEqual(pristine);
  });

  it('amount edits keep the sign and reject bad input; no-ops add no history', () => {
    const s = run(CASE_2, [{ type: 'setAmount', entryId: 'E03', magnitudeCents: 8437 }]);
    expect(s.state.entries.find((e) => e.entryId === 'E03')!.amountCents).toBe(-8437);
    expect(() => applyAction(s, { type: 'setAmount', entryId: 'E03', magnitudeCents: 0 })).toThrow();
    expect(() => applyAction(s, { type: 'setAmount', entryId: 'E03', magnitudeCents: 12.5 })).toThrow();
    expect(applyAction(s, { type: 'setAmount', entryId: 'E03', magnitudeCents: 8437 })).toBe(s);
    expect(applyAction(s, { type: 'recategorize', entryId: 'E01', category: 'sales' })).toBe(s);
  });

  it('recorded rows are locked as cleared; only statement lines can be recorded', () => {
    const s = run(CASE_2, [C2_RECORD_FEE]);
    expect(s.state.entries.at(-1)).toMatchObject({ entryId: 'ADD1', cleared: true, source: 'Added from statement' });
    expect(() => applyAction(s, { type: 'setCleared', entryId: 'ADD1', cleared: false })).toThrow();
    expect(() => applyAction(s, { type: 'record', txnId: 'R14', category: 'contract' })).toThrow();
    expect(() => applyAction(s, { type: 'delete', entryId: 'NOPE' })).toThrow();
  });

  it('reset returns to the handed-over books', () => {
    const s = reset(run(CASE_2, C2_SOLVE));
    expect(s.state).toStrictEqual(createSession(CASE_2).state);
    expect(s.history).toEqual([]);
  });
});

describe('clues follow the intended path', () => {
  it('case 1: the difference points at three Upwork rows (one of them real)', () => {
    const c = clues(CASE_1, createSession(CASE_1).state);
    expect(c[0].kind).toBe('clearedRow');
    expect(c[0].entryIds.sort()).toEqual(['E09', 'E10', 'E14']);
  });

  it('case 2: general → missing bank line → swapped digits → none', () => {
    let s = createSession(CASE_2);
    expect(clues(CASE_2, s.state).map((c) => c.kind)).toEqual(['general']);
    s = applyAction(s, C2_RECORD_FEE);
    const c1 = clues(CASE_2, s.state);
    expect(c1.map((c) => c.kind)).toEqual(['statementLine']);
    expect(c1[0].txnIds).toEqual(['R03']);
    s = applyAction(s, { type: 'setCleared', entryId: 'E03', cleared: true });
    expect(reconcile(CASE_2, s.state).differenceCents).toBe(-3600);
    expect(clues(CASE_2, s.state).map((c) => c.kind)).toEqual(['transposition']);
    s = applyAction(s, { type: 'setAmount', entryId: 'E03', magnitudeCents: 8437 });
    expect(clues(CASE_2, s.state)).toEqual([]);
  });
});

describe('cleanup report', () => {
  it('describes every correction from the end state', () => {
    const s = run(CASE_2, C2_SOLVE);
    const r = cleanupReport(CASE_2, s.state);
    expect(r.items.map((i) => i.kind).sort()).toEqual(['amount', 'category', 'cleared', 'duplicate', 'outstanding', 'recorded']);
    expect(r.before.pnl.netIncomeCents).toBe(1040677);
    expect(r.after.pnl.netIncomeCents).toBe(541076);
    const text = reportText(CASE_2, r);
    expect(text).toMatch(/Reclassified Transfer from savings, Mar 10 from Sales income to Owner's contribution/);
    expect(text).toMatch(/Difference: \$0\.00/);
  });

  it('is path-independent (equivalent solutions give the same kinds of items)', () => {
    const a = cleanupReport(CASE_1, run(CASE_1, C1_SOLVE).state).items.map((i) => i.text);
    const b = cleanupReport(CASE_1, run(CASE_1, [...C1_FIX_CATS, { type: 'delete', entryId: 'E09' }]).state).items.map((i) => i.text);
    expect(a).toEqual(b);
  });
});

describe('money', () => {
  it('formats integer cents without float math', () => {
    expect(formatCents(-41250)).toBe('−$412.50');
    expect(formatCents(1777536)).toBe('$17,775.36');
    expect(formatSignedCents(0)).toBe('$0.00');
    expect(formatSignedCents(1250)).toBe('+$12.50');
    expect(() => formatCents(1.5)).toThrow();
  });

  it('sumCents rejects intermediate overflow', () => {
    expect(() => sumCents([Number.MAX_SAFE_INTEGER, 2, -2])).toThrow();
  });
});
