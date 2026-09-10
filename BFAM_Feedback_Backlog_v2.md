# BFAM — Testing Feedback & Backlog (v2)

**Source:** Founder's own hands-on testing of the app after Part A of `BFAM_Feedback_Backlog_v1.md` was implemented (items A-1 through A-12) and pulled in from a second contributor's work.
**Status:** Documentation only. Nothing in this file has been implemented yet — same convention as v1: every item restates the feedback in plain terms, notes what is actually true in the codebase today (verified against the code, not assumed), and proposes a change.
**Numbering:** Continues v1's running numbers rather than restarting — these are new items, filed under the same Part A ("extends an already-built module") / Part B ("new subsystem") / Part C ("decision needed") split v1 established. So this doc picks up at **A-13** and **B-11**.

Scope decisions already settled with the founder for this round (asked up front, not assumed):

- **Copy Pitch Details (A-14):** copies everything except `turf_name` and the address fields, within the same venue only.
- **Outdated matches/bookings (A-15):** split into Upcoming / Past sections, not hidden.
- **The "room" concept (B-11):** a new, alternate flow that runs _alongside_ today's book-first match creation — not a replacement.
- **Score counter accuracy (A-19):** scoped specifically to "the innings never knows it's over," not a run/wicket math bug.

---

## Part A — Phase 2 Refinements (continued from v1)

### A-13. Operating Hours: a general default for all days, with optional per-day override

**Feedback:** "In the turf owner portal, adding Operating Hours asks for the open/close time for every single day. For minimum clicks, let the owner set one general open/close time that applies to every day by default — with an option to set a different time for a specific day if they want."

**Verified current state:** `apps/mobile/app/owner-turfs/[turfId].tsx` (and its web mirror, `apps/web/src/app/owner/turfs/[turfId]/page.tsx`) render a fixed loop over all 7 `WEEKDAY_LABELS`, each with its own Open/Close text field, backed by `hoursByDay: Record<number, { open, close }>`. There is no "same for every day" shortcut anywhere — an owner with a single standard operating window still has to type the same open/close time into all 7 rows one at a time. The backend (`ownerService.setOperatingHours`) already accepts an arbitrary list of `{ day_of_week, open_time, close_time }` rows and replaces the full set (delete + reinsert), so it already supports "some days different from others" — the gap is entirely in the UI's data-entry pattern, not the API.

**Proposed change:** Add a "General Hours" open/close field above the per-day list, defaulting every day to it. Add a lightweight per-day override (e.g. a "Customize this day" toggle that reveals that one day's own open/close fields when turned on). On save, still send the same `SetOperatingHoursRow[]` shape to the existing endpoint — this is a pure UI/data-entry change, no backend or schema change needed.

---

### A-14. Copy an existing pitch's details onto another pitch in the same venue

**Feedback:** "Give an option to copy all the details of a pitch if they've filled it in before — e.g. copy all the details of Pitch 1 to Pitch 2."

**Verified current state:** No such feature exists anywhere (`grep` for "copy"/"duplicate" turf/pitch across mobile, web, and backend turns up nothing). Confirmed with the founder: this is specifically for two pitches under the same venue, and should copy everything except the turf's own name (must stay distinct) and address (already locked to and inherited from the shared venue per backlog A-2). That leaves: `description`, `ball_types_supported`, pricing rows (`turf_pricing`), operating hours (`turf_operating_hours`), and stadium sound setting as the copyable fields — all already independently readable/writable per turf via the existing owner endpoints (`updateTurf`, `setPricing`, `setOperatingHours`, `setStadiumSound`).

**Proposed change:** On a pitch's management screen (`owner-turfs/[turfId].tsx` and its web equivalent), add a "Copy details from another pitch" action that — for a pitch under a venue — lists that venue's other pitches, and on selection fetches the source pitch's description/ball types/pricing/hours/sound setting and writes them onto the current pitch via the existing update endpoints (client-side orchestration of calls that already exist; no new backend endpoint needed). A pitch not under a venue (standalone) has no sibling to copy from or into, so this action is venue-pitches-only, consistent with how A-2 already scopes "sibling" pitches.

---

### A-15. Split match/booking lists into Upcoming and Past

**Feedback:** "Outdated details like matches, etc. are still showing even though the date has passed — do something to prevent that."

**Verified current state:** Confirmed — every match/booking listing query in the codebase returns everything ever created, ordered only by date, with no status or date filtering and no separation between what's still relevant and what's long over:

- `matchService.listMyMatches` — `ORDER BY m.scheduled_start_time DESC`, no filter.
- `ownerService.listMatchesForOwner` (Owner Web/Mobile "Matches") — same, no filter.
- The mobile Matches tab and Owner Web's `/owner/matches`/`/owner/bookings` pages apply no client-side filtering either — a match from months ago sits in the same flat list as tonight's, distinguished only by its date text.

**Proposed change (per founder's choice — split, don't hide):** Group each of these lists into two sections, "Upcoming" and "Past" — a match/booking counts as Past once its `scheduled_start_time`/`booking_date` has passed _and_ it's not still `IN_PROGRESS` (an in-progress match that's running long should stay in Upcoming/current, not get miscategorized as past just because its scheduled start time has ticked by). This is a display/grouping change on top of data the endpoints already return — no backend change needed, since the full list is already being fetched and can be partitioned client-side; consider trimming the query/response only if list sizes become a real performance concern later.

