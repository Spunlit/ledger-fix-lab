import { generateFile, todaySeed } from '../core/generator';
import { caseById } from '../core/scenarios';
import { ALL_SKILLS } from '../core/skills';
import type { Scenario, SkillId } from '../core/types';

export interface Resolved {
  scenario: Scenario;
  /** For daily files: the UTC day it belongs to. */
  day?: string;
}

const cache = new Map<string, Scenario>();

function cached(key: string, make: () => Scenario): Scenario {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key)!;
}

export const dailyHref = (day = todaySeed()) => `#/daily/${day}`;
export const practiceHref = (seed: string, focus: SkillId[]) => `#/practice/${seed}${focus.length ? `/${focus.join(',')}` : ''}`;

/** Map a location hash to a scenario: guided cases, the file of the day, or a practice file. */
export function resolve(hash: string): Resolved | null {
  let m = /^#\/case\/([\w-]+)/.exec(hash);
  if (m) {
    const s = caseById(m[1]);
    return s ? { scenario: s } : null;
  }
  m = /^#\/daily(?:\/(\d{4}-\d{2}-\d{2}))?$/.exec(hash);
  if (m) {
    const day = m[1] ?? todaySeed();
    return { scenario: cached(`daily:${day}`, () => generateFile(day, { kind: 'daily' }).scenario), day };
  }
  m = /^#\/practice\/([a-z0-9]{1,16})(?:\/([a-zA-Z,]+))?$/.exec(hash);
  if (m) {
    const focus = (m[2] ?? '').split(',').filter((k): k is SkillId => (ALL_SKILLS as string[]).includes(k));
    const key = `${m[1]}:${focus.join(',')}`;
    return { scenario: cached(`practice:${key}`, () => generateFile(key, { kind: 'practice', focus }).scenario) };
  }
  return null;
}
