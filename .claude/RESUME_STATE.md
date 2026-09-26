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

## Deployment readiness (2026-09-26) — read this first

The user asked to deploy everything for a beta so testers can give feedback, and
chose: **Azure free account** ($200 credit for 30 days, then the 12-month free VM +
MySQL B1ms), no custom domain yet, Android **and** iPhone, **static OTP** for now
(with a documented path to a real SMS provider), every account under
sportsbfam@gmail.com, and "fix the blockers first".

**Done and committed (all tested; `BFAM_Deployment_Plan.md` §4 has the
commit-by-commit table):** dev-token hole closed + fail-closed `isLocalDevOrTest()`,
`TRUST_PROXY`, admin web on Next 15 / React 19 (`next build` works; `NEXT_DIST_DIR`),
mobile-web API URL baked in via `EXPO_PUBLIC_API_URL` (`npm run export:web`,
SPA-fallback host config in `apps/mobile/public`), IST-explicit booking times and
"today", extension-agnostic migration names, `DB_SSL`, S3-compatible storage (R2)
with private staff-ID documents + signed links, `OTP_MODE=static`, `db:seed:beta`
(demo seeds refuse to run in production), one `CORS_ORIGIN` allowlist for REST +
Socket.IO, backend `Dockerfile` + `.dockerignore` + `deploy/` (compose + Caddy +
env template) + `.github/workflows/deploy-backend.yml`. Suites at that point:
backend 716, mobile 333, web 50; `tsc --noEmit` clean.

**Not verifiable from this machine (say so, don't claim it works):** Docker (not
installed — the image steps were emulated on a clean checkout and the compiled
production layout was booted against an empty MySQL), Azure, GitHub Actions,
Cloudflare R2, Static Web Apps / Netlify. The user must create the cloud accounts
and enter credentials (the assistant must not); the runbook is
`BFAM_Deployment_Plan.md` §6.

