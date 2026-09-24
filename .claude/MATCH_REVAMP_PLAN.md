# Match creation / toss / scoring / result revamp — plan & research notes

Requested 2026-09-24 after the user tested on a real phone and compared against
the Gully Crix app (reference screenshots). This file records the findings and
the phased plan so work can resume from it.

## Problems found in the current flow (from code + user report)

1. **Result is manual.** `finish-match` -> `/result` shows a form (result type,
   winning side, margin, POTM). The scoring data already determines all of it.
2. **Result page shows the BFAM ID** ("Player of the Match: BFDEMO16300602") —
   backend `getMatchResult` only returns `player_of_the_match_bfam_id`. The page
   itself is a plain stack of grey cards.
3. **Sides are unknown until after the toss.** `createMatch` always makes two
   anonymous `match_teams` rows (TEAM_A / TEAM_B, no name). Players are only
   assigned to a side on the _Start Innings_ screen, i.e. after the toss has
   already been recorded as "Team A won". Nobody knows who Team A is.
4. **Scoring assumes two batters.** Box cricket is often single-batter (no
   non-striker). `isAllOut` also assumes size-1 wickets ends an innings.
5. **After a wicket nothing asks who comes in.** The dismissed end is cleared
   and the scorer must open a picker row.
6. Scoring UI is a long scroll of pickers + run buttons; the toss UI is a small
   chip form. Reference app: red score header, ball bubbles, big run pad,
   WKT button, coin-toss with caller/call, "Start a match" setup page.

## Design decisions

- Keep BFAM theme (brand red #D80000 / black / white); the reference's scoring
  screen is already red-on-black so its layout maps 1:1. No green.
- **Teams are named and known up front.** New `match_teams.team_name`
  (COALESCE'd with the real team's name for team-vs-team matches, else the
  "Team A/B" label). A new **Match Setup** screen runs _before_ the cinematic
  intro: name both teams, put every player on a side (with an Auto-balance
  button reusing `domain/teamBalance.ts`), overs, rules, then Start.
- Order becomes: Setup (teams+rules) -> Countdown -> Playing XI (by team name)
  -> Toss (caller / call / coin) -> Scoring. Start Innings screen no longer asks
  for side assignment.
- **Rules** exposed at setup are only ones the backend really implements:
  extras count toward score (existing A-8), single batter / no non-striker
  (new `matches.no_non_striker`), overs. "Free hit" and "change overs mid-match"
  from the reference are NOT included (no backing logic; would be fake toggles).
- **Single-batter mode** default ON for new matches (BFAM = turf/box cricket),
  OFF for pre-existing matches (column default false). With it: no strike
  rotation, one batter at the crease, innings ends when _every_ batter is out
  (cap = team size, not size-1).
- **Auto result** = pure `computeMatchOutcome` (2nd innings vs 1st: win by
  runs / wickets remaining, tie, or no-result if <2 innings) + server-side
  Player of the Match (runs + 20 x wickets, tie -> winning side). `POST
/matches/:id/result` with no body auto-finalizes and is idempotent; the manual
  fields stay accepted by the API (override) but no UI collects them.
- Result screen shows the POTM by **name** (falls back to BFAM ID only when the
  player never set a name) with their line, both innings as score cards.
- Wicket flow: type -> (run-out: who) -> **"Who's coming in?"** sheet listing
  remaining batters; auto-picks when only one is left.
- Redo from the reference is skipped (backend only supports undo).

## Status (2026-09-24) — A, B and C are DONE, committed and pushed

- **A** — auto result (`domain/matchOutcome.ts`, idempotent POST /matches/:id/result
  with no body), premium result screen (winner, both scores, Player of the Match
  by NAME + stats), `match_teams.team_name`, `matches.no_non_striker` migration
  (20260925000000), PATCH /matches/:id/setup.
- **B** — Match Setup screen (`[matchId]/setup.tsx`: team names, per-player side
  assignment, skill auto-balance, overs, single-batter + extras rules); Game
  Room "Start Match" now goes there first; intro XI reveal + toss use team
  names; toss = caller -> heads/tails -> coin -> bat/bowl first (manual entry
  still available).
- **C** — scoring screen rebuilt (`[matchId]/scoring.tsx`): red score header,
  this-over ball bubbles (from `getLiveScore.current_over_balls`), WKT + extras
  - run pad, "more runs" 7-12 sheet, one-tap wicket types, "Who's coming in?"
    (lone remaining batter walks in automatically), next-bowler prompt at over
    end, ends change at over end, single-batter mode (backend all-out cap =
    team size; no strike rotation), crease restored from the last ball on
    reopen (`src/lib/crease.ts`), undo restores the crease
    (`undoBall.undone_event`).

Verified by hand on the real stack (MySQL + backend + mobile-web): setup ->
toss -> scoring (single batter, wicket, over end, chase) -> Finish Match ->
auto result "OWLS WON by 2 wickets", Player of the Match "Aditya Shah".

### Known gaps / follow-ups (not done)

- Fielder (catch/run-out credit) is still not collected; POTM ignores fielding.
- "Free hit" and "change overs mid-match" gully rules from the reference app are
  NOT implemented (no backing logic; would be fake toggles).
- Redo (reference app) skipped — backend only supports undo.
- A newly chosen batter is not persisted until a ball is bowled, so reopening
  right after a wicket asks "who's coming in?" again.
- The bottom tab bar is still visible on setup/intro/scoring/result (they sit
  inside the tabs group).
- Old matches (created before this) default to two-batter mode
  (`no_non_striker = false`); their old manual results (e.g. a WIN with no
  winning side) are left as recorded.
- 401 on an expired session shows "Could not load this match" instead of
  sending the user to login (pre-existing app-wide behaviour).

## Original phases

- **A** — auto result + premium summary + team names/migration (this file's
  first commit).
- **B** — Match Setup screen, sides-before-toss, coin-toss UI with names,
  setup endpoint, Start Innings simplified.
- **C** — scoring screen redesign, single-batter mode (backend + UI), next
  batter prompt, bowler prompt at over end, "more runs" picker.
