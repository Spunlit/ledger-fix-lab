import { describe, expect, it } from 'vitest';
import { centsToPlain, esc, parseDollarsToCents, masteryLevel, weekDays } from '../src/ui/util';

describe('amount input parsing (no floats)', () => {
  it.each([
    ['84.37', 8437],
    ['$84.37', 8437],
    ['84', 8400],
    ['84.3', 8430],
    ['1,204.50', 120450],
    [' 0.07 ', 7],
  ])('%s → %i cents', (input, cents) => expect(parseDollarsToCents(input)).toBe(cents));

  it.each(['', '0', '0.00', '-5', '84.371', 'abc', '1e3', '84..3', '.5'])('rejects %j', (input) =>
    expect(parseDollarsToCents(input)).toBeNull(),
  );

  it('round-trips with centsToPlain', () => {
    expect(centsToPlain(-8437)).toBe('84.37');
    expect(parseDollarsToCents(centsToPlain(105))).toBe(105);
  });
});

describe('escaping', () => {
  it('escapes HTML-significant characters', () => {
    expect(esc(`<img src=x onerror="a('b')">&`)).toBe('&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
  });
});

import { dailyStreak } from '../src/ui/util';
describe('daily streak', () => {
  const at = { at: 'x', checksRun: 1 };
  it('counts consecutive completed days ending today or yesterday', () => {
    expect(dailyStreak({}, '2026-11-15')).toBe(0);
    expect(dailyStreak({ 'daily-2026-11-15': at, 'daily-2026-11-14': at, 'daily-2026-11-12': at }, '2026-11-15')).toBe(2);
    expect(dailyStreak({ 'daily-2026-11-14': at, 'daily-2026-11-13': at }, '2026-11-15')).toBe(2);
    expect(dailyStreak({ 'daily-2026-11-13': at }, '2026-11-15')).toBe(0);
  });
});

import { canOpenPractice, FREE_PRACTICE_FILES } from '../src/ui/util';
describe('paywall entitlement', () => {
  const plan = { plan: 'practice' as const, billing: 'monthly' as const, since: 'x', demo: true as const };
  it('allows the free practice files, re-opening, and everything with a plan', () => {
    expect(FREE_PRACTICE_FILES).toBe(1);
    expect(canOpenPractice('a', [], null)).toBe(true);
    expect(canOpenPractice('a', ['a'], null)).toBe(true);
    expect(canOpenPractice('b', ['a'], null)).toBe(false);
    expect(canOpenPractice('b', ['a'], plan)).toBe(true);
  });
});

describe('course home helpers', () => {
  it('weekDays lists seven UTC days ending today and marks the ones done', () => {
    const w = weekDays({ 'daily-2026-11-13': { at: 'x', checksRun: 1 }, 'daily-2026-11-08': { at: 'x', checksRun: 1 } }, '2026-11-14');
    expect(w.map((d) => d.day)).toEqual(['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14']);
    expect(w.filter((d) => d.done).map((d) => d.day)).toEqual(['2026-11-08', '2026-11-13']);
    expect(w[6].today).toBe(true);
    expect(w[6].label).toBe('Sa');
  });

  it('masteryLevel needs two tries before calling a skill solid', () => {
    expect(masteryLevel(0, 0)).toBe('New');
    expect(masteryLevel(1, 1)).toBe('Practicing');
    expect(masteryLevel(2, 2)).toBe('Solid');
    expect(masteryLevel(5, 4)).toBe('Solid');
    expect(masteryLevel(5, 3)).toBe('Practicing');
  });
});
