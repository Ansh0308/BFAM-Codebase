# BFAM — Backlog & Implementation Prompts

A working document derived from `BFAM_Gap_Analysis_and_TODO.md` (as of 2026-09-22, `main` at commit `1be2111`), scoped to **only what's still genuinely open** — every item already marked DONE or explicitly rejected by the founder in that document is left out of this one entirely. Cross-reference the gap analysis doc's own ID (A-#, B-#, E-#, S-#, 12.#) for full history/context on any item.

**Also reflects your brother's completed work** (pulled/merged 2026-09-22, commit `1be2111`): **B-13** (Team vs Team Challenge Mode) and **B-12** (Player Search from Home) are both done and correctly marked DONE in the gap analysis doc already — his own commit updated it. I additionally fixed two stale leftovers in that doc's Priority section that still listed B-12 as open after his merge, and separately corrected S-2/S-3/S-4/S-5 (login screen fixes), which were done earlier this session but never marked DONE in that doc until now.

## How to use this doc

1. Pick the next unchecked item (roughly in priority order, top to bottom — but feel free to jump to whatever's most urgent).
2. Paste that item's **Prompt** block into a new session as-is (or edited to taste).
3. When it's done, check the box here, and update the corresponding entry in `BFAM_Gap_Analysis_and_TODO.md` too (that doc is the historical record; this one is the queue).
4. Delete or archive an item's prompt once it's DONE — no need to keep completed prompts around; the gap analysis doc is the permanent record.

---

## Tier 0 — Scoring Interface refinement

Not from the gap analysis — added per explicit request. `scoring.tsx` has grown organically across A-7 (fewer taps), A-9 (names not IDs), A-10 (side-restricted pickers), A-20 (run-out picker + dismissed-batter blocking), A-21 (all-out banner) and the brother's countdown tweak — each patch was scoped and correct on its own, but nobody's stepped back to look at the screen as a whole since.

- [ ] **Refine and improve the Scoring Interface**

  > Let's do a dedicated refinement pass on the Scoring Interface (`apps/mobile/app/(tabs)/matches/[matchId]/scoring.tsx`). It's grown large and organically patched across several backlog items (A-7 fewer-taps, A-9 names, A-10 side-restricted pickers, A-20 run-out/dismissed-batter, A-21 all-out banner) — nobody's reviewed it holistically since. Please:
  >
  > 1. Read the whole file fresh and map out its current structure/state variables — flag anything that looks redundant, inconsistent, or like dead weight from an earlier iteration.
  > 2. Audit the actual scoring flow for tap-count and clarity: is there anything that still takes more taps than it should (the original A-7 spirit)? Any state that doesn't reset correctly between overs/innings/matches? Any place the UI can get into a confusing or stuck state (e.g. two pickers open at once, a wicket flow abandoned halfway)?
  > 3. Check visual/UX consistency against the rest of the app's Design system (spacing, color tokens, typography) — this screen was one of the earliest built and may have drifted.
  > 4. Propose a prioritized list of concrete fixes/improvements (not a rewrite) before touching code, then implement the ones I approve.
  >    Don't scope-creep into new scoring features (that's A-19/fielding-credit territory) — this is a quality/polish pass on what already exists.

---

## Tier 1 — Live-match integrity

- [ ] **A-19 — Auto-finalize the innings on target reached / overs complete**

  > Let's implement A-19: auto-finalize an innings when the chase target is reached or overs run out, the last two triggers of the "does this innings need to end right now" check (A-21 already built the all-out trigger — same underlying mechanism, reuse it). Feedback: a chased target currently doesn't stop the innings; the batting side can keep scoring balls past their target, and an innings that reaches its full over count doesn't auto-end either.
  > Current state to verify first: `recordBall` in `apps/backend/src/services/scoringService.ts` already computes `isMatchWinningBall` for the audio-trigger cue when `innings.target_runs != null && totalsAfter.total_runs >= innings.target_runs`, but nothing actually completes the innings on that condition. There's no `overs_per_innings` check wired into `recordBall` at all currently (the match's `overs_per_innings` column exists on `matches`, just isn't read here). A-21's `isAllOut()` helper (same file) is the pattern to follow: add sibling checks for target-reached and overs-complete, and complete the innings (`innings_status = 'COMPLETED'`) the same way — including the `undoLastBall` symmetry A-21 already built (reopening the innings if the ball that triggered completion gets undone).
  > Also decide and implement: when the _second_ innings hits one of these triggers, should the match auto-finalize too (call something equivalent to `finalizeMatch`), or just end the innings and leave "Finalize Result" as the organizer's explicit next tap (matching the existing manual flow)? I'd lean toward the latter (don't auto-decide the winner without the organizer confirming) — confirm before building.
  > On the mobile side, `scoring.tsx`'s all-out banner (from A-21) is the template — extend it (or generalize it) to also show when the innings ended via target-reached or overs-complete, with the right message for each.

---

## Tier 2 — Quick, high-value wins

- [ ] **A-16 — Captain-only team management screen + a real Leave Team button**

  > Let's implement A-16: a captain-only team management screen, plus a working "Leave Team" button for everyone else. Feedback: there's no dedicated place for a captain to manage their team, and no way for a non-captain member to leave one. Verified state to re-confirm: the backend already has a `leaveTeam` service function (check `apps/backend/src/services/teamService.ts`) that's been sitting unused since before v2 was written — start there and see exactly what it does and whether it's still correct against the current schema. On mobile, check `apps/mobile/app/(tabs)/teams/[teamId]/manage.tsx` (the brother's Team Challenge work already touches this file for the "Open for Challenge" toggle and Challenges list) — figure out what's already captain-gated there vs. what still needs building, and wire in a Leave Team button (with a confirmation prompt) for non-captains.

- [ ] **A-18 — Extend `displayName()` to the remaining BFAM-ID-only screens**

  > Let's finish A-18: the `displayName()` helper (falls back BFAM ID -> real name, already proven in Scoring and Match Intro) still needs applying to 5 screens that show raw BFAM IDs instead of names: Invite, Live Score, Roster Check-in, Scorecard, and the Team member list. This is mechanical — same pattern each time, just grep each screen for `bfam_id` being rendered directly and swap in `displayName(player)` (or add the helper locally if that screen doesn't already have it, matching its exact signature: `full_name || bfam_id || ''`). Note the Scorecard screen's `BattingRow`/`BowlingRow` types (`packages/shared-types/index.ts`) only carry `bfam_id`, not `full_name` — check whether `getScorecard` (`apps/backend/src/services/scoringService.ts`) needs to start joining `players.full_name` before the frontend can even do this for that screen.

- [ ] **A-15 — Split match/booking lists into Upcoming/Past**

  > Let's implement A-15: split the match list and booking list screens into Upcoming/Past tabs or sections, instead of one flat list. Find the relevant screens (likely `apps/mobile/app/(tabs)/matches/index.tsx` and wherever bookings are listed — check Owner Web too, `apps/web/src/app/owner/bookings`) and figure out the cleanest split point (`scheduled_start_time`/`booking_date` vs. now, plus probably `match_status`/`booking_status` for anything explicitly completed/cancelled). Keep it simple — a tab switcher or two headed sections, not a new screen.

- [ ] **A-13 — General operating-hours default with per-day override**

  > Let's implement A-13: turf operating hours should have one general default (e.g. 6 AM - 11 PM) that applies to every day, with the option to override specific days individually — instead of whatever the current turf-hours model requires today. Find the current operating-hours data model (`apps/backend/src/models/index.ts` and the turf/availability services) and check whether it's already per-day-only, or has no structure for this at all. Design the schema change (if needed) and the Owner Web turf-settings UI change together — this is a real feature, not just a display tweak, so plan the migration before writing it.

- [ ] **A-14 — Copy a pitch's details onto another pitch**

  > Let's implement A-14: let an owner copy one pitch (turf)'s details — pricing, facilities, images, operating hours, whatever's configurable — onto another pitch at the same venue, instead of re-entering everything by hand for each pitch. Check the venue/multi-pitch model (A-2, already done) and the turf-edit screens on Owner Web for where a "Copy from another pitch" action would fit naturally — probably a button on the turf-edit screen that opens a picker of sibling pitches under the same venue.

- [ ] **B-5 — Fair Play Rating surfaced on Open Teams**

  > Let's verify and finish B-5: the underlying Fair Play score (PRD 12.22/12.27) already exists as a computed post-match aggregate, but check whether it's actually displayed anywhere on the Open Teams list screen (`apps/mobile/app/(tabs)/teams/open.tsx` — note the brother's Team Challenge work already touched this file for the Players/Challenge mode switch, so re-read it fresh). If it's not shown at all, add it to each team's list row. This may already be partially covered by 12.27 below (Post-Match Fair Play Summary on Result) — check both together, they might be one piece of work.

---

## Tier 3 — Needs a quick confirm before building (don't just guess)

- [ ] **S-1 / S-7 — Label-casing "bug" the code already looks correct on**

  > Ask the founder (or whoever reported this) for a fresh screenshot of the casing issue on Login/Signup labels, taken on the current build after a clean `npx expo start -c` rebuild. Both `login.tsx` and `signup.tsx` already show properly-cased labels ("Phone or Email", "Password", "Confirm Password") in the current code — this matches the exact stale-bundler-cache pattern already confirmed for A-25. Don't touch code until you have a screenshot showing an actual problem, or confirmation it was a stale build.

- [ ] **S-6 — Move duplicate-signup validation earlier (if that's actually wanted)**

  > Confirm with the founder: the backend (`POST /auth/otp/send`) already returns a clean 409 "An account already exists for this identifier" for a duplicate phone number, and the OTP-verification screen already displays it — but only after the user taps Continue and lands on the OTP screen, not inline on the Sign Up form itself while they're still typing the phone number. If the ask is specifically "show this before navigating away," implement a debounced inline check on the Sign Up phone field (similar debounce pattern to `player-search.tsx`'s 350ms debounce) that calls a lightweight existence check and shows the error inline. If the existing OTP-screen behavior is actually fine, close this out with no code change.

- [ ] **A-17 — Confirm which screen (if any) still needs a manual reload**

  > A-17 was flagged as "mostly already fine" — the two most likely culprits (join-request, accept-request on teams) already self-refresh. Ask the founder to name a specific screen that's still stale after a team action, since guessing and "fixing" screens that already refresh correctly would be wasted work. If they can't name one, close this out.

- [ ] **B-12 follow-up — Confirm what "Turfs" meant on the player-profile screen**

  > Player Search (B-12) is done, but one ambiguity was flagged and deliberately left open: the feedback mentioned showing "turfs/matches" on a searched player's profile, and the implementation went with the narrower, safer reading — a "Book a Turf" shortcut reusing the existing single-turf logic (A-12). Confirm with the founder whether "turfs/matches" actually meant _this player's play history_ (where they've played, who against) — if so, that needs new backend aggregation (no endpoint for this exists today) and is real scoping work, not a quick follow-up.

---

## Tier 4 — Admin Panel (new subsystem, needs real scoping)

The admin layout file's own code comment already says most of this is unbuilt. Only Player Management (E-1) and a Home Banners CMS (part of E-7) exist today.

- [ ] **E-3 — Admin: Turf Management** _(cheapest of this tier — do first)_

  > Let's build E-3, Admin Turf Management. Owner Web already has a working turf-management UI (`apps/web/src/app/owner/turfs`) scoped to "turfs I own" — the fastest path here is very likely reusing that same UI/components on the Admin side with the ownership check relaxed to "any turf, any owner" instead of "my turfs only." Check `apps/web/src/app/admin` for the existing admin layout/routing pattern (same one E-1's Player Management already uses) and follow it. Scope: list all turfs across all owners, view/edit any turf's details, probably a status toggle (active/suspended) — confirm exact scope with the founder before building if the PRD (§9, E-3) doesn't spell it out precisely enough.

- [ ] **E-2 — Admin: Match Management**

  > Let's build E-2, Admin Match Management — a read/moderate view over all matches platform-wide (not scoped to one organizer), following the same Admin layout pattern as E-1 (Player Management). Scope out with the founder first: is this read-only oversight (list/filter/view match details, dispute investigation), or does it need real actions (cancel a match, reassign a scorer)? The PRD's §9/E-2 description should say — check it before assuming.

- [ ] **E-4 — Admin: Team Management**

  > Let's build E-4, Admin Team Management — same pattern as E-1/E-2/E-3: an admin-scoped view over all teams platform-wide. Scope out with the founder what actions (if any) beyond viewing are needed — e.g. disband a team, remove a member, view fair-play history.

- [ ] **E-5 — Admin: Reviews Management**

  > Let's build E-5, Admin Reviews Management — moderation over the review system (B-4, already built for turf/match reviews). Likely scope: list all reviews, filter by flagged/reported, remove/hide a review. Check the existing review data model and service (`apps/backend/src/services` — search for review-related functions) before designing the admin UI.

- [ ] **E-6 — Admin: Reports (+ 12.49/12.50 Business Analytics)**

  > Let's build E-6 (Admin Reports) together with 12.49 (Business Analytics) and 12.50 (Cancellation/No-Show Analytics) — they're the same underlying gap: raw data exists (bookings, payments, cancellations, no-shows) but nothing aggregates or surfaces it anywhere. This is the biggest item in this tier — start by scoping exactly which reports/metrics the founder actually wants (revenue over time, occupancy per turf, cancellation rate, no-show rate, are the obvious candidates from the PRD) before writing any aggregation queries. Decide whether this lives under Admin Web, Owner Web (per-owner analytics, PRD 12.46 already flags this gap for Owner Management too), or both — they may want different scopes (platform-wide vs. per-owner).

- [ ] **E-7 remainder — Home Content Management beyond banners**

  > The Home Banners CMS already exists (part of E-7). Let's finish the rest: sliders/offers content management beyond static banners — check what B-6 (home page carousel, already DONE) currently reads its content from, and whether an admin-editable version of that is what's missing here, or something else entirely. Confirm scope with the founder before building.

---

## Tier 5 — SRS/PRD long tail (not yet raised as explicit feedback, lowest priority)

Everything below is a real gap against `BFAM_PRD_v2.2.md` §12, but nobody has asked for it explicitly yet — listed so it doesn't get lost, roughly ordered by how self-contained/quick each one is.

- [ ] **12.27 — Post-Match Fair Play Summary on the Result screen**

  > The Fair Play score is already computed and stored (12.22) but never shown on the Result screen (`apps/mobile/app/(tabs)/matches/[matchId]/result.tsx` — same screen A-22's Match Summary block and A-24's POTM suggestion already live on). Add a Fair Play summary block there, same display-only pattern as A-22 (the number already exists, this is surfacing it). Quick — probably bundle with B-5 above since they may be the same underlying display gap.

- [ ] **12.33 — Rankings & Leaderboards**

  > No leaderboard endpoint or screen exists at all. Scope out with the founder: leaderboard by what metric (skill rating, runs, wickets, win rate?), what scope (global, city, team)? Player Statistics (12.32, done) already computes most of the underlying per-player numbers — this is mostly a new aggregation query + ranking endpoint + a screen, not a new data pipeline.

- [ ] **12.28 — Smart/skill-aware Team Balancing**

  > Room's random-split (B-11, done) is pure random — no skill/role awareness. Extend `randomSplitRoom` (check `apps/backend/src/services/roomService.ts`) or add an alternative "balanced split" mode that uses `skill_rating` (12.29, already tracked per player) to distribute players evenly by skill across the two sides, not just randomly. Decide whether this replaces random-split as the default or is offered as a second option.

- [ ] **12.34 — Broader BFAM Coin earning sources**

  > Coin earning is currently limited to reviews only (B-1, done). The PRD lists several more sources that aren't wired up: winning a match, Player of the Match, referrals (12.53, itself not built), streaks (12.38, not built), on-time arrival. Start with the ones that don't depend on other unbuilt features — winning a match and POTM are both immediately actionable since `finalizeMatch`/A-24's POTM already fire at a clear moment to award coins from.

- [ ] **12.35 / 12.37 / 12.38 / 12.39 — XP & Levels, Achievements & Badges, Match Streaks, Special Recognition**

  > None of these exist. They're related (gamification layer) but each is its own data model and UI surface — don't build all four in one pass. Recommend scoping and building XP & Levels (12.35) first since Achievements/Streaks/Special Recognition likely want to reference level/XP milestones once that exists. Get the founder's actual design intent for each before building — these are exactly the kind of feature where guessing the rules (how much XP per action, what unlocks a badge) wastes real work if wrong.

- [ ] **12.40 / 12.41 — Tournaments & Leagues + Points Table**

  > `TOURNAMENT` exists only as a label on the match-type dropdown today — no tournament entity, fixture generation, or bracket/points-table logic anywhere. This is a genuinely large subsystem (new data model: tournaments, fixtures, standings) — needs real scoping/design with the founder before any code, not a quick-prompt implementation. Don't start this without a design session first.

- [ ] **12.42 — Match Recording & Highlights**

  > No video/highlight capability anywhere in the codebase. Needs a scoping conversation first — is this user-uploaded clips, auto-generated highlights from ball-by-ball data (e.g. "here's every six this match"), or something else? The PRD wording should clarify; confirm before estimating.

- [ ] **12.51 — Memberships**

  > Not built at all. Scope out with the founder: what does a membership actually grant (discounted bookings, priority slots, both)? Likely intersects with 12.52 (offers/coupons) and 12.36 (rewards) — check whether this should be designed together with those rather than in isolation.

- [ ] **12.52 — Offers taxonomy beyond generic promo codes**

  > Generic promo codes exist (check the payments/promo service), but the PRD's specific categories — first-booking, weekend, membership-linked, referral-linked — don't. This is mostly a matter of adding eligibility rules on top of the existing promo-code mechanism rather than a new system; check the current promo-code service before assuming a rebuild is needed.

- [ ] **12.53 — Referral System**

  > Zero references anywhere in the codebase. Needs a referral-code generation/tracking mechanism, a reward trigger (ties into 12.34's coin sources), and a UI surface for sharing a referral code/link. Scope the reward rules with the founder before building.

- [ ] **12.54 — Café module**

  > Not built. No existing code to anchor this to — needs full scoping (what does "Café" even mean here: in-app ordering at the turf, a loyalty tie-in, just a menu display?) before any implementation estimate is possible.

- [ ] **12.55 — Real Maintenance task tracker**

  > Only a "maintenance" reason exists on an availability block today — not the PRD's actual task tracker (equipment/electrical/cleaning categories, each with a status). Check the availability-block model (`apps/backend/src/services` — turf/availability service) and design a proper `maintenance_tasks` table + Owner Web UI for creating/tracking them, separate from just blocking a time slot.

- [ ] **12.58 — Map view / turn-by-turn navigation**

  > Distance-sorted turf search already exists; no map view or in-app navigation. The PRD itself notes this is out of scope for now — treat as lowest priority in this whole document, only pick up if the founder explicitly asks.

---

## Not included here (deliberately)

- Everything marked DONE or "Rejected by founder" in `BFAM_Gap_Analysis_and_TODO.md` — including all of A-1 through A-12 (except A-3, rejected), A-20 through A-26, B-1 through B-4, B-6 through B-13, D-1 through D-3, E-1, and every S-# except S-1/S-6/S-7 above.
- 12.6 (Team vs Team Matchmaking) — done via B-13, your brother's work.
- 12.20 (Digital Scoreboard) — the owner-web picker + LED/TV display page is done; only out-of-scope physical hardware integration remains, which the PRD itself defers to future.
