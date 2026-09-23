# BFAM — Autonomous Resume State

**Read this file first, in full, before doing anything else.** This is a
handoff note from a previous Claude Code session that ran out of usage
budget mid-task. You have no memory of that session — this file is the
only continuity. Treat it as instructions from the user, since the user
explicitly asked for this file to drive your next actions.

## The standing instruction

The user asked (in the previous session) to work through the BFAM backlog
**one item at a time**, each one:

1. Actually reproduced/verified live (browser + curl), not just read from code.
2. Fixed.
3. Covered by a new automated test (backend: `apps/backend/src/__tests__`,
   mobile: `apps/mobile/__tests__`, web: `apps/web/__tests__`).
4. Typechecked (`npx tsc --noEmit` in the relevant `apps/*` or `packages/*`
   directory) and the **full** test suite of every touched app run clean —
   not just the new test file.
5. Committed with a descriptive message (see the git log for this repo for
   the established tone/format — explain _why_, not just _what_, and
   mention what you verified) and pushed to `origin/main`.

Do **one item fully** (including commit+push) before starting the next.
Do not batch multiple backlog items into one commit unless they're
trivially related.

**If you are a scheduled/autonomous session with no user present to answer
questions:** make the reasonable, well-scoped call yourself and keep
going — this mirrors how the previous sessions operated (auto mode). Only
stop if genuinely blocked (e.g. needs a product decision only the founder
can make — see "Needs founder input" below, skip those and move to the
next available item).

## If you are close to hitting a usage/rate limit again

1. Finish and commit+push whatever you're currently working on if at all
   possible — never leave a half-finished, uncommitted change.
2. Update **this file** (`.claude/RESUME_STATE.md`) with the new current
   state (what's now done, what's next) before you stop, so the next
   session has an accurate picture — don't leave stale state in this file.
3. If a scheduled continuation isn't already set up for after the next
   reset, create one (see "Scheduling yourself" below).

## Where things stand right now (2026-09-23, continued session)

`main` branch, latest commit at time of writing: `485d933` — "Add
Reschedule Booking as its own flow (G-23)". Working tree is clean,
everything up to and including G-23 is committed and pushed.

**Correction to this file's own prior notes**: G-24 ("audit_logs table
doesn't exist at all") is stale/wrong — the `audit_logs` table exists
(phase1 migration) and `bookingService.ts`'s `cancelBooking` already
wrote to it before this session started; `rescheduleBooking` (added
this cycle) now also does. The real remaining gap is narrower than the
original note: payment/refund events (`paymentService.ts`), match-
result corrections, and admin actions still don't write audit_logs
entries. Scope G-24 as "extend audit logging to the write paths that
don't have it yet," not "build it from scratch."

Full context: the canonical, continuously-updated status doc is
`BFAM_Gap_Analysis_and_TODO.md` at the repo root — read it for the full
picture of what's DONE vs. not. A supplementary "what's left" extract
lives at `BFAM_Remaining_Backlog_2026-09-23.md` (same info, filtered to
pending items only, plus 5 newly-surfaced gaps numbered G-21 through G-25).

### Completed this cycle (2026-09-23 session), in order:

1. **Onboarding crash fix** — `useWindowDimensions()` returning `width: 0`
   on first web render crashed the whole app. Fixed in `apps/mobile/app/onboarding.tsx`.
2. **Cross-platform API URL bug** — web builds were using a LAN-IP env var
   meant for physical devices, causing every request to silently hang.
   Fixed via `apps/mobile/src/lib/apiBaseUrl.ts`.
3. **MySQL boolean type-cast bug** (root cause of "Start Innings" always
   failing with a mystifying 400) — raw `sequelize.query` reads of
   BOOLEAN/TINYINT(1) columns came back as `0`/`1` numbers, not real
   booleans. Fixed centrally via a `dialectOptions.typeCast` hook in
   `apps/backend/src/config/sequelize.ts` (exported as `boolTinyIntTypeCast`
   for unit testing).
