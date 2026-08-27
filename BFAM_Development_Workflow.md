# BFAM — Development Workflow & Build Checklist

**Purpose:** A phase-by-phase, module-by-module build plan for an AI-assisted IDE (Claude Code, Cursor, Windsurf, etc.) to work through. Each module is scoped so it can be handed to the IDE as one focused task, with its exact source references so the assistant pulls detail from the right document instead of guessing.

**Source documents this plan is built from** (keep all four open/attached in the IDE workspace):

- `BFAM_PRD_v2_2.md` — product requirements, feature specs, priorities (cited below as **PRD §X**)
- `BFAM_Tech_Stack_Document_v1_1.md` — approved technology choices, cited as **Stack §X**
- `BFAM_dbData_v2_compact.md` — database schema / data dictionary, cited as **DB: table_name**
- `BFAM_Design_Document.md` — colors, type, spacing, component styles, cited as **Design §X**

**Rules for working through this file:**

1. Build in the order given — later modules depend on earlier ones (e.g. Live Scoring depends on Match Creation depends on Booking depends on Auth).
2. Finish a module's checklist (including its tests) before starting the next one. Don't let the IDE jump ahead to a "more interesting" module.
3. Every screen built must follow `BFAM_Design_Document.md` tokens exactly (color palette, type scale, spacing scale, radius scale) — don't let the IDE invent new colors or spacing values.
4. Every table touched must match `BFAM_dbData_v2_compact.md` column-for-column — don't let the IDE improvise schema.
5. Check off items as they're completed (`- [x]`) so progress is visible across sessions.
6. Phase 0 and Phase 1 are prerequisites for everything else and are not optional, even though they don't produce visible screens.

---

## Phase 0 — Project Setup & Foundations

- [ ] Initialize monorepo (npm/pnpm workspaces or Turborepo) with `apps/mobile`, `apps/web`, `packages/shared-types`, `packages/api-client` (Stack §7/8)
- [ ] Scaffold `apps/mobile` with Expo + React Native + TypeScript (Stack §2)
- [ ] Scaffold `apps/web` with Next.js + TypeScript + Tailwind CSS (Stack, cross-platform architecture decision)
- [ ] Set up NativeWind in mobile app, map `BFAM_Design_Document.md` §7 Quick-Reference Token Sheet directly into `tailwind.config` (colors, spacing, radius) for both mobile and web so tokens are shared
- [ ] Install and configure the Anton/Archivo Black display font + Inter UI font per Design §2
- [ ] Set up ESLint + Prettier + Husky/lint-staged shared config (Stack §8.2)
- [ ] Set up Docker Compose for local MySQL + Redis (Stack §7.3)
- [ ] Initialize backend service (`apps/backend` or `services/api`): Node.js + Express + TypeScript
- [ ] Configure Sequelize + MySQL connection, run first migration scaffold
- [ ] Configure Socket.IO server skeleton (health-check namespace only, for now)
- [ ] Set up environment config (`.env.example` per environment: dev/staging/prod) — never commit secrets
- [ ] Set up GitHub Actions CI (lint, type-check, test on PR) (Stack §8.3)
- [ ] Set up Sentry (or equivalent) error tracking for mobile + backend

**Definition of done:** empty app boots on Android + iOS + web, backend responds to a health-check endpoint, CI passes on a trivial PR.

---

## Phase 1 — Backend Foundation (Database + Core Services)

Build the database and shared backend plumbing before any feature module. Use `BFAM_dbData_v2_compact.md` as the literal schema source — every migration below should match it column-for-column.

