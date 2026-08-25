## **BFAM** 

_Technology Stack Document_ 

## **Recommended Frontend, Backend, Database, Libraries, Deployment & Workflow** 

Companion to the BFAM Product Requirements Document (PRD) 

Version 1.1 | Prepared for Developers & Co-Founders 

August 2026 --- updated against PRD v2.1 (adds Section 33 "Gaps to Consider" and the Memberships/Offers/Referral/Café/Maintenance/BFAM ID feature set). Section cross-references to the PRD below use v2.1's numbering; earlier v1.0 references to old section numbers (e.g. "Section 45/59") are corrected throughout. 

## **1. Executive Summary** 

This document defines the recommended technology stack for building BFAM --- a mobile-first box-cricket ecosystem covering turf discovery and booking, team and player matchmaking, realtime match coordination, live scoring, payments, statistics, Fair Play, ratings, rewards, and tournaments (see the BFAM PRD for full product scope). 

Every recommendation is chosen against BFAM's actual requirements: a single Android + iOS mobile codebase, real-time WebSocket-driven live scoring and chat, relational data with many interconnected entities (players, teams, matches, bookings, payments, tournaments), Razorpaybased payments, and a small team that needs to move fast without re-learning a new language for frontend vs. backend. 

## **Layer Recommendation** 

Mobile Frontend          React Native + Expo Styling                  NativeWind (Tailwind CSS for React Native) Backend                  Node.js + Express.js Database                 MySQL + Sequelize ORM Real-Time Layer          Socket.IO over WebSockets Authentication           JWT (JSON Web Tokens) Payments                 Razorpay 

Hosting / Infra          AWS (EC2/ECS, RDS, S3, CloudFront) 

# **Web Admin Dashboard      React (Next.js) sharing the same backend (Phase 2)** 

This is the same direction already specified in the BFAM PRD; this document explains why each piece fits, what to add around it, and how the pieces work together in production. 

## **2. Frontend Framework** 

## **2.1 Recommendation: React Native + Expo** 

React Native, run through the Expo managed/dev-client workflow, is the recommended mobile frontend for BFAM. 

## **Why React Native** 

- One codebase for Android and iOS. BFAM's PRD explicitly requires both platforms at launch; React Native avoids maintaining two native codebases (Kotlin/Swift) with a small team. 

- Large ecosystem of libraries for exactly the features BFAM needs: maps/location, camera/QR scanning, push notifications, payments, and real-time sockets. 

- JavaScript/TypeScript across the whole stack (see Section 4) means the same engineers can move between mobile UI and backend logic, which matters for a lean early-stage team. 

- Mature enough for real-time, interactive apps --- companies running live-score-style or chatheavy real-time mobile products (e.g., sports and social apps) commonly run on React Native with Socket.IO. 

- Hot reload and fast iteration speed suit a product with 40+ screens and features that will evolve quickly through MVP → Phase 2 → Future, as defined in the PRD's priority tiers. 

## **Why Expo Specifically** 

- Expo's managed workflow removes most native build configuration (Xcode/Android Studio setup) for day-to-day feature work, which speeds up onboarding and iteration. 

- EAS Build and EAS Submit handle Android/iOS store builds and submissions without a local Mac/Xcode requirement for every build. 

- Expo Push Notifications gives a single, simple API for the push notifications the PRD treats as the primary notification channel (Section 16 of the PRD). 

- Expo Location, Expo Camera (for QR check-in), and Expo Updates (over-the-air JS updates) map directly onto BFAM's location, check-in, and rapid-iteration needs. 

- If a feature ever needs a native module Expo doesn't support, Expo's dev-client / prebuild path allows dropping into bare React Native for that module without abandoning the rest of the Expo tooling. 

## **Trade-offs to Be Aware Of** 

- React Native has more overhead than a fully native app for very heavy graphics/animation --- not a concern for BFAM's form-, list-, and chat-heavy UI. 

