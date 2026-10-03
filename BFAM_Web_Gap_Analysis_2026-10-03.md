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

| ID    | Item                                                                                                   | PRD ref                                                   | Backend       | Notes                                                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| AW-1  | **Admin Overview** landing page (total + active users, turfs, bookings, matches, revenue, tournaments) | §30.10 Must-have                                          | Partial       | Reports endpoint already has bookings, revenue, refunds and active counts. Missing: total users, matches by status, tournaments. |
| AW-2  | **User management beyond players** — owners, staff, captains; account status; suspend / activate       | §9.1, §30.10 Must-have                                    | Needs backend | Only a player list endpoint exists.                                                                                              |
| AW-3  | **Complaint / dispute handling** (support tickets)                                                     | §9.1                                                      | Ready         | Admin-only ticket status-update endpoint exists; no web UI.                                                                      |
| AW-4  | **Promo code management** — create, list, deactivate                                                   | §9.1 (Rewards config)                                     | Ready         | `POST /admin/promo-codes` exists; no listing / UI.                                                                               |
| AW-5  | **BFAM ID reservation** — lock, assign, unlock premium IDs                                             | PRD §12.59                                                | Ready         | Three admin endpoints exist; no UI.                                                                                              |
| AW-6  | **Audit log viewer**                                                                                   | Audit-log backlog (G-24)                                  | Partial       | `audit_logs` table and service exist; needs a list endpoint + UI.                                                                |
| AW-7  | **Payment & refund oversight** across UPI, gateway and cash                                            | §9.1                                                      | Needs backend | Nothing admin-side; owner payments list is owner-scoped only.                                                                    |
| AW-8  | **Rewards / ratings / membership configuration**                                                       | §9.1                                                      | Needs backend | Mobile has Rewards and Membership; nothing configures them.                                                                      |
| AW-9  | **Tournament management** — create, registrations, fixtures, results, points table                     | §9.1, §30.10 Should-have                                  | Needs backend | No tournament entity exists. Largest item in this document.                                                                      |
| AW-10 | **Fuller analytics** — cancellation / no-show breakdown, peak hours, customer growth, trends, charts   | §23.1, §23.2, §30.10                                      | Needs backend | Today's report is 9 totals with no time dimension.                                                                               |
| AW-11 | **Turf approval + pricing edit + performance**                                                         | §30.10 ("approve, manage, suspend; pricing; performance") | Partial       | Suspend / reactivate exist. Approve flow, pricing editor and per-turf performance do not.                                        |
| AW-12 | **Platform settings**                                                                                  | §9.1                                                      | Needs backend |                                                                                                                                  |
| AW-13 | **Home content beyond banners** (sliders / offers)                                                     | Backlog E-7                                               | Partial       | Banners CMS only.                                                                                                                |

### 2.2 Turf Owner Web (PRD §9.2, §22.1, §30.9)

| ID    | Item                                                                                                      | PRD ref            | Backend       | Notes                                                                                                      |
| ----- | --------------------------------------------------------------------------------------------------------- | ------------------ | ------------- | ---------------------------------------------------------------------------------------------------------- |
| OW-1  | **Revenue & booking dashboard** — revenue, bookings, occupancy, peak hours, cancellation, customer growth | §9.2, §23.1, §30.9 | Needs backend | Dashboard today is a venue / turf list. No owner analytics endpoint.                                       |
| OW-2  | **Cash payment reconciliation** alongside digital payments                                                | §9.2               | Ready         | `POST /payments/cash` exists; the Payments page is a read-only list.                                       |
| OW-3  | **Booking actions & detail** — view customer + payment status, cancel, upcoming vs past                   | §30.9              | Partial       | Cancel exists on the player side; owner-facing detail / cancel needs checking. Today's Bookings is a list. |
| OW-4  | **Availability calendar view** (slots, blocks, maintenance, holiday schedule)                             | §30.9              | Ready         | Block create / list / remove are in the turf editor; no calendar view.                                     |
| OW-5  | **Customer management**                                                                                   | §9.2               | Needs backend | No customer endpoint.                                                                                      |
| OW-6  | **Occupancy & analytics dashboards**                                                                      | §9.2               | Needs backend | Same dependency as OW-1.                                                                                   |
| OW-7  | **Tournament management for their turf**                                                                  | §9.2               | Needs backend | Depends on AW-9.                                                                                           |
| OW-8  | **Offers**                                                                                                | §22.1              | Partial       | Generic promo codes exist; no owner-scoped offers.                                                         |
| OW-9  | **Maintenance tracker** (tasks with status, not just a block reason)                                      | §22.1              | Needs backend | Maintenance is only a reason on an availability block.                                                     |
| OW-10 | **Staff permissions + staff activity**                                                                    | §22.2, §30.9       | Needs backend | UI can assign / remove staff and review verification; no permissions or activity log.                      |
| OW-11 | **Web live-scoring console**                                                                              | §9.2 / §9.3        | Ready         | Scoring endpoints exist (used by mobile). Only the display page exists on web.                             |
| OW-12 | **Match Management actions** (players, teams, status, scoring)                                            | §30.9              | Partial       | Page is a list.                                                                                            |

### 2.3 Turf Staff Web (PRD §9.3, §22.2–22.3)

| ID   | Item                                                                                                    | PRD ref     | Backend       | Notes                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------- | ----------- | ------------- | ---------------------------------------------------------------------------------------------------- |
| SW-1 | ✅ **DONE (Phase 1)** — **Desk check-in** — mark Checked in / Late / No-show per booking and per player | §9.3, §22.3 | Ready         | Attendance logic exists in the backend (used by Staff Mobile). Staff Web has no actions.             |
| SW-2 | ✅ **DONE (Phase 1)** — **Cash collection** at the desk                                                 | §9.3 / §17  | Ready         | `POST /payments/cash`.                                                                               |
| SW-3 | **Match management + turf-managed live scoring**                                                        | §9.3        | Ready         | Match Operations is a table; no scoring console. Shares work with OW-11.                             |
| SW-4 | ✅ **DONE (Phase 1)** — **Booking verification** (QR / confirmation lookup)                             | §22.3       | Partial       | Verification page is for the staff member's own ID document, not for verifying a customer's booking. |
| SW-5 | **Turf status** (open / closed for the day)                                                             | §22.2       | Needs backend |                                                                                                      |
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