- [ ] Migration: `users` (incl. `bfam_id` allocator groundwork, `google_id`, `apple_id`, `is_minor`) — DB: users
- [ ] Migration: `players` (incl. `bfam_id`, `favorite_cricketer_name`, `favorite_cricketer_external_id`) — DB: players
- [ ] Build the atomic BFAM ID allocator (DB row lock or Redis `INCR`, starting at `BF1000`) — PRD §12.59
- [ ] Migration: `teams`, `team_members`, `team_invitations`, `team_join_requests` — DB: teams, team_members, team_invitations
- [ ] Migration: `turfs`, `turf_pricing`, `turf_staff_assignments`, `turf_availability_blocks`, `turf_images`, `turf_facilities`, `turf_operating_hours` — DB: turfs
- [ ] Migration: `bookings` — DB: bookings (composite unique constraint on turf+date+slot — no double-booking, PRD §15)
- [ ] Migration: `matches`, `match_teams`, `match_players`, `match_invitations`, `player_replacements` — DB: matches
- [ ] Migration: `payment_obligations`, `payments` (incl. `CASH` mode, `collected_by`, `cash_reference`), `payment_allocations`, `refunds` — DB: payments
- [ ] Migration: `innings`, `score_events` (incl. `audio_trigger`), `match_results`, `player_match_statistics` — DB: score_events
- [ ] Migration: `player_rating_events` — DB: player_rating_events
- [ ] Migration: `match_intro`, `live_match_sessions` — new v1.1 tables
- [ ] Migration: `notifications`, `audit_logs`, `support_tickets`
- [ ] Set up JWT auth middleware + role-based access control (Player / Turf Owner / Turf Staff / Admin) (PRD §7)
- [ ] Set up shared validation layer (zod/joi) matching each table's domain/allowed-values column
- [ ] Set up Razorpay SDK integration skeleton (keys, webhook endpoint scaffold, no live flows yet)
- [ ] Set up push notification service skeleton (Expo push token registration endpoint)

**Definition of done:** all MVP tables exist and migrate cleanly, seed script populates realistic sample data (a few turfs, players, one pending match), auth issues and validates a JWT for each of the four roles.

---

## Phase 2 — MVP Module Build (in dependency order)

Each module below = one focused IDE session. Build mobile screens using Design Document tokens; wire to the backend endpoints from Phase 1.

### 2.1 Authentication & Onboarding — MVP

- [ ] Splash, Onboarding, Login, Signup, OTP Verification, Forgot Password, Role Selection screens (PRD §8.1, §31.1)
- [ ] Google/Apple Sign-In alongside phone/OTP
- [ ] Favorite Cricketer search step — external cricket API integration, autocomplete, photo preview (PRD §12.60)
- [ ] BFAM ID Confirmation screen ("You are BF1042") (PRD §12.59)
- [ ] Consent capture (location/contacts/payment-data/terms) logged with policy version + timestamp (PRD §32.8)
- [ ] Minor/age-gate check at signup (PRD §32.7)

### 2.2 Player Profile — MVP

- [ ] Profile Setup (photo, playing role, batting/bowling style, skill level) (PRD §12.2)
- [ ] Player Profile (public view): BFAM ID, favorite cricketer, identity, stats placeholder, ratings placeholder
- [ ] Profile Settings, Notification Settings, Privacy Settings, Payment Methods, Language

### 2.3 Turf Discovery & Booking — MVP

- [ ] Turf Listing (search/filter, map optional later) (PRD §12.7)
- [ ] Turf Details (gallery, facilities, pricing, availability preview)
- [ ] Turf Availability (calendar/slot grid)
- [ ] Booking flow → Booking Confirmation, My Bookings, Booking Details, Cancel Booking
- [ ] Enforce no-double-booking at the API layer using the DB composite unique constraint (PRD §15)

### 2.4 Payments — MVP

- [ ] Payment method selector: UPI / Gateway (Razorpay) / Cash / Captain-Pays / Split Payment (PRD §17, §12.16)
- [ ] Razorpay checkout flow (order creation, webhook confirmation, payment_status transitions)
- [ ] Cash payment flow (collected_by required, marked SUCCESS directly, cash_reference optional)
- [ ] Split payment allocation logic (payment_obligations → payments → payment_allocations)
- [ ] Refund flow (Cancellation & Refund policy, PRD §12.17)
- [ ] Payment History screen

### 2.5 Teams — MVP

- [ ] My Teams, Create Team, Team Details, Team Management (invite/remove/change captain) (PRD §12.3)
- [ ] Open Teams (vacancy discovery) + Join Team Request flow (PRD §12.4)
- [ ] Enforce: one active membership per player per team; exactly one active Captain per team (PRD §15)

### 2.6 Match Creation & Game Room — MVP

