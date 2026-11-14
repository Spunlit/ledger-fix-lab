import { describe, expect, it } from 'vitest';
import { coachStep } from '../src/core/coach';
import { applyAction, createSession } from '../src/core/engine';
import { GLOSSARY, splitTerms } from '../src/core/glossary';
import { GUIDE } from '../src/core/guide';
import { CASE_1, CASE_2 } from '../src/core/scenarios';

const join = (text: string) => splitTerms(text).map((p) => p.text).join('');
const terms = (text: string) => splitTerms(text).filter((p) => p.term).map((p) => p.term!.id);

describe('plain-language glossary', () => {
  it('splitting never changes the text', () => {
    const samples = [
      ...GUIDE.flatMap((t) => [t.see, t.tell, t.fix, t.why]),
      coachStep(CASE_1, createSession(CASE_1).state).title,
      coachStep(CASE_2, createSession(CASE_2).state).action,
      'The difference is $0.00, but 2 checks fail. Balanced is not the same as right.',
      '',
    ];
    for (const s of samples) expect(join(s)).toBe(s);
  });

  it('marks each word once, longest spelling first, whole words only', () => {
    expect(terms('The bank statement and the statement again')).toEqual(['statement']);
    expect(terms("Owner's draw is not an expense category")).toEqual(['draw', 'category']);
    expect(terms('An outstanding check is not cleared')).toEqual(['outstanding', 'cleared']);
    expect(terms('Rebalanced indifference')).toEqual([]); // no matches inside other words
    expect(terms('Net profit is too high')).toEqual(['profit']);
  });

  it('explanations are short and do not lean on other jargon', () => {
    const jargon = /reconcil|transpos|outstanding|uncleared|equity|ledger|accrual/i;
    for (const t of GLOSSARY) {
      expect(t.plain.split(/\s+/).length).toBeLessThanOrEqual(28);
      // a term may name itself (the "Bookkeepers call it…" note), never another hard word
      const own = new RegExp(t.match.concat(t.term.toLowerCase()).join('|'), 'i');
      const leaked = (t.plain.match(new RegExp(jargon.source, 'gi')) ?? []).filter((w) => !own.test(w) && !/transpos/i.test(w));
      expect(leaked).toEqual([]);
    }
    expect(new Set(GLOSSARY.map((t) => t.id)).size).toBe(GLOSSARY.length);
  });

  it('the coach text for the uncleared Verizon row carries a tappable word', () => {
    let s = createSession(CASE_2);
    s = applyAction(s, { type: 'record', txnId: 'R13', category: 'bankfees' });
    s = applyAction(s, { type: 'delete', entryId: 'E09' });
    s = applyAction(s, { type: 'setAmount', entryId: 'E03', magnitudeCents: 8437 });
    const step = coachStep(CASE_2, s.state);
    expect(step.kind).toBe('tick');
    expect(terms(`${step.title} ${step.action}`)).toContain('cleared');
  });
});
