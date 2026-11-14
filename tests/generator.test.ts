import { describe, expect, it } from 'vitest';
import { clues } from '../src/core/clues';
import { applyAction, checkAll, createSession, reconcile, validateScenario } from '../src/core/engine';
import { generateFile, rng, todaySeed, transpositions } from '../src/core/generator';
import { cleanupReport } from '../src/core/report';
import { plantedOutcomes, skillStats, weakestSkills } from '../src/core/skills';
import type { Action, LedgerState } from '../src/core/types';

const SEEDS = Array.from({ length: 300 }, (_, i) => `seed-${i}`);
const solve = (g: ReturnType<typeof generateFile>, actions: Action[] = g.solution) =>
  actions.reduce((s, a) => applyAction(s, a), createSession(g.scenario));

describe('generator: every file is fair and provably solvable', () => {
  it('is deterministic per seed', () => {
    expect(generateFile('2026-11-15', { kind: 'daily' })).toEqual(generateFile('2026-11-15', { kind: 'daily' }));
    expect(generateFile('a', { kind: 'daily' }).scenario.txns).not.toEqual(generateFile('b', { kind: 'daily' }).scenario.txns);
    expect(rng('x')()).toBeGreaterThanOrEqual(0);
  });

  it.each([3, 4, 5])('300 seeds × %i problems: valid, broken as handed over, solved by the reference', (problems) => {
    for (const seed of SEEDS) {
      const g = generateFile(seed, { kind: 'practice', problems });
      const s = g.scenario;
      expect(validateScenario(s), seed).toEqual([]);
      expect(s.ledger.length).toBeGreaterThanOrEqual(10);
      expect(s.ledger.length).toBeLessThanOrEqual(16);
      expect(new Set(s.planted.filter((p) => p.skill !== 'genuineRepeats').map((p) => p.skill)).size, seed).toBe(problems);
      const start = checkAll(s, createSession(s).state);
      expect(start.ok, seed).toBe(false);
      // Each planted problem except the traps (outstanding check, genuine repeat) is flagged at the start.
      for (const { planted, handled } of plantedOutcomes(s, start)) {
        const trap = planted.skill === 'timing' || planted.skill === 'genuineRepeats';
        expect(handled, `${seed} ${planted.skill}`).toBe(trap);
      }
      const solved = solve(g).state;
      expect(checkAll(s, solved).ok, seed).toBe(true);
      expect(clues(s, createSession(s).state)).toBeDefined();
      expect(cleanupReport(s, solved).items.length).toBeGreaterThan(0);
      for (const t of s.txns) expect(Number.isSafeInteger(t.amountCents) && t.amountCents !== 0).toBe(true);
    }
  });

  it('focus skills are always planted (practice files target weak spots)', () => {
    for (const seed of SEEDS.slice(0, 100)) {
      const skills = generateFile(seed, { kind: 'practice', focus: ['transposition', 'timing'] }).scenario.planted.map((p) => p.skill);
      expect(skills).toContain('transposition');
      expect(skills).toContain('timing');
    }
  });

  it('the traps trap: deleting the outstanding check or a genuine repeat always fails', () => {
    for (const seed of SEEDS.slice(0, 150)) {
      const g = generateFile(seed, { kind: 'practice', focus: ['timing', 'genuineRepeats'] });
      const solved = solve(g);
      const traps = g.scenario.planted.filter((x) => x.skill === 'timing' || x.skill === 'genuineRepeats');
      expect(traps.length, seed).toBeGreaterThanOrEqual(1);
      for (const p of traps) {
        const entry = solved.state.entries.find((e) => e.txnId === p.txnId)!;
        const r = checkAll(g.scenario, applyAction(solved, { type: 'delete', entryId: entry.entryId }).state);
        expect(r.ok, seed).toBe(false);
        expect(r.integrity.missing.map((t) => t.txnId)).toContain(p.txnId);
      }
    }
  });

  it('a lone transposition leaves a difference divisible by 9 and triggers the clue', () => {
    for (const seed of SEEDS.slice(0, 150)) {
      const g = generateFile(seed, { kind: 'practice', focus: ['transposition'] });
      const p = g.scenario.planted.find((x) => x.skill === 'transposition')!;
      const s = solve(g, g.solution.filter((a) => a.type !== 'setAmount'));
      const d = reconcile(g.scenario, s.state).differenceCents;
      expect(Math.abs(d) % 9, seed).toBe(0);
      expect(d).not.toBe(0);
      expect(clues(g.scenario, s.state).map((c) => c.kind)).toContain('transposition');
      expect(checkAll(g.scenario, s.state).amounts.wrong.map((w) => w.entry.txnId)).toEqual([p.txnId]);
    }
  });

  it('exhaustive on sample files: among all delete subsets only the two duplicate copies pass', () => {
    for (const seed of SEEDS.slice(0, 6)) {
      const g = generateFile(seed, { kind: 'practice', focus: ['duplicates'] });
      const fixed = solve(g, g.solution.filter((a) => a.type !== 'delete')).state;
      const dupTxn = g.scenario.planted.find((p) => p.skill === 'duplicates')!.txnId;
      let passing = 0;
      for (let mask = 0; mask < 1 << fixed.entries.length; mask++) {
        const entries = fixed.entries.filter((_, i) => mask & (1 << i));
        // A kept manual copy must be ticked to pass; give each kept copy of the duplicate the right tick.
        const state: LedgerState = { entries: entries.map((e) => (e.txnId === dupTxn ? { ...e, cleared: true } : e)), nextAddedId: fixed.nextAddedId };
        if (checkAll(g.scenario, state).ok) passing++;
      }
      expect(passing, seed).toBe(2);
    }
  });

  it('transpositions swaps adjacent distinct digits without leading zeros', () => {
    expect(transpositions(8437).sort()).toEqual([4837, 8347, 8473].sort());
    expect(transpositions(1050)).toEqual([1500, 1005]);
    expect(transpositions(1100)).toEqual([1010]);
  });

  it('today seed is the UTC date', () => {
    expect(todaySeed(new Date('2026-11-15T03:00:00Z'))).toBe('2026-11-15');
  });
});

describe('skill record', () => {
  it('counts first-check accuracy once per file and ranks weak spots', () => {
    const h = [
      { fileId: 'a', at: '1', firstCheck: { duplicates: true, transposition: false } },
      { fileId: 'a', at: '2', firstCheck: { duplicates: false, transposition: true } }, // ignored: same file
      { fileId: 'b', at: '3', firstCheck: { transposition: false, timing: true } },
    ];
    const st = Object.fromEntries(skillStats(h).map((s) => [s.skill, s]));
    expect(st.duplicates).toMatchObject({ attempts: 1, firstTry: 1 });
    expect(st.transposition).toMatchObject({ attempts: 2, firstTry: 0 });
    expect(weakestSkills(h, 2)[0]).toBe('transposition');
  });
});