- [ ] Create Game flow (turf/booking link, format, ball type, scoring mode, scorer assignment) (PRD §12.9)
- [ ] Game Room screen: match info, roster, confirmations, payment status, attendance summary (PRD §12.10)
- [ ] Invite Players (contacts, team members, share link, WhatsApp share) (PRD §12.11)
- [ ] Player Confirmation flow (Confirmed/Maybe/Can't Play/Pending/No Response)
- [ ] Smart Reminders (24h/3h/1h/15min scheduled jobs) (PRD §12.13)
- [ ] Attendance & Running-Late status updates (PRD §12.14)
- [ ] Player Replacement flow (vacancy → suggested players → invite → accept) (PRD §12.15)
- [ ] QR-based Check-In (PRD §12.48)

### 2.7 Cinematic Match Countdown Intro — MVP

- [ ] `match_intro` record creation on "Start Match" (PRD §12.61)
- [ ] Full-screen 10-second countdown (Reanimated), Playing XI reveal (derived from `match_players` where CONFIRMED), captain indicator, BFAM IDs shown
- [ ] Toss result capture and display
- [ ] Optional background music toggle (`expo-av`, gated by turf `sound_enabled`)
- [ ] `match:intro_stage` Socket.IO event keeps all connected viewers synchronized
- [ ] Apply Design Document's "sports broadcast" visual language here specifically — this screen is the strongest expression of the brand-red/black/white system

### 2.8 Live Scoring — MVP

- [ ] Scorer Selection (Player-Managed vs Turf-Managed) (PRD §12.19)
- [ ] Scoring Interface: ball event buttons (0/1/2/3/4/6/Wide/No Ball/Bye/Leg Bye/Wicket), batsman/bowler selector, undo (PRD §12.18)
- [ ] Live Score viewer screen: score header, overs/wickets, current batsmen/bowler, target/RRR/CRR
- [ ] Scorecard (batting/bowling tables, extras, fall of wickets)
- [ ] Match Result screen (winner, margin, Player of the Match)
- [ ] `score_events` insert transaction updates cached `innings` totals atomically (Stack real-time notes)
- [ ] `audio_trigger` computed server-side per event; client plays matching sound via `expo-av` if `sound_enabled` (PRD §12.63)
- [ ] Stadium sound asset set bundled (six/four/wicket/fifty/century/hat-trick/match-won/toss/countdown) — no copyrighted audio

### 2.9 Live Match Viewer Count — MVP-adjacent (build alongside Live Scoring; Phase 2 priority per PRD but technically simplest to add while the Live Score screen is already open)

- [ ] `live_match_sessions` join/leave tracking via Socket.IO room per match
- [ ] De-duplicate by (match_id, user_id) via Redis presence set with heartbeat/TTL
- [ ] "👁 N Watching Live" element on Live Score header (Design: use `live-indicator` red token, not green) (PRD §12.62)
- [ ] Total views counter (separate from live active-viewer count)

### 2.10 Match Statistics & Basic Rating — MVP

- [ ] `player_match_statistics` materialization from `score_events` on match completion (PRD §12.21)
- [ ] Player Statistics screen (lifetime/season toggle)
- [ ] Basic Skill Rating calculation from `player_rating_events`, displayed on Player Profile (PRD §12.29)
- [ ] Rebook Same Players flow (PRD §12.44)

### 2.11 Notifications — MVP

- [ ] Notification Center screen (filter tabs, mark-all-read)
- [ ] Push notification delivery for every event type listed in PRD §12.45
- [ ] Notification preferences respected per user

### 2.12 Turf Owner & Turf Staff — Mobile + Web — MVP

- [ ] Owner Mobile: Dashboard, Today's Bookings, Turf Management, Availability, Pricing, Match Management, Staff Management, Payments (incl. Cash reconciliation), Sound Settings (PRD §8.3)
- [ ] Staff Mobile: Today's Bookings, Check-In, Match Operations, Live Score Control (PRD §8.4)
- [ ] Owner Web dashboard (Next.js) — same functionality as Owner Mobile, desktop-optimized (PRD §9.2)
- [ ] Staff Web dashboard — same functionality as Staff Mobile, desktop-optimized (PRD §9.3)
- [ ] Staff verification flow (ID/document upload, owner review) before live permissions (PRD §32.14)
- [ ] Confirm both web and mobile call the identical backend API — no parallel logic

### 2.13 Support — MVP

- [ ] Help Center, Contact Support, Submit Complaint, Complaint Status (`support_tickets`) (PRD §12.57)
- [ ] In-app dispute flow for scoring/result disagreements (PRD §32.2)
- [ ] Injury report flow tied to the liability waiver (PRD §32.9)

**Phase 2 exit criteria (the MVP loop, PRD §25.2):** a real group of players can register (incl. BFAM ID + favorite cricketer), discover and book a turf, pay by any supported mode, create a match, get invited and confirmed, check in, watch the countdown/Playing XI/toss, play with live scoring (viewer count + stadium audio included), see the match result and updated statistics, and rebook — entirely inside BFAM.

---

## Phase 3 — Phase 2 Feature Modules

Build only after Phase 2 is stable and tested end-to-end.

- [ ] Team vs Team Matchmaking: Find Opponents, Match Challenge, Match Requests (PRD §12.6)
- [ ] Fair Play System: batting/bowling rotation tracking, Fair Play alerts, post-match summary, Team Fair Play Score (PRD §12.22–12.27)
- [ ] Reliability Score + Community Rating (PRD §12.30–12.31)
- [ ] Rankings & Leaderboards (materialized `leaderboard_entries`, periodic job) (PRD §12.33)
- [ ] BFAM Coins ledger (`coin_transactions`, `coin_wallets`) + XP/Levels (`xp_transactions`, `player_levels`) (PRD §12.34–12.35)
- [ ] Rewards catalog + redemption flow (PRD §12.36)
- [ ] Achievements & Badges, Match Streaks (PRD §12.37–12.38)
- [ ] Match Chat (Socket.IO, per Game Room) (PRD §12.43)
- [ ] Tournaments & Leagues: creation, registration, fixtures, points table, knockout bracket (PRD §12.40–12.41)
- [ ] Digital Scoreboard (large-format view for arena TV/LCD) (PRD §12.20)
- [ ] Business Analytics + Cancellation/No-Show Analytics dashboards (owner/admin web) (PRD §12.49–12.50)
- [ ] Offers & Coupons, Referral System (PRD §12.52–12.53)
- [ ] Reviews & Feedback (turf reviews) (PRD §12.56)
- [ ] Maintenance tracking (`turf_maintenance_logs`) (PRD §12.55)
- [ ] Peak viewer analytics (extends Phase 2's live viewer count)

---

## Phase 4 — Future Scope (design later, do not build yet)

Listed for roadmap visibility only — no module work should start here until explicitly greenlit:

- [ ] Premium BFAM ID marketplace (PRD §12.59, explicitly deferred)
- [ ] Multiple stadium sound packs / owner-customizable audio (PRD §12.63)
- [ ] Match Recording & AI Highlights (PRD §12.42)
- [ ] AI Player Performance Analysis, Smart Team Balancing, Smart Matchmaking
- [ ] Demand prediction & dynamic pricing
- [ ] Memberships (`membership_plans`, `memberships`)
- [ ] Café ordering (`cafe_menu_items`, `cafe_orders`)
- [ ] IoT / arena hardware integration
- [ ] Special Recognition (Hall of Fame, monthly awards)

---

## Cross-Cutting Checklists (apply throughout every phase)

### Design system compliance (check per screen)

- [ ] Colors used are only from the Design Document palette — brand-red `#D80000` for actions/live/positive states, ink-black/white/grays otherwise — never a second accent color, never green for success
- [ ] Headlines use Anton/Archivo Black uppercase; body/UI text uses Inter; stat numbers use tabular figures
- [ ] Spacing matches the 8px scale (`space-1`…`space-7`); screen margins are 24px
- [ ] Corner radii match the scale (4px tags, 8px cards/inputs/buttons, 12px elevated cards, 50% avatars only)
- [ ] Bottom tab bar is exactly Home / Discover / Matches / Teams / Profile, red active state
- [ ] Every live/real-time element (viewer count, live score, LIVE badge) is styled per Design §4.3/§5's "data-forward, scoreboard" treatment

### Testing (per module, before moving on)

- [ ] Unit tests for business logic (rating calc, booking availability, payment allocation)
- [ ] API integration tests, especially booking + payment flows (Razorpay test mode + Cash)
- [ ] Mobile component tests for the module's key screens
- [ ] Manual QA pass on both Android and iOS builds
- [ ] Web dashboard QA pass (Owner Web / Staff Web) where applicable

### Security & compliance (recurring, not a one-time phase)

- [ ] No plaintext passwords, no raw card data anywhere (payments always via Razorpay reference or Cash + collected_by)
- [ ] RBAC enforced on every new endpoint (Player / Captain-context / Turf Owner / Turf Staff / Admin)
- [ ] Audit log entries written for booking cancellations, payment/refund events, match result corrections, admin actions
- [ ] Consent + minor/age checks re-verified whenever a new data-collecting flow is added

---

_This file is a living checklist — update it as modules complete or scope shifts. Keep phase order intact even if individual checkboxes get reordered within a module._
