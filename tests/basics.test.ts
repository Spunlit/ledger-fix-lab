import { describe, expect, it } from 'vitest';
import { BASICS, BASICS_BANK, BASICS_BOOKS, BASICS_FACTS } from '../src/core/basics';
import { GLOSSARY } from '../src/core/glossary';

describe('Start from zero', () => {
  it('has five steps, each with one right answer among its options', () => {
    expect(BASICS).toHaveLength(5);
    for (const s of BASICS) {
      const ids = s.options.map((o) => o.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toContain(s.answer);
      expect(s.options.length).toBe(3);
      expect(s.explain.split(/\s+/).length).toBeLessThanOrEqual(45);
    }
  });

  it('the arithmetic on screen is right: the difference is exactly the missing fee', () => {
    expect(BASICS_BANK - BASICS_BOOKS).toBe(BASICS_FACTS.fee);
    const diff = BASICS.find((s) => s.id === 'difference')!;
    expect(diff.options.find((o) => o.id === diff.answer)!.title).toBe('−$15.00');
    expect(diff.context!.lines.map((l) => l.amount)).toEqual(['$1,265.00', '$1,280.00']);
    expect(BASICS.find((s) => s.id === 'category')!.right).toContain('$500.00 too high');
  });

  it("uses the app's own category names", () => {
    const names = GLOSSARY.map((t) => t.term);
    expect(names).toContain("Owner's contribution");
    expect(BASICS.find((s) => s.id === 'category')!.options.map((o) => o.title)).toContain("Owner's contribution");
  });
});
