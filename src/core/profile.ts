/**
 * The device profile behind "Sign in". This build has no server, so a profile is only an email kept in
 * the browser to put a name on the learner's progress. Nothing is sent anywhere and no password exists.
 */
export interface Profile {
  email: string;
  /** ISO timestamp of the first sign-in on this device. */
  since: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** A trimmed, lower-cased email, or null when the text does not have the shape of one. */
export function normalizeEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  return e.length <= 120 && EMAIL.test(e) ? e : null;
}

/** The letter shown in the round profile mark. */
export function profileInitial(email: string): string {
  return (email.trim()[0] ?? '?').toUpperCase();
}

/** Reads a stored profile defensively: anything malformed counts as signed out. */
export function parseProfile(raw: string | null): Profile | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<Profile>;
    const email = typeof p.email === 'string' ? normalizeEmail(p.email) : null;
    if (!email || typeof p.since !== 'string' || !Number.isFinite(Date.parse(p.since))) return null;
    return { email, since: p.since };
  } catch {
    return null;
  }
}