---

### A-16. Only a team's captain should see management actions; everyone else gets Leave Team

**Feedback:** "In Teams, another player who is not the captain is getting the option to manage the team — they shouldn't. Instead, they should have an option to leave the team."

**Verified current state — mixed:** The one reachable entry point today (`apps/mobile/app/(tabs)/teams/[teamId]/index.tsx`) already gates the "Manage Team" button behind `isCaptain` — a non-captain browsing normally does not see that button. However, `manage.tsx` itself (the screen the button links to) has **no client-side role check of its own** — it only has a code comment noting "the backend re-enforces this." So anyone who reaches that URL by any other means (a stale/shared link, browser back-forward in the web build, a future entry point that forgets the gate) sees the full management UI (invite, remove, change captain, respond to join requests) and only finds out they can't actually do any of it when a button click 403s. Separately: **`leaveTeam` already exists as a working backend endpoint** (`POST /teams/:teamId/leave`, `apiClient.leaveTeam`) but is never called from anywhere in the mobile or web UI — there is currently no way for a non-captain member to leave a team at all.

**Proposed change:** Two independent fixes: (1) Add a client-side captain check inside `manage.tsx` itself (not just at its one current entry point) that redirects/blocks a non-captain, so the screen is safe regardless of how it's reached. (2) Add a "Leave Team" button on the Team Details screen for a non-captain member, wired to the already-existing `apiClient.leaveTeam`. Both are small, contained changes — the hard backend work (the endpoint, the "captain can't leave without transferring first" rule) is already done.

---

### A-17. Team actions should reflect immediately, without a manual reload

**Feedback:** "After doing an action like requesting to join a team or accepting a request, I need to reload/refresh the page — it should be reflected directly within seconds instead."

**Verified current state — likely already fixed, needs the founder to re-check on the latest build:** The two most obvious candidates already refresh without a manual pull: `open.tsx`'s "Request to Join" updates its own local `requestedIds` state immediately (no reload needed), and `manage.tsx`'s accept/reject/invite/remove/change-captain actions all run through a shared `withBusy()` helper that calls `await load()` straight after every action, which re-fetches both the team and its join-request list. Both of these were touched by the second contributor's recent commits, which may well be exactly what fixed this. **Open question for the founder:** which specific screen/action still shows stale data on a fresh build — if it's something other than these two flows (e.g. a _different_ screen that shows a team's member count or a pending-request badge without listening for the change), point it out so it isn't misdiagnosed.

**Proposed change:** Re-verify live on the current build first. If a specific stale-data case remains, the fix is the same pattern already used elsewhere in this codebase (Discover, Open Teams, Owner Dashboard): either `useFocusEffect` to refetch whenever that screen regains focus, or an immediate local state update right after the action succeeds (as `open.tsx` already does for join requests) rather than waiting for a background refresh.

---

### A-18. Player names instead of BFAM ID, on the remaining screens

**Feedback:** "During the match we still need to select or assign players by their BFAM ID instead of their names — I want player names everywhere."

**Verified current state:** v1's A-9 (add a `full_name` field and use it in the Scoring Interface) is already done — the DB migration, `full_name` on the relevant shared types, and a `displayName()` helper (falls back to BFAM ID if no name is set) all exist and are wired into `scoring.tsx`'s striker/non-striker/bowler pickers. What's left is everywhere else that still renders a bare `bfam_id` with no name fallback — confirmed by grep, these screens show BFAM ID only:

- `matches/[matchId]/intro.tsx` — the Playing XI reveal during Match Intro.
- `matches/[matchId]/invite.tsx` — the invite-players list.
- `matches/[matchId]/live.tsx` — the live score view's player references.
- `matches/[matchId]/roster-check-in.tsx` — the check-in roster.
- `matches/[matchId]/scorecard.tsx` — batting/bowling figures.
- `teams/[teamId]/index.tsx` — the team member list.

**Proposed change:** Extend the same `displayName()` pattern (real name if set, BFAM ID as fallback) already proven in `scoring.tsx` to these six screens. This is purely a frontend display change — the `full_name` field and its API plumbing already exist end-to-end (confirmed present on `Player`, `MatchPlayer`, `TeamMember`, and related shared types), so no backend or schema work is needed here, only updating what each screen renders.

---

### A-19. Auto-finalize the match result once the innings is actually over

**Feedback:** "The score counter isn't accurate — in the second innings, even after the batting team has chased the target, I'm still able to keep playing and scoring instead of the match being finished. We need minimum clicks to automate things in Live Scoring: who wins once the target is achieved, or the side is all out, or overs run out, and the margin — Finalize Result should be automated."

**Verified current state — confirmed, and scoped exactly to the founder's description (not a run/wicket math bug):** `scoringService.recordBall` already computes `isMatchWinningBall` (`innings.target_runs != null && totalsAfter.total_runs >= target_runs`) — but only to pick the `MATCH_WON` audio/celebration trigger. It never changes `innings_status`, never stops the innings from accepting more balls, and never creates a result. There is also no check anywhere for all-out (`total_wickets` reaching the side's batting-XI limit) or overs-complete (`legal_balls` reaching `overs_per_innings * 6`) — an innings simply keeps accepting balls forever unless a human manually stops it. `Match Result` (`matches/[matchId]/result.tsx`) is a fully manual form today: the organizer picks Win/Tie/No-Result, the winning side, free-text margin, and Player of the Match, with nothing pre-filled or computed from the actual score.

