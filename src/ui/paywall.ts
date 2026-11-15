import { FREE_PRACTICE_FILES, loadTheme, themeButton, type Plan } from './util';

/**
 * The Practice plan paywall. The checkout is a clearly labelled demo (no card, nothing charged):
 * the hackathon brief asks for a working paywall with a clear price; real billing is out of scope.
 */
export interface PaywallState {
  /** Where to go after the plan is active (a practice-file hash), if the visitor hit the limit. */
  returnTo: string | null;
  step: 'plans' | 'checkout';
  billing: 'monthly' | 'yearly';
}

export const PRICE = { monthly: 15, yearly: 120 } as const;

const check = `<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="m5 10.5 3.2 3L15 6.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function renderPaywall(st: PaywallState, plan: Plan | null): string {
  const hitLimit = Boolean(st.returnTo) && st.returnTo !== '#/check' && !plan;
  const yearly = st.billing === 'yearly';
  const price = yearly ? `$${PRICE.yearly}<small>/year</small>` : `$${PRICE.monthly}<small>/month</small>`;
  return `
  <header class="nav">
    <a class="brand" href="#/" aria-label="Ledger Fix Lab home"><span class="mark" aria-hidden="true"></span>Ledger Fix Lab</a>
    <div class="nav-right"><a class="nav-link" href="#/">Home</a>${themeButton(loadTheme())}</div>
  </header>
  <main class="paywall" aria-labelledby="pw-h">
    ${
      plan
        ? `<section class="pw-active" data-testid="plan-active">
            <span class="pill">Practice plan active <b>demo</b></span>
            <h1 id="pw-h">Unlimited practice is on.</h1>
            <p class="pw-sub">Every practice file is built around the mistakes you miss most. Billed ${plan.billing === 'yearly' ? `$${PRICE.yearly}/year` : `$${PRICE.monthly}/month`} after the 7-day trial in the real product; in this demo nothing is charged.</p>
            <div class="pw-actions">
              ${st.returnTo ? `<button type="button" class="btn primary big" data-pw="open">${st.returnTo === '#/check' ? 'Back to my books' : 'Open my practice file'}</button>` : '<a class="btn primary big" href="#/">Back to practice</a>'}
              <button type="button" class="btn ghost" data-pw="cancel">Cancel demo plan</button>
            </div>
          </section>`
        : `
    <section class="pw-hero">
      <span class="pill">${hitLimit ? `You've used your free practice file${FREE_PRACTICE_FILES > 1 ? 's' : ''}` : 'Practice plan'}</span>
      <h1 id="pw-h">Practice until catching mistakes is automatic.</h1>
      <p class="pw-sub">New client files built around the mistakes you miss, as many as you want. Graded instantly, in your browser, no QuickBooks needed.</p>
    </section>

    <section class="pw-card" aria-label="Practice plan">
      <div class="pw-toggle" role="group" aria-label="Billing period">
        <button type="button" class="${yearly ? '' : 'on'}" data-pw="monthly" aria-pressed="${!yearly}">Monthly</button>
        <button type="button" class="${yearly ? 'on' : ''}" data-pw="yearly" aria-pressed="${yearly}">Yearly <span>save 33%</span></button>
      </div>
      <p class="pw-price" data-testid="pw-price">${price}</p>
      <p class="pw-trial">Preview of the plan: the checkout is a demo and nothing is charged.</p>
      <ul class="pw-list">
        <li>${check} Unlimited practice files aimed at your weak spots</li>
        <li>${check} Check your own books: every finding, every month</li>
        <li>${check} Your full skill history across every file</li>
      </ul>
      ${
        st.step === 'checkout'
          ? `<div class="pw-checkout" data-testid="pw-checkout">
              <p class="pw-demo"><b>Demo checkout.</b> This hackathon build simulates the purchase: no card is needed and nothing is charged.</p>
              <div class="pw-summary"><span>Practice plan, ${yearly ? 'yearly' : 'monthly'}</span><span class="num">${yearly ? `$${PRICE.yearly}.00/yr` : `$${PRICE.monthly}.00/mo`}</span></div>
              <div class="pw-summary"><span>Due today</span><span class="num">$0.00</span></div>
              <button type="button" class="btn primary big wide" data-pw="confirm">Start free trial (demo)</button>
              <button type="button" class="link small" data-pw="back">Back</button>
            </div>`
          : `<button type="button" class="btn primary big wide" data-pw="checkout">Start 7-day free trial</button>`
      }
      <p class="pw-anchor">For comparison: one practice client file elsewhere sells for $49 to $119, and you grade it yourself.</p>
    </section>

    <section class="pw-free">
      <h2>Free forever</h2>
      <p>Both guided cases, a new file of the day every day, your skill record, ${FREE_PRACTICE_FILES} practice file, and the first three findings in your own books.</p>
      <a class="link" href="#/">Keep using the free version</a>
      <p class="pw-terms">By starting a plan you agree to the <a href="#/terms">Terms and Conditions</a> (draft).</p>
    </section>`
    }
  </main>
  <footer class="foot"><p>Prices are the plan we intend to test. Payments are simulated in this build; no card data is collected.</p></footer>`;
}
