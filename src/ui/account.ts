import { todaySeed } from '../core/generator';
import { normalizeEmail, parseProfile, profileInitial, type Profile } from '../core/profile';
import { dailyStreak, esc, loadPlan, loadTheme, longDate, themeButton, type Completed } from './util';

/**
 * Sign in (app.html#/signin). An email names the learner's profile on this device. There is no server in
 * this build, and the page says so: nothing is sent, no password, no confirmation. Any well-formed email
 * is accepted at once, so nobody is held up at a door that leads nowhere yet.
 */
const KEY = 'ledger-fix-lab:v23:profile';

export function loadProfile(): Profile | null {
  try { return parseProfile(localStorage.getItem(KEY)); } catch { return null; }
}
export function signIn(rawEmail: string, now = new Date()): Profile | null {
  const email = normalizeEmail(rawEmail);
  if (!email) return null;
  const p: Profile = { email, since: now.toISOString() };
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage blocked: signed in for this page view only */ }
  return p;
}
export function signOut(): void {
  try { localStorage.removeItem(KEY); } catch { /* nothing stored, nothing to remove */ }
}

/** The profile link for page headers: "Sign in", or the learner's initial. */
export function profileLink(p: Profile | null): string {
  return p
    ? `<a class="who" href="#/signin" aria-label="Your profile, ${esc(p.email)}" data-testid="who">${esc(profileInitial(p.email))}</a>`
    : `<a class="nav-link" href="#/signin" data-testid="signin-link">Sign in</a>`;
}

export interface AccountState {
  /** What was typed when the last attempt failed. */
  tried: string | null;
}

export function renderAccount(p: Profile | null, s: AccountState, done: Completed): string {
  const header = `
  <header class="nav">
    <a class="brand" href="./" aria-label="Ledger Fix Lab, back to the main page"><span class="mark" aria-hidden="true"></span>Ledger Fix Lab</a>
    <div class="nav-right"><a class="nav-link" href="#/">Your desk</a>${themeButton(loadTheme())}</div>
  </header>`;
  const note = `<p class="acct-note" data-testid="acct-note"><b>Early build.</b> There is no server yet. Your email stays in this browser and is not sent anywhere. Accounts that follow you to another device come later.</p>`;
  if (p) {
    const solved = Object.keys(done).length;
    const streak = dailyStreak(done, todaySeed());
    const plan = loadPlan();
    return `${header}
  <main class="guide-page acct">
    <header class="guide-head">
      <p class="drill-step">Profile</p>
      <h1 data-testid="acct-in">You are signed in</h1>
      <p class="guide-lead"><b class="acct-mail">${esc(p.email)}</b>, on this device since ${esc(longDate(p.since.slice(0, 10)))}.</p>
    </header>
    <dl class="acct-facts">
      <div><dt>Files solved</dt><dd class="num">${solved}</dd></div>
      <div><dt>Day streak</dt><dd class="num">${streak}</dd></div>
      <div><dt>Plan</dt><dd>${plan ? 'Practice (demo)' : 'Free'}</dd></div>
    </dl>
    <div class="drill-actions">
      <a class="btn primary big" href="#/">Go to your desk</a>
      <button type="button" class="btn big" data-account="out">Sign out</button>
    </div>
    <p class="acct-fine">Signing out removes the email from this browser. Your progress stays.</p>
    ${note}
  </main>`;
  }
  return `${header}
  <main class="guide-page acct">
    <header class="guide-head">
      <p class="drill-step">Profile</p>
      <h1>Sign in</h1>
      <p class="guide-lead">Enter your email to put a name on your progress. No password, nothing to confirm.</p>
    </header>
    <form class="acct-form" data-account-form novalidate>
      <label for="acct-email">Email</label>
      <div class="acct-row">
        <input id="acct-email" name="email" type="text" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="you@example.com" value="${esc(s.tried ?? '')}" maxlength="120" ${s.tried !== null ? 'aria-invalid="true" aria-describedby="acct-err"' : ''}>
        <button type="submit" class="btn primary big">Continue</button>
      </div>
      ${s.tried !== null ? `<p class="acct-err" id="acct-err" role="alert" data-testid="acct-err">That does not look like an email. Try a shape like name@example.com.</p>` : ''}
    </form>
    ${note}
    <a class="link" href="#/">Continue without signing in</a>
  </main>`;
}