4. **Striker/non-striker picker overlap** in the Scoring Interface — fixed
   in `apps/mobile/app/(tabs)/matches/[matchId]/scoring.tsx`.
5. **A-18 — names instead of raw BFAM IDs everywhere** — Live Score,
   Scorecard (batting/bowling/fall-of-wickets), Match Result, Invite
   Players, Roster Check-in, Team Details member list, Team Management
   join requests, and Admin Web's player directory (which had _no_ name
   column at all — added one + search). Several needed real backend query
   fixes (`getScorecard`, `listJoinRequests`, `listAllPlayers` never
   selected `p.full_name`).
6. **A-19 — auto-finalize an innings on a chased target or overs-complete**
   — the wicket cap (A-21, done previously) already auto-completed an
   innings; target-reached and overs-complete didn't. Fixed in
   `apps/backend/src/services/scoringService.ts` via a shared
   `isInningsComplete()` check. Also fixed a real bug found while wiring
   this up: `getLiveScore`'s Required Run Rate hardcoded a 20-over (T20)
   balls-remaining cap regardless of the match's actual `overs_per_innings`
   — every match in this app is far shorter than 20 overs, so RRR was
   badly overstated whenever a target was set. Mobile's completion banner
   now distinguishes "Target chased" / "Overs complete" / "All out"
   instead of always saying "All out".
7. **S-2/S-3/S-4** (login error text, Forgot Password link placement, back
   button) — turned out already fixed by a parallel session's commit;
   added regression tests locking them in (they had zero coverage).
8. **A-16 — Leave Team button** — wired the mobile UI to the backend's
   already-existing `leaveTeam` endpoint. Found and fixed a real
   cross-platform bug while wiring up the confirm step: `Alert.alert()` is
   a documented no-op on web (react-native-web never implements it), so a
   confirm-before-destructive flow silently did nothing on web. New
   `apps/mobile/src/lib/confirm.ts` branches to `window.confirm` on web,
   `Alert.alert` elsewhere — use this helper for any future
   confirm-before-destructive-action flow instead of calling `Alert.alert`
   directly.
9. **A-15 — Upcoming/Past tabs** on My Bookings and My Matches. New shared
   `apps/mobile/src/components/SegmentedTabs.tsx` component — use this for
   any future tab-style toggle instead of inlining a new one (there's
   already one inline instance in `apps/mobile/app/(tabs)/teams/open.tsx`'s
   Players/Challenge switch from backlog B-13 that predates this component
   and could be migrated to it as a small follow-up, but that's optional
   polish, not required).
