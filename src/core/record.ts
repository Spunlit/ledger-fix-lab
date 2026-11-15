import { skillStats, type SkillAttempt, type SkillStat } from './skills';

/**
 * The practice record: an honest summary of what a learner has actually done in the trainer. It is not
 * a certificate and claims no authority; it lists facts (which files were solved, how many without hints,
 * first-check accuracy per skill) and says whether the practice is current. "Current" is what ties it to
 * a subscription rather than a one-time course: the record stays current only while you keep practising.
 */
export interface RecordInput {
  /** fileId -> when it was solved and how many checks it took. */
  done: Record<string, { at: string; checksRun: number }>;
  history: SkillAttempt[];
  basicsDone: boolean;
  /** Ids of the guided cases, in order. */
  caseIds: string[];
  now: Date;
}

export interface Requirement {
  id: 'basics' | 'case1' | 'case2' | 'unguided' | 'firstCheck';
  label: string;
  done: boolean;
  /** Progress in words, e.g. "2 of 3". */
  detail: string;
}

export interface PracticeRecord {
  requirements: Requirement[];
  /** All requirements met. */
  complete: boolean;
  /** Complete, and an unguided file was solved in the last CURRENT_DAYS days. */
  current: boolean;
  /** ISO day until which the record stays current, when it is. */
  currentThrough: string | null;
  /** ISO day of the latest solved unguided file. */
  lastPractice: string | null;
  unguidedSolved: number;
  firstCheckSolved: number;
  skills: SkillStat[];
}

export const UNGUIDED_NEEDED = 3;
export const CURRENT_DAYS = 30;

const day = (iso: string) => iso.slice(0, 10);

export function practiceRecord(input: RecordInput): PracticeRecord {
  const { done, history, basicsDone, caseIds, now } = input;
  const unguided = Object.entries(done).filter(([id]) => !caseIds.includes(id));
  const unguidedSolved = unguided.length;
  const firstCheckSolved = unguided.filter(([, v]) => v.checksRun === 1).length;
  const requirements: Requirement[] = [
    { id: 'basics', label: 'Start from zero finished', done: basicsDone, detail: basicsDone ? 'Done' : 'Not yet' },
    { id: 'case1', label: 'Case 1 solved (guided)', done: Boolean(done[caseIds[0]]), detail: done[caseIds[0]] ? 'Done' : 'Not yet' },
    { id: 'case2', label: 'Case 2 solved (guided)', done: Boolean(done[caseIds[1]]), detail: done[caseIds[1]] ? 'Done' : 'Not yet' },
    { id: 'unguided', label: `${UNGUIDED_NEEDED} files solved without hints`, done: unguidedSolved >= UNGUIDED_NEEDED, detail: `${Math.min(unguidedSolved, UNGUIDED_NEEDED)} of ${UNGUIDED_NEEDED}` },
    { id: 'firstCheck', label: 'One file right on the first check', done: firstCheckSolved >= 1, detail: firstCheckSolved >= 1 ? 'Done' : 'Not yet' },
  ];
  const complete = requirements.every((r) => r.done);
  const last = unguided.map(([, v]) => v.at).sort().pop() ?? null;
  const lastMs = last ? Date.parse(last) : NaN;
  const fresh = Number.isFinite(lastMs) && now.getTime() - lastMs <= CURRENT_DAYS * 86400000 && lastMs <= now.getTime() + 86400000;
  return {
    requirements,
    complete,
    current: complete && fresh,
    currentThrough: complete && fresh ? new Date(lastMs + CURRENT_DAYS * 86400000).toISOString().slice(0, 10) : null,
    lastPractice: last ? day(last) : null,
    unguidedSolved,
    firstCheckSolved,
    skills: skillStats(history).filter((s) => s.attempts > 0),
  };
}
