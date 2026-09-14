# BFAM — Testing Feedback & Backlog (v3)

**Source:** Founder's own hands-on testing after v2's items and the second contributor's Part B/B-11/SDK-57 work were merged into `main`.
**Status:** Documentation only. Nothing in this file has been implemented yet — same convention as v1/v2: every item restates the feedback in plain terms, notes what is actually true in the codebase today (verified against the code, not assumed), and proposes a change.
**Numbering:** Continues v2's running numbers — this doc picks up at **A-20** and **B-12**.

Scope decisions already settled with the founder for this round (asked up front, not assumed):

- **Player of the Match (A-24):** a simple points formula (runs + wickets, with bonuses), not a reuse of the Skill Rating math.
- **All-out threshold (A-21):** based on however many players actually got assigned to that side _this match_ (already tracked since A-10), not a new fixed "team size" field.
- **Extras "disappeared" (A-25):** the founder's read is that this used to work and broke after the latest pull — see that item for what I could and couldn't verify.
- **Player Search "Turfs" (B-12):** the founder's clarification was "available turf for the booking" — I've written up my best-effort reading of that below, but flagged it in Part C since I'm not fully certain I have it right.

---

## Part A — Phase 2 Refinements (continued from v2)

### A-20. Ask who got out and who's coming in on a wicket; block a dismissed batter from being selected again

**Feedback:** "While recording a wicket, the system should ask which batter is getting out and which batter is coming in. The batter who gets out must not be allowed to bat again — currently the dismissed batter can still be selected."

