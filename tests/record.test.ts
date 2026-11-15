import { describe, expect, it } from 'vitest';
import { practiceRecord, type RecordInput } from '../src/core/record';

const CASES = ['maple-pine-oct', 'rivera-mar'];
const now = new Date('2026-11-15T00:00:00Z');
const at = (d: string, checksRun = 2) => ({ at: `${d}T10:00:00.000Z`, checksRun });
const base = (over: Partial<RecordInput> = {}): RecordInput => ({ done: {}, history: [], basicsDone: false, caseIds: CASES, now, ...over });

describe('practice record', () => {
  it('starts empty and in progress', () => {
    const r = practiceRecord(base());
    expect(r.complete).toBe(false);
    expect(r.current).toBe(false);
    expect(r.requirements.map((q) => q.done)).toEqual([false, false, false, false, false]);
  });

  it('guided cases do not count as files without hints', () => {
    const r = practiceRecord(base({ basicsDone: true, done: { 'maple-pine-oct': at('2026-11-14', 1), 'rivera-mar': at('2026-11-14', 1) } }));
    expect(r.unguidedSolved).toBe(0);
    expect(r.firstCheckSolved).toBe(0);
    expect(r.complete).toBe(false);
  });

  it('is complete and current after both cases, three unguided files and one first-check pass', () => {
    const done = { 'maple-pine-oct': at('2026-11-10'), 'rivera-mar': at('2026-11-11'), 'daily-2026-11-12': at('2026-11-12'), 'daily-2026-11-13': at('2026-11-13', 1), 'practice-abc': at('2026-11-14') };
    const r = practiceRecord(base({ basicsDone: true, done }));
    expect(r.complete).toBe(true);
    expect(r.current).toBe(true);
    expect(r.currentThrough).toBe('2026-12-14');
    expect(r.lastPractice).toBe('2026-11-14');
  });

  it('needs a first-check pass: three slow solves are not enough', () => {
    const done = { 'maple-pine-oct': at('2026-11-10'), 'rivera-mar': at('2026-11-11'), a: at('2026-11-12'), b: at('2026-11-13'), c: at('2026-11-14') };
    expect(practiceRecord(base({ basicsDone: true, done })).complete).toBe(false);
  });

  it('lapses when the last unguided file is more than 30 days old', () => {
    const done = { 'maple-pine-oct': at('2026-09-01'), 'rivera-mar': at('2026-09-01'), a: at('2026-09-02', 1), b: at('2026-09-03'), c: at('2026-10-10') };
    const r = practiceRecord(base({ basicsDone: true, done }));
    expect(r.complete).toBe(true);
    expect(r.current).toBe(false);
    expect(r.currentThrough).toBeNull();
  });
});
