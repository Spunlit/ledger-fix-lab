# Ledger Fix Lab

**Practice your first bookkeeping cleanup before a client pays for it.**
Live: https://spunlit.github.io/ledger-fix-lab/ (free, no sign-up)

Realistic client books with the mistakes real books have: duplicate imports, swapped digits, bank fees nobody
recorded, checks that haven't cleared, and owner money booked as income. You reconcile them to the bank statement,
and a deterministic engine grades the **end state of the books**: not just whether the difference is $0.00, but
whether the books are actually right.

Track: Skills (bookkeeping) · Built for: new US freelance bookkeepers who have finished a course or certification
but have no hands-on cleanup experience. Evidence and open questions: [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md).

## First 30 seconds
The home page is a one-click challenge: the books are $412.50 off and one payment was imported twice. Delete the
wrong copy and you see $0.00 together with "Balanced, but wrong": the core lesson, before reading anything.

## Guided vs. unguided
Guided cases give instant feedback after every move, a progress count and an optional hint, and show only the tools
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

## What is real vs. not
**Real:** the interactive books (tick cleared, edit amount, change category, delete, record a bank line), undo and
start over, reconciliation worksheet, four checks with explanations, clues, P&L before/after, cleanup summary,
completion remembered in your browser. All in the browser; nothing is sent anywhere.

**Synthetic / not built:** all client files are fictional training data (the generated ones too). Simplified single-account model, no
QuickBooks/Xero/bank connection, no accounts, no payments. The $12/month price on the site is a hypothesis to test;
demand and retention are unmeasured.

## Run and test
```bash
npm install
npm run dev                 # local dev server
npm test                    # 76 unit tests incl. exhaustive state-space checks and 900 generated files
npm run build && npm run preview          # production build, works offline (fonts bundled)
node scripts/e2e.mjs http://localhost:4173/ledger-fix-lab/   # 42 browser checks, headless Chrome/Edge
node scripts/e2e.mjs https://spunlit.github.io/ledger-fix-lab/  # same checks against the live site
```
CI (GitHub Actions) runs the unit tests and build before every deploy to GitHub Pages.

## Structure
- `src/core/` — pure engine, no DOM: `engine.ts` (actions, undo, reconciliation, checks, validation),
  `scenarios.ts` (the two cases), `generator.ts` (generated files), `skills.ts` (skill record), `clues.ts`, `explain.ts`, `report.ts`, `money.ts` (integer cents only).
- `src/ui/`, `src/main.ts`, `src/style.css` — interface (vanilla TypeScript, Public Sans bundled locally).
- `tests/` — Vitest; `scripts/e2e.mjs` — browser checks.
- `pitch/` — pitch deck source and PDF.

Fonts: Public Sans, SIL Open Font License 1.1 (see `public/fonts/README.txt`).
