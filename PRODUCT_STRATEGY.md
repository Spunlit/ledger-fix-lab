# Product strategy — Ledger Fix Lab (rev. 2, 14 Nov 2026)

Status of evidence: **[O]** observed at the source · **[I]** our inference · **[H]** untested hypothesis · **[U]** unknown.
Research window ≈ 30 min. Reddit blocks automated fetching, so Reddit threads could not be read directly; Intuit's
community forums, vendor pages and earlier local research (`RESEARCH_VERIFIED_SKILLS.txt`) were used instead.

## 1. Verified user problems

| # | Problem | Evidence |
|---|---|---|
| P1 | People who finish the **free** QuickBooks certification still have **no hands-on experience** and can't get it. | [O] Intuit community, Jun 2023: poster just finished ProAdvisor certification, "I don't have any hands-on experience yet", asks how to start. [O] Intuit community, Oct 2024: trainee finished QBO training, offered free work on freelance sites, "so far, I've only received refusals" (poster in Brazil — not our geography, same pattern). |
| P2 | That gap is **sold** as a product: practice "experience" before the first client. | [O] A review of QBO Gym says it gives beginner bookkeepers "the hands-on experience they need before taking on real clients" and a certificate for "a full year of experience"; the product now redirects into Akadian. Price **[U]** (seller page 404). [O] QuickBooks Online practice-set books and Udemy practice sets exist (paid). |
| P3 | Cleanup is **paid client work** a freelancer can win — and a reconciliation is where it starts. | [O] Cleanup + reconciliation gigs are listed on Upwork, Fiverr, Contra. [O] Firm checklists put bank reconciliation first and recommend delivering a written cleanup summary to the client. |
| P4 | The mistakes are specific and recurring. | [O] Intuit community threads: owner checks/transfers coded as income inflating the P&L; deleting previously reconciled transactions breaks the next reconciliation; beginning-balance differences. [O] Xero product-ideas forum: bank-feed duplicates, with the caveat that genuine same-day repeat purchases must be kept. |

Context: [O] BLS — 1.6 M bookkeeping, accounting and auditing clerks (2024), median pay $49,210, −6 % projected 2024–34
but ~170 k openings per year. Occupation size is **not** a market for a trainer.

## 2. What people pay (offer prices, not verified sales)

| Alternative | Price seen | Notes |
|---|---|---|
| QuickBooks ProAdvisor training & exam | Free (Intuit) | Teaches the software; no graded client-style cleanup. |
| QuickBooks Online Test Drive / sample company | Free | Sandbox; nothing checks your work. **Strongest free substitute.** |
| Intuit Academy Bookkeeping cert (Coursera) | $59/mo or $399/yr (Coursera Plus) | Course content + exam path. |
| Akadian QBO certification bundle | $847 for 3 (2025 page, may be outdated) | Exam prep; QBO Gym now folded into Akadian. |
| Bookkeeper Launch (Bookkeepers.com) | $2,999 or 12 × $299 (seller page) | Business-building course for new freelancers. |
| YouTube / ChatGPT | Free | Explain; neither checks the state of *your* books. |

[I] New freelancers do spend personally on training, from tens to thousands of dollars. Whether they would pay for
graded cleanup practice specifically is **[U]**.

## 3. Unknowns we will not paper over
Willingness to pay for a simulator; QBO Gym/Akadian sales volume; retention after a few cases; share of buyers aged
25–45; whether practice transfers to faster real cleanups. No interviews, users, revenue or retention exist.

## 4. Three approaches, scored against the official weights (estimates, not measurements)

| | Eng /40 | Value /20 | Problem /15 | Business /15 | Orig /10 | Total |
|---|---|---|---|---|---|---|
| Baseline v1 (one 14-row exercise) | 30 | 6 | 8 | 6 | 5 | 55 |
| **A. Client-file cleanup simulator** (chosen) | 32 | 11 | 11 | 8 | 7 | **69** |
| B. Local CSV reconciliation utility | 28 | 10 | 9 | 6 | 4 | 57 |
| C. Notary loan-package defect trainer | 24 | 9 | 11 | 10 | 6 | 60 |

- **A** keeps the approved concept but changes *what is practiced*: a real bank-reconciliation workflow on a client's
  books with the errors that recur in forums (duplicates vs genuine repeats, transpositions, unrecorded bank fees,
  outstanding checks, owner transfers booked as income), graded by state, ending in a client-ready cleanup summary.
- **B** is crowded (QBO/Xero built-in reconciliation, Mohasib finder, Quadratic/Excel templates), serves business
  owners rather than learners, and would be a new product outside the approved Skills concept. Rejected.
- **C** has the strongest spending evidence (NNA packages at $199/$249, BBB complaints confirm purchases) but is a new
  product needing Council re-approval and a from-scratch build in < 19 h. Kept as the credible alternative, not pursued.

Adversarial room:
- *Experienced bookkeeper:* "Real cleanups are messier than 15 rows." → Cases mirror the real workflow and real error
  types; we say plainly it's a simplified one-account model.
- *Paying customer:* "Why pay when Test Drive is free?" → Test Drive never tells you you're wrong; we check the end
  state, catch "balanced but wrong", and hand you a cleanup summary you could show a client. WTP still **[U]**.
- *Investor:* "Tiny, shrinking niche; one-and-done." → Honest answer: B2C beachhead is new freelancers; repeat use
  depends on new case packs (credit cards, payroll, A/R). Retention **[U]**.

## 5. Decision
Build **A** inside the approved concept: two deep cases (beginner → intermediate), professional reconciliation
worksheet, evidence-based clues, visible P&L consequences, per-skill record, and a generated cleanup summary.
Buying hypothesis **[H]**: a new freelance bookkeeper pays once for a case pack to feel ready before quoting a first
cleanup. Cheapest test: post the free case in bookkeeping-learner communities; measure completion, which trap catches
people, and clicks on "notify me about the next case pack". Not yet run.

## Sources
- https://quickbooks.intuit.com/community/off-topic-discussion-73/how-to-kickstart-my-bookkeeping-gig-165177
- https://quickbooks.intuit.com/learn-support/en-us/other-questions/how-can-i-become-a-bookkeeping-trainee-for-a-professional/00/1498241
- https://fine-points.squarespace.com/blog/need-bookkeeping-experience-qbo-gym-review-discount-code
- https://quickbooks.intuit.com/accountants/training-certification/certification
- https://quickbooks.intuit.com/learn-support/en-us/help-article/small-business-processes/test-drive-quickbooks-online/L9C12ODlA_US_en_US
- https://www.coursera.org/articles/bookkeeping-certification
- https://fastandeasyqbo.samcart.com/products/qbo-course-combo
- https://bookkeepers.com/ (Bookkeeper Launch pricing page)
- https://www.upwork.com/services/product/consulting-hr-quickbooks-online-cleanup-and-reconciliation-1740605797039247360
- https://financial-cents.com/resources/articles/bookkeeping-clean-up-checklist/
- https://quickbooks.intuit.com/learn-support/en-us/reports-and-accounting/how-do-i-remove-a-transfer-that-is-appearing-incorrectly-as/00/1540606
- https://quickbooks.intuit.com/learn-support/en-us/banking/deleted-a-previously-reconciled-transaction/01/793057
- https://productideas.xero.com/forums/939198-for-small-businesses/suggestions/50512302-statement-assisted-reconciliation-to-assist-janky
- https://www.bls.gov/ooh/office-and-administrative-support/bookkeeping-accounting-and-auditing-clerks.htm
- https://www.nationalnotary.org/notary-signing-agent-training (alternative C)
