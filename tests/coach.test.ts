import { describe, expect, it } from 'vitest';
import { coachStep } from '../src/core/coach';
import { GUIDE, guideTopic } from '../src/core/guide';
import { ALL_SKILLS } from '../src/core/skills';
import { applyAction, checkAll, createSession } from '../src/core/engine';
import { CASE_1, CASE_2 } from '../src/core/scenarios';
import type { Action, Scenario, Session } from '../src/core/types';

/** Do exactly what the coach says, the way a learner would, and return the next session. */
function follow(s: Scenario, session: Session): Session {
  const report = checkAll(s, session.state);
  const step = coachStep(s, session.state, report);
  let action: Action;
  switch (step.kind) {
    case 'record': {
      const txn = s.txns.find((t) => t.txnId === step.txnIds[0])!;
      action = { type: 'record', txnId: txn.txnId, category: txn.category };
      break;
    }
    case 'duplicate':
      action = { type: 'delete', entryId: step.entryIds[0] };
      break;
    case 'amount': {
      const w = report.amounts.wrong.find((x) => x.entry.entryId === step.entryIds[0])!;
      action = { type: 'setAmount', entryId: w.entry.entryId, magnitudeCents: Math.abs(w.expectedCents) };
      break;
    }
    case 'tick':
      action = { type: 'setCleared', entryId: step.entryIds[0], cleared: true };
      break;
    case 'untick':
      action = { type: 'setCleared', entryId: step.entryIds[0], cleared: false };
      break;
    case 'category': {
      const w = report.categories.wrong.find((x) => x.entry.entryId === step.entryIds[0])!;
      action = { type: 'recategorize', entryId: w.entry.entryId, category: w.expected };
      break;
    }
    default:
      throw new Error(`coach gave ${step.kind}, which is not a fix`);
  }
  return applyAction(session, action);
}

describe('the coach for guided cases', () => {
  it('case 1 starts with the doubled purchase and points at both copies', () => {
    const s = createSession(CASE_1);
    const step = coachStep(CASE_1, s.state);
    expect(step.kind).toBe('duplicate');
    expect(step.entryIds).toHaveLength(2);
    expect(step.title).toMatch(/in the books twice/);
  });

  it('case 2 starts with the bank fee the books never recorded', () => {
    const step = coachStep(CASE_2, createSession(CASE_2).state);
    expect(step.kind).toBe('record');
    expect(step.txnIds).toEqual(['R13']);
    expect(step.title).toMatch(/\$15\.00/);
  });

  it('never points at the outstanding check or a genuine repeat', () => {
    for (const scenario of [CASE_1, CASE_2]) {
      let session = createSession(scenario);
      const traps = new Set(scenario.planted.filter((p) => p.skill === 'timing' || p.skill === 'genuineRepeats').map((p) => p.txnId));
      for (let i = 0; i < 12; i++) {
        const step = coachStep(scenario, session.state);
        if (step.kind === 'done') break;
        const touched = [...step.txnIds, ...step.entryIds.map((id) => session.state.entries.find((e) => e.entryId === id)!.txnId)];
        expect(touched.filter((t) => traps.has(t))).toEqual([]);
        session = follow(scenario, session);
      }
    }
  });

  it('following the coach step by step ends with books that pass every check', () => {
    for (const scenario of [CASE_1, CASE_2]) {
      let session = createSession(scenario);
      for (let i = 0; i < 12 && coachStep(scenario, session.state).kind !== 'done'; i++) session = follow(scenario, session);
      expect(coachStep(scenario, session.state).kind).toBe('done');
      expect(checkAll(scenario, session.state).ok).toBe(true);
    }
  });

  it('deleting a real payment makes the coach ask for Undo first', () => {
    const s = applyAction(createSession(CASE_2), { type: 'delete', entryId: 'E14' });
    const step = coachStep(CASE_2, s.state);
    expect(step.kind).toBe('restore');
    expect(step.action).toMatch(/Undo/);
  });

  it('every step that asks for a fix points at a guide topic; the guide covers all seven skills once', () => {
    for (const scenario of [CASE_1, CASE_2]) {
      let session = createSession(scenario);
      for (let i = 0; i < 12; i++) {
        const step = coachStep(scenario, session.state);
        if (step.kind === 'done') {
          expect(step.topic).toBeNull();
          break;
        }
        expect(guideTopic(step.topic!).why.length).toBeGreaterThan(40);
        session = follow(scenario, session);
      }
    }
    expect(GUIDE.map((t) => t.skill).sort()).toEqual([...ALL_SKILLS].sort());
    expect(coachStep(CASE_2, applyAction(createSession(CASE_2), { type: 'record', txnId: 'R13', category: 'bankfees' }).state).topic).not.toBeNull();
  });

  it('case 2 ends on the owner-money topic: the mistake that balances', () => {
    let session = createSession(CASE_2);
    let last = coachStep(CASE_2, session.state);
    for (let i = 0; i < 12; i++) {
      const step = coachStep(CASE_2, session.state);
      if (step.kind === 'done') break;
      last = step;
      session = follow(CASE_2, session);
    }
    expect(last.topic).toBe('owner');
  });
});
