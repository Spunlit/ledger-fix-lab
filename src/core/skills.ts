import type { CheckReport } from './engine';
import type { Planted, Scenario, SkillId } from './types';

export const ALL_SKILLS: SkillId[] = ['duplicates', 'genuineRepeats', 'missing', 'transposition', 'timing', 'categories', 'ownerEquity'];

/** Every transaction any check currently flags. */
export function flaggedTxnIds(report: CheckReport): Set<string> {
  const ids = new Set<string>();
  report.integrity.missing.forEach((t) => ids.add(t.txnId));
  report.integrity.extra.forEach((x) => ids.add(x.txn.txnId));
  report.amounts.wrong.forEach((w) => ids.add(w.entry.txnId));
  report.cleared.wrong.forEach((w) => ids.add(w.entry.txnId));
  report.categories.wrong.forEach((w) => ids.add(w.entry.txnId));
  return ids;
}

/** A planted problem counts as handled when no check flags its transaction. */
export function plantedOutcomes(s: Scenario, report: CheckReport): { planted: Planted; handled: boolean }[] {
  const flagged = flaggedTxnIds(report);
  return s.planted.map((p) => ({ planted: p, handled: !flagged.has(p.txnId) }));
}

/** Per skill: true only if every planted problem of that skill was handled. */
export function skillOutcomes(s: Scenario, report: CheckReport): Partial<Record<SkillId, boolean>> {
  const out: Partial<Record<SkillId, boolean>> = {};
  for (const { planted, handled } of plantedOutcomes(s, report)) {
    out[planted.skill] = (out[planted.skill] ?? true) && handled;
  }
  return out;
}

export interface SkillAttempt {
  fileId: string;
  at: string;
  /** Outcome of the FIRST check on that file, per skill practiced. */
  firstCheck: Partial<Record<SkillId, boolean>>;
}

export interface SkillStat {
  skill: SkillId;
  attempts: number;
  firstTry: number;
}

/** Aggregate first-check accuracy per skill. One attempt per file (the first time it was checked). */
export function skillStats(history: SkillAttempt[]): SkillStat[] {
  const seen = new Set<string>();
  const stats = new Map<SkillId, SkillStat>(ALL_SKILLS.map((k) => [k, { skill: k, attempts: 0, firstTry: 0 }]));
  for (const h of history) {
    if (seen.has(h.fileId)) continue;
    seen.add(h.fileId);
    for (const [k, ok] of Object.entries(h.firstCheck) as [SkillId, boolean][]) {
      const st = stats.get(k)!;
      st.attempts += 1;
      if (ok) st.firstTry += 1;
    }
  }
  return [...stats.values()];
}

/** Weakest skills first: lowest first-try rate among practiced skills, then never-practiced ones. */
export function weakestSkills(history: SkillAttempt[], n = 2): SkillId[] {
  const stats = skillStats(history);
  const practiced = stats.filter((s) => s.attempts > 0 && s.firstTry < s.attempts).sort((a, b) => a.firstTry / a.attempts - b.firstTry / b.attempts || b.attempts - a.attempts);
  const unpracticed = stats.filter((s) => s.attempts === 0);
  return [...practiced, ...unpracticed].slice(0, n).map((s) => s.skill);
}
