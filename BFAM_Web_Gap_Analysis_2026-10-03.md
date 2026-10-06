# BFAM — Web App Gap Analysis & Build Plan

**Date:** 2026-10-03
**Scope:** The Next.js web app (`apps/web`) — Admin Web, Turf Owner Web and Turf Staff Web.
**Compared against:** `BFAM_PRD_v2.2.md` §9 (Web Dashboards), §22 (Turf Owner & Staff Management), §23 (Analytics), §30.9–30.10 (screen lists), checked against the web pages in `apps/web/src/app` and the routes in `apps/backend/src`.
**Supersedes (for the web only):** the Admin Panel notes in `BFAM_Gap_Analysis_and_TODO.md` and `BFAM_Remaining_Backlog_2026-09-23.md`, which still list E-2 through E-6 as unbuilt. They have since been built (see "Current state").

**How this was produced:** by reading the code — page files, the API client and backend route files. The web app was not run. Where a page looks read-only, that is inferred from its size and the calls it makes; confirm before building.

**Legend** — Backend column: **Ready** = the endpoint exists and only a web page is needed · **Partial** = some backend exists · **Needs backend** = nothing exists yet.

---

## 1. Current state (what is already built)

### Admin Web — 7 sections

| Page         | What it does                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Players      | Player directory                                                                                                                     |
| Matches      | Cross-organizer match list, force-cancel                                                                                             |
| Turfs        | Cross-owner turf list, suspend / reactivate                                                                                          |
| Teams        | Cross-captain team list, archive / reactivate                                                                                        |
| Reviews      | Cross-turf review list, delete                                                                                                       |
| Home Banners | Create / edit / delete home carousel banners                                                                                         |
| Reports      | 9 headline tiles: total / cancelled bookings, cancellation rate, revenue, refunds, matches completed, active players / turfs / teams |

`/admin` itself only redirects to Players.

### Turf Owner Web

| Page                | What it does                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| Dashboard           | Lists venues and turfs, links to create / edit                                                 |
| Venues (new / edit) | Create and edit venues, assign turfs to venues                                                 |
| Turfs (new / edit)  | Details, pricing, operating hours, availability blocks, copy-from-another-pitch, stadium sound |
| Today's Bookings    | List                                                                                           |
| Match Management    | List                                                                                           |
| Payments            | List                                                                                           |
| Staff Management    | Assign / remove staff, review staff verification                                               |
| Scoreboard          | Live match picker + full-screen LED/TV display (socket-driven)                                 |

### Turf Staff Web

| Page             | What it does              |
| ---------------- | ------------------------- |
| Today's Bookings | Table: turf, time, status |
| Match Operations | Table                     |
| Verification     | Upload ID document        |

---

## 2. Gaps by portal

### 2.1 Admin Web (PRD §9.1, §30.10)

