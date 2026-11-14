import { describe, expect, it } from 'vitest';
import { applyAction, createSession, initialState } from '../src/core/engine';
import { actionFeedback, progress } from '../src/core/feedback';
import { CASE_1, CASE_2 } from '../src/core/scenarios';
import type { Action, Scenario } from '../src/core/types';

function step(s: Scenario, prior: Action[], action: Action) {
  const before = prior.reduce((acc, a) => applyAction(acc, a), createSession(s));
  const after = applyAction(before, action);
  return actionFeedback(s, initialState(s), before.state, after.state);
}

describe('instant feedback in guided cases', () => {
  it('case 1: deleting the duplicate copy is progress', () => {
    expect(step(CASE_1, [], { type: 'delete', entryId: 'E10' })).toEqual({ tone: 'good', text: 'Fixed. Difference $412.50 to $0.00. 1 of 3 problems done.' });
  });

  it('case 1: deleting the real Oct 29 payment warns immediately', () => {
    const f = step(CASE_1, [], { type: 'delete', entryId: 'E14' });
    expect(f?.tone).toBe('warn');
    expect(f?.text).toMatch(/real: it's on the bank statement/);
  });

  it('case 1: deleting one of the identical coffees warns', () => {
    expect(step(CASE_1, [], { type: 'delete', entryId: 'E05' })?.tone).toBe('warn');
  });

  it('case 1: a wrong category on a correct row warns; the right fix is progress', () => {
    expect(step(CASE_1, [], { type: 'recategorize', entryId: 'E02', category: 'office' })?.tone).toBe('warn');
    expect(step(CASE_1, [], { type: 'recategorize', entryId: 'E03', category: 'software' })?.tone).toBe('good');
  });

  it('case 1: the last fix says to confirm with Check', () => {
    const f = step(CASE_1, [{ type: 'delete', entryId: 'E10' }, { type: 'recategorize', entryId: 'E03', category: 'software' }], { type: 'recategorize', entryId: 'E11', category: 'car' });
    expect(f?.text).toMatch(/last one: press Check the books/);
  });

  it('case 2: deleting the outstanding check warns that it is real but uncleared', () => {
    expect(step(CASE_2, [], { type: 'delete', entryId: 'E14' })?.text).toMatch(/hasn't reached the bank yet/);
  });

  it('a neutral action gives no feedback', () => {
    expect(step(CASE_2, [], { type: 'setCleared', entryId: 'E03', cleared: true })).toBeNull();
  });

  it('progress counts only fixable planted problems (traps excluded)', () => {
    expect(progress(CASE_1, initialState(CASE_1), initialState(CASE_1))).toEqual({ fixed: 0, total: 3 });
    expect(progress(CASE_2, initialState(CASE_2), initialState(CASE_2))).toEqual({ fixed: 0, total: 4 });
  });
});
