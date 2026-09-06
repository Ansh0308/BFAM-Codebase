# BFAM — Testing Feedback & Backlog (v1)

**Source:** Informal hands-on testing feedback (founder + brother) after a first pass through the Phase 2 build, before deep/formal testing.
**Status:** Documentation only. Nothing in this file has been implemented or scheduled — it exists so the raw feedback isn't lost, and so Phase 3 planning starts from a well-defined list instead of a chat message.
**How this is organized:** Every item restates the feedback in plain terms, notes what is actually true in the codebase today (verified against the code, not assumed), and is filed under one of three parts:

- **Part A — Phase 2 Refinements:** extends a module that's already built; no new subsystem or major data model needed.
- **Part B — Phase 3 / New Subsystems:** needs a new data model, a new major feature area, or doesn't exist in any form yet.
- **Part C — Decisions Needed Before Scoping:** cross-cutting questions that block estimating several items above until someone (product/founder) decides an answer.

Items are numbered for reference (e.g. "A-3") — these numbers are just for this document, not a commitment to build order.

---

## Part A — Phase 2 Refinements

### A-1. Let a player book more than one hour in a single booking

**Feedback:** "The player can book only one slot of one hour at a time — we want them to be able to book multiple slots (e.g. a 3-hour block) at once."

**Verified current state:** The backend already supports this — `duration_minutes` is accepted anywhere from 30 to 480 minutes (`createBookingSchema`), and `bookingService.createBooking` has no assumption that a booking is exactly one hour. The gap is entirely in the mobile Turf Availability screen: it renders fixed 1-hour slots and lets the player tap exactly one, then derives `duration_minutes` from that single slot's start/end — there's no UI to select a longer or multi-slot booking.

**Proposed change:** Let the player select a start slot and a duration (e.g. a stepper for 1–4 hours, or multi-select of contiguous slots), compute the combined price, and pass the resulting `duration_minutes` through the existing booking call. No backend change needed — this is a mobile UI feature only.

---

### A-2. Owner: support more than one turf/pitch at the same venue

**Feedback:** "A turf owner may have more than one turf or pitch in the same area — give them an option to add multiple turfs."

**Verified current state:** An owner can already create as many independent `turfs` rows as they want via "Add Turf" — nothing technically blocks a second listing at the same address. What's missing is any concept of grouping multiple pitches under one physical venue (e.g. "Redline Sports Complex — Pitch 1 / Pitch 2") so a player sees them as siblings rather than two unrelated, identically-addressed listings in Discover.

**This needs a product decision before it can be scoped** — see Part C-1.

---

### A-3. Remove Pricing from the (player-facing) Turf Details page

**Feedback:** "Remove Pricing from Turf Details page."

**Verified current state:** Turf Details (`apps/mobile/app/(tabs)/discover/turf/[turfId]/index.tsx`) currently renders a "Pricing" section listing each day-type rate before the availability preview.

**Proposed change:** Delete that section from the player-facing Turf Details screen. (Pricing management on the Owner side is unaffected — this is only about what a player sees before booking.) Small, contained UI change.

---

### A-4. Remove the Running Late feature from Match Details

**Feedback:** "Remove Running Late feature from Match Details."

**Verified current state:** `RUNNING_LATE` is one of the `attendance_status` values, touched in four places: the DB enum (migration + `domain/constants.ts`), `matchService.ts`'s attendance-update logic, the `PATCH` route in `routes/matches.ts`, and the "I'm Running Late" button on the mobile Game Room screen.

**Proposed change — needs a scope decision:** either (a) just hide the "I'm Running Late" button (attendance status stays in the data model, simplest, fully reversible), or (b) remove the status from the enum and every code path entirely (touches the four places above, not reversible without a migration). Recommend (a) unless there's a reason to actually drop it from the schema.

---

### A-5. Remove Dispute Result

**Feedback:** "Remove Dispute Result."

**Verified current state:** "Dispute Result" is a player-facing entry point on both the Scorecard and Match Result screens, routing to `match-dispute.tsx`, which calls `supportService.createMatchDispute` (module 2.13, PRD §32.2).

