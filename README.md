# Ledger Fix Lab

**Practice your first bookkeeping cleanup before a client pays for it.**
Live: https://spunlit.github.io/ledger-fix-lab/ (free, no sign-up)

Realistic client books with the mistakes real books have: duplicate imports, swapped digits, bank fees nobody
recorded, checks that haven't cleared, and owner money booked as income. You reconcile them to the bank statement,
and a deterministic engine grades the **end state of the books**: not just whether the difference is $0.00, but
whether the books are actually right.

Track: Skills (bookkeeping) · Built for: new US freelance bookkeepers who have finished a course or certification
but have no hands-on cleanup experience. Evidence and open questions: [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md).

## For judges: a 2-minute tour
1. **Landing page:** in the books window, click the line that is booked wrong. The books match the bank to $0.00, yet
   profit is $5,000 too high; catch it and the profit counts down to the true figure. Graded by the real engine on
   case 2's books.
2. **Warm-up drill** (`app.html#/drill`, best on a phone): five one-tap rounds, "tap the line that is wrong". Rounds are
   cut from generated files and answered by the same checks that grade full files.
3. **Case 2 ("Balanced, but wrong"):** a coach names one problem at a time, the row it is about and what to click;
   every fix says what changed ("Difference $99.37 to $84.37"). Press *Check the books* and read the review.
4. **Today's file:** a generated client file, no hints (exam mode). Its first check feeds your skill record.
5. **Practice my weak spots, second practice file:** the paywall (Practice plan, $12/month or $96/year, 7-day trial).
   Checkout is a clearly labelled demo: no card, nothing charged.

## Guided vs. unguided
Guided cases have a coach (the single next step, from the same checks that grade the file), instant feedback after every move, a progress count and an optional hint, and show only the tools
the case needs (case 1: delete and category). Files of the day and practice files are exams: no hints or feedback
until you check, and only they feed the skill record.

## The two cases
| | Case | What it practices |
|---|---|---|
| 1 | **The doubled import** (Maple & Pine Design Studio, Oct) | Duplicate bank-feed imports vs genuine identical purchases; expense categories; why deleting the wrong $412.50 row "balances" but is wrong. |
| 2 | **Balanced, but wrong** (Rivera Mobile Detailing, Mar) | Recording a bank fee from the statement, catching a transposed amount ($84.37 typed as $48.37), leaving an outstanding check in place, removing a duplicate, and reclassifying the owner's $5,000 transfer from Sales to Owner's contribution — the reconciliation hits $0.00 while profit is still overstated by $5,000. |

## A new client file every day
Beyond the two guided cases, a generator builds fresh client files from four business types, planting 3–5 kinds of
problem (duplicates, transposed amounts, missing bank fees, outstanding checks, wrong categories, owner money booked as
income/expense) plus traps like genuine repeat purchases. Every file is returned only if it passes the scenario
validator, fails as handed over, and is solved by its own reference solution (900 generated files are checked in
tests).
- **File of the day** (`#/daily`): the same file for everyone, new every UTC day.
- **Skill record**: the first check on each file records which kinds of problem you caught (kept in your browser).
- **Weak-spot practice** (`#/practice/<seed>/<skills>`): files that plant more of what you miss.

## How grading works
Four independent checks on the final state, plus the reconciliation arithmetic:
1. Every real transaction is in the books exactly once (nothing doubled, nothing real deleted, nothing unknown).
2. Every amount matches its source.
3. A row is ticked cleared exactly when it is on this statement (outstanding items stay unticked).
4. Every row is in the right category; the effect on net profit is shown in dollars.

`Difference = adjusted bank balance − book balance = statement ending − cleared balance`. $0.00 is necessary, never
sufficient. Any correct end state passes (either duplicate copy; editing the transposed amount or re-recording it).
Clues use real bookkeeper heuristics on the live difference (matches a bank line, matches ticked rows, divisible by
9 → swapped digits). On completion you get a client-ready cleanup summary generated from what changed.

## Who it is for
Working adults in the US (25–45) who keep the books for their own side business or freelance work (29.8 M nonemployer
businesses, Census 2022; over two-thirds of small-business owners do their own bookkeeping, QuickBooks Dec 2025), and
working adults building a side income doing bookkeeping for others. They pay out of pocket (B2C).

## What is real vs. not
**Real:** the interactive books (tick cleared, edit amount, change category, delete, record a bank line), undo and
start over, reconciliation worksheet, four checks with explanations, clues, P&L before/after, cleanup summary,
completion remembered in your browser. All in the browser; nothing is sent anywhere.

**Synthetic / not built:** all client files are fictional training data (the generated ones too). Simplified single-account model, no
QuickBooks/Xero/bank connection, no accounts. The paywall works (free tier: both cases, daily files, 1 practice
file), but checkout is simulated: no card data is collected and nothing is charged. Demand and retention are unmeasured.

## Run and test
```bash
npm install
npm run dev                 # local dev server
npm test                    # 104 unit tests incl. exhaustive state-space checks and 900 generated files
npm run build && npm run preview          # production build, works offline (fonts bundled)
node scripts/e2e.mjs http://localhost:4173/ledger-fix-lab/   # 58 browser checks, headless Chrome/Edge
node scripts/e2e.mjs https://spunlit.github.io/ledger-fix-lab/  # same checks against the live site
```
CI (GitHub Actions) runs the unit tests and build before every deploy to GitHub Pages.

## Structure
- `src/core/` — pure engine, no DOM: `engine.ts` (actions, undo, reconciliation, checks, validation),
  `scenarios.ts` (the two cases), `generator.ts` (generated files), `skills.ts` (skill record), `clues.ts`, `explain.ts`, `report.ts`, `money.ts` (integer cents only).
  `coach.ts` (next step for guided cases), `drill.ts` (warm-up rounds), `feedback.ts`, `match.ts`.
- `index.html`, `src/landing.*` — the landing page (static, on the MIT design kit in `public/kit`).
- `app.html`, `src/main.ts`, `src/ui/`, `src/*.css` — the trainer (vanilla TypeScript, hash routes). Fonts: Manrope + Inter via Google Fonts. `guide.ts` is the field guide (also the coach's "Why?").
- `tests/` — Vitest; `scripts/e2e.mjs` — browser checks.
- `pitch/` — pitch deck source and PDF.

Fonts: Public Sans, SIL Open Font License 1.1 (see `public/fonts/README.txt`).
