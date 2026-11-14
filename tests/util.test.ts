import { describe, expect, it } from 'vitest';
import { centsToPlain, esc, parseDollarsToCents } from '../src/ui/util';

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
