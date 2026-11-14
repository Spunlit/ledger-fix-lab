import { describe, expect, it } from 'vitest';
import { applyAction, checkAll, createSession } from '../src/core/engine';
import { generateFile } from '../src/core/generator';
import { CASE_1, CASE_2 } from '../src/core/scenarios';
import { skillOutcomes } from '../src/core/skills';
import type { Action, Scenario } from '../src/core/types';

const run = (s: Scenario, actions: Action[]) => actions.reduce((acc, a) => applyAction(acc, a), createSession(s));
const C1_SOLVE: Action[] = [
  { type: 'delete', entryId: 'E10' },
  { type: 'recategorize', entryId: 'E03', category: 'software' },
  { type: 'recategorize', entryId: 'E11', category: 'car' },
];

describe('identical bank lines are interchangeable (audit HIGH 1)', () => {
  it.each(['T05', 'T06'])('deleting a coffee and re-recording it from bank line %s restores correct books', (line) => {
    for (const del of ['E05', 'E06']) {
      const s = run(CASE_1, [...C1_SOLVE, { type: 'delete', entryId: del }, { type: 'record', txnId: line, category: 'meals' }]);
      expect(checkAll(CASE_1, s.state).ok, `${del} then ${line}`).toBe(true);
    }
  });

  it('recording a unique line that is already in the books still creates a duplicate', () => {
    const s = run(CASE_2, [{ type: 'record', txnId: 'R01', category: 'sales' }]);
    expect(checkAll(CASE_2, s.state).integrity.extra.map((x) => x.txn.txnId)).toContain('R01');
  });

  it('generated twins: delete either, re-record from either line, books pass', () => {
    for (const seed of Array.from({ length: 60 }, (_, i) => `tw-${i}`)) {
      const g = generateFile(seed, { kind: 'practice', focus: ['genuineRepeats'] });
      const twins = g.scenario.planted.filter((p) => p.skill === 'genuineRepeats').map((p) => p.txnId);
      expect(twins.length, seed).toBe(2);
      const solved = run(g.scenario, g.solution);
      for (const del of twins) {
        const entry = solved.state.entries.find((e) => e.txnId === del)!;
        for (const line of twins) {
          const cat = g.scenario.txns.find((t) => t.txnId === line)!.category;
          const s = [{ type: 'delete', entryId: entry.entryId } as Action, { type: 'record', txnId: line, category: cat } as Action].reduce((a, x) => applyAction(a, x), solved);
          expect(checkAll(g.scenario, s.state).ok, `${seed} ${del} ${line}`).toBe(true);
        }
      }
    }
  });
});

describe('skill record attribution (audit HIGH 2, MEDIUM 4)', () => {
  it.each(['E05', 'E06'])('falling for the genuine-repeat trap (deleting %s) is recorded as missed', (del) => {
    const s = run(CASE_1, [...C1_SOLVE, { type: 'delete', entryId: del }]);
    expect(skillOutcomes(CASE_1, checkAll(CASE_1, s.state)).genuineRepeats).toBe(false);
  });

  it('traps are not credited when Check is pressed on untouched books', () => {
    const out = skillOutcomes(CASE_2, checkAll(CASE_2, createSession(CASE_2).state), { worked: false });
    expect(out.timing).toBeUndefined();
    expect(out.duplicates).toBe(false);
    const worked = skillOutcomes(CASE_2, checkAll(CASE_2, createSession(CASE_2).state), { worked: true });
    expect(worked.timing).toBe(true);
  });
});

describe('generator content fixes (audit MEDIUM 3, 5, LOW 6, 7)', () => {
  const files = Array.from({ length: 400 }, (_, i) => generateFile(`c-${i}`, { kind: 'practice', focus: i % 2 ? ['genuineRepeats'] : [] }).scenario);

  it('a genuine-repeat focus is always planted', () => {
    files.filter((_, i) => i % 2).forEach((s) => expect(s.planted.some((p) => p.skill === 'genuineRepeats'), s.id).toBe(true));
  });

  it('no wire fee without a wire, no rideshare as car, no vehicle insurance', () => {
    for (const s of files) {
      for (const t of s.txns) {
        expect(t.description).not.toMatch(/wire fee|Lyft|van insurance/i);
      }
    }
  });

  it('a duplicate is never planted on a small repeatable purchase', () => {
    for (const s of files) {
      const dup = s.planted.find((p) => p.skill === 'duplicates');
      if (dup) expect(s.txns.find((t) => t.txnId === dup.txnId)!.category, s.id).not.toBe('meals');
    }
  });
});
