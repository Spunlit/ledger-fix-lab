const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape any string interpolated into HTML (text or attribute). */
export const esc = (s: string | number): string => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

/**
 * Parse a user-typed dollar amount into positive integer cents without floating point.
 * Accepts "84.37", "$84.37", "1,204.5", "84". Returns null if invalid or zero.
 */
export function parseDollarsToCents(input: string): number | null {
  const s = input.trim().replace(/^\$/, '').replace(/,/g, '');
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  return cents > 0 ? cents : null;
}

export function centsToPlain(cents: number): string {
  const abs = Math.abs(cents);
  return `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

const STORE_KEY = 'ledger-fix-lab:v2:completed';

export type Completed = Record<string, { at: string; checksRun: number }>;

/** Per-viewer convenience only; the app works the same if storage is unavailable. */
export function loadCompleted(): Completed {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Completed;
  } catch {
    return {};
  }
}

export function saveCompleted(c: Completed): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(c));
  } catch {
    /* storage blocked: progress simply isn't remembered */
  }
}

const HISTORY_KEY = 'ledger-fix-lab:v3:skill-history';

/** First-check outcomes per file. Per-viewer convenience only; works without storage. */
export function loadHistory(): import('../core/skills').SkillAttempt[] {
  try {
    const v = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function saveHistory(h: import('../core/skills').SkillAttempt[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(-200)));
  } catch {
    /* storage blocked */
  }
}

/** A short random seed for a new practice file (UI only; the file itself is deterministic per seed). */
export function newSeed(): string {
  return Math.random().toString(36).slice(2, 8);
}

export function longDate(isoDay: string): string {
  const [y, m, d] = isoDay.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

/** Consecutive UTC days, ending today (or yesterday), on which the file of the day was completed. */
export function dailyStreak(done: Completed, today: string): number {
  const has = (d: string) => Boolean(done[`daily-${d}`]);
  const dayBefore = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  let d = has(today) ? today : dayBefore(today);
  let n = 0;
  while (has(d)) {
    n += 1;
    d = dayBefore(d);
  }
  return n;
}

/** The last seven UTC days, oldest first, with whether that day's file was completed. */
export function weekDays(done: Completed, today: string): { day: string; label: string; done: boolean; today: boolean }[] {
  const t = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(t - (6 - i) * 86400000);
    const day = d.toISOString().slice(0, 10);
    return { day, label: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).slice(0, 2), done: Boolean(done[`daily-${day}`]), today: day === today };
  });
}

/** A plain level for a skill from first-check results: needs two tries before it can be called solid. */
export function masteryLevel(attempts: number, firstTry: number): 'New' | 'Practicing' | 'Solid' {
  if (attempts === 0) return 'New';
  return attempts >= 2 && firstTry / attempts >= 0.8 ? 'Solid' : 'Practicing';
}

const DRILL_KEY = 'ledger-fix-lab:v11:drill';
export interface DrillRecord {
  runs: number;
  best: number;
}
export function loadDrillRecord(): DrillRecord {
  try {
    const v = JSON.parse(localStorage.getItem(DRILL_KEY) ?? 'null');
    return v && Number.isInteger(v.runs) && Number.isInteger(v.best) ? { runs: v.runs, best: v.best } : { runs: 0, best: 0 };
  } catch {
    return { runs: 0, best: 0 };
  }
}
export function saveDrillRun(firstTry: number): DrillRecord {
  const r = loadDrillRecord();
  const next = { runs: r.runs + 1, best: Math.max(r.best, firstTry) };
  try {
    localStorage.setItem(DRILL_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked */
  }
  return next;
}

// ---------------------------------------------------------------- plan (paywall)

const PLAN_KEY = 'ledger-fix-lab:v5:plan';
const OPENED_KEY = 'ledger-fix-lab:v5:practice-opened';
/** Free tier: both guided cases, every file of the day, and this many practice files. */
export const FREE_PRACTICE_FILES = 1;

export interface Plan {
  plan: 'practice';
  billing: 'monthly' | 'yearly';
  since: string;
  /** This build simulates checkout; nothing is charged. */
  demo: true;
}

export function loadPlan(): Plan | null {
  try {
    const p = JSON.parse(localStorage.getItem(PLAN_KEY) ?? 'null');
    return p && p.plan === 'practice' ? (p as Plan) : null;
  } catch {
    return null;
  }
}

export function savePlan(p: Plan | null): void {
  try {
    if (p) localStorage.setItem(PLAN_KEY, JSON.stringify(p));
    else localStorage.removeItem(PLAN_KEY);
  } catch {
    /* storage blocked: the plan lasts for this page view only */
  }
}

export function loadOpenedPractice(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(OPENED_KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function saveOpenedPractice(ids: string[]): void {
  try {
    localStorage.setItem(OPENED_KEY, JSON.stringify(ids.slice(-500)));
  } catch {
    /* ignore */
  }
}

/** A practice file can be opened if the visitor has a plan, already opened it, or still has free files left. */
/** Topic drills from the guide: the first three topics are free, the rest come with the Practice plan. */
export const FREE_TOPIC_DRILLS = 3;

export function canOpenPractice(id: string, opened: string[], plan: Plan | null): boolean {
  return Boolean(plan) || opened.includes(id) || opened.length < FREE_PRACTICE_FILES;
}

// ---------------------------------------------------------------- theme

const THEME_KEY = 'ledger-fix-lab:theme';
export type Theme = 'dark' | 'light';

/** Night (dark) is the default look; the visitor's choice is remembered in this browser. */
export function loadTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function saveTheme(t: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* ignore */
  }
}

export function themeButton(t: Theme): string {
  const sun = `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="10" cy="10" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 1.8v2.4M10 15.8v2.4M1.8 10h2.4M15.8 10h2.4M4.2 4.2l1.7 1.7M14.1 14.1l1.7 1.7M4.2 15.8l1.7-1.7M14.1 5.9l1.7-1.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  const moon = `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M15.5 12.6A6.5 6.5 0 0 1 7.4 4.5a6.5 6.5 0 1 0 8.1 8.1Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  return `<button type="button" class="theme-btn" data-theme-toggle aria-label="Switch to ${t === 'dark' ? 'day' : 'night'} theme" title="Switch to ${t === 'dark' ? 'day' : 'night'} theme">${t === 'dark' ? sun : moon}</button>`;
}