| ID    | Item                                                                                                                           | PRD ref                                                   | Backend        | Notes                                                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| AW-1  | ✅ **DONE (Phase 3)** — **Admin Overview** landing page (total + active users, turfs, bookings, matches, revenue, tournaments) | §30.10 Must-have                                          | Partial        | Reports endpoint already has bookings, revenue, refunds and active counts. Missing: total users, matches by status, tournaments. |
| AW-2  | **User management beyond players** — owners, staff, captains; account status; suspend / activate                               | §9.1, §30.10 Must-have                                    | Needs backend  | Only a player list endpoint exists.                                                                                              |
| AW-3  | ✅ **DONE (Phase 3)** — **Complaint / dispute handling** (support tickets)                                                     | §9.1                                                      | Ready          | Admin-only ticket status-update endpoint exists; no web UI.                                                                      |
| AW-4  | ✅ **DONE (Phase 3)** — **Promo code management** — create, list, deactivate                                                   | §9.1 (Rewards config)                                     | Ready          | `POST /admin/promo-codes` exists; no listing / UI.                                                                               |
| AW-5  | ✅ **DONE (Phase 3)** — **BFAM ID reservation** — lock, assign, unlock premium IDs                                             | PRD §12.59                                                | Ready          | Three admin endpoints exist; no UI.                                                                                              |
| AW-6  | ✅ **DONE (Phase 3)** — **Audit log viewer**                                                                                   | Audit-log backlog (G-24)                                  | Partial        | `audit_logs` table and service exist; needs a list endpoint + UI.                                                                |
| AW-7  | ✅ **DONE (Phase 8)** — **Payment & refund oversight** across UPI, gateway and cash                                            | §9.1                                                      | Needs backend  | Nothing admin-side; owner payments list is owner-scoped only.                                                                    |
| AW-8  | ✅ **DONE (Phase 8)** — **Rewards / ratings / membership configuration**                                                       | §9.1                                                      | Needs backend  | Mobile has Rewards and Membership; nothing configures them.                                                                      |
| AW-9  | ✅ **DONE (Phase 6)** — **Tournament management** — create, registrations, fixtures, results, points table                     | §9.1, §30.10 Should-have                                  | Needs backend  | No tournament entity exists. Largest item in this document.                                                                      |
| AW-10 | ✅ **DONE (Phase 5)** — **Fuller analytics** — cancellation / no-show breakdown, peak hours, customer growth, trends, charts   | §23.1, §23.2, §30.10                                      | Needs backend  | Today's report is 9 totals with no time dimension.                                                                               |
| AW-11 | ✅ **DONE (Phase 7)** — **Turf approval + pricing edit + performance**                                                         | §30.10 ("approve, manage, suspend; pricing; performance") | Partial        | Suspend / reactivate exist. Approve flow, pricing editor and per-turf performance do not.                                        |
| AW-12 | **Platform settings**                                                                                                          | §9.1                                                      | Done (Phase 9) |                                                                                                                                  |
| AW-13 | **Home content beyond banners** (sliders / offers)                                                                             | Backlog E-7                                               | Partial        | Banners CMS only.                                                                                                                |

### 2.2 Turf Owner Web (PRD §9.2, §22.1, §30.9)

| ID    | Item                                                                                                                              | PRD ref            | Backend       | Notes                                                                                                      |
| ----- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------- | ---------------------------------------------------------------------------------------------------------- |
| OW-1  | ✅ **DONE (Phase 5)** — **Revenue & booking dashboard** — revenue, bookings, occupancy, peak hours, cancellation, customer growth | §9.2, §23.1, §30.9 | Needs backend | Dashboard today is a venue / turf list. No owner analytics endpoint.                                       |
| OW-2  | ✅ **DONE (Phase 2)** — **Cash payment reconciliation** alongside digital payments                                                | §9.2               | Ready         | `POST /payments/cash` exists; the Payments page is a read-only list.                                       |
| OW-3  | ✅ **DONE (Phase 2)** — **Booking actions & detail** — view customer + payment status, cancel, upcoming vs past                   | §30.9              | Partial       | Cancel exists on the player side; owner-facing detail / cancel needs checking. Today's Bookings is a list. |
| OW-4  | ✅ **DONE (Phase 2)** — **Availability calendar view** (slots, blocks, maintenance, holiday schedule)                             | §30.9              | Ready         | Block create / list / remove are in the turf editor; no calendar view.                                     |
| OW-5  | ✅ **DONE (Phase 7)** — **Customer management**                                                                                   | §9.2               | Needs backend | No customer endpoint.                                                                                      |
| OW-6  | ✅ **DONE (Phase 5)** — **Occupancy & analytics dashboards**                                                                      | §9.2               | Needs backend | Same dependency as OW-1.                                                                                   |
| OW-7  | ✅ **DONE (Phase 6)** — **Tournament management for their turf**                                                                  | §9.2               | Needs backend | Depends on AW-9.                                                                                           |
| OW-8  | ✅ **DONE (Phase 8)** — **Offers**                                                                                                | §22.1              | Partial       | Generic promo codes exist; no owner-scoped offers.                                                         |
| OW-9  | ✅ **DONE (Phase 7)** — **Maintenance tracker** (tasks with status, not just a block reason)                                      | §22.1              | Needs backend | Maintenance is only a reason on an availability block.                                                     |
| OW-10 | ✅ **DONE (Phase 7)** — **Staff permissions + staff activity**                                                                    | §22.2, §30.9       | Needs backend | UI can assign / remove staff and review verification; no permissions or activity log.                      |
| OW-11 | ✅ **DONE (Phase 4)** — **Web live-scoring console**                                                                              | §9.2 / §9.3        | Ready         | Scoring endpoints exist (used by mobile). Only the display page exists on web.                             |
| OW-12 | ✅ **DONE (Phase 2)** — **Match Management actions** (players, teams, status, scoring)                                            | §30.9              | Partial       | Page is a list.                                                                                            |

