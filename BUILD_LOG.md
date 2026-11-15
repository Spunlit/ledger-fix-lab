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

## 2026-11-14 ~21:20–22:00 Astana — v7: "the auditor's desk" (founder: still looked like AI slop)
- Dropped the generic dark-SaaS hero (centered pill + glow + glass + stars). New concept from the subject: a printed
  ledger page on a midnight desk. Colors are objects: electric-blue pencil ticks, cantaloupe highlighter on the
  profit, red pen circle, green RECONCILED stamp. Honest lines get a pencil tick + handwritten margin note; the lie is
  circled in red, BUT WRONG is stamped over RECONCILED, profit struck and corrected by hand. Engine-graded as before.
- Day theme = same paper on a light desk. Books/statement on the case page and reviews render as paper (scoped tokens).
- Caveat (OFL) bundled for margin notes only. npm test 94/94; e2e 47/47.

## v8: landing page rebuilt on a design system (Nov 14, ~18:30 UTC)
- Installed and audited design skills (design-taste-frontend, frontend-design, webapp-testing, ui-ux-pro-max); the taste-skill Stop hook was removed, its install.sh not run.
- index.html is now a static landing page on the skill's kit (public/kit, MIT): collage hero with a live books window graded by the engine (click the wrong line), workbench app frame, 3 steps, daily file + skill record, pricing, FAQ, close.
- The trainer moved to app.html (Vite multi-page). app.html#/ is "Your practice desk" (path + skill record).
- App restyled to match: midnight #070a12, electric blue #2f6bff, cantaloupe #ffa36c for warnings, Reddit Sans + JetBrains Mono, sharp corners. Day/night switch on both pages, shared key.
- Checked: 94 unit tests, 49 e2e checks, phone 375px without horizontal scroll, copy-lint 0 FAIL.

## v9: founder palettes, Geist, coach in guided cases (Nov 14, ~20:00 UTC)
- Palettes: night #02070A / #0297DE / #FC734D, day #FCFFFF / #0593C6 / #D83995. Blue = action (dark label, white fails contrast), third colour = attention only.
- Landing rebuilt after a Fable audit (.taste-skill/fable-audit.md): no fake window chrome, glows or mega-menu; natural section heights; Geist; shorter instructional copy; hero books window with engine-graded picks and profit count-down; workbench demo applies the Verizon fix with real engine figures.
- Guided cases: new pure module src/core/coach.ts gives the single next step (problem, action, rows to mark) from the same checks that grade the file; "Show me the row"; feedback now states the difference/profit change.
- Motion: difference tick, staggered check results, coach target pulse; all off under prefers-reduced-motion.
- Checked: 99 unit tests (5 new coach tests incl. "following the coach solves both cases"), 52 e2e checks.
- Design gate of the taste skill: fails on section-height rules by decision (forced one-screen sections left dead space).