**Proposed change — needs a scope decision:** either (a) remove the two entry-point buttons only (the backend dispute flow and support-ticket handling stay intact, in case it's wanted again later or an admin still needs to handle disputes raised some other way), or (b) remove the entire flow including the backend route/service. Recommend (a) for the same reversibility reason as A-4.

---

### A-6. Add a coin-toss presentation option alongside the manual toss

**Feedback:** "Add Toss in Match Starting screen — also provide a coin toss option for the teams during match starting, along with the manual toss we already have."

**Verified current state:** The Match Intro screen (module 2.7) already has a manual toss step — the organizer picks the winning side and bat/bowl decision from two chip rows, and it's recorded via `POST /matches/:matchId/intro/toss`.

**Proposed change:** Add a second, playful "flip a coin" presentation (an animated coin flip in the UI) as an alternative way to _decide_ the winning side, which then still feeds into the exact same `recordToss` call and result. This is a presentation/UX addition on top of an already-built step, not a new data model.

---

### A-7. Refine the Scoring Interface for fewer taps

**Feedback:** "Refine Scoring Interface UI — it should be very user-friendly and minimal clicks. Also, every interaction in the app should be minimal clicks."

**Verified current state:** The current Scoring Interface (module 2.8) requires selecting striker/non-striker/bowler from dropdowns, then a separate tap for the run value, with extras and wickets as their own toggled states.

**Proposed change:** A UX redesign pass specifically on tap-count — e.g. persisting the current striker/bowler across balls instead of re-selecting them, combining extras+runs into fewer taps, larger primary buttons for the most common actions. This is a UI/interaction redesign within the existing module, not a new feature — but it's real design work, not a small tweak, so it should be scoped with mockups before building. The "minimal clicks everywhere" principle should also be treated as a general design-review pass across the app, not a one-off fix.

---

### A-8. Optional "extras count toward the score" toggle before scoring starts

**Feedback:** "Before entering the scoring interface, let them choose whether extras (wides, no-balls, etc.) count toward the actual displayed score or not — but still record them for the record, so we know how many wides/no-balls a bowler bowled."

**Verified current state:** Extras always count toward both the team's displayed total and (for wides/no-balls) the bowler's conceded runs (`domain/scoring.ts`'s `totalRunsForBall`/`runsConcededForBall`) — there's no variant mode today.

**Proposed change:** Add a per-match (or per-innings) setting, chosen before scoring starts, that changes only what's _displayed_ as the "official" score — the full ball-by-ball ledger (`score_events`) still records everything exactly as bowled, so bowler figures (wides/no-balls conceded) remain fully accurate regardless. This needs a product decision on the exact rule: e.g. does "extras don't count" mean they're dropped from the team total only, or also from the bowler's economy? (The feedback implies extras should still be tracked "for the record," which suggests bowler figures stay accurate either way — only the headline score changes.) Once that's settled, this is a contained addition to the existing scoring module.

---

### A-9. Select players by name in the Scoring Interface, not BFAM ID

**Feedback:** "Select players based on name from the scoring interface instead of BFAM ID — not everyone will know each other's BFAM ID."

**Verified current state — this one needs a schema addition first:** players in BFAM today have **no stored name field at all.** The only identifiers on a player are their BFAM ID, phone number, and (for some) their favorite cricketer's name — there is nothing resembling "Ansh's real name" anywhere in the `users`/`players` tables. Every screen that shows a player (roster rows, invite lists, the scoring selectors) displays their BFAM ID because that's the only human-readable field that exists.

**Proposed change:** Add a `full_name` (or `display_name`) field to the player/user profile (collected at signup or profile setup), then switch the scoring selectors — and likely other player-list screens for consistency — to show that name instead of the BFAM ID. This is bigger than a pure UI change because of the missing field; flagged here rather than assumed to be a one-line fix.

---

### A-10. Restrict batter/bowler selection to the correct team during scoring

**Feedback:** "As per the current innings — whichever team is batting or bowling — the batter and bowler should be selected only from that team. The user shouldn't be able to select a batter from the team that's currently bowling."

**Verified current state:** This is a real, already-known gap, not a new idea — it was flagged during the Module 2.7 review: `match_players.match_team_id` is never populated anywhere in the app (it's always `null`). No prior module ever built the step where an organizer assigns each roster player to Team A or Team B, so the scoring interface currently offers _every_ confirmed player as a possible striker/non-striker/bowler regardless of side.

**Proposed change:** Build the missing "assign players to a side" step (most naturally during the Playing XI reveal or right before the toss), persist it onto `match_players.match_team_id`, then filter the Scoring Interface's striker/non-striker options to the innings' `batting_match_team_id` and the bowler option to `bowling_match_team_id`. This directly enables A-9's team-aware selection and closes a gap this project's own prior review already called out.

---

### A-11. Let a captain copy an older team instead of starting from scratch

**Feedback:** "Provide an option to copy older teams — user experience should be minimal clicks, so let them copy a previously created team and edit it."

**Verified current state:** No such flow exists — Create Team always starts blank. There is a close precedent already built and working: Rebook Same Players (module 2.10), which fetches a prior match's roster/format and pre-fills a new booking.

**Proposed change:** A "Create from existing team" action on My Teams that pre-fills the Create Team form (name, description, skill level, home city, open-for-players) from a selected prior team, which the captain can then edit before saving as a new team. Same shape of feature as Rebook Same Players — small-to-medium, no new subsystem.

---

### A-12. Temporarily hide Turf Discovery

**Feedback:** "For now, hide the Turf Discover feature — before offering this to other turf owners, we're building our own turf and only want to offer these features on our own turf for now. We want Discover back in the future."

**Verified current state:** Turf Discovery (module 2.3) is fully built and is the main entry point into booking.

**Proposed change:** This is explicitly a temporary business decision, not a defect or a feature to remove — the framing matters for _how_ it's implemented. Recommend a feature flag / config toggle (e.g. hide the Discover tab and route players directly to the one owned turf) rather than deleting or disabling the underlying module, so it can be switched back on later with no rebuild. Needs a decision on what a player sees _instead_ of Discover in the meantime (see Part C-4).

---

## Part B — Phase 3 / New Subsystems

### B-1. Promo codes and BFAM Coins at checkout

**Feedback:** "Let a player use a promo code or BFAM Coins to reduce the amount they pay."

**Verified current state:** Neither promo codes nor a coins/wallet balance exist anywhere in the schema or payment flow today. This is a genuinely new subsystem: a coins ledger (earn/spend transactions, balance), a promo code table (code, discount rule, validity, usage limits), and a change to the payment-obligation calculation to apply a discount before the amount is charged. It's also the shared foundation B-4 (review rewards) needs, so these two should be designed together — see Part C-2.

---

### B-2. Contacts-based team/match invites

**Feedback:** "While creating a team and inviting players, the captain should be able to invite from their phone contacts — sync contacts, then invite whichever of them are already registered on BFAM."

**Verified current state:** This was already raised and explicitly deferred once, during the Module 2.6 (Match Creation) review — Invite Players currently supports team members, direct BFAM/player ID entry, a share link, and WhatsApp share, but not a real Contacts picker. It's re-surfacing now for Teams as well. Building it means: adding `expo-contacts` and a permission flow, plus a new backend endpoint that matches a batch of phone numbers against registered accounts — which is a privacy-sensitive design decision (how much do we reveal about who is/isn't on BFAM from someone's contact list), not just a UI addition.

---

### B-3. Team chat / activity room with auto-pushed match events

**Feedback:** "Like a video game, a created match/team can have a room where everyone can chat, and updates like player check-in and payment get automatically pushed into the team room/chat with notifications."

**Verified current state:** No chat/messaging subsystem exists anywhere in BFAM today — there's a Socket.IO real-time layer (used for live scoring, viewer presence, and match-intro sync), but no message storage, no chat UI, and no concept of a persistent room feed. This is a substantial new feature: message persistence, a chat UI, wiring existing events (check-in, payment, confirmations, etc.) to post system messages into the room, and notification delivery for new messages.

---

### B-4. Turf/match review system with coin rewards

**Feedback:** "After a match, ask the player to review the match/experience; give them BFAM Coins as a reward for leaving feedback."

**Verified current state:** There's a `turfs.average_rating` column, but it is **never written to anywhere in the codebase** — it's always `null`. There is no review/rating submission flow, no review table, and (per B-1) no coins system to reward with yet. This needs: a review entity (rating + text, tied to a completed match and/or turf), a flow prompting the player post-match, aggregation back into `average_rating`, and the same coins ledger as B-1.

---

### B-5. Fair Play Rating surfaced on the Open Teams list

**Feedback:** "When discovering/finding a team, show its Fair Play score — decided by whether everyone gets an equal chance to play (bat and bowl) during matches."

**Verified current state:** The Basic Skill Rating work (module 2.10) explicitly scoped out a Reliability/Fair-Play dimension as a separate, not-yet-built piece — `player_rating_events` already has a `rating_dimension` column built to support it, but nothing populates a non-SKILL dimension today, and there's no team-level aggregate at all (skill rating is per-player). The underlying data needed to compute "did everyone get an equal share of batting/bowling" already exists in `score_events`/the scorecard, which lowers the implementation cost — what's missing is the formula itself.

**This needs a product decision on the exact formula** before it can be scoped — see Part C-3.

---

### B-6. Home page carousel/slider for offers and ads

**Feedback:** "Add a carousel/slider on the home page for offers — later, on the super-admin side, let us (the app owner) display ads in the interface."

**Verified current state:** There is no admin-facing content-management surface in BFAM at all today (the `ADMIN` role exists for auth purposes, but no admin UI has been built for anything like this). This needs both the player-facing carousel component and, more significantly, an admin CMS to create/schedule/manage what appears in it — the second half is the larger piece of work.

---

### B-7. Home page redesign (top player, winning team, fair play highlights)

**Feedback:** "Add content to the Home page per the reference image — show a top player and winning team, or a fair-play slider, similar to the example provided."

**Verified current state:** The Home tab for a PLAYER account is still explicitly a placeholder today ("The full Home screen is built in a later module") — this feedback is effectively that later module. **Note: the reference image mentioned in the feedback was not included with the text of this feedback and will need to be re-attached when this is actually scoped**, since the specific layout/content it's asking for can't be captured from the description alone. This also depends on B-5 (Fair Play) if a fair-play slider is part of the design.

---

### B-8. Team join vacancy constrained by player rating

**Feedback:** "Let a captain add a constraint when creating a team/vacancy — e.g. only players with a certain rating or above can join."

**Verified current state:** `requestToJoinTeam`/Open Teams has no concept of eligibility constraints today — any player can request to join any open team. Adding a minimum (or range) skill-rating requirement on a team, enforced when a join request is made, is a contained addition once Basic Skill Rating (already built, module 2.10) is the reference metric — smaller than most items in this section, but still a new constraint dimension on the team model, not a UI-only change.

---

### B-9. Followers/Following for players, with play notifications

**Feedback:** "Let players follow each other like social media — show follower/following counts on the profile, and notify a user whenever someone they follow plays a match."

**Verified current state:** No social graph (follows/followers) exists anywhere in BFAM today. This is a new subsystem: a follows table, follower/following counts on the profile UI, and a new notification event type (which would need to be added to the Module 2.11 PRD §12.45 event list and its template registry, following the pattern already established there).

---

### B-10. View another player's profile

**Feedback:** "Let a user open another player's profile by tapping their profile icon (e.g. from a roster or team list)."

**Verified current state:** Every profile-related backend endpoint today is scoped to "me" only (`GET /profile/me`, statistics' `resolveOwnPlayerId`, etc.) — there is no public, by-ID profile endpoint for viewing someone else's profile. This needs a new read-only endpoint (deciding what's public vs. private — e.g. is skill rating shown to other players?) plus a public-profile view reachable from roster/team rows. Smaller than B-9, and could reasonably ship ahead of or independently from the full follow system, but still needs new backend surface that doesn't exist today.

---

## Part C — Decisions Needed Before Scoping

These aren't yes/no bugs — each blocks giving a real estimate on one or more items above until someone decides an answer.

1. **Multi-pitch venues (blocks A-2):** Do we want a new "Venue" entity that groups multiple `turfs` rows together for display (e.g. "Redline Sports Complex" showing Pitch 1/Pitch 2 as tabs), or is it enough that an owner can already list them as separate, independently bookable turfs today? The technical cost is very different depending on the answer.

2. **Coins economy design (blocks B-1, B-4):** Before either promo codes or review-rewards can be built, we need: what is a BFAM Coin worth in ₹ terms (if anything)? How is it earned (only reviews, or other actions too)? Can it expire? Is there a cap per booking on how much of the payment it can cover? This is genuinely a product/finance decision, not an engineering one.

3. **Fair Play formula (blocks B-5):** "Equal chance to bat and bowl" needs a precise definition to compute — e.g. is it measured per player across their team's matches, then averaged for the team? What counts as "equal" (exact balls faced/bowled, or just "everyone got at least one turn")? Does a team with only a few matches played get penalized for a small sample size?

4. **What replaces Discover while it's hidden (affects A-12):** If Discover is hidden, does Home's "Book Turf" quick action go straight to the one owned turf's availability screen, skipping the listing entirely? Needs a decision so A-12 isn't just "delete a tab with nothing in its place."

5. **Reference image for the Home redesign (blocks B-7):** The example image referenced in that feedback wasn't attached to the text — it'll need to be provided again when this is scoped.
