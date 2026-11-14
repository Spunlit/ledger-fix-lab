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

## 2026-11-14 ~15:40 Astana — public deploy + MVP freeze (user approved deploy)
- Pre-push audit: no keys/credentials/.env; internal process files (.claude/, CLAUDE.md, BUILD_BRIEF.md) gitignored;
  repo-local git identity uses the GitHub noreply address.
- Vite base `/ledger-fix-lab/`. Workflow `.github/workflows/deploy.yml`: npm ci → npm test → npm run build →
  official configure-pages / upload-pages-artifact / deploy-pages.
- Repo: https://github.com/Spunlit/ledger-fix-lab (public). Live: https://spunlit.github.io/ledger-fix-lab/
- First Actions run: build ✓ (CI `npm test` 15/15) and deploy ✓. Warnings only: Node 20 action-runtime deprecation.
- `node scripts/e2e.mjs https://spunlit.github.io/ledger-fix-lab/` (fresh headless Chrome profile) → 16/16 passed,
  desktop 1280px and phone 375px screenshots reviewed.
- MVP FREEZE: tag `mvp-freeze` (local). Independent Codex review requested.

## 2026-11-14 ~16:00 Astana — freeze review fixes
- Codex review (partial: hit usage limit; could not run Vitest in read-only sandbox; ran tsc OK; brute-forced all
  16,384 row-retention subsets in memory → exactly 2 pass = either duplicate copy). No critical/high findings.
- Fixed: e2e runner could exit 0 if the browser socket closed mid-run (now rejects pending calls, 120s watchdog,
  requires all 16 checks to run); sumCents checks safe-integer at every step; validateScenario reports unknown
  txns instead of crashing. XSS reviewed manually: all fixture strings escaped, only user input is a validated
  <select>; also escaped source/entryId for hardening.
- npm test 17/17, build OK, local e2e 16/16.
- Decision (user): no further Codex reviews; main session owns review.

## 2026-11-14 ~16:15 Astana — exhaustive test + pitch deck
- Added exhaustive test: all 2^14 keep/delete subsets (categories fixed) → exactly 2 pass (delete E09 or E10). npm test 18/18.
- Pitch: `pitch/slides.html` → `pitch/LedgerFixLab_pitch.pdf` via headless Chrome print-to-pdf (10 pages, verified
  by page count + per-slide screenshots; no overflow). Only facts from code/tests/brief; unvalidated items marked UNKNOWN.
- Skills check (user request): no frontend-design/UI-UX skill installed; available relevant ones: artifact-design,
  dataviz, run, code-review, simplify, security-review, pptx/pdf/docx. Nothing installed.

## 2026-11-14 ~16:05–16:35 Astana — product reinvention (v2)
- Rollback point: tag `v1-baseline` + branch `baseline-v1` pushed.
- Research (~30 min, Reddit blocked for fetching): PRODUCT_STRATEGY.md — evidence, prices, unknowns, A/B/C scored.
  Decision: Strategy A inside the approved concept (client-file cleanup simulator for new freelance bookkeepers).
- Fable 5.2 challenge adopted: separate truth model, cleared ticks, four independent checks, fake-pass tests,
  client note states entity/no-loan/check mailed, no "experience/certificate" claims.
- Skills: anthropics/skills @2c5958ecac7c `frontend-design` and `webapp-testing` copied to .claude/skills
  (Apache-2.0, project-local, gitignored). frontend-design guidance applied (token plan, defaults avoided, two
  visual passes). webapp-testing's method applied via the existing CDP harness (no Python Playwright install).
- Engine v2 + Case 2 + clues + cleanup report + new UI (landing, workbench, review, completion).
- Verified: npm test 47/47 (incl. ~524k-state exhaustive case-2 test); build OK; e2e 31/31 locally
  (found & fixed: completion not saved when solved after a check; mobile statement wrapping; worksheet height).

## 2026-11-14 ~17:00 Astana — v2 live + new pitch
- v2 merged to main and deployed; e2e 31/31 against https://spunlit.github.io/ledger-fix-lab/ (fresh profile).
- Pitch rebuilt (pitch/slides.html → LedgerFixLab_pitch.pdf, 10 pages) from live screenshots; every number from
  the engine, tests or a cited source; observed / inferred / unknown separated. Rendered PDF pages inspected with
  pypdfium2 (already installed); fixed caption/footer collision, screenshot scrollbars, sparse type.
- UX: edit hint on amounts; note that deleting is only acceptable in an unreconciled month.
