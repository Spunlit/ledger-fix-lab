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
