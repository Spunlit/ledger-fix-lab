import { describe, expect, it } from 'vitest';
import { DRILL_ROUNDS, drillRounds } from '../src/core/drill';

describe('the warm-up drill', () => {
  it('builds five answerable rounds for 60 different seeds', () => {
    for (let n = 0; n < 60; n++) {
      const rounds = drillRounds(`s${n}`);
      expect(rounds).toHaveLength(DRILL_ROUNDS);
      for (const r of rounds) {
        const ids = r.rows.map((x) => x.id);
        expect(new Set(ids).size).toBe(ids.length); // no row shown twice
        expect(r.rows.length).toBeGreaterThanOrEqual(4);
        expect(r.rows.length).toBeLessThanOrEqual(6);
        expect(r.answers.length).toBeGreaterThanOrEqual(1);
        for (const a of r.answers) expect(ids).toContain(a);
        // every wrong tap is really a clean line: the rows hold exactly the answers plus honest lines
        expect(r.rows.length - r.answers.length).toBe(3);
        expect(r.why.length).toBeGreaterThan(20);
        // fair: no honest line looks identical to another line (a genuine repeat would read as a duplicate)
        const looks = r.rows.filter((x) => !r.answers.includes(x.id)).map((x) => `${x.title}|${x.detail}|${x.amount}`);
        expect(new Set(looks).size).toBe(looks.length);
        for (const l of looks) expect(r.rows.filter((x) => `${x.title}|${x.detail}|${x.amount}` === l)).toHaveLength(1);
      }
    }
  });

  it('is deterministic: the same seed gives the same rounds', () => {
    expect(drillRounds('abc')).toEqual(drillRounds('abc'));
  });

  it('a duplicate round accepts either copy; an amount round shows figures that differ only on the answer', () => {
    const rounds = drillRounds('k1');
    const dup = rounds.find((r) => r.kind === 'duplicate')!;
    expect(dup.answers).toHaveLength(2);
    const amt = rounds.find((r) => r.kind === 'amount')!;
    for (const row of amt.rows) {
      const agrees = row.detail === `Bank says ${row.amount}`;
      expect(agrees).toBe(!amt.answers.includes(row.id));
    }
  });
});