**Verified current state:** Confirmed — `confirmWicket()` in `scoring.tsx` submits the wicket with no `dismissed_player_id` at all (the backend's `RecordBallInput` has an optional `dismissed_player_id` field, but nothing in this UI ever sets it, so the backend's own fallback — "the striker is out" — is always what's recorded). After a wicket, the screen just clears the striker slot (feedback A-7) and forces a fresh pick from the **same full batting-side list** — there's no tracking anywhere of who's already been dismissed, so a previously-out batter shows up as selectable again exactly like anyone else.

**Proposed change:** Two parts. (1) On confirming a wicket, if it's a run-out, let the organizer pick _which_ batter (striker or non-striker) was actually dismissed — for every other wicket type the striker is already correct, so this only needs to surface for RUN_OUT. (2) Track dismissed players for the innings (derivable from `score_events` where `is_wicket = true`, or simplest: maintain it client-side alongside the existing `overBalls` local state, reset on a new innings) and filter them out of the striker/non-striker picker options for the rest of that innings — the same `optionsForSide` filtering this screen already does for team-side (A-10) gets a second filter layered on. No backend/schema change needed — `dismissed_player_id` already exists and is already accepted by `recordBall`, it's just never populated by this screen today.

---

### A-21. Cap wickets at (assigned players on that side − 1) and auto-declare all out

**Feedback:** "The number of players in a team is 8, but the falling-wickets count currently goes up to 12. The wicket count should be limited to the team size, and the innings should auto-declare all out at total players − 1 (e.g. 7 wickets for an 8-player side)."

**Verified current state:** Confirmed — there is no wicket cap anywhere. `applyBall`/`recordBall` just keep incrementing `total_wickets` forever; nothing checks it against how many players are actually on the batting side, and nothing ever marks an innings `COMPLETED` for any reason (this is the same underlying gap already documented in v2's **A-19**, which covers the target-reached case — this item is the all-out case of the same problem). Per the founder's decision, "team size" here means the count of players actually assigned to that batting side for this match (`match_players.match_team_id`, tracked since backlog A-10), not a new separate setting — so an 8-a-side match with only 7 confirmed and assigned would auto-end at 6 wickets, not 7.

**Proposed change:** In `recordBall`, alongside A-19's target-reached check, also check `total_wickets >= (assignedBattingPlayers - 1)` after applying a ball; if hit, mark the innings `COMPLETED` the same way. This and A-19 should be built together — they're the same "does this innings need to end right now" check, just three different trigger conditions (target chased / all out / overs complete) landing on the same outcome.

---

### A-22. Show run rate, bowler economy, and other match statistics at the end of the match

**Feedback:** "At the end of the match, the statistics section should display run rate, bowler economy, and other relevant batting and bowling statistics."

**Verified current state — the underlying numbers already exist, they're just not shown together at match end:** `Scorecard` (from `getScorecard`) already includes bowling `economy` per bowler (and it's already rendered per-innings on the Scorecard screen), plus batting figures, extras, and fall of wickets. `LiveScore` already computes `current_run_rate`/`required_run_rate` during a live innings. What's missing: the actual **end-of-match** screen (`result.tsx`) shows none of this — its "Statistics" button routes to `/player-statistics`, which is the _viewing user's own lifetime_ stats (module 2.10), not a summary of _this match_. There's also no team-level run rate (runs ÷ overs) computed or shown anywhere, even though it's trivial to derive from data the scorecard already returns.

**Proposed change:** Add a match-summary stats block to the Result screen (and/or make it more prominent on the Scorecard, which a viewer likely reaches from Result anyway) — each innings' run rate (`total_runs / overs_completed`, computed client-side from data already fetched), each bowler's economy (already computed server-side, just needs surfacing here), and highlight the top batting/bowling performances. Since the raw numbers already exist end-to-end, this is a display-only addition, not a new stats pipeline.

---

### A-23. Remove the "Watching Live" active-viewer count, keep only total views

**Feedback:** "Remove the 'Watching Live' count and keep only the total views count."

**Verified current state:** Confirmed exactly — `ViewerCountBadge.tsx` (module 2.9) renders both `{active} Watching Live` and `· {total} total views` side by side, fed by a Redis-backed presence set (`active`) and a separate lifetime session counter (`total`).

**Proposed change:** Remove the `active`/"Watching Live" text from the badge, keeping only the total-views count. The underlying active-presence tracking (join/leave/heartbeat socket events, the Redis presence set) is more infrastructure than just this one badge — recommend leaving that machinery in place (it's cheap to keep running and could feed something else later) and only removing the display, unless the founder specifically also wants the heartbeat/presence traffic itself stopped to save resources.

---

### A-24. Automatically select Player of the Match

**Feedback:** "At the end of the match, the system should automatically select the Player of the Match based on overall performance — batting, bowling, fielding, and other relevant statistics."

**Verified current state:** Confirmed — Player of the Match is a fully manual pick today. `result.tsx` shows a chip-select of every player and the organizer picks one by hand; `finalizeMatch` just stores whatever `player_of_the_match_id` it's given, with zero computation involved.

**Proposed change (per founder's choice — a simple points formula):** Compute a per-player score from data already available in the scorecard/score-events for this match — e.g. 1 point per run, a fixed bonus per wicket (a common convention is ~20-25 points/wicket to make bowling roughly comparable to a useful batting innings), a smaller bonus per catch/run-out/stumping, then the highest total across all players in the match wins. Pre-fill the Result screen's Player of the Match selection with this computed winner (still shown as a normal chip-select, not locked) so the organizer can see and override it rather than the system silently deciding unreviewable — matches how a real Player of the Match award is usually presented as computed-then-confirmed rather than blindly automatic.

---

### A-25. Extras option missing since the latest pull

**Feedback:** "The option to count and record extras has disappeared. Restore it so wides, no-balls, byes, leg-byes, and other extras are correctly added to the team score and reflected in match statistics." Follow-up: this used to work and the founder believes it broke specifically after the last `git pull`.

**Verified current state — I could not reproduce a missing extras feature by reading the code:** The Extras row (WIDE / NO BALL / BYE / LEG BYE buttons) is present in `scoring.tsx` exactly as before, the scoring math (`domain/scoring.ts`) correctly adds extras to the total by default, and the Scorecard screen already renders an extras breakdown (`Wide N · No Ball N · Bye N · Leg Bye N`) per innings. I specifically re-diffed the pre-merge and post-merge versions of `scoring.tsx` to check my own merge resolution didn't silently drop anything from either side, and the Extras section is identical in both.

The one thing that **does** only conditionally appear, by design: the "Extras count toward the score" toggle (backlog A-8) only shows on the pre-first-innings setup screen, and only for a _first_ innings that hasn't started yet — reopening an in-progress or completed match, or starting a second innings, won't show that toggle again (the backend rejects changing it after any innings exists). If what "disappeared" is specifically that toggle rather than the WIDE/NO BALL/BYE/LEG BYE buttons themselves, that's expected behavior, not a bug.

**Next step:** please re-check on the current build (after the latest pull + a fresh install/rebuild, since the coin-toss and Scoring UI feedback earlier this cycle both turned out to be stale-build issues) and, if it's still missing, tell me exactly which screen and which specific element isn't there — I don't want to "fix" a bug I can't actually locate in the code.

---

### A-26. Clicking "Start Match" again resets the countdown/toss/scoring for everyone

**Feedback:** "After a match has already started, clicking 'Start Match' again shouldn't restart the whole setup — currently it re-triggers the countdown, toss, etc. Match state (countdown, toss, innings, score, players) needs to be persistent and synced for everyone, not resettable by clicking Start Match again."

**Verified current state — a real bug, and I found the exact cause in three places:**

1. **The Game Room screen's "Start Match" button** just navigates to `/intro` unconditionally — there's no check anywhere for whether this match has already been started.
2. **The Match Intro screen always begins at `COUNTDOWN`** — `const [stage, setStage] = useState<Stage>('COUNTDOWN')` is the component's initial state on _every_ mount, with no check of what stage the match is actually already at (toss done? already live-scoring?) before starting the countdown timer locally.
3. **The backend makes it worse for everyone else, not just the person who clicked it twice:** `matchIntroService.startIntro` is correctly idempotent about the data (it won't re-insert the `match_intro` row or re-send notifications on a second call — that part already has an `isFirstStart` guard) — but it unconditionally calls `broadcastStage(matchId, 'COUNTDOWN', { players })` on _every_ call, re-entry or not. That socket event forces every other connected client (viewers, the other captain, anyone with Live Score open) back to the COUNTDOWN stage visually, even mid-toss or mid-innings, purely because one person re-opened `/intro`.

Underlying all of this: `matches.match_status` already has an `IN_PROGRESS` value defined in the schema/type (`MatchStatus`), but **nothing in the codebase ever transitions a match into it** — it's an unused state that already exists and just needs to actually get set.

**Proposed change:** (1) Set `match_status = 'IN_PROGRESS'` the first time `startIntro` runs for a match. (2) Only call `broadcastStage(..., 'COUNTDOWN', ...)` on `isFirstStart` — a re-entry should resync the caller to wherever the match actually is, not force a restart broadcast to everyone. (3) On the Intro screen, resolve the correct initial `stage` from the current intro/toss/innings state (via the data `getIntroContext`/`getLiveScore` already return) instead of hardcoding `COUNTDOWN`, so reopening `/intro` (or a second click of Start Match) resumes in place. (4) On the Game Room screen, once `match_status` is `IN_PROGRESS`, change the button to something like "Resume Match" and route straight to the correct current screen (Intro if still mid-toss, Scoring/Live if innings are underway) instead of always going through `/intro`.

---

## Part B — Phase 3 / New Subsystems (continued from v2)

### B-12. Player Search from the Home top nav

**Feedback:** "On the Home Page, add a player search option in the top navigation bar. Users should be able to search for a player and view their profile, turfs, matches, and other relevant information."

**Verified current state:** No search-by-name/BFAM-ID capability exists anywhere — `GET /players/:playerId` (backlog B-10, already built) looks up a player by an ID you already have, it can't be used to find someone. There's no search input on the Home tab's top nav today. The public profile a search would presumably land on (`profileService.getPublicProfile`) currently returns only identity/skill fields (name, BFAM ID, photo, city, playing role, batting/bowling style, skill rating, follow counts) — no match history, no turf history, nothing booking-related.

**Proposed change:** A search bar in the Home top nav (name and/or BFAM ID), backed by a new backend search endpoint (`GET /players/search?q=...`, simple `LIKE` match against `full_name`/`bfam_id`, paginated) landing on the existing public-profile screen. Per the founder's clarification ("available turf for the booking"), the profile view reached from search should also surface turfs currently available to book — most likely meaning it links out to (or embeds) the existing Discover/turf-listing flow rather than showing a history of turfs this specific player has played at. **I'm not fully confident I've read this correctly — see Part C.**

---

### B-13. Team vs Team Challenge Mode

**Feedback:** "Add a Team vs Team Challenge Mode — one team can challenge another for a match. The challenged team can accept or reject. There should also be an option to mark a team as 'Open for Challenge' so other teams can challenge them."

**Verified current state:** Nothing like this exists anywhere in the codebase today (confirmed by search — no "challenge" concept at all). This is a genuinely new subsystem, distinct from both existing match-creation paths:

- The original book-first flow (module 2.6): a captain books a turf, then creates a match and invites individual players.
- **B-11** (already built this cycle): a captain assembles an ad-hoc _room_ of individual players lobby-style, then books a turf for that room.

Challenge Mode is a third path, at the **team** level rather than the individual-player level: Team A's captain picks Team B and sends a challenge; Team B's captain accepts or declines; on accept, the flow presumably continues into a turf-booking step similar to the other two paths. "Open for Challenge" is a new boolean/state on the existing `teams` table (`is_open_for_players` already exists as a precedent for exactly this shape of flag).

**Proposed change — needs real scoping, not just a build:** at minimum: (1) a `team_challenges` entity (challenger team, challenged team, status: PENDING/ACCEPTED/DECLINED/EXPIRED, timestamps); (2) an endpoint for a captain to send a challenge to another team, and for the challenged captain to accept/decline; (3) an `is_open_for_challenge` flag on `teams`, and a discovery surface for it (a new list, or folded into the existing Open Teams screen); (4) on accept, hand off into the same turf-booking → match-creation → invite pipeline the other two flows already use, with both full rosters pre-populated instead of inviting player-by-player. Recommend scoping this alongside **B-11**, since both are "how does a match actually get created" variations and likely want to share the same booking/match-creation tail end rather than three independently-built paths that happen to converge on the same Match Intro screen.

---

## Part C — Decisions Needed Before Scoping

1. **Player Search "Turfs" meaning (blocks precise scoping of B-12):** the founder's answer was "available turf for the booking," which I've read as "the searched player's profile should surface turfs currently available to book" rather than "which turfs has this player played at before." I'm genuinely not certain that's the right reading — worth a quick confirm (a sentence or a sketch of what you picture on that screen) before this gets built, since the two interpretations are different features.

2. **A-25 (extras) needs a live repro on the current build.** I could not find a code-level regression — the Extras UI, the scoring math, and the Scorecard breakdown are all present and look correct in both the pre- and post-merge versions of the file. Please re-check after the latest pull and, if still missing, name the exact screen/steps.

3. **A-24's point weights** (runs = 1pt, wicket = ~20-25pts, catch/run-out/stumping = a smaller bonus) are my own reasonable-default numbers, not something the founder specified — worth a quick sanity check once this is actually built and testable against a real match, rather than treating the exact numbers as locked in from this document alone.

---