### 2.3 Turf Staff Web (PRD §9.3, §22.2–22.3)

| ID   | Item                                                                                                    | PRD ref     | Backend       | Notes                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------- | ----------- | ------------- | ---------------------------------------------------------------------------------------------------- |
| SW-1 | ✅ **DONE (Phase 1)** — **Desk check-in** — mark Checked in / Late / No-show per booking and per player | §9.3, §22.3 | Ready         | Attendance logic exists in the backend (used by Staff Mobile). Staff Web has no actions.             |
| SW-2 | ✅ **DONE (Phase 1)** — **Cash collection** at the desk                                                 | §9.3 / §17  | Ready         | `POST /payments/cash`.                                                                               |
| SW-3 | ✅ **DONE (Phase 4)** — **Match management + turf-managed live scoring**                                | §9.3        | Ready         | Match Operations is a table; no scoring console. Shares work with OW-11.                             |
| SW-4 | ✅ **DONE (Phase 1)** — **Booking verification** (QR / confirmation lookup)                             | §22.3       | Partial       | Verification page is for the staff member's own ID document, not for verifying a customer's booking. |
| SW-5 | ✅ **DONE (Phase 8)** — **Turf status** (open / closed for the day)                                     | §22.2       | Needs backend |                                                                                                      |
| SW-6 | **Customer assistance**                                                                                 | §22.2       | Needs backend |                                                                                                      |

---

## 3. Cross-cutting web gaps

| ID  | Item                                      | Notes                                                                                                                                                                                      |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| X-1 | **Shared UI building blocks**             | Only `DashboardShell`, `BallLoader` and one data table exist. Needed: detail drawer / modal, confirm dialog, search + filters, pagination, date-range picker, toast notifications, charts. |
| X-2 | **Design consistency**                    | Web still uses the older, plainer design. The mobile redesigns (Home, Matches, Teams, Profile) have no web counterpart.                                                                    |
| X-3 | **Dashboard landing pages**               | Admin `/admin` redirects to Players. Staff has no summary page.                                                                                                                            |
| X-4 | **Test coverage**                         | 13 web test files for 23 pages. Each new page below needs tests.                                                                                                                           |
| X-5 | **Empty / error / loading states**        | Several pages swallow errors into an empty list. Needs a consistent error state.                                                                                                           |
| X-6 | **Responsive / desktop-vs-mobile polish** | PRD: owners work on desktop, staff are mobile-first on the ground. Staff Web needs to work well on a phone.                                                                                |

---

## 3.1 Phase 1 status (2026-10-03)

Phase 1 (Staff Web desk operations) is built: Today's Desk with live stats, timeline and booking lookup; per-booking drawer with roster check-in / running late / no-show (single and bulk), cash collection with reference, payment history and booking details; Match Operations with filters and a per-match roster. The shared shell (sidebar with animated active indicator, top bar, page transitions), tables, buttons and inputs were rebuilt with the `motion` and `lucide-react` packages already in the web app. Web tests: 11 new/updated for the staff pages.

