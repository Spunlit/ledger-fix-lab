# BUILD_LOG — Ledger Fix Lab (K1)

## 2026-11-14 ~15:30 Astana — vertical slice
- Scaffold: Vite 6 + TypeScript 5 + Vitest 3 (only dev deps). No backend, no accounts, no CDN.
- Pure core `src/core/` (no DOM): types, categories, synthetic scenario (14 rows / 13 real txns, USD, integer cents),
  engine (delete / recategorize, undo stack, reset), three separate checks (integrity, statement balance, categories),
  scenario validator, plain-language explanations.
- Scenario facts (from fixture, not invented): opening $4,250.00, statement closing $5,754.45, initial difference −$412.50
  (duplicate Upwork Oct 15), 2 wrong categories (Adobe, Shell). Traps: two real identical Blue Bottle coffees;
  a real Oct 29 Upwork payment of the same amount (compensating error → $0.00 but integrity fails).
- UI `src/main.ts`: ledger table, statement, live difference, Undo/Reset/Check, three check cards with explanations,
  phone layout (stacked rows).
- Verified:
  - `npm test` → 15/15 passed (correct, equivalent, needed-row deletion, compensating, wrong category at $0 diff,
    identical purchases ≠ duplicate, exact undo by deep equality, no mutation, money formatting).
  - `npm run build` → OK (tsc clean).
  - `npm run e2e` (headless Chrome via DevTools, against `vite preview`) → 16/16 UI checks passed, including
    no horizontal scroll at 375px (fixed one real overflow bug: absolutely positioned sr-only label).
- Deploy: NOT done yet — waiting for user permission (GitHub repo + hosting).
