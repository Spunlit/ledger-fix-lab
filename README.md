# Ledger Fix Lab

Practice cleaning up small-business books in the browser, on synthetic data, with a deterministic checker that
grades the **final state of the ledger**, not a text answer.

Track: Money · Audience hypothesis: US freelance bookkeepers / small-business owners (25–45) who keep their own books.
Buyer demand, ages and retention are **UNKNOWN** (not validated).

## What is real
- Interactive ledger: delete a row, change its category, undo (exact), reset.
- Three independent checks running in the browser:
  1. **Transactions** — every bank-statement transaction is in the ledger exactly once (no deleted real records, no duplicates left).
  2. **Matches statement** — opening balance + ledger rows = statement closing balance (difference in cents).
  3. **Categories** — every row is in the category its rule calls for (independent of money).
- Equivalent correct answers pass (either copy of a duplicate can be deleted). Two real identical purchases are not a duplicate.
- Explanations of which rule is broken, including "balance matches but errors cancel out".
- Unit tests (Vitest) for the engine and an end-to-end browser check of the demo flow.

## What is mock / out of scope
- One fixed, **synthetic** scenario (fictional business). Not connected to QuickBooks or any bank.
- No accounts, no saved progress, no payments. Monetization (paid scenario packs) is a hypothesis only.
- Simplified reconciliation: one account, no timing differences, no adding missing entries.

## Run
```bash
npm install
npm run dev        # local dev server
npm test           # engine unit tests
npm run build && npm run preview   # production build, works offline
npm run e2e        # UI check in headless Chrome/Edge against http://localhost:4173/ledger-fix-lab/
node scripts/e2e.mjs https://spunlit.github.io/ledger-fix-lab/   # same check against the live site
```

## Structure
- `src/core/` — pure engine (no DOM): `engine.ts` (actions, undo, checks), `scenario.ts` (fixture), `explain.ts`, `money.ts` (integer cents).
- `src/main.ts`, `src/style.css` — UI.
- `tests/engine.test.ts`, `scripts/e2e.mjs` — checks.

## Pitch
- PDF (10 slides): [`pitch/LedgerFixLab_pitch.pdf`](pitch/LedgerFixLab_pitch.pdf). Source: `pitch/slides.html`
  (screenshots in `pitch/img/` are from the live site).
- Rebuild: open `pitch/slides.html` in Chrome and print to PDF, or
  `chrome --headless=new --no-pdf-header-footer --print-to-pdf=pitch/LedgerFixLab_pitch.pdf pitch/slides.html`.
