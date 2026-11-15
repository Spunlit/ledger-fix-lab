import { describe, expect, it } from 'vitest';
import { normalizeEmail, parseProfile, profileInitial } from '../src/core/profile';

describe('device profile', () => {
  it('accepts anything with the shape of an email and tidies it', () => {
    expect(normalizeEmail('  Dana@Example.COM ')).toBe('dana@example.com');
    expect(normalizeEmail('qwerty@asdf.io')).toBe('qwerty@asdf.io');
    expect(normalizeEmail('\u0444\u0446\u0449@fonanhwjo.com')).toBe('\u0444\u0446\u0449@fonanhwjo.com');
  });

  it('rejects text that is not shaped like an email', () => {
    for (const bad of ['', 'dana', 'dana@', '@example.com', 'dana@example', 'da na@example.com', 'a@b.c', `${'x'.repeat(120)}@example.com`]) {
      expect(normalizeEmail(bad)).toBeNull();
    }
  });

  it('shows the first letter in the profile mark', () => {
    expect(profileInitial('dana@example.com')).toBe('D');
  });

  it('treats a damaged stored profile as signed out', () => {
    expect(parseProfile(null)).toBeNull();
    expect(parseProfile('{oops')).toBeNull();
    expect(parseProfile(JSON.stringify({ email: 'nope', since: '2026-11-15T00:00:00.000Z' }))).toBeNull();
    expect(parseProfile(JSON.stringify({ email: 'dana@example.com', since: 'yesterday' }))).toBeNull();
    expect(parseProfile(JSON.stringify({ email: 'dana@example.com', since: '2026-11-15T00:00:00.000Z' }))).toEqual({ email: 'dana@example.com', since: '2026-11-15T00:00:00.000Z' });
  });
});