## v10–v11 (Nov 14, ~20:30 UTC)
- Landing: grid + beam light, pointer-lit cards, travelling border on the books window, bento for the three steps, ticker, scroll reveals (plain CSS/TS, founder palette).
- New: warm-up drill (app.html#/drill), five one-tap rounds cut from generated files; pure module src/core/drill.ts, answers from checkAll. Honest filler lines are visually unique (genuine repeats excluded).
- Phone: 44px+ touch targets in cases.
- Checked: 102 unit tests, 56 e2e checks.

## v12 (Nov 14, ~20:30 UTC)
- Type: Manrope headings + Inter text (compared four options on the phone hero). Softer palette: calmer ink/green/red, deeper blue under white button labels (#027CBB night, #047CA6 day; brand blues stay for accents).
- "Try it" banner and the coach are blue instructions; the attention colour is only for the wrong line and too-high figures.
- New: field guide (app.html#/guide), seven topics from src/core/guide.ts; the coach has "Why?" per step linking to its topic; drill results link to the guide.
- Checked: 104 unit tests, 58 e2e checks.

## v13 (Nov 14, ~21:00 UTC): plain words
- Founder feedback: some bookkeeping words are unknown to a beginner. Added src/core/glossary.ts (15 terms, one plain sentence each) and tappable terms (dashed underline; card on desktop, bottom sheet on a phone) in the coach, hints, review, figures, guide, drill and landing page. Guide has a "Words explained" list.
- Plainer copy: h1 "Bookkeeping practice for beginners"; "swapped digits" instead of "transposed", "checks not at the bank yet", "Change category".
- Checked: 108 unit tests (4 new for the glossary), 60 e2e checks.

## v14 (Nov 14, ~22:00 UTC)
- Text colours desaturated (links, green, red, attention); glow around the hero window kept (founder: the neon was the text colour).
- Drill: "what do you do?" rounds with three choices (outstanding check, real repeat, missing bank charge); every guide topic has a 3-round drill (app.html#/drill/<topic>).
- Desk as a course home: one "Next up" action, seven-day strip with streak, level per skill (New / Practicing / Solid), best warm-up score.
- Phone, exam files: Books / Bank statement tabs.
- Checked: 112 unit tests, 65 e2e checks.

## v15 (Nov 14, ~21:30 UTC): colour as light
- Founder sent the reference his palette came from (a dark page with a blue-to-orange light burst, fine vertical rays, a serif display line with one italic word, mono labels; a day page in sky blue with a pink bloom behind ribbed glass).
- Landing hero rebuilt in that manner: centred serif headline "Books that balance can still be wrong.", honest side figures (7 kinds, 4 checks, 900 generated files tested, $0 to start), the live books window rising out of the burst. Day theme: sky blue, pink bloom, frosted window. Sections and the close carry the same light, quieter.
- Type: Instrument Serif (display) + Inter (text) + Geist Mono (labels), in the app too (page titles serif, interface Inter).
- Checked: 112 unit tests, 65 e2e checks.

## v16 (Nov 14, ~22:30 UTC)
- Landing rebuilt as a calling card (founder: no tables on the start page): headline, one framed light scene, a statement, three steps, seven mistakes, pricing, questions. Self-contained CSS; the design kit (public/kit) is removed.
- Motion written for the page, after an MIT template the founder liked (ideas only, no code copied, no GSAP): headline lines rise from a mask, the scene frame opens on scroll, words light up, blocks rise, pills roll and lean to the pointer, nav pill slides.
- Day theme in that template manner: white page, ink text, black pills, the sky-blue and pink scene inside the frame.
- New: first-visit tour of the workbench (src/ui/tour.ts): 7 steps, lit target, Next/Back/Skip, keys, replay from the header.
- Checked: 112 unit tests, 66 e2e checks.

## v17 (Nov 14, ~23:00 UTC)
- Terms and Conditions page (app.html#/terms), a plain-language draft marked as not reviewed by a lawyer; linked from the landing footer and the plan page.
- Day theme made crisp: no blur on the colour field, sharper ribs, solid white card with ink text, ink featured plan.
- Checked: 112 unit tests, 67 e2e checks.

## v18 (Nov 14, ~23:50 UTC)
- New: Start from zero (app.html#/basics), a two-minute lesson of five ideas (statement, books, matching, difference, categories), one tap each; hand-written content in src/core/basics.ts with a test on its arithmetic. It is the first step on the landing page and on the desk for a newcomer.
- Landing answers "will AI not do this": a short block and an FAQ item (automation enters the lines and makes exactly these mistakes; review is the job that stays). No AI is built in, and the page does not claim one.
- Phone pass at 390px: landing, basics, desk, guide, plan, drill; no horizontal scroll.
- Checked: 115 unit tests, 71 e2e checks.

## v19 (Nov 15, ~00:15 UTC)
- Help in guided cases climbs with each press on the same problem: Hint (a clue), More help (scrolls to the row), Show me how (a three-step demonstration that lights the line, the tool, then makes the move through the normal dispatch). The demonstration is given once per file; skipping it changes nothing. coachAction() in src/core/coach.ts, tested to solve both cases.
- Checked: 117 unit tests, 75 e2e checks.

## v20 (Nov 15, ~00:45 UTC)
- "Show me how" is available on every problem (after Hint and More help), not once per file; the progress bar says how many fixes were shown.
- The "why learn this" block now cites primary sources: Intuit help on duplicate bank-feed transactions, IRS Topic 254 (the taxpayer answers for the return), AIPB Certified Bookkeeper designation (bank reconciliation and error correction are tested). The page states it is independent, not affiliated or endorsed, and issues no certificate.
- Checked: 117 unit tests, 76 e2e checks.

## v21 (Nov 15, ~00:40 UTC)
- After Start from zero the choice is practice (case 1) or more theory (the guide); the warm-up button is gone from that screen.
- New: practice record (app.html#/record). Five requirements for level 1, first-check accuracy per skill, a "current" status that lapses 30 days after the last file solved without hints, optional name, print to PDF. It states that it is not a certification and that Ledger Fix Lab is not an accredited body. Pure logic in src/core/record.ts with tests.
- Positioning decided with the founder: no self-issued "certificate"; a record of practice that stays current fits a subscription, a one-time certificate would fit a course.
- Checked: 122 unit tests, 77 e2e checks.

## v22 (Nov 15, ~01:10 UTC)
- Desk shows the path as a ladder: Start from zero, Practice 1, Practice 2, today file, Practice 3 (one free), Practice 4+ (plan), theory and topic practice (3 of 7 topic drills free). Locked rungs lead to the plan page; the theory itself stays open.
- No accounts: the brief requires the main scenario without registration, and a static site has no backend. The desk says so: progress lives in this browser, accounts are not built yet.
- Checked: 122 unit tests, 79 e2e checks.

## v22.1 (Nov 15, ~01:40 UTC)
- Reviewed five skills the founder sent. Installed only emilkowalski/skills (three markdown skills at commit 0f2e23b, MIT, no scripts or hooks), project-local. Not installed: dream-loop (needs Blender and a paid image API), mengto/skills and fil.design html-demo (not needed before the deadline), hairline (a new npm dependency).
- Applied its motion rules in the app: one strong ease-out, exact transition properties, press feedback (scale 0.97) on buttons and cards.
