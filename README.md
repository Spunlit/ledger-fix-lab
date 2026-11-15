# Ledger Fix Lab

**Books that balance can still be wrong. Practice catching it, and get graded on the result.**
Live: https://spunlit.github.io/ledger-fix-lab/ (free, no sign-up)

A browser trainer for beginners. You fix the books of a made-up small business against its bank statement: delete the
duplicate, correct the swapped digits, record the bank fee nobody entered, leave the uncashed check alone, move the
owner's money out of Sales. A deterministic engine grades the **books you end with**: not only whether the difference
is $0.00, but whether the books are right. When you have the skill, the same matching checks your own two CSV files.

Track: Skills. For working adults in the US (25 to 45) who keep the books for their own side business, or who are
starting to keep books for others. They pay out of pocket (B2C). Evidence and open questions:
[PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md). Deck: [pitch/LedgerFixLab_pitch.pdf](pitch/LedgerFixLab_pitch.pdf).

## For judges: a 3-minute tour
1. **Start from zero** (`app.html#/basics`): five ideas in two minutes, one tap each, for someone who has never kept
   books. Every bookkeeping word in the product can be tapped for a plain explanation.
2. **Case 1** (`app.html#/case/maple-pine-oct`): a short tour lights each part of the screen. The coach names one
   problem at a time. Press *Hint* three times: a clue, then the row, then *Show me how* makes the move for you.
3. **Case 2, "Balanced, but wrong"** (`app.html#/case/rivera-mar`): bring the difference to $0.00 and press *Check
   the books*. Three checks pass, the fourth says profit is overstated by $5,000.
4. **Your desk** (`app.html#/`): the path as a ladder (done, open, with the plan), today's file, the skill record.
   A locked step opens the Practice plan ($12 a month or $96 a year). Checkout is a labelled demo: no card, no charge.
5. **Check your own books** (`app.html#/check`): press *Try the sample files*. The $234.89 difference is explained to
   the cent by four lines, and a transfer filed as income is flagged although it balances.
6. **Warm-up drill** (`app.html#/drill`, best on a phone) and the **field guide** (`app.html#/guide`).

## What is real and what is a demo
**Working, in the browser, with no server:**
- the interactive books (tick cleared, edit an amount, change a category, delete, record a bank line), undo, start over;
- four independent checks with explanations, clues, profit before and after, a client-ready cleanup summary;
- the coach and three levels of help in guided cases; exam mode with no hints for the file of the day and practice files;
- a generator of client files, each returned only if it is valid, broken as handed over, and solved by its own
  reference solution (900 generated files are checked in tests);
- the file of the day (the same for everyone, new every UTC day), streak, skill record from first checks, weak-spot files;
- warm-up and topic drills, the field guide with a glossary, the "Start from zero" lesson;
- the practice record (a printable page of what you have done; it says it is not a certificate);
- **Check your own books**: reads two CSV files in the browser (nothing is uploaded), pairs the lines and lists what to
  look at; the findings always add up to the difference.

**Demo, and labelled so in the product:**
- Checkout: the paywall and plan locks work, but no card is asked for and nothing is charged.
- Sign in: an email names a profile on this device. There is no server, no password and no cross-device account.

**Not built, not measured:** user accounts on a server, payments, QuickBooks/Xero/bank connections, an AI tutor.
No interviews, users, revenue or retention data exist. All practice businesses and the sample files are fictional.
The trainer models one bank account on a cash basis; real books can be more complicated.

## How grading works
Four independent checks on the final state, plus the reconciliation arithmetic:
1. Every real transaction is in the books exactly once (nothing doubled, nothing real deleted, nothing unknown).
2. Every amount matches its source.
3. A row is ticked cleared exactly when it is on this statement (outstanding items stay unticked).
4. Every row is in the right category; the effect on net profit is shown in dollars.

`Difference = adjusted bank balance − book balance`. $0.00 is necessary, never sufficient. Any correct end state
passes (either copy of a duplicate; editing a swapped amount or re-recording it). Two real identical purchases are not
a duplicate. Money is integer cents everywhere; formatting happens only on output. There is no AI in the grading: the
same books always get the same grade.

## Run and test
```bash
npm install
npm run dev                 # local dev server
npm test                    # 146 unit tests, incl. exhaustive state-space checks and 900 generated files
npm run build && npx vite preview --port 4173          # production build, served locally
node scripts/e2e.mjs http://localhost:4173/ledger-fix-lab/      # 96 browser checks, headless Chrome/Edge
node scripts/e2e.mjs https://spunlit.github.io/ledger-fix-lab/  # the same checks against the live site
node pitch/shots.mjs && node pitch/build-pdf.mjs                # deck screenshots from the real product, then the PDF
```
CI (GitHub Actions) runs the unit tests and the build before every deploy to GitHub Pages. The pages load their fonts
from Google Fonts; without a network the system fonts are used and everything else works.

## Structure
- `src/core/`: the pure core, no DOM. `engine.ts` (actions, undo, reconciliation, checks, validation), `scenarios.ts`
  (the two cases), `generator.ts`, `skills.ts`, `coach.ts`, `clues.ts`, `feedback.ts`, `match.ts`, `drill.ts`,
  `guide.ts`, `glossary.ts`, `basics.ts`, `record.ts`, `checker.ts` (your own CSV files), `profile.ts`, `money.ts`.
- `index.html`, `src/landing.*`: the landing page (static, its own CSS and a small script).
- `app.html`, `src/main.ts`, `src/ui/`, `src/*.css`: the trainer (vanilla TypeScript, hash routes).
- `tests/`: Vitest. `scripts/e2e.mjs`: browser checks over the DevTools protocol, no extra dependencies.
- `pitch/`: deck source (`slides.html`), the PDF, and speaker notes in Russian (`PITCH_RU.md`).

Typefaces: Instrument Serif, Inter and Geist Mono (SIL Open Font License), served by Google Fonts.