- Live scoring and chat need careful state management (Section 5) so real-time updates don't cause unnecessary re-renders across a busy Game Room screen. 

## **2.2 Language: TypeScript** 

Use TypeScript rather than plain JavaScript across the React Native app. BFAM's data model has many interrelated entities (Player, Team, Match, Booking, Payment, Tournament) passed between many screens; TypeScript's compile-time type checking catches a large class of bugs before they reach a live match, and it pairs naturally with a Node.js/Express backend that can share types 

via a common package. 

## **3. Styling Solution** 

## **3.1 Recommendation: NativeWind (Tailwind CSS for React Native)** 

NativeWind lets the team write Tailwind CSS utility classes directly in React Native components, compiling them to native styles at build time. 

## **Why NativeWind** 

- This was already the direction specified for BFAM ("NativeWind / Tailwind-style UI" in the PRD's tech direction) --- this document confirms and justifies it. 

- Utility-class styling is fast for a UI with 40+ distinct screens (Section 8 of the PRD): spacing, color, and layout are expressed inline without hopping between component files and separate StyleSheet objects. 

- A shared design system (colors for Skill Rating vs. Fair Play vs. Reliability badges, prioritytier colors, status chips for Confirmed/Maybe/Can't Play) is easy to encode as Tailwind config tokens and reuse consistently across screens. 

- If BFAM later ships a web Admin Dashboard in React/Next.js (Section 9 of the PRD), the same Tailwind design tokens and utility classes carry over almost directly, keeping mobile and web visually consistent with minimal duplicated styling work. 

## **Supporting Libraries** 

- React Native Reanimated --- smooth animations for live-score updates, confirmation status changes, and level-up/reward moments without jank. 

- React Native Gesture Handler --- needed for swipeable match cards, pull-to-refresh, and any drag interactions (e.g., reordering a batting lineup). 

- React Native SVG --- for custom icons, badges, achievement graphics, and the scoreboard's visual elements. 

## **3.2 Alternative Considered: styled-components / Restyle** 

Component-based styling libraries (styled-components, Shopify Restyle) are a reasonable alternative, but NativeWind is preferred here because of the utility-first speed advantage across many screens and the direct reuse path toward a future web dashboard using the same Tailwind conventions. 

## **4. Backend Technology** 

## **4.1 Recommendation: Node.js + Express.js** 

Node.js with the Express.js framework is the recommended backend for BFAM's REST APIs and WebSocket server. 

## **Why Node.js** 

- JavaScript/TypeScript end-to-end: the same language runs on the React Native frontend and the backend, so types, validation schemas, and even utility functions can be shared through a monorepo package (Section 7). 

- Node's event-driven, non-blocking I/O model is well suited to BFAM's real-time-heavy workload: live scoring updates, match chat, and push-notification dispatch are all I/O-bound, high-concurrency operations rather than CPU-bound computation. 

- Excellent first-class support for Socket.IO (Section 5), which is the natural fit for BFAM's real-time Game Room, live scoreboard, and chat. 

- Enormous package ecosystem (npm) covers every integration BFAM needs out of the box: Razorpay SDK, JWT libraries, Sequelize, push notification SDKs, image/file handling for AWS S3. 

## **Why Express.js Specifically** 

- Minimal, unopinionated, and extremely well documented --- appropriate for a REST API surface covering ~40+ resource types (players, teams, matches, bookings, tournaments, etc.) without unnecessary framework overhead. 

- Middleware model maps cleanly onto BFAM's cross-cutting concerns: JWT auth checks, role-based access control (Player/Captain/Turf Owner/Staff/Admin), request validation, and rate limiting can each be a small, testable middleware. 

- Pairs naturally with Socket.IO in the same Node process (or a dedicated Socket.IO service, see Section 6), so the same authentication/session logic can be reused for both REST calls and WebSocket connections. 

## **Alternative Considered: NestJS** 

NestJS (a more structured, opinionated Node.js framework built on Express or Fastify) is worth considering once the backend team grows beyond a couple of engineers, since its 

module/service/controller structure enforces consistency across a large number of resources. For an early-stage build, plain Express with a clear folder convention (routes/controllers/services/models) is faster to start with and easy to migrate into NestJS-style structure later if needed. 

## **5. Database Choice** 

## **5.1 Recommendation: MySQL + Sequelize ORM** 

MySQL, accessed through the Sequelize ORM, is the recommended primary database for BFAM. 

## **Why a Relational Database (MySQL) Over NoSQL** 

- BFAM's data model is fundamentally relational: Players belong to Teams, Teams play Matches, Matches belong to Bookings, Bookings belong to Turfs, Payments belong to Bookings/Players, Tournaments contain Matches and Points Tables. These are exactly the one-to-many and many-to-many relationships relational databases are built for. 

- Strong consistency matters for BFAM's core transactions: a turf slot must never be doublebooked, payment status must be reliably tracked, and match statistics must be calculated correctly from a finalized scorecard. MySQL's ACID transactions directly support the PRD's business rules (Section 15/67 of the PRD) such as "a turf slot cannot be double-booked." 

- Reporting and analytics (turf occupancy, revenue, leaderboards, points tables) are naturally expressed as SQL joins and aggregations --- exactly the kind of query relational databases and their query planners are optimized for. 

- MySQL specifically is free, extremely well supported on AWS (RDS for MySQL/Aurora MySQL), has mature tooling, and is a technology most backend engineers are already comfortable with, which shortens ramp-up time. 

## **Why Sequelize** 

- Sequelize is a mature, widely used Node.js ORM with first-class MySQL support, migrations, and model associations that map directly onto BFAM's relationships (Player ↔ Team, Match ↔ Players, Booking ↔ Turf, etc.). 

- Migrations give a clear, version-controlled history of schema changes as BFAM grows from MVP (Section 25 of the PRD) into Phase 2 features like Tournaments and Fair Play tracking. 

- Built-in transaction support directly enforces the "no double booking" and "reliable payment status" non-functional requirements (Section 24 of the PRD). 

## **5.2 Supporting Data Stores** 

**Store Purpose** 

Redis            Caching hot data (turf availability, leaderboards), Socket.IO pub/sub across multiple server instances, and rate limiting. 

AWS S3           Storing profile pictures, team logos, turf photos, and (future) match highlight video/clips. 

# **Amazon SNS /     Push notification delivery, paired with Expo's push Firebase Cloud   notification service. Messaging** 

Redis in particular becomes important once live scoring and chat run across more than one backend instance, since Socket.IO needs a shared pub/sub layer to broadcast events to all connected clients regardless of which server instance they're attached to. 

## **6. Essential Libraries & Packages** 

## **6.1 Mobile App (React Native / Expo)** 

**Package Purpose** 

expo-router or React    Screen navigation across BFAM's 40+ screens Navigation              (tabs, stacks, deep links to a specific Game Room). 

socket.io-client        Real-time connection for live scoring, match chat, and attendance/running-late updates. 

axios or fetch +        REST API calls with caching, retries, and TanStack Query (React   background refetching --- useful for Turf Query)                  Listing, Leaderboards, Player Statistics. 

zustand or Redux        Client-side state management for auth session, Toolkit                 active Game Room state, and cart-like booking flow. 

react-hook-form + zod   Form handling and schema validation for Signup, Create Team, Create Match, and Booking forms. 

expo-notifications      Push notification registration and handling. 

expo-location           Turf discovery, distance calculation, and navigation deep links. 

expo-camera /           QR-code check-in at the turf. expo-barcode-scanner 

react-native-razorpay   Native Razorpay checkout integration. 

date-fns or dayjs       Lightweight date/time handling for slots, reminders, and match scheduling. 

# **i18n-js or              Multi-language support (English/Hindi/regional) react-i18next           if pursued, per the PRD's recommendations section.** 

## **6.2 Backend (Node.js / Express)** 

**Package Purpose** 

express                HTTP server and routing. 

socket.io              WebSocket server for live scoring, chat, and real-time Game Room updates. 

sequelize + mysql2     ORM and MySQL driver. 

jsonwebtoken + bcrypt  JWT issuance/verification and password hashing. 

joi or zod             Request payload validation on every API route. 

razorpay               Official Node.js SDK for payment orders, verification, and webhooks. 

multer + aws-sdk (S3   File uploads (profile pictures, turf photos) to client)                S3. 

node-cron or BullMQ +  Scheduled jobs for smart reminders Redis                  (24h/3h/1h/15min) and recurring tasks. 

express-rate-limit +   Basic API hardening: rate limiting, secure helmet + cors          headers, and CORS policy. 

winston or pino        Structured application logging for debugging and audit trails. 

# **jest + supertest       Unit and API integration testing.** 

## **6.3 DevOps / Infra** 

- Docker for containerizing the backend and Socket.IO service 

- GitHub Actions for CI/CD (lint, test, build, deploy) 

- PM2 (if not fully containerized) for Node process management 

- Sentry for error tracking on both mobile and backend 

## **7. Deployment & Hosting Recommendations** 

## **7.1 Cloud Provider: AWS** 

AWS is recommended, matching the PRD's stated tech direction, because it offers every managed service BFAM needs under one account and billing relationship, with strong support for the Mumbai (ap-south-1) region --- keeping latency low for an India-based launch. 

## **AWS Service Role in BFAM** 

EC2 or ECS          Hosts the Node.js/Express API and Socket.IO (Fargate)           service. ECS Fargate is recommended over raw EC2 once traffic justifies it, since it removes server-patching overhead and scales containers automatically. 

RDS for MySQL (or   Managed MySQL database with automated backups, read Aurora MySQL) replicas, and Multi-AZ failover for production reliability. 

ElastiCache (Redis) Socket.IO pub/sub across instances, caching, and rate-limiting counters. 

S3                  Object storage for profile pictures, team logos, turf photos, and future match highlight clips. 

CloudFront          CDN in front of S3 for fast image loading across regions. 

Application Load    Distributes traffic across backend instances and Balancer            terminates TLS. 

Route 53            DNS management for the API domain. 

CloudWatch          Metrics, logs, and alarms for backend health and performance. 

# **SNS / SES           SMS/OTP delivery and transactional email, if needed alongside push notifications.** 

## **7.2 Mobile App Distribution** 

- Expo Application Services (EAS) Build --- builds signed Android (.aab) and iOS (.ipa) binaries in the cloud without requiring local Xcode/Android Studio setup for every build. 

- EAS Submit --- automates submission to the Google Play Store and Apple App Store. 

- Expo Updates (OTA) --- ships JavaScript-only bug fixes and minor UI changes to users instantly without a full store review cycle, reserved for non-native-code changes. 

## **7.3 Environments** 

Maintain at least three environments to protect production data and match integrity: 

- Development --- local Docker Compose stack (Node, MySQL, Redis) for individual engineers. 

- Staging --- mirrors production infrastructure on AWS, used for QA and pre-release testing 

including Razorpay's test mode. 

- Production --- fully managed AWS environment with Multi-AZ RDS, autoscaling backend, and monitoring/alerts active. 

## **8. Development Tools & Workflow** 

## **8.1 Source Control & Repository Structure** 

- Git + GitHub, matching the PRD's stated direction. 

- A monorepo (using npm/pnpm workspaces or Turborepo) containing the mobile app, backend API, and any shared TypeScript types/validation schemas is recommended so changes to a shared type (e.g., the Match or Booking model) are enforced consistently across frontend and backend. 

- Branching model: trunk-based development with short-lived feature branches and required pull-request review before merging to main. 

## **8.2 Code Quality** 

- ESLint + Prettier, shared config across mobile and backend packages for consistent style. 

- TypeScript strict mode across both frontend and backend. 

- Husky + lint-staged for pre-commit linting and formatting checks. 

## **8.3 CI/CD** 

- GitHub Actions pipeline: on every pull request --- install, lint, type-check, run unit/integration tests. 

- On merge to main --- build and deploy the backend container to ECS/EC2 staging automatically; production deploys gated behind manual approval. 

- EAS Build triggered on release branches/tags for mobile app builds, separate from the backend deploy pipeline. 

## **8.4 Testing Strategy** 

**Layer Approach** 

Backend unit tests Jest for business logic (rating calculations, Fair Play scoring, booking availability checks). 

Backend            Supertest against a test database for API endpoints, integration tests  especially payment and booking flows. 

Mobile component   Jest + React Native Testing Library for key tests              components (Game Room, Live Score, Booking flow). 

End-to-end tests   Detox (React Native) for critical user journeys --- signup → book turf → create match → pay. 

# **Manual/QA          Staging environment with Razorpay test mode for the full booking-to-payment flow before each release.** 

## **8.5 Project Management** 

- Issue tracking against the PRD's feature list and priority tiers (MVP / Phase 2 / Future) so sprint planning maps directly back to the product document. 

- A lightweight design system / component library (Storybook for React Native, optional) to keep the NativeWind-based UI consistent as new screens are added. 

## **8.6 Local Development Setup** 

- Docker Compose spinning up MySQL, Redis, and the backend API together for a onecommand local environment. 

- Seed scripts populating representative data (sample players, teams, turfs, and a live match) so frontend engineers can build against realistic data without needing a full backend running for every feature. 

- .env-based configuration (never committing secrets) with a documented .env.example for every service. 

## **9. Additional Stack Requirements (PRD v2.1 Update)** 

PRD v2.1 adds Section 33 ("Additional Recommendations --- Gaps to Consider") and expands the Complete Feature List with Memberships, Offers & Coupons, Referral System, Café, Maintenance, the BFAM ID System, and Favorite Cricketer. None of these change the core stack in Sections 1--8 above; they add the following to it. 

## **9.1 Authentication --- Social Login** 

- `expo-auth-session` + Google/ `expo-apple-authentication` for Google and Sign in with Apple, alongside the existing phone/OTP flow (PRD 33.5). Apple requires Sign in with Apple whenever another third-party login is offered, so both should ship together. 

- Backend: verify Google ID tokens and Apple identity tokens server-side ( `google-authlibrary` , `apple-signin-auth` ), then issue the same JWT used for phone/OTP sessions so downstream role/permission logic is unchanged. 

## **9.2 Offline-First Live Scoring** 

- `expo-sqlite` (or WatermelonDB) as a local queue on the scorer's device: every ball-byball event writes locally first, then syncs to the backend when connectivity returns, addressing box-cricket turfs' poor network coverage (PRD 33.3). 

- Sync events need a client-generated idempotency key so a retried sync can't double-count a ball; the backend upsert on this key. 

## **9.3 Guest / One-Off Player Flow** 

- No new library --- a lightweight guest-join endpoint (name + phone, no password) that issues a limited-scope JWT, upgradeable to a full account later (PRD 33.4). 

## **9.4 Weather & External Data** 

- OpenWeatherMap (or IMD-backed alternative) for rain-risk signals feeding the Weather & Rain Policy flow (PRD 33.1): abandoned-match refund/reschedule-credit decisioning. 

- A public/open-source cricket-player API (e.g., CricAPI or similar) for the Favorite Cricketer autocomplete (PRD 12.60); BFAM stores only the selected player's name and external reference ID, not a cricketer database of its own. 

## **9.5 Localization** 

- `react-i18next` promoted from "if pursued" to a firm MVP-adjacent recommendation: English, Hindi, and Gujarati, since the PRD now specifies an India-first, multi-language audience (PRD 33.6). 

## **9.6 Accessibility & Dark Mode** 

- React Native's `Appearance` API + NativeWind `dark:` variants for a system-linked dark mode; `accessibilityLabel` / `accessibilityRole` on Book/Pay/Confirm actions and scalable text via `PixelRatio` /dynamic type support (PRD 33.12). 

## **9.7 Product Analytics & Telemetry** 

- PostHog (self-hostable, generous free tier) or Amplitude for product telemetry --- funnel drop-off (Discover → Book → Pay), invitation acceptance rate, live-score session length --kept separate from the Business Analytics dashboards in Section 23 of the PRD, which read from the primary MySQL database instead (PRD 33.13). 

## **9.8 Compliance & Trust** 

- DPDP Act (India)-compliant consent capture: explicit location/contacts/payment-data consent screens logged with policy version and timestamp (PRD 33.8). 

- Liability waiver acceptance at signup/first booking, plus an in-app injury-report path (PRD 33.9). 

- Account-deletion flow and a versioning strategy so older app builds degrade gracefully against a newer backend, ahead of App Store/Play Store review (PRD 33.11). If BFAM Coins ever become purchasable with real money, that purchase must route through Apple/Google in-app purchase, not Razorpay, on iOS/Android. 

- Staff verification: ID/document upload to S3, reviewed by the turf owner before a staff account gets live check-in/payment permissions (PRD 33.14). No new library --- reuses the existing `multer` + S3 upload path. 

- In-app dispute flow (flag a match → both sides state their case → admin/staff resolves) reusing the existing support-ticket/admin tooling rather than a new subsystem (PRD 33.2). 

## **9.9 Ancillary Commerce Features** 

Memberships, Offers & Coupons, Referral System, and Café (PRD 12.51-- 12.54) are additional REST resources and Razorpay charges on the existing stack --- no new backend framework or payment provider is needed. Café order status updates can reuse the existing Socket.IO connection (order placed → preparing → ready), the same pattern already used for live scoring. 

## **10. Summary --- Full Stack at a Glance** 

## **Category Choice Primary Reason** 

Mobile Frontend    React Native + Expo      Single Android/iOS codebase, fast iteration, strong ecosystem for real-time & payments 

Language           TypeScript               Shared types across a relational, interconnected data model 

Styling            NativeWind (Tailwind for Fast utility-first styling; RN)                      reusable design tokens for a future web dashboard 

Backend            Node.js + Express.js     JS/TS end-to-end; ideal for I/O-heavy, real-time workloads 

Real-Time          Socket.IO                Live scoring, chat, and Game Room updates 

Database           MySQL + Sequelize        Relational data, ACID transactions, no-double-booking guarantees 

Cache / Pub-Sub    Redis (AWS ElastiCache)  Socket.IO scaling, caching, rate limiting 

Auth               JWT + Google/Apple       Stateless, scalable, Sign-In                  role-based access across 5 user roles; social login for signup friction & App Store compliance 

Localization       react-i18next (EN/HI/GU) India-first, multi-language audience per PRD 33.6 

Analytics          PostHog / Amplitude      Product telemetry (funnels, session length), separate from business analytics 

Payments           Razorpay                 India-focused gateway with split/booking payment support File Storage       AWS S3 + CloudFront      Profile photos, team logos, turf photos, future highlights 

Hosting            AWS (ECS/EC2, RDS, ALB)  Managed, India (Mumbai) region availability, integrates with all of the above 

CI/CD              GitHub Actions + EAS     Automated backend deploys and mobile store builds 

# **Future Web         React (Next.js)          Shares Tailwind design Dashboard                                   tokens and the same backend API** 

**_This stack is chosen to let a small team ship the MVP loop (Section 25 of the PRD) quickly, then scale into Fair Play, Rewards, Tournaments, and eventually the Admin web dashboard --- without a framework rewrite at any stage._** 