**Proposed change:** In `recordBall`, after applying a ball, check for each of the three innings-ending conditions (target reached in the second innings, all out, overs complete) and — when one is hit — mark the innings `COMPLETED` and stop it from accepting further balls (mirroring the existing `innings_status !== 'IN_PROGRESS'` guard that already rejects a ball on a _previously_ completed innings, just triggered automatically instead of only by a manual "End Innings" action). Once both innings are complete, auto-compute and submit the match result (winner, result type, and margin — runs for a defending team's win, wickets/balls-remaining for a chasing team's win) through the same `finalizeMatch` path the manual form uses today, so Player of the Match remains the one thing still requiring a human pick (there's no existing metric in this codebase to auto-select that fairly). This directly answers the "minimum clicks" framing raised repeatedly across this and v1's A-7 — it removes the Finalize Result form's clicks entirely for the normal case, rather than just making the form faster to fill in.

---

## Part B — Phase 3 / New Subsystems (continued from v1)

### B-11. Pre-match "room": assemble players lobby-style, then book and split into teams

**Feedback:** "The captain creates a room, inviting/adding players — like an online game lobby. After creating the room, other players who are looking for a game can also find/join it. Then they create a match for a booked turf, same as now. During the match, the captain divides the players into two teams (or the app can distribute them randomly). After that, they can start the match — same 10-second countdown, Playing XI of both teams one after another, toss, same as now."

**Verified current state:** Nothing like this exists today. The current flow (module 2.6, Match Creation) runs in the opposite order: a turf slot is booked _first_, a match is created _against that booking_, and players are invited into an already-scheduled match — there's no concept of assembling a roster before there's a match/booking to attach it to, and no public "looking for players" discovery surface (Open Teams, module 2.5, is the closest existing concept, but that's about joining a _persistent_ team, not a one-off game lobby). **Per the founder's decision, this is a new flow that runs alongside the existing one** — the current book-first flow stays exactly as-is for an organizer who already knows their turf/players; this is a second path for a more casual "find players first" style of getting a game together.

**Proposed change — needs real scoping, not just a build:** at minimum this needs: (1) a "room" entity distinct from both `teams` and `matches` — an open or invite-only lobby with a player list and a status (filling / ready / converted-to-match); (2) a join/discovery surface for a room, parallel to Open Teams but for a one-off game instead of a persistent team; (3) once a room's captain is ready, a turf-booking step that produces a real `bookings` row and a `matches` row exactly as today's flow does, carrying the room's assembled player list into the match invite step instead of inviting one by one; (4) a "split into two sides" step for the captain — manual drag/assign or a random-shuffle option — which is genuinely new (today's Playing XI/toss/scoring flow assumes `match_players.match_team_id` gets set some other way, e.g. via A-10 from v1, but has no UI for a captain to actually do the splitting); (5) from "start the match" onward, this hands off to the _already-built_ Match Intro sequence (countdown → Playing XI reveal → toss) completely unchanged. Recommend scoping this as its own small PRD-style write-up (entities, states, endpoints) before estimating, given it introduces a new core entity rather than extending an existing one.

---

## Part C — Decisions Needed Before Scoping

1. **A-17's exact stale screen:** flagged as an open question in A-17 itself — needs the founder to identify (on the current, already-pulled build) exactly which action still requires a manual reload, since the two most likely culprits already appear to self-refresh.

2. **B-11's player-splitting UX (blocks estimating B-11 precisely):** "manual, or random" is settled per the feedback itself (both should exist), but not yet: can the captain _edit_ a random split afterward before starting, or is it one or the other per attempt? Does an odd player count (uneven teams) need a specific handling rule, or is that left to the captain's judgment?

3. **B-11's relationship to the persistent `teams` entity:** does a room's roster ever get offered as "save this group as a team" afterward (reusing v1's A-11 copy-a-team precedent), or is a room always fully ad-hoc and disposable once the match starts? Affects whether B-11 needs any linkage to module 2.5 at all.

---