**Live beta (2026-09-26):** deployed to Azure South India with `deploy/deploy-azure.ps1`
(VM + Docker + Caddy, MySQL Flexible Server, Static Web App for the player site);
secrets and the resource names live OUTSIDE the repo in `%USERPROFILE%\bfam-secrets\`
(the repo is public, so URLs and the static OTP code must not be committed). App UI
changes go live with `deploy/publish-web.ps1`. The classifier blocked the assistant from
creating Azure resources / SSH-ing itself, so the user runs those scripts; publishing the
static site was allowed. Not live: photo uploads (needs an R2 account), admin web (Netlify),
Android APK (Expo), native iPhone (Apple $99 — iPhone testers use Safari + Add to Home Screen).
Local testing needs the throwaway MySQL 8.4 in the session scratchpad (`mysqld --datadir=...\mysqldata
--console`), then `preview_start` backend + mobile-web; demo login +919916300600 / Demo@1234.

**Later the same day (2026-09-26):** new brand logo + icons (traced from the user's brand
sheet into `apps/mobile/src/assets/brand/{mark,wordmark}.svg`; `npm`-free generator
`apps/mobile/scripts/build-brand-assets.js` renders all PNGs; `BrandLogo` component; `app.json`
icon/adaptiveIcon). Web-build fixes: file uploads sent "[object Object]" on web (fixed in
`packages/api-client` `appendPickedFile`), and contacts invites now use the Contact Picker API
(Android Chrome) or a phone-number lookup (`useContactsMatch`). R2: S3 keys work against
`bfam-public` (tested with real upload from the browser UI); they live in
`%USERPROFILE%\bfam-secrets\r2.env` (NOT the repo). Still needed to enable photos in production:
the bucket's public `r2.dev` address in `R2_PUBLIC_URL`, then `deploy/configure-storage.ps1`
(needs the user's SSH; the assistant is not allowed to SSH). There is no `bfam-private` bucket yet
(staff ID documents would fall back to the public bucket). Expo project `@sportsbfam/bfam-mobile`
exists (`eas.json` preview = APK; `EXPO_PUBLIC_API_URL` is an EAS environment variable, not in the repo);
first Android build was started from the CLI. Netlify site `bfam-admin-<suffix>` was created but the
admin web is NOT deployed: Netlify's Next.js plugin failed at "Failed publishing static content"
when deploying from this monorepo (the `next build` itself passes); options: host the admin web as a
container on the VM, or make its three dynamic routes static and use Azure Static Web Apps.
The user pasted Cloudflare API tokens (cfat_/cfut_) into chat: they should be revoked; only the S3
key pair is used.

**NativeWind gotcha:** `className` is silently ignored on React Native's own `Animated.*`
components (unlike plain `View`/`ScrollView`) — use `style`/`contentContainerStyle`, or wrap a
plain `View` (this caused the edge-to-edge Home on the deployed site; regression test:
`__tests__/home-layout.test.tsx`). The display font Anton has one weight, so `.font-display`
sets `font-synthesis: none` on the web. `expo export` ignores `+html.tsx` (single output):
home-screen tags are patched in by `scripts/patch-web-html.js` via `npm run export:web`.

**Gotchas learned:** `npm prune --omit=dev` in this monorepo re-installs the
mobile/web trees (use a separate `npm ci --omit=dev -w apps/backend`, which is what
the Dockerfile does); `expo export` needs `--clear` or a cached bundle keeps an old
`EXPO_PUBLIC_*` value; new Azure public IPs are Standard/static and not free (~$3–4
per month, estimate); any iOS build needs the $99 Apple Developer Program (iPhone
testers start on mobile-web via Safari).

**Still open for deployment:** `eas.json` for the Android APK (not written — do it
when the user is ready to run `eas login`); optional iPhone web polish
(apple-touch-icon, `viewport-fit=cover`); after the user deploys, fix whatever the
first real run of the Dockerfile / workflow / Azure surfaces. The user should restart
their own web dev server once (Next/React upgrade) and use `db:seed:beta` — not the
demo seeds — for any shared database.

**Local environment incident (2026-09-26, repaired the same day):** a mistaken shell
command run from this session deleted part of the repo's root `node_modules`
(unescaped backticks in a double-quoted bash string ran pieces of note text as
commands, including npm commands; no tracked file changed). The old dev servers
(backend ts-node-dev, `expo start`, two nativewind children) held native `.node`
files open, so the user stopped them; `npm ci` at the repo root then restored
everything from the committed lockfile (1,735 packages), and bcrypt, the `@bfam`
workspace links, `.bin` and `npm run type-check` were re-checked. **The dev servers
were stopped and are not running** — restart them (backend `:5000`, mobile web
`:8081`, web `:3000`) when needed. Lesson: write markdown/notes with the Write or
Edit tool, never through `bash -c "…"` strings containing backticks.

## Where things stand right now (2026-09-24, continued session)

`main` branch, latest commit at time of writing: see `git log` (most recent item: Referral System). Working tree is clean,
everything up to and including it is committed and pushed.

**The entire well-scoped backlog from `BFAM_Remaining_Backlog_2026-09-23.md`
Section D is now DONE**: A-13, A-14, G-22, G-23, G-24, G-21, E-3, E-5,
E-4, E-2, E-6. Now working through the "long tail" one item at a
time, same discipline as everything else (reproduce/verify, fix,
test, typecheck, full suite, commit+push) — see "Completed this
cycle" below for progress and "What's next" for what's left of it.

**Admin Web now has**: Reports (KPI tiles), Players, Matches, Turfs,
Teams, and Reviews directories (the latter four each with a moderation
action), plus the Home Banners CMS
(`apps/web/src/app/admin/{reports,players,matches,turfs,teams,reviews,banners}/page.tsx`).

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
14. **G-24 — Audit logging extended to refunds + admin ticket actions**
    New `apps/backend/src/services/auditLogService.ts`'s `writeAuditLog()`
    — the one shared helper every write path should use going forward
    instead of inlining its own `bulkInsert('audit_logs', ...)`.
    `bookingService.ts`'s cancel/reschedule now route through it (pure
    refactor). New `REFUND_ISSUED` entries in
    `paymentService.ts`'s `refundPaymentsForBooking`, and
    `SUPPORT_TICKET_STATUS_CHANGED` in `supportService.ts`'s
    `updateTicketStatus` (currently the only real ADMIN-only write path
    in the app). Match-result corrections and the rest of "admin
    actions" have no audit hook yet because those features (Admin Panel
    E-2..E-6, any result-correction flow) don't exist yet — add the
    `writeAuditLog()` call at the same time those are eventually built,
    not as a separate retrofit.
15. **G-21 — Consent capture with policy versioning**
    New `user_consents` table + `apps/backend/src/services/consentService.ts`
    (`recordConsent`/`getMyConsents`, append-only log, one shared
    `CURRENT_POLICY_VERSION` across all 4 categories — see the migration's
    comment for why). `createUserAccount` now records a `TERMS` consent
    on every registration. New `POST /consents` / `GET /consents/mine`,
    wired into the two real device-permission-grant moments that already
    exist: `useContactsMatch.ts` (CONTACTS) and the Turf Discovery
    screen's location effect (LOCATION). `PAYMENT_DATA` has no UI wiring
    — flagged under "Needs founder input" below.
16. **E-3 — Turf Management in Admin Web**
    New `apps/backend/src/services/adminTurfService.ts`
    (`listAllTurfsForAdmin`, `setTurfStatusAsAdmin` — writes a
    `TURF_STATUS_CHANGED` audit_logs entry via G-24's `writeAuditLog()`),
    routes `GET /admin/turfs` / `PATCH /admin/turfs/:turfId/status`, and
    `apps/web/src/app/admin/turfs/page.tsx` (directory + search +
    Suspend/Reactivate). Deliberately NOT a duplicate of Owner Web's
    pricing/hours/blocks editor — scoped to what only Admin should do
    (cross-owner directory + moderation), not what Owner already owns.
17. **E-5 — Reviews Management in Admin Web**
    New `apps/backend/src/services/adminReviewService.ts`
    (`listAllReviewsForAdmin`, `deleteReviewAsAdmin` — a real hard delete,
    `reviews` has no `deleted_at`; recomputes the turf's
    `average_rating` afterward and writes a `REVIEW_DELETED` audit_logs
    entry), routes `GET /admin/reviews` / `DELETE /admin/reviews/:reviewId`,
    and `apps/web/src/app/admin/reviews/page.tsx` (directory + search +
    confirm-then-delete).
18. **E-4 — Team Management in Admin Web**
    New `apps/backend/src/services/adminTeamService.ts`
    (`listAllTeamsForAdmin` — captain name/phone via a join, active
    member count via a `team_members` subquery; `setTeamStatusAsAdmin` —
    writes a `TEAM_STATUS_CHANGED` audit_logs entry), routes
    `GET /admin/teams` / `PATCH /admin/teams/:teamId/status`, and
    `apps/web/src/app/admin/teams/page.tsx` (directory + search +
    Archive/Reactivate). Same directory+moderation shape as E-3/E-5.
19. **E-2 — Match Management in Admin Web**
    New `apps/backend/src/services/adminMatchService.ts`
    (`listAllMatchesForAdmin` — organizer name/phone and turf name via
    joins through `bookings`; `forceCancelMatchAsAdmin` — writes a
    `MATCH_FORCE_CANCELLED` audit_logs entry, rejects a match already
    COMPLETED/CANCELLED), routes `GET /admin/matches` /
    `POST /admin/matches/:matchId/force-cancel`, and
    `apps/web/src/app/admin/matches/page.tsx` (directory + search +
    confirm-then-force-cancel). Unlike E-3, there was no existing
    organizer-facing cancel flow to relax an ownership check on —
    force-cancel is a new, admin-only action from scratch.
20. **E-6 — Reports in Admin Web (Business Analytics, PRD §12.49)**
    New `apps/backend/src/services/adminReportsService.ts`
    (`getBusinessReport()` — 8 independent aggregate queries run in
    parallel: total/cancelled bookings, cancellation rate, revenue,
    refunds, active player/turf/team counts, matches completed; run as
    separate queries rather than one join, since joining
    bookings/payments/matches/teams together would fan out and
    double-count unrelated rows), route `GET /admin/reports`, and
    `apps/web/src/app/admin/reports/page.tsx` (a KPI tile grid).
    Deliberately a first cut, not the full analytics platform PRD
    §12.49/§12.50 imply eventually (no date-range filtering, no per-
    turf/per-owner breakdowns, no exports) — this closes out the
    original E-2 through E-6 Admin Panel gap list entirely.
21. **Rankings & Leaderboards (long tail, PRD §12.33)**
    New `apps/backend/src/services/leaderboardService.ts`
    (`aggregateByPlayer` — a pure, independently-tested function
    grouping `player_match_statistics` rows per player, correctly
    summing cricket-notation overs via `oversNotationToLegalBalls`
    rather than SQL `SUM`, which would silently miscompute; `getLeaderboard`
    covers MOST_RUNS/MOST_WICKETS/MOST_SIXES/BEST_STRIKE_RATE/
    BEST_ECONOMY from match stats plus HIGHEST_SKILL_RATING/FAIR_PLAY/
    RELIABILITY straight from `players` columns), route
    `GET /leaderboards?category=...`, and a new mobile screen
    (`app/leaderboards.tsx`, horizontal category picker) reached from
    Profile. Rate-based categories have a documented qualifying minimum
    (30 balls faced / 6 overs bowled) to stop a one-match fluke from
    topping the board forever. Deliberately left out: MVP (no scoring
    formula defined anywhere), all-rounder ranking (no combined formula
    specified), Tournament leaderboard (no tournament entity exists —
    separate long-tail item).
22. **XP & Player Levels (long tail, PRD §12.35)**
    New migration (`players.xp_total` + `xp_transactions`, same shape
    as `coin_transactions`/`players.coin_balance`), `services/xpService.ts`
    (`computeLevelProgress` — pure, independently tested — against
    documented MVP level thresholds: Newbie 0 / Rookie 100 / Player 300
    / Pro 700 / Elite 1500 / Legend 3000 XP), routes
    `GET /players/:playerId/xp` and `.../xp/history`, and a new mobile
    screen (`app/xp-level.tsx` — level badge, progress bar, XP history)
    reached from a new "Level & XP" Profile entry point. `reviewService.ts`'s
    `submitReview` now also grants `XP_REWARD_PER_REVIEW` (10 XP, MVP
    default) in the same transaction as the existing coin reward — the
    one real "player did something positive" event that exists today.
    No other XP-earning triggers wired yet — booking completion, match
    wins, POTM, etc. from PRD §12.34's coin list would need the same
    treatment, but none of those actually call `earnCoins` either
    today, so there's nothing broader to extend yet (a pre-existing
    gap in B-1, not something this item introduced).
23. **Achievements & Badges (long tail, PRD §12.37)**
    New `domain/achievements.ts` (`evaluateAchievements` — pure,
    against 9 documented MVP thresholds covering all of PRD §12.37's
    named badges: First Match, Century Club [100+ runs], Six Machine
    [25+ career sixes], Hat-Trick Hero, Match Streak [3+ consecutive
    wins], BFAM Legend [reached Legend XP level], Fair Play Champion /
    Reliable Player [95+ rating], Top Performer [1+ POTM]),
    `services/achievementService.ts` (the DB-fetching layer — nothing
    is stored, every badge is evaluated fresh on read), route
    `GET /players/:playerId/achievements`, and a new mobile screen
    (`app/achievements.tsx`) reached from a new "Achievements" Profile
    entry point. Also added `computeBestWinStreak` (longest-ever win
    run, not the existing season-scoped "current streak") and
    `hasHatTrick` (3 consecutive wicket-taking deliveries by the same
    bowler, scoped per-match) as reusable pure functions — note:
    **Match Streaks (PRD §12.38) is its own separate long-tail item**
    and is NOT done — this only uses `computeBestWinStreak` internally
    for one achievement's threshold check; §12.38 wants its own
    dedicated "current streak / best streak / consecutive
    participation / streak rewards" screen, which doesn't exist.
    (Update: done next — see item 24.)
24. **Match Streaks (long tail, PRD §12.38)**
    New `domain/matchStreaks.ts` (`computeMatchStreaks` — pure,
    independently tested; weekly-participation streak, Monday-Sunday
    UTC weeks — deliberately a DIFFERENT metric from Achievements'
    win-based MATCH_STREAK badge despite the shared name; a streak
    stays "alive" if the player played this week OR last week, so an
    in-progress week never falsely breaks it), `services/matchStreakService.ts`,
    route `GET /players/:playerId/match-streaks`, and a new mobile
    screen (`app/match-streaks.tsx` — current/best streak tiles)
    reached from a new "Match Streaks" Profile entry point. "Streak
    rewards and bonuses" (named in §12.38 and §12.34's coin-earning
    list) deliberately NOT implemented — needs its own idempotency
    record to avoid re-granting on every read, plus undefined reward
    amounts; this is tracking/display only.
25. **Peak-viewer analytics (long tail, G-25)**
    New `matches.peak_viewer_count` column (cached running value, only
    ever increases per match), `updatePeakViewerCountIfHigher` in
    `services/presenceService.ts` — piggybacks on the existing
    `broadcastViewerCount` called on every join/leave, no new event
    wiring needed. Exposed via the existing `GET /matches/:matchId/viewers`
    route (new `peak` field) and the `match:viewer_count` socket event.
    Surfaced on the Match Result screen's Match Summary block —
    deliberately NOT on the live `ViewerCountBadge`, since backlog A-23
    already removed the live active-viewer count from that badge to
    keep it minimal, and peak count is inherently a post-match number
    anyway.

26. **Referral System (long tail, PRD §12.53)**
    Referral code = the referrer's own BFAM ID (no new identifier).
    New table (one per referred player; also widens
    with REFERRAL_REWARD), ( at signup — invalid/unknown codes are
    silently ignored; — idempotent, awards
    100 coins MVP default to the referrer), optional on
    register/social-complete, qualification hooked into
    (qualifying action = referred player's
    first completed match), , and a mobile
    reached from Profile. **Not done**: the mobile
    signup screens don't yet have a field — DONE in item 27a below.

27. **"Small five" (2026-09-24)** — all committed + pushed:
    a. Referral code field on mobile Player signup (role-selection screen,
    passed through signupStore -> completeAccountCreation).
    b. **Rewards catalog (PRD §12.36)**: rewards + reward_redemptions tables,
    /rewards routes, coin-priced, redemption = PENDING row fulfilled
    manually; mobile Rewards screen.
    c. **Memberships (PRD §12.51)**: membership_plans + player_memberships,
    /memberships routes; bought with COINS (no recurring-payment flow
    exists); renewing while active extends from current expiry;
    discount_percent stored/shown but NOT applied at checkout (needs
    design vs promo+coin stacking). Mobile Membership screen.
    d. **Special Recognition (PRD §12.39)**: GET /recognition?month=YYYY-MM,
    computed on the fly (no table): Batting Star, Bowling Star, Player of
    the Month (runs + 20 x wickets — judgement call), Sportsman of the
    Month (CURRENT fair-play snapshot, not historical). Tournament awards
    and persisted Hall of Fame deferred. Mobile Recognition screen.
    e. **Skill-aware team balancing (PRD §12.28)**: pure domain/teamBalance.ts
    (greedy strongest-first, sizes within 1, role as tie-break only),
    GET /matches/:id/balanced-teams (organizer/scorer, read-only
    suggestion over CONFIRMED roster); "Suggest Balanced Teams" button
    in the Game Room.
    Tests at that point: backend 608, mobile 284 passing, tsc clean.

28. **Manual test run (2026-09-24) — DONE.** Ran a throwaway MySQL 8.4 (data dir in
    the session scratchpad, mysqld --initialize-insecure, then created
    bfam_dev/bfam_user from apps/backend/.env), ran ALL 29 migrations up (and
    the last 6 down+up) cleanly, seeded phase1 + demo, and exercised the API,
    mobile-web (Profile tiles, Membership, Rewards, Recognition, Referrals,
    Leaderboards, XP, Achievements, Streaks, Stats, Game Room balanced teams)
    and admin web (Reports/Players/Matches/Turfs/Teams/Reviews/Banners), plus
    booking create/reschedule via API.
    **Two real bugs found and fixed** (both invisible to the mocked suites):
    a. dialectOptions.typeCast (added for the TINYINT bool fix) replaced
    Sequelize's DATE parser, so every raw-query DATE column came back as a
    JS Date: createMatch built "Invalid Date" (demo seed and real match
    creation broken) and dates JSON-serialized timezone-shifted. Fixed in
    config/sequelize.ts (DATE -> raw 'YYYY-MM-DD' string) + tests.
    b. GET /admin/turfs 500'd: adminTurfService selected u.full_name but
    full_name lives on players. Now LEFT JOINs players (owners have no
    player row, so owner_name is null and the UI shows the phone).
    Also fixed "1 wickets" pluralization on the Recognition screen.
    Observed, NOT fixed: Profile's "Basic Skill Rating" tile still says Fair
    Play/Reliability/Community are "coming in a later module" (stale copy);
    XP is 0 for seeded players because XP is only earned via reviews (by
    design); referral QUALIFICATION (first completed match -> 100 coins) and
    the mobile signup UI field were not clicked through end to end (API
    register-with-referral-code verified; qualification is unit-tested only);
    demo seed re-runs duplicate data (harmless).
    To re-run: start MySQL (see above), npm run db:migrate, seeds, then
    preview_start backend / mobile-web / web. Logins: player
    +919916300600 / Demo@1234; admin +91987654323 / BfamPhase1!234.

**(Historical) The user asked for a MANUAL TEST of everything built so far by
actually running the project** (backend + web + mobile-web via preview
tools; needs MySQL + running all migrations incl. 20260924* files, which
have only ever been exercised via mocked tests). Record findings honestly.

### What's next

Everything else in the "long tail" section of
`BFAM_Remaining_Backlog_2026-09-23.md` (Tournaments & Leagues, Match
Recording & Highlights, a real Offers taxonomy beyond generic promo
codes, Café, a real Maintenance task tracker, in-match Fair Play
rotation/alerts/new-player-protection, and map/navigation) — lowest priority, pick
based on what seems highest-value; none of it blocks anything else,
and each is a substantial, mostly-independent feature build rather
than a small well-scoped fix like everything completed above. **If working
autonomously with no user present**, pick ONE, scope it deliberately
(look for existing partial infrastructure first, the way E-3/E-4/E-5
found `turf_status`/`team_status`/`reviews` already half-there), and
follow the same one-item-at-a-time, fully-tested, fully-verified,
committed+pushed discipline as everything above.

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
- **G-21 follow-up**: `PAYMENT_DATA` is a defined consent type
  (`consentService.ts`'s `ConsentType`, `POST /consents` accepts it) but
  nothing calls `recordConsent(..., 'PAYMENT_DATA')` anywhere — BFAM
  never collects raw payment data itself (Razorpay handles cards
  directly via its own hosted flow), so there's no concrete UI moment
  that obviously corresponds to "the user just gave us payment data."
  Needs a product decision on what this should actually mean here (e.g.
  consent to share booking/contact details _with_ the gateway?) before
  wiring anything — don't guess at a UI moment for it.

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
