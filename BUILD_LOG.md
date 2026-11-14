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

## 2026-11-14 ~17:00–18:30 Astana — v3: retention made real
- Owner critique: two fixed cases = no reason to return; case packs only on a slide; authoring cost unsolved.
- Built: generator.ts (seeded, provably solvable files; 4 archetypes; 6 problem kinds + genuine-repeat trap),
  skills.ts (first-check attribution, stats, weak spots), file of the day, practice files, skill record on landing,
  first-check results + copy result + "Practice my weak spots" on completion, planned-pricing section ($12/mo, labeled).
- Verified: npm test 58/58 (900 generated files valid/broken/solved; trap, transposition, exhaustive-delete properties);
  e2e 39/39 locally and against the live site after deploy (c9aaf33).
- Pitch slides 6–10 rebuilt for v3; rendered PDF pages inspected (fixed slide 6 crop twice).
- Fable audit of generator/skill record (read-only, 4000+ generated files): fixed all findings —
  identical bank lines now interchangeable when recording (also fixes case 1 coffee twins); both twins planted;
  traps credited only after the user worked the file; genuine-repeat focus always planted; no wire fee without a
  wire; no rideshare-as-car or vehicle insurance; no defensible "wrong" categories; no duplicates on small repeatable
  purchases; home page guarded against generator errors. Regression tests added: npm test 68/68; e2e 39/39.

## 2026-11-14 ~18:00–19:30 Astana — v4: simpler experience (user rated design 2/10, site 4/10)
- Research (UX_RESEARCH.md): QBO Dojo sells practice clients $49–119 each (needs QBO, self-check, no auto-grading);
  Akadian CAS $97–197/mo; Brilliant (question first, one idea, instant feedback, scaffolding removed in practice);
  NN/g progressive disclosure; Linear 2026 (less visual weight, same capability).
- Home is now a 30-second challenge on real case 1 rows graded by the engine ("Balanced, but wrong" vs "Right").
- Guided cases: instant feedback per action (core/feedback.ts), progress dots, one next-step line, hint on demand,
  case 1 shows only delete + category; note, math and category guide collapsed. Exam mode for daily/practice files;
  only exam files feed the skill record.
- New visual language (white, airy, one elevated element). Two screenshot review passes; fixed truncated labels,
  layout shift, a CSS class collision and the phone header.
- npm test 76/76; e2e rewritten, 42/42 locally.

## 2026-11-14 ~19:00–20:00 Astana — v5: "one line is lying" (Fable critique + founder/Gemini direction)
- Home rebuilt as a detective case: "The books balance. One line is lying." Paradox tiles ($0.00 balanced vs
  profit $10,410.76), four evidence cards from case 2 graded by the engine; wrong picks explain why the line is
  honest; the right pick rolls profit to $5,410.76 and stamps CAUGHT. Everyone reaches the aha by succeeding.
- Path of three steps (case 1 → case 2 → today's file) with done ticks and a daily streak; comparison row with
  verified competitor prices; "How it works"/pricing sections removed; ink-black primary buttons.
- Workbench: one message at a time (warning replaces next step, with Undo), BALANCED, BUT WRONG / RECONCILED AND
  RIGHT stamps, profit before/after bars in the review, cleanup summary open by default, streak in shared result.
- npm test 77/77; e2e 42/42 locally.

## 2026-11-14 ~20:00–21:00 Astana — v6: matching workbench, paywall, night theme
- Official brief + FAQ read (audience "working adults with jobs, families, bills and goals"; working paywall is the
  minimum, Q37/Q55; renewals over DAU, Q30; numbers with sources, Q58). Strategy rev 4 with Census/QuickBooks/RevenueCat.
- Workbench redesign (started by Fable, finished/integrated by Opus after Fable hit its rate limit): bank-feed style
  matching (core/match.ts, visible data only, tested incl. 50 generated files), paired books/bank rows, "No bank match"
  / "Not in books" rows, review counts, sticky bottom action bar, compact figures.
- Paywall: free tier (cases, daily files, 1 practice file), Practice plan $12/mo or $96/yr, 7-day trial, demo checkout
  clearly labelled (no card, nothing charged), returns to the requested file.
- Theme: midnight black / electric blue / cantaloupe orange; night by default, day/night switch remembered; cinematic
  home background. Open Graph share image.
- npm test 94/94; e2e 47/47 locally.