10. **A-13 — Default-hours quick-fill** for Turf Operating Hours (Owner
    Mobile + Web). "Apply a Default to Every Day" block on both platforms'
    turf-management screen, ahead of the per-day rows. No live-DB
    verification (MySQL wasn't running) — component tests only.
11. **A-14 — Copy a pitch's details onto another pitch**
    (`copyTurfDetails` in `apps/backend/src/services/ownerService.ts`,
    route `POST /owner/turfs/:turfId/copy-from`, api-client
    `copyTurfDetails()`, "Copy Details From Another Pitch" UI section on
    both Owner Mobile and Web). Copies description, ball types, sound
    setting, pricing, and operating hours — never the name or address.
    Same no-live-DB caveat as A-13.
12. **G-22 — Minor/age-gate enforced at registration itself**
    (`createUserAccount` in `apps/backend/src/services/accountService.ts`
    now computes `is_minor`/rejects under-13 from an optional
    `date_of_birth` on both `POST /auth/register` and
    `POST /auth/social/complete`, reusing profileService's existing
    `calculateAge`/`MINIMUM_AGE_YEARS`/`UnderMinimumAgeError`). Did NOT
    wire the mobile signup UI to collect `date_of_birth` at registration
    time — flagged under "Needs founder input" below, since
    `DateOfBirthField.tsx` documents a conflicting 2026-08-30 product
    decision.
13. **G-23 — Reschedule Booking as its own flow**
    (`rescheduleBooking` in `apps/backend/src/services/bookingService.ts`,
    route `POST /bookings/:bookingId/reschedule`, api-client
    `rescheduleBooking()`, mobile screen reusing the turf-availability
    slot grid). Implemented as create-new-then-cancel-old, linked via a
    `BOOKING_RESCHEDULED` audit_logs entry — see the commit message for
    the full scoping rationale (no migration, no "recharge the
    difference" logic).

### What's next, in priority order (per `BFAM_Gap_Analysis_and_TODO.md` Part 4 / the remaining-backlog doc's Section D)

1. **G-24** — Audit log. **Note: narrower than originally scoped** — the
   `audit_logs` table already exists and `bookingService.ts` already
   writes to it (cancellations, reschedules). What's still missing:
   payment/refund events (`apps/backend/src/services/paymentService.ts`),
   match-result corrections, and admin actions don't write audit_logs
   entries yet. Scope this as "extend to the remaining write paths," not
   "build from scratch."
2. **G-21** — Consent capture at signup with policy versioning (only a
   single boolean `waiver_accepted` exists today, no per-category consent
   log). Needs a real data model decision — same "do it once properly"
   caution as G-24.
3. **E-3** — Turf Management in Admin Web (cheapest remaining Admin Panel
   module — Owner Web's turf-management UI already exists, mostly needs
   the ownership check relaxed to "any turf" for an admin caller).
4. **E-2, E-4, E-5, E-6** — rest of the Admin Panel (Match/Team/Reviews
   Management, Reports).
5. Everything in the "long tail" section of the remaining-backlog doc
   (Rankings, XP/Levels, Achievements, Tournaments, etc.) — lowest
   priority, pick based on what seems highest-value; none of it blocks
   anything else.

### Needs founder/user input (skip these if working autonomously, don't guess)

- S-1 / S-7 (casing issue — code looks correct, needs a screenshot from
  whoever reported it).
- S-5 ("Welcome" heading — needs a reference image that never arrived).
- S-6 (whether duplicate-signup validation should move earlier/inline).
- A-17 (whether a specific screen still needs a manual reload — the two
  likely culprits already self-refresh).
- **G-22 follow-up** (backend half done, see "Completed this cycle"
  below): whether the mobile signup UI itself should collect
  `date_of_birth` at registration (before account creation), vs. leaving
  it collected only in the immediately-following Profile Setup step as
  today. `apps/mobile/src/components/DateOfBirthField.tsx`'s own comment
  documents a 2026-08-30 product decision that its Profile Setup
  collection is "for future analytics, not age-gating" — which directly
  conflicts with `profileService.ts`'s pre-existing G-04 age gate that
  already throws `UnderMinimumAgeError` off that same field. Given that
  explicit, dated product note, don't wire a signup-time DOB field
  autonomously — confirm with the founder first whether the "not
  age-gating" decision still holds, since both call sites now enforce
  the gate identically.

## Standing conventions to follow (established this session, don't deviate)

- **Dev servers**: backend on `:5000` (`npm run dev --workspace=apps/backend`),
  mobile web on `:8081` (`npm run web --workspace=apps/mobile`), web
  (Owner/Staff/Admin) on `:3000` — all configured in `.claude/launch.json`,
  use the `preview_start` tool by name (`backend` / `mobile-web` / `web`),
  never start a duplicate via Bash.
- **Demo login** (for live browser verification): email
  `player0.344861.demo@bfam.local`, password `Demo@1234` (shared password
  for every seeded demo account — see `apps/backend/src/seed/demoSeed.ts`'s
  `PASSWORD` constant). For an admin session, there's no known password —
  get a dev JWT via `POST /auth/dev-token` with a real admin `user_id`
  (query `SELECT user_id FROM users WHERE role='ADMIN'`) and inject it into
  `localStorage` as `bfam_web_token`/`bfam_web_user` (see `apps/web/src/lib/auth.tsx`
  for the exact key names and shape) rather than trying to log in through
  the UI.
- **Git workflow**: always `git fetch origin` and check
  `git log --oneline main..origin/main` before committing — other sessions
  may be working in parallel. If origin has moved, `git rebase origin/main`
  (should be clean; these commits touch mostly-disjoint files). Check for
  a stray Word lock file (`ls "~\$AM"*.md`) before committing — if
  `BFAM_Gap_Analysis_and_TODO.md` or similar is open in Word, the
  pre-commit hook's prettier step will fail and its auto-revert can
  corrupt the working tree; if that happens, recover from the
  `lint-staged automatic backup` stash it creates (`git stash list`, then
  `git checkout stash@{0} -- <path>` per file, verified byte-for-byte
  against the stash before dropping it).
- **Never** `Alert.alert()` for a confirm-before-destructive action on
  mobile — it's a no-op on web. Use `apps/mobile/src/lib/confirm.ts`'s
  `confirmAction()`.
- **Never** trust a raw MySQL BOOLEAN/TINYINT(1) read via
  `sequelize.query` to already be a real JS boolean without the
  `boolTinyIntTypeCast` fix in place — it is (that fix is global and
  already committed), but if you ever see `0`/`1` instead of
  `false`/`true` in a response, that's a sign something is bypassing the
  shared `sequelize` instance, not a reason to add a local `!!` coercion.
- **Every** screen showing a player identifier should use
  `full_name || bfam_id`, never `bfam_id` alone — this is now the
  established pattern (see any file touched under A-18 above for the
  exact idiom) and should be followed for any new screen, not just the
  ones already fixed.
- **Tab-style toggles** (Upcoming/Past, Players/Challenge, etc.) should
  use `apps/mobile/src/components/SegmentedTabs.tsx`.

## Scheduling yourself (if you're an autonomous/scheduled session)

**Use `mcp__scheduled-tasks__create_scheduled_task`** (the Claude Code
desktop app's own local scheduled-tasks feature) — NOT the `schedule`
skill/`RemoteTrigger` (that one spins up a _cloud_ agent that clones the
repo from GitHub, which is not connected for this account, so it cannot
see this local repo or this file at all), and NOT `CronCreate` (that one
is session-only, in-memory, and disappears the moment this session ends —
useless for surviving a usage-limit reset).

`mcp__scheduled-tasks__create_scheduled_task` runs locally, persists to
disk (`C:\Users\jhray\.claude\scheduled-tasks\`), survives this session
ending, and runs in this same local repo — exactly what's needed. It does
require the Claude Code desktop app to be open at (or after) the fire
time; if closed, it fires on next launch instead, which is fine here.

If you finish everything in this file's task list, or you're getting
close to a usage limit again and meaningful work remains: call it with:

- `taskId`: something like `bfam-resume-<a short date/counter suffix>`
  (check `list_scheduled_tasks` first and don't collide with an existing
  one — reuse/update the existing task via `update_scheduled_task` with a
  new `fireAt` if one already exists, rather than creating a duplicate).
- `fireAt`: your best estimate of when the next usage reset lands, plus a
  few minutes of buffer (ISO 8601 with the `+05:30` IST offset).
- `prompt`: exactly "Read C:\Users\jhray\Source\repos\BFAM-Codebase\.claude\RESUME_STATE.md
  in full and continue from where it left off, following its instructions
  exactly — including updating this file with the new current state, and
  scheduling another one-time task the same way before you stop, if you
  hit a usage limit again or finish everything in this file's task list."
- Leave `cronExpression` unset (one-time only, via `fireAt`) — never
  schedule a recurring job for this, so it doesn't keep firing pointlessly
  once the user is back and working live.
