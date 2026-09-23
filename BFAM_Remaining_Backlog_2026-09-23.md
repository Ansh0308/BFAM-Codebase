# BFAM — Remaining Development Backlog

**Date generated:** 2026-09-23
**Purpose:** A single, current list of everything still left to build — done items are deliberately excluded. This supersedes nothing (the full history/status of _everything_, done or not, stays in `BFAM_Gap_Analysis_and_TODO.md`), it just answers "what's actually left" in one place, re-verified against the code as it stands today.

**Source documents cross-referenced this pass:**

- Everything already tracked in `BFAM_Gap_Analysis_and_TODO.md` (itself built from `BFAM_PRD_v2.2.md` §12, `BFAM_Feedback_Backlog_v1/v2/v3.md`, and the brother's "BFAM_issues" login/signup sheet) — re-verified against `main` at commit `1be2111` (2026-09-23), not assumed stale.
- Four documents that live in `C:\Users\jhray\Source\repos\docs` but have **no equivalent .md in this repo**, read for the first time this pass: `BFAM_AI_IDE_Prompts.docx`, `BFAM_Build_Verification_Checklist.docx`, `BFAM_Sitemap_Screen_Structure.docx`, and the repo's own newer `BFAM_Gap_Analysis_and_TODO.md` (the `docs` folder's copy of that file is stale — the repo's is the one kept in sync with real commits).

Cross-referencing those three docs-only files against the codebase surfaced **5 requirements not previously tracked as their own line item** anywhere — see Section A. Everything else confirmed as already covered, just not yet built, is re-organized into Sections B–D below.

**How to read status:** DONE items are omitted entirely. **PARTIAL** = some of it exists, gap stated explicitly. **NOT STARTED** = no real implementation found in code (verified by reading the actual files, not inferred from a filename or a DB column existing).

---

## Section A — Newly surfaced gaps (found this pass, not previously tracked)

Cross-checking `BFAM_AI_IDE_Prompts.docx` / `BFAM_Build_Verification_Checklist.docx` / `BFAM_Sitemap_Screen_Structure.docx` against the code turned up these 5 real gaps that weren't yet their own backlog line:

| ID       | Item                                                                                                                        | Status          | Evidence / Gap                                                                                                                                                                                                                                                                                                                      |
| -------- | --------------------------------------------------------------------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G-21** | Consent capture at signup (location/contacts/payment-data/terms), each logged with policy version + timestamp — PRD §32.8   | **NOT STARTED** | Only a single boolean `waiver_accepted` + `liability_waiver_accepted_at` timestamp exist (`accountService.ts`). No consent table, no policy-version field, no per-category (location/contacts/payment-data) consent record anywhere in the schema.                                                                                  |
| **G-22** | Minor/age-gate actually blocks registration at signup — PRD §32.7                                                           | **PARTIAL**     | `UnderMinimumAgeError` exists but is only thrown from `updateMyProfile` (Profile Setup, _after_ signup) in `profileService.ts`. `accountService.createUserAccount` hardcodes `is_minor: false` and never checks the minimum age at registration time, even though `registerUserSchema` already accepts an optional `date_of_birth`. |
| **G-23** | Reschedule Booking as its own flow (distinct from Cancel + rebook-as-a-new-booking) — sitemap doc, P1                       | **NOT STARTED** | Zero references anywhere in backend or mobile. Today a player can only cancel and start a fresh booking from scratch.                                                                                                                                                                                                               |
| **G-24** | `audit_logs` — write an entry for booking cancellations, payment/refund events, match-result corrections, and admin actions | **NOT STARTED** | No `audit_logs` migration exists at all, and nothing in the codebase writes to a table by that name — despite the data dictionary and every module's QA checklist expecting one. This is a real compliance/traceability gap, not just a missing "nice to have" screen.                                                              |
| **G-25** | Peak-viewer analytics extending the Live Match Viewer Count (module 2.9)                                                    | **NOT STARTED** | The live/total viewer-count mechanism itself works (A-23 already resolved it), but nothing aggregates a match's _peak_ concurrent viewers anywhere — this was explicitly scoped as its own follow-up item in the original build plan, separate from Business Analytics (12.49) in general.                                          |

_(Everything else checked this pass — Google/Apple Sign-In, Language settings, Complaint Status screen, staff-verification gate on check-in/payments, injury-report-tied-to-waiver, Owner Sound Settings, and the Favorite Cricketer external-API search — was confirmed **already built**, contrary to what a first read of the sitemap/checklist docs might suggest. Not repeated here since this document only lists what's left.)_

---

## Section B — PRD §12 items still not fully built

Only the rows that are **PARTIAL** or **NOT STARTED** as of today (39 of the 63 PRD §12 items are already fully DONE and are omitted):

| #     | Feature                        | Status      | What's missing                                                                                               |
| ----- | ------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------ |
| 12.20 | Digital Scoreboard             | PARTIAL     | Mobile-only; no web scoreboard view, no physical LCD/TV integration.                                         |
| 12.22 | Fair Play System               | PARTIAL     | Only a post-match aggregate fairness number exists; no in-match rotation tracking or mode-specific behavior. |
| 12.23 | Fair Batting Rotation          | NOT STARTED | No live batting-opportunity tracking anywhere.                                                               |
| 12.24 | Fair Bowling Rotation          | NOT STARTED | No bowling-opportunity tracking.                                                                             |
| 12.25 | New Player Protection          | NOT STARTED | No first-timer identification/inclusion logic.                                                               |
| 12.26 | Fair Play Alerts               | NOT STARTED | No in-match alerting for uneven participation.                                                               |
| 12.27 | Post-Match Fair Play Summary   | PARTIAL     | Score is computed/stored but never shown on the Result screen.                                               |
| 12.28 | Smart Team Balancing           | NOT STARTED | Room's random-split (B-11) is pure random, not skill/role-aware.                                             |
| 12.33 | Rankings & Leaderboards        | NOT STARTED | No leaderboard endpoint or screen.                                                                           |
| 12.35 | XP & Player Levels             | NOT STARTED | No XP/level system at all.                                                                                   |
| 12.36 | Rewards                        | PARTIAL     | Coins redeemable only as a booking discount — no merchandise, priority booking, or rewards catalog.          |
| 12.37 | Achievements & Badges          | NOT STARTED | Not built.                                                                                                   |
| 12.38 | Match Streaks                  | NOT STARTED | Not built.                                                                                                   |
| 12.39 | Special Recognition            | NOT STARTED | No Player-of-the-Month/Hall-of-Fame logic.                                                                   |
| 12.40 | Tournaments & Leagues          | NOT STARTED | `TOURNAMENT` is only a label on the match-type dropdown — no entity, fixtures, or brackets.                  |
| 12.41 | Tournament Points Table        | NOT STARTED | Depends entirely on 12.40.                                                                                   |
| 12.42 | Match Recording & Highlights   | NOT STARTED | No video/highlight capability.                                                                               |
| 12.49 | Business Analytics             | NOT STARTED | No analytics/aggregation endpoint — same as v1's **E-6**.                                                    |
| 12.50 | Cancellation/No-Show Analytics | NOT STARTED | Raw data exists, nothing aggregates it.                                                                      |
| 12.51 | Memberships                    | NOT STARTED | Not built.                                                                                                   |
| 12.52 | Offers & Coupons               | PARTIAL     | Generic promo codes exist; PRD's specific categories (first-booking, weekend, membership, referral) don't.   |
| 12.53 | Referral System                | NOT STARTED | Zero references anywhere in the codebase.                                                                    |
| 12.54 | Café                           | NOT STARTED | Not built.                                                                                                   |
| 12.55 | Maintenance                    | PARTIAL     | Only a "maintenance" reason on an availability block — not a real task tracker with status.                  |
| 12.58 | Location                       | PARTIAL     | Distance-sorted search exists; no map view or navigation (PRD itself defers this).                           |

**Admin Web** (§9): only Player directory and a Home Banners CMS exist. Turf/Match/Team/Reviews management and Reports (**E-2 through E-6**, see Section C) are entirely unbuilt.

---

## Section C — Feedback backlog items still pending

### Quick, isolated fixes

| ID   | Item                                                                                 | Notes                                                                                                                                                                                                                                                                                        |
| ---- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-19 | Auto-finalize an innings when the target is chased or overs run out                  | **Confirmed still open** — `scoringService.ts` computes `isMatchWinningBall` only to pick the crowd-audio cue; it never sets `innings_status = 'COMPLETED'` on target-reached or overs-complete the way the wicket cap (A-21) already does. A chased target does not stop the innings today. |
| S-2  | Login error text says "invalid identifier" instead of "invalid username or password" | One-line text fix in `login.tsx`.                                                                                                                                                                                                                                                            |
| S-3  | Move the Forgot Password link to directly below the Password field                   | Currently the very last element on the Login screen.                                                                                                                                                                                                                                         |
| S-4  | Add a Back button to the Forgot Password screen                                      | No header/back control exists there today.                                                                                                                                                                                                                                                   |
| A-16 | Captain-only management screen + a real "Leave Team" button                          | Backend `leaveTeam` endpoint already exists and is unused.                                                                                                                                                                                                                                   |
| A-18 | Extend `displayName()` (name-instead-of-BFAM-ID) to the remaining screens            | Invite, Live Score, Roster Check-in, Scorecard, and the Team member list still show raw BFAM ID.                                                                                                                                                                                             |
| A-15 | Split match/booking lists into Upcoming/Past tabs                                    | Not built.                                                                                                                                                                                                                                                                                   |
| A-13 | General turf operating-hours default with per-day override                           | Not built.                                                                                                                                                                                                                                                                                   |
| A-14 | Copy one pitch's details onto another pitch                                          | Not built.                                                                                                                                                                                                                                                                                   |

### Needs a quick founder confirm before building

| ID        | Item                                                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| S-1 / S-7 | Casing issue on login/signup labels — the code already looks correct; needs a screenshot from Vaibhav to confirm what's actually being seen. |
| S-5       | "Welcome" heading change — needs the reference image that never made it through.                                                             |
| S-6       | Whether duplicate-signup validation needs to move earlier (inline on the Sign Up form) rather than only surfacing on the OTP screen.         |
| A-17      | Whether a specific screen still needs a manual reload after a team action — the two likeliest culprits already self-refresh.                 |

### New subsystems needing real scoping (not a quick build)

| ID              | Item                                                                                                                                                                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E-2 through E-6 | Rest of the Admin Panel — Match/Turf/Team/Reviews Management, Reports. **E-3 (Turf Management)** is cheapest since Owner Web's turf UI already exists and mostly needs the ownership check relaxed to "any turf." |
| G-21            | Consent capture with policy versioning (Section A) — needs a real consent-log data model, not a checkbox.                                                                                                         |
| G-22            | Minor/age-gate at signup (Section A) — needs `date_of_birth` actually checked against `MINIMUM_AGE_YEARS` in `createUserAccount`, not just at profile-edit time.                                                  |
| G-23            | Reschedule Booking (Section A) — needs a product decision on whether this reuses the cancel+rebook path under the hood or needs its own state machine.                                                            |
| G-24            | Audit log (Section A) — needs a `audit_logs` migration and write-calls threaded through every cancellation/refund/correction/admin-action code path; a real cross-cutting change, not a single module.            |

### Long tail — PRD gaps never raised as explicit feedback (lowest priority, listed so nothing is forgotten)

Rankings/Leaderboards (12.33), XP & Levels (12.35), Achievements & Badges (12.37), Match Streaks (12.38), Special Recognition (12.39), Tournaments & Leagues (12.40/41), Match Recording & Highlights (12.42), Business/Cancellation Analytics (12.49/50 — same as E-6), Peak-viewer analytics (**G-25**), Memberships (12.51), a real Offers taxonomy beyond generic promo codes (12.52), Referral System (12.53), Café (12.54), a real Maintenance task tracker (12.55), in-match Fair Play rotation/alerts/new-player-protection (12.23–12.26), skill-aware team balancing (12.28), a broader rewards catalog (12.36), a web scoreboard view (12.20), and map/navigation (12.58).

---

## Section D — Recommended order of attack

1. **A-19** — Auto-finalize on target/overs-complete. The only remaining item that can actually corrupt a live match (a chased target should stop the innings and it currently doesn't) — same completion mechanism A-21 already built for the wicket cap, just needs the two other trigger conditions wired to it.
2. **S-2 / S-3 / S-4** — Three trivial, isolated auth-screen fixes; batch them into one small PR.
3. **A-16** — Leave Team + captain-only management screen (backend already exists, purely a mobile UI gap).
4. **A-18** — Mechanical `displayName()` rollout to the remaining 5 screens, same proven pattern.
5. **G-22** — Close the minor/age-gate loophole at actual signup time — small, well-scoped, and a real compliance gap today.
6. **A-15 / A-13 / A-14** — Owner-side quality-of-life items, no dependencies on anything else.
7. **G-23** — Reschedule Booking, once scoped with the founder (does it reuse cancel+rebook internally, or need its own flow?).
8. **G-24** — Audit logging — worth scoping deliberately since it cuts across almost every write path in the app, rather than bolting it onto an unrelated feature PR.
9. **G-21** — Consent capture with policy versioning — same "do it once, properly" argument as audit logs.
10. **E-3** — Turf Management in Admin Web (cheapest of the remaining Admin Panel modules).
11. **E-2, E-4, E-5, E-6** — the rest of the Admin Panel.
12. Everything in the **long tail** — pick based on product priority; none of these block anything else in the app today.

---

_For full detail on every item ever raised — including everything already DONE — see `BFAM_Gap_Analysis_and_TODO.md` at the repo root, which remains the canonical, continuously-updated status doc. This file is a point-in-time "what's left" extract from it, dated 2026-09-23._
