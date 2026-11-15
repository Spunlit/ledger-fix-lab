import { esc, loadTheme, themeButton } from './util';

/**
 * Terms and Conditions (app.html#/terms). A plain-language DRAFT written for the hackathon build: it says
 * what the product is and is not, and what really happens with data and payments in this build. It has
 * not been reviewed by a lawyer, and the page says so.
 */
const UPDATED = 'November 15, 2026';

const SECTIONS: { h: string; p: string[] }[] = [
  {
    h: '1. What Ledger Fix Lab is',
    p: [
      'Ledger Fix Lab is a practice tool. You fix the books of made-up small businesses against made-up bank statements, and the tool grades the result.',
      'It is for learning. It is not accounting, tax, legal or financial advice, and finishing a file here is not a certificate or a licence.',
    ],
  },
  {
    h: '2. The practice files are fictional',
    p: [
      'Every business, person, bank line and amount in the trainer is invented for practice. Any likeness to a real business or person is a coincidence.',
      'The trainer models one bank account of a sole proprietor on a cash basis. Real books can be more complicated. Check anything that matters with a qualified professional.',
    ],
  },
  {
    h: '3. No account needed, and where your progress lives',
    p: [
      'You do not need to sign up. Your progress (finished files, skill record, streak, theme) is saved only in this browser, in its local storage. We do not receive it.',
      'Signing in is optional. The email you enter names your profile in this browser. It is not sent to us, it is not checked, and no account is created on a server in this build.',
      'Clearing your browser data, or using another device, starts you from zero. We cannot restore it.',
      '"Check your own books" reads the files you choose inside this browser. They are not uploaded and not stored; closing the tab forgets them. Its findings are suggestions for you to review, not advice.',
      'The pages load their fonts from Google Fonts, so Google receives a normal web request from your browser. The site is hosted on GitHub Pages, which keeps its own server logs.',
    ],
  },
  {
    h: '4. Free and Practice plans',
    p: [
      'The Free plan includes both guided cases, the file of the day, warm-up drills, the field guide and one practice file.',
      'The Practice plan is shown at $12 a month or $96 a year with a 7-day trial. In this build the checkout is a demonstration: you are not asked for a card and nothing is charged. "Starting" the plan only unlocks practice files in this browser.',
      'If paid plans are switched on later, the price, renewal and cancellation terms will be shown before you pay, and these terms will be updated first.',
    ],
  },
  {
    h: '5. Using the site fairly',
    p: [
      'Use the trainer to learn. Do not try to break it, overload it, or pass off its practice files as real financial records.',
    ],
  },
  {
    h: '6. Ownership',
    p: [
      'The source code is public on GitHub. The practice files, texts and design of Ledger Fix Lab belong to its authors. You may use them to learn and to teach others; please do not resell them.',
    ],
  },
  {
    h: '7. No warranty',
    p: [
      'The trainer is provided as it is. We work to keep the grading correct (it is covered by automated tests), but we do not promise that it is free of mistakes or always available.',
      'To the extent the law allows, the authors are not liable for losses that come from relying on the trainer for real bookkeeping, tax or business decisions.',
    ],
  },
  {
    h: '8. Changes and contact',
    p: [
      'These terms may change as the product changes. The date at the top shows the latest version.',
      'Questions and corrections: open an issue on the project\'s GitHub page.',
    ],
  },
];

export function renderTerms(): string {
  return `
  <header class="nav">
    <a class="brand" href="./" aria-label="Ledger Fix Lab, back to the main page"><span class="mark" aria-hidden="true"></span>Ledger Fix Lab</a>
    <div class="nav-right"><a class="nav-link" href="#/">Your desk</a>${themeButton(loadTheme())}</div>
  </header>
  <main class="guide-page legal">
    <header class="guide-head">
      <p class="drill-step">Legal</p>
      <h1>Terms and Conditions</h1>
      <p class="legal-draft" data-testid="terms-draft"><b>Draft.</b> Written in plain language for this early build and not yet reviewed by a lawyer. Last updated ${esc(UPDATED)}.</p>
    </header>
    ${SECTIONS.map((s) => `<section class="legal-sec"><h2>${esc(s.h)}</h2>${s.p.map((t) => `<p>${esc(t)}</p>`).join('')}</section>`).join('')}
    <section class="guide-end">
      <div class="drill-actions">
        <a class="btn primary big" href="./">Back to the main page</a>
        <a class="btn big" href="https://github.com/Spunlit/ledger-fix-lab/issues">Open an issue on GitHub</a>
      </div>
    </section>
  </main>`;
}