---

## 3.2 Phase 2 status (2026-10-03)

Phase 2 (Owner reconciliation & booking actions) is built:

- **Bookings** (replaces Today's Bookings): Today / Tomorrow / Next 7 days / Last 7 days, turf filter, status filter, search by customer / phone / turf / ID; stat tiles (bookings, booked value, collected, outstanding); a detail drawer with customer, payment shares, payments, matches in the slot and **cancel booking** (with reason).
- **Payments & Cash**: all payments with 7 / 30 day / all-time windows, plus a **cash reconciliation** view grouped by day and by collector, a "counted" checklist (kept in the browser only — not stored on the server) and CSV export.
- **Availability**: day-by-day slot calendar per pitch (open / booked-by-whom / blocked), multi-select blocking with a reason, and one-click unblock.
- **Match Management**: filters, live/upcoming/finished tiles, match details, read-only roster, scoreboard shortcut for live matches.
- **Backend additions:** `GET /owner/bookings` (date range, max 62 days, customer + paid/due), `GET /owner/payments` now returns the collector's phone and the booking, and staff assigned to a turf can look up a booking (read-only) — this also fixes the Staff Web booking-ID lookup, which the server would previously have refused.

Not part of the original plan but noted: a persistent "reconciled" state for cash (stored server-side) would need a new table; today's checklist is a counting aid only.

---

## 3.3 Phase 3 status (2026-10-04)

Phase 3 (Admin quick wins) is built, with a new set of Admin Web pages and the endpoints behind them:

- **Overview** (`/admin`, replaces the redirect to Players): platform totals (players, owners, staff, turfs, bookings today / 7 days, 30-day revenue, live and upcoming matches, open tickets, reserved IDs), a "needs attention" list and a recent-activity feed. `GET /admin/overview`.
- **Support** (`/admin/support`): the complaint / match-dispute / injury queue with real status totals, filters, search, a detail panel and the status workflow (the server enforces valid moves; the player is notified). `GET /admin/tickets`.
- **Promo Codes** (`/admin/promos`): list with offer and rules, live / scheduled / expired / off state, create form with validation, on/off switch (audited). `POST /admin/promo-codes/:id/active`.
- **BFAM IDs** (`/admin/bfam-ids`): reserve, assign to a searched-for player, or release.
- **Audit Log** (`/admin/audit`): newest first, filter by area, paginated, expandable before → after changes. `GET /admin/audit-logs`.
- The shared API client gained all the admin methods (none existed for promo codes, BFAM IDs or tickets before).

AW-1 is only partly done as an item: the overview has no tournament figures (tournaments don't exist yet) and no trend charts (Phase 5).

---

## 4. Recommended build order

| Phase       | Work                                   | Items                                                                      | Why this order                                                                                                 |
| ----------- | -------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **1**       | Staff Web desk operations              | SW-1, SW-2, SW-4 (+ X-1 basics: confirm dialog, toasts, detail drawer)     | The PRD defines Staff Web as the desk alternative to Staff Mobile; today it can only look. All backend exists. |
| **2**       | Owner reconciliation & booking actions | OW-2, OW-3, OW-4, OW-12                                                    | Mostly UI over existing endpoints; makes the Owner portal operational, not just a viewer.                      |
| **3**       | Admin quick wins                       | AW-1 (basic), AW-3, AW-4, AW-5, AW-6                                       | Endpoints exist or nearly exist; closes the "Reports and complaint handling" and rewards-config parts of §9.1. |
| **4**       | Web live-scoring console               | OW-11, SW-3                                                                | Backend ready; one console serves both Owner and Staff.                                                        |
| **5**       | Analytics                              | OW-1, OW-6, AW-10, AW-1 (full) + charts (X-1)                              | Needs new aggregation endpoints (occupancy, peak hours, cancellation / no-show, customer growth).              |
| **6**       | Tournaments                            | AW-9, OW-7                                                                 | Largest build: new data model, fixtures / brackets, points table. Scope with the founder first.                |
| **7**       | Remaining admin & owner items          | AW-2, AW-7, AW-8, AW-11, AW-12, AW-13, OW-5, OW-8, OW-9, OW-10, SW-5, SW-6 | Each needs new backend and, for several, a product decision.                                                   |
| **Ongoing** | Cross-cutting                          | X-2 to X-6                                                                 | Fold design refresh, states and tests into each phase rather than a separate pass.                             |

---

## 5. Decisions needed before building

1. **Tournaments** (AW-9 / OW-7): format (league, knockout, both), who can create them (admin only, or owners for their own turf), registration and fee handling.
2. **Customer management** (OW-5): what "customer" means — players who have booked at the turf? What data is the owner allowed to see (privacy)?
3. **Maintenance tracker** (OW-9): is a simple task list with status enough, or is scheduling / cost tracking required?
4. **Staff permissions** (OW-10): which actions are permissioned (check-in, cash, scoring, cancel)?
5. **Admin turf approval** (AW-11): do new turfs need approval before going live? (Today owners can create turfs freely.)
6. **Web design direction** (X-2): bring the web up to the redesigned mobile look now, or after functionality is complete?
7. **Staff Web as a phone experience** (X-6): is it primarily used on phones? If so, it needs mobile-first layouts.

---

## 6. Summary

- **Built:** 23 pages — an Admin moderation / directory suite, a substantial Owner turf-management and scoreboard suite, and a thin read-only Staff portal.
- **Mostly missing:** actions (check-in, cash, cancel, reconcile), analytics, and tournaments.
- **Ready to build now (backend exists):** SW-1, SW-2, SW-3, SW-4, OW-2, OW-4, OW-11, AW-3, AW-4, AW-5.
- **Needs new backend first:** analytics, customer management, tournaments, payment / refund oversight, user management beyond players, permissions, maintenance, platform settings.

---

## 7. Update — Admin full control and account provisioning

**Done (not yet committed):**

- **Sign-up is player-only.** `/auth/register` and social sign-up refuse Turf Owner / Turf Staff (HTTP 403 / 400). The mobile role-selection screen no longer offers them; owners and staff sign in with the credentials they were given.
- **Admin creates owners, staff and admins** (Admin → Users → New account). **Owners create their own staff** (Owner → Staff Management → Create a staff account).
- **Admin → Users:** every account, filter by role, search, edit, suspend / reactivate, reset password, delete (soft). Suspension is now enforced at login (password, OTP, Google, Apple).
- **"Manage as":** the admin opens an owner's or staff member's own portal as that user (turf create / edit, pricing, hours, availability, venues, staff, bookings). A banner shows while active; writes are audit-logged under the admin.
- **Admin → Bookings:** all turfs, date range, correct a booking's status.
- **Promo codes:** edit and delete (a code already redeemed cannot be deleted — switch it off).
- **Turfs:** delete (blocked while upcoming bookings exist) and "Manage as owner".
- **Data Explorer:** browse, add, edit and delete rows in any table. Password hashes, tokens and OTPs are hidden and not editable; `audit_logs` and `payment_events` are read-only; only single-column primary keys can be written; every change is audit-logged.

**Known limits:** a suspended user's already-issued token works until it expires (about 1 hour); the Data Explorer edits values as plain text, so it is a power tool rather than a form-by-form UI.

---

## 8. Update — Phase 4: web live-scoring console

**Done (not yet committed):**

- **One console for Owner and Staff:** `/owner/scoring/[matchId]` and `/staff/scoring/[matchId]`, opened from **Score this match** in each Matches page's drawer (turf-managed matches that are not finished).
- **Flow:** begin match, toss, who bats, start innings, then ball by ball (runs 0–6, wide / no-ball / bye / leg-bye, wickets including the run-out choice, undo, swap strike). It prompts for openers, new batter and next bowler, then end innings / start the chase / finish match. Keyboard shortcuts: 0–6, W, U, X. Same crease and strike-rotation rules as the mobile scorer.
- **Permissions (backend):** for `TURF_STAFF_MANAGED` matches the turf's owner and its approved, active staff may now run the toss / setup and record balls, not only a pre-assigned scorer (`turfOperatorAccess.ts`). Player-managed matches are unchanged. Admins can use it through **Manage as**.

**Known limits:** every player must already have a side (Match Setup); the legacy "assign sides while scoring" fallback is not on web. The fielder on a catch and the Player-of-the-Match override are not captured (the result is auto-computed).

---

## 9. Update — Phase 5: analytics

**Done (not yet committed):**

- **Owner → Analytics** and **Admin → Analytics** (one shared dashboard). Date range 7D / 30D / 90D / 12M; owners can filter by turf.
- **Figures** (each with change versus the previous equal-length period): revenue, bookings, occupancy, average booking value, collected, cancellation rate, customers, new customers, no-shows.
- **Charts:** revenue / bookings over time, peak start hours, busiest weekdays, top turfs by revenue (with occupancy), payment modes, and (admin) new players per day. Built in-house in SVG, so there is no new dependency.
- **Backend:** `GET /owner/analytics` (scoped to the owner's turfs) and `GET /admin/analytics`, from `analyticsService.ts`. The SQL was run against the local database.

**Definitions (also shown on the page):** revenue = booking value of non-cancelled bookings; collected = paid obligations on those bookings; occupancy = booked time ÷ opening hours (blocks and maintenance are not subtracted); peak hours = bookings by the hour they start.

**Not included:** CSV / PDF export, custom date pickers, per-customer reports (OW-5), and tournament figures.

---

## 10. Update — Phase 6: tournaments

**Done (not yet committed):**

- **Admin → Tournaments** (platform-wide) and **Owner → Tournaments** (hosted at the owner's own turfs). An owner can manage only the tournaments they organise; an admin can manage all.
- **Formats:** league (round robin, optionally home and away), knockout (seeded bracket with byes), or league followed by a knockout (top 4 go through, or top 2 for a small field).
- **Lifecycle:** draft, open registration, start (fixtures generated and entries closed), enter results, start knockout, champion. Cancel is available until it finishes; delete only for a draft or cancelled one.
- **Teams:** captains apply (`POST /tournaments/:id/register`, needs the captain of the team) and the organiser approves or rejects. The organiser can also search for and add a team directly, set the seeding, and remove a team.
- **Entry fee:** set per tournament; each team shows Paid / Unpaid and the organiser records payment with a reference.
- **Results:** per match, win / tie / no result, runs, wickets and overs for both teams. They feed the **points table** (win 2, tie or no result 1; ties split by wins, then net run rate) and the **bracket**. A result can be reopened until the next stage has been played.
- **Backend:** migration `20261005000000-tournaments`, pure maths in `domain/tournamentEngine.ts`, `tournamentService.ts`, `routes/tournaments.ts`. Run `npm run db:migrate --workspace=apps/backend` (or just restart the backend) to create the tables.

**Known limits:**

- **No online payment yet.** Fees are recorded by the organiser (cash / UPI / transfer). Taking them through the payment gateway is a follow-up.
- **Captain registration needs the mobile app.** The endpoint exists, but there is no screen for captains yet (mobile is paused), so for now organisers add teams themselves.
- Results are typed in by the organiser; fixtures are not yet linked to the live-scoring engine, and captains are not notified.

---

## 11. Update — Phase 7: customers, maintenance, staff permissions, turf approval

**Done (not yet committed):**

- **Turf approval (AW-11).** A turf (or a venue's pitches) an owner creates now starts as _awaiting approval_ and is hidden from players. **Admin → Turfs** shows a banner, and Approve / Reject buttons (a rejection needs a reason the owner can read on their dashboard). An admin working through "Manage as" publishes straight away. Existing turfs stay live. Per-turf performance is the Admin Analytics turf filter; pricing edits are through "Manage as".
- **Staff permissions + activity (OW-10).** For each verified staff member the owner switches **check players in**, **collect cash** and **score matches** on or off (all on by default, so nothing changes until an owner decides). Enforced on the server at check-in, cash collection and the scoring console, with a clear 403 message. **Activity** lists the check-ins and cash each staff member has recorded at that turf.
- **Customers (OW-5).** **Owner → Customers**: everyone who booked at the owner's turfs, with spend, visits, cancellations and no-shows, segments (New, Regular, Lapsed, Occasional), search, sort, a turf filter, and a detail view of their bookings. Only name, phone and history at the owner's own turfs are shown (decision: no email or activity elsewhere).
- **Maintenance (OW-9).** **Owner → Maintenance**: a board (To do, In progress, Done) with priority, category, due date, assignee and cost; overdue tasks are flagged and completed cost is totalled.
- **Backend:** migration `20261006000000-phase7-owner-admin` (turf status values, `rejection_reason`, `maintenance_tasks`). Run `npm run db:migrate --workspace=apps/backend`, or restart the backend.

**Known limits:** staff permissions are checked per action across a staff member's turfs (one turf granting it is enough); staff activity covers check-ins and cash only (not individual scoring balls); owners are not yet notified when a turf is approved or rejected (they see it on their dashboard); the remaining Phase 7 items (AW-2, AW-7, AW-8, AW-12, AW-13, OW-8, SW-5, SW-6) need product decisions and were not part of this scope.

---

## 12. Update — Tournament follow-ups: online fees, mobile screens, live scoring

**Done (not yet committed):**

- **Entry fee paid online, like a turf booking.** A captain pays with **UPI** or the **payment gateway** (the same Razorpay order and webhook turf bookings use). The entry flips to _Paid online_ when the webhook confirms. **Cash** is still recorded by the host. A team that paid online cannot be removed until the host reverses the payment (no automatic refund).
- **Tournaments on the mobile app.** Profile → **Tournaments** lists tournaments (Open / Live / Finished). A tournament shows the fee and stage, **Teams**, **Fixtures**, the **Points table** and the **Bracket**. A captain can **enter their team**, **pay the fee**, and **withdraw**; anyone can **watch a live fixture**. Tournament notifications open the tournament.
- **Notifications.** Captains are told when their team is accepted or rejected, when the tournament starts, when they reach the knockout, when a match is scheduled, and when a result is in; the host is told when a fee is paid online.
- **Fixtures run on the live-scoring engine, host only.** On a fixture the host clicks **Start live match** (picks the start time, and the turf for an admin-hosted event). That books the slot, puts both squads on their sides and opens the scoring engine. **Only the tournament's host can run the toss and score it**; turf owners, turf staff and other admins are refused. When the match is finished, the **result flows into the fixture, points table and bracket automatically** (an all-out side is charged its full overs for net run rate). A fixture with a live match cannot be given a manual result until the match is finished.
- **Backend:** migration `20261007000000-tournament-payments-and-live-link` (`tournament_teams.payment_id`, `matches.tournament_id`). Run `npm run db:migrate --workspace=apps/backend` or restart the backend. New endpoints: `POST /tournaments/entries/:id/pay`, `POST /tournaments/fixtures/:id/match`.

**Known limits:** a tournament match creates a zero-amount booking at the turf, so it counts as a booking in the owner's analytics (with no revenue); a knockout match that ends tied has no winner to advance, so the host settles it by hand; there is no automatic refund when a paid team leaves; an admin who is not the host can still type results by hand but cannot start or score matches.

---

## 13. Update — Phase 8: closing the known limits and four more gap items

**Limits closed:**

- **Turf approval notifications.** The owner is notified (new `TURF_UPDATE` notification) when a turf is approved or rejected, with the reason.
- **Staff activity now includes scoring**, at match level: starting an innings and finishing a match (not every ball). Closing / reopening the turf is logged too.
- **Tournament analytics.** A tournament match's zero-amount booking still counts toward **occupancy** but is left out of booking counts, revenue, averages, customers, the charts and the owner's customer list.
- **Knockout ties.** A knockout match that ends level shows _"Tied — choose who goes through"_ to the host, with a one-tap pick per team. The finished match's runs, wickets and overs are kept, and the bracket advances. The host is notified; mobile players are told the host is deciding.

**New items built:**

- **SW-5 Turf open / closed for the day.** A switch per turf on the **staff desk** and the **owner dashboard**. Closing blocks new bookings for today (existing ones are untouched; the count is shown so those customers can be contacted). New permission **Close the turf for the day** (on by default, switchable per staff member).
- **OW-8 Owner offers.** **Owner → Offers**: discount codes for the owner's own turfs (all of them, or one). Players enter them at checkout like any code; checkout refuses them at anyone else's turf. Used offers cannot be deleted, only switched off.
- **AW-7 Payment and refund oversight.** **Admin → Payments**: every payment (UPI, gateway, cash; turf bookings and tournament entry fees) with who paid, what for, status and any refund; totals by status and method; filters, search, a Refunds view and CSV export.
- **AW-8 Rewards and membership configuration.** **Admin → Rewards**: edit the reward catalog, hand over pending redemptions (the player is notified), and manage membership plans (price, duration, discount, active members).

**Backend:** migration `20261008000000-offers-day-closed-turf-notifications` (notification type, `DAY_CLOSED` block reason, `promo_codes.owner_id` / `turf_id`). Run `npm run db:migrate --workspace=apps/backend` or restart the backend.

**Still open:** AW-12 platform settings, AW-13 home content beyond banners and SW-6 customer assistance need product decisions. The first real Razorpay payment (booking or tournament fee) still has to be tried on a phone with live keys.

## 14. Update — Phase 9: platform settings, home content, staff customer desk, staff on phones

**New items built:**

- **AW-12 Platform settings.** **Admin → Settings**: booking and refund rules (full / partial refund windows and percentage, how far ahead players can book), coin and referral values (coin worth in rupees, review and referral rewards), support and legal links, and **maintenance mode** with a message and a minimum app version. Built-in defaults equal the previous hard-coded behaviour, so nothing changes until the admin edits a value; if the settings can't be read, the defaults apply. Maintenance blocks only new bookings and online payments (with a clear message); everything else keeps working. Every change is audit-logged.
- **AW-13 Home content.** **Admin → Home Content**: pin featured offers, turfs and tournaments and write announcements, with order, on/off and optional dates. Cards point at live records, so an expired offer or suspended turf drops out by itself. The mobile Home shows a "Featured" section; the app also reads `GET /config/public` for a maintenance notice, a "please update" notice and support links.
- **SW-6 Staff customer desk.** **Staff → Customers**: look a customer up by phone or BFAM ID (only their history at your turf is shown), book a slot for a walk-in (optionally taking cash on the spot), or log a complaint on their behalf. Limited to the staff member's assigned turfs; recorded in the owner's staff activity.
- **Staff web on phones.** Below tablet width the portals show a top bar with a menu, a bottom tab bar and a slide-over menu; the staff desk shows times inside each booking card and the new Customers page is built one-column with large touch targets.

**Backend:** migration `20261009000000-platform-settings-and-home-content` (`platform_settings`, `home_content_items`). Run `npm run db:migrate --workspace=apps/backend` or restart the backend.

**Still open:** nothing from the gap list. The first real Razorpay payment still has to be tried on a phone with live keys.
