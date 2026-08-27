# **BFAM**

_(Brother From Another Mother)_

_More than a turf. It's a cricket ecosystem._

### **Product Requirements Document (PRD)**

Cross-Platform Mobile App (React Native + Expo, Android & iOS) with Web Dashboards

Version 1.1 | Prepared for Developers, Designers, Business Partners & Co-Founders August 2026 — incorporates Product Change Request v1.1

## **1. Executive Summary**

BFAM is a mobile-first platform (Android and iOS) that turns box cricket from a logistics headache into a seamless, community-driven experience. It goes far beyond turf booking: BFAM lets players build teams, find opponents, coordinate matches, handle payments, score matches live, track statistics, build a reputation, earn rewards, and compete in tournaments — all inside one connected ecosystem.

##### **_BFAM handles the coordination, so players can focus on the game._**

This document defines what BFAM should do — its users, screens, features, workflows, business rules, priorities and success metrics — without prescribing implementation details, database schemas or APIs. It is intended to align developers, designers, business partners, co-founders and AI build tools around one shared product definition.

## **2. Project Overview**

| **Atribute**      | **Value**                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| Product Name      | BFAM (Brother From Another Mother)                                                                                 |
| Product Category  | Sports Technology / Box Cricket / Turf Management / Community Platorm                                              |
| Primary Platorm   | BFAM cross-platorm mobile applicaton — React Natve + Expo, one shared<br>codebase producing Android and iOS builds |
| Secondary Platorm | Responsive web dashboards for Turf Owner, Turf Staf, and Platorm Admin                                             |

#### **2.1 What BFAM Is**

BFAM is a complete box-cricket ecosystem delivered as a cross-platform mobile application — a single shared React Native + Expo codebase that produces both the Android and iOS builds, rather than two separately developed apps. It combines turf discovery and booking, team and player matchmaking, match creation and coordination, live scoring, player statistics, a fair-play system, ratings and reputation, gamified rewards, and tournament management into a single connected product. Every player also receives a unique, permanent BFAM ID (Section 12.59) as their public identity across the platform.

#### **2.2 The Problem It Solves**

Today, playing a casual box-cricket match requires one person to book a turf, personally call or message every player, chase confirmations, collect money, find last-minute replacements, and manually keep score — usually on a scrap of paper or a spreadsheet. BFAM replaces this scattered, manual coordination with one connected workflow.

#### **2.3 Why Normal Turf Booking Is Not Enough**

A booking app only solves one part of the problem — reserving a slot. It does nothing for team formation, player invitations, confirmations, payments splitting, replacements, live scoring, statistics, fairness, or long-term player identity. BFAM treats the turf booking as the entry point into a much larger match lifecycle.

#### **2.4 How BFAM Handles the Complete Match Lifecycle**

From the moment a turf is booked to the moment players decide to rebook the same group, BFAM manages every step: invitations, confirmations, reminders, attendance, replacements, live scoring, statistics, ratings, fair play, and rewards. See Section 14, “Match Lifecycle,” for the full flow.

#### **2.5 Building a Cricket Community**

By connecting players who need a team, teams who need opponents, and turfs that need bookings, BFAM creates a recurring local cricket community rather than a one-off transactional booking tool.

#### **2.6 Improving Coordination Between Players**

Game Rooms, smart reminders, running-late status updates, and automatic replacement suggestions remove the need for external phone calls and WhatsApp groups to organize a match.

#### **2.7 Encouraging Fair Play**

The BFAM Fair Play System tracks batting and bowling opportunity, protects new players, and gives captains gentle, non-forcing suggestions so every player gets a fair chance to participate.

#### **2.8 Creating Player Identity and Reputation**

Every player builds a BFAM identity made up of four distinct, non-overlapping reputation signals: Skill Rating, Fair Play Rating, Reliability Score, and Community Rating (see Section 19).

#### **2.9 Rewards and Gamification**

BFAM Coins, XP and levels, achievements, badges, streaks, and leaderboards give players ongoing reasons to keep playing, keep showing up on time, and keep coming back to BFAM turfs.

##### **_BFAM — More than a turf. It's a cricket ecosystem._**

## **3. Problem Statement**

#### **3.1 Problems Faced by Players**

- One person has to book the turf, absorbing all the effort and risk.

- That same person has to individually call or message every player.

- Everyone then waits on player confirmations that trickle in slowly.

- Players forget about matches they agreed to play.

- Last-minute cancellations disrupt team composition.

- Finding a replacement player at short notice is difficult and stressful.

- Collecting money from every participant is tedious and often incomplete.

- Players arrive late without informing anyone, delaying the match.

- Players without a team struggle to find one to join.

- Teams struggle to find opponent teams of a similar skill level.

- Players struggle to find specific players (e.g., a bowler) on short notice.

- There is no centralized place to manage a match end-to-end.

- There is no proper live scoring — scores are tracked informally or not at all.

- There are no individual player statistics carried across matches.

- There is no player reputation system to signal reliability or skill.

- There is no structured fair-play mechanism to ensure everyone gets a chance to bat and bowl.

- There are no rewards for players who show up regularly and play fairly.

- There is no unified way to run or join tournaments.

#### **3.2 Problems Faced by Turf Businesses**

- Turf owners manually manage bookings, often via phone calls or registers.

- No structured way to manage on-ground matches, staff, or live scoring.

- Limited visibility into revenue, occupancy, and customer behavior.

- No systematic way to reduce cancellations and no-shows.

#### **3.3 How BFAM Solves These Problems**

BFAM consolidates booking, team formation, matchmaking, invitations, confirmations, payments, reminders, replacements, live scoring, statistics, fair play, ratings, rewards and tournaments into one mobile app, with a dedicated Game Room acting as the command center for every match, and a Turf Owner toolset for managing the business side.

## **4. Product Vision**

BFAM should evolve from a turf booking platform into a complete digital box-cricket ecosystem where players can discover, connect, organize, play, compete, improve, and build a community.

**_“More than a turf. It's a movement.”_**

## **5. Goals & Objectives**

- Remove the manual coordination burden from organizing a box-cricket match.

- Make it effortless to find turfs, teams, players, and opponents.

- Provide a reliable, real-time live scoring experience for every match.

- Build durable player identity through statistics, ratings, and reputation.

- Encourage fair participation for every player, especially newcomers.

- Reward consistent, reliable, and fair-playing members of the community.

- Give turf owners the tools to run their business efficiently.

- Create a foundation that can scale from one turf to multiple turfs and cities.

## **6. Target Audience**

- Amateur and semi-competitive box-cricket players looking for regular matches.

- Team captains and organizers who currently coordinate matches manually.

- Corporate groups and friend circles organizing recurring games.

- Turf owners and box-cricket arena businesses.

- Turf staff who manage day-to-day operations and live scoring.

- Tournament organizers running community or corporate leagues.

## **7. User Roles & Permissions**

BFAM defines five functional roles. Note that Team Captain is not a separate permanent account type — it is a responsibility a normal Player takes on for a specific team or match.

#### **7.1 Player / User**

- Create profile

- Create or join teams

- Find players, teams, and opponent teams

- Book turfs and create matches

- Join matches and confirm participation

- Make payments

- View live scores and statistics

- Earn ratings and rewards

- Participate in tournaments

#### **7.2 Team Captain (a Player managing a team/match)**

- Create and manage a team

- Invite players; accept or reject join requests

- Create matches and invite players

- Track confirmations and payments

- Find replacement players and opponent teams

- Manage match-related activities

#### **7.3 Turf Owner**

- Add and manage turf listings

- Manage availability and pricing

- Manage bookings and staff

- Manage matches and live scoring for their turf

- View revenue, occupancy, and analytics

- Manage offers and maintenance

#### **7.4 Turf Staff**

- View today's bookings

- Check in players and verify bookings

- Manage matches and live score entry

- Assist customers on-site

- Update turf status

#### **7.5 Platform Admin**

- Manage the entire BFAM platform: users, turfs, owners, staff, teams, matches, tournaments

- Manage payments, rewards, and ratings platform-wide

- Manage reports and complaints

- View platform-wide analytics and manage platform settings

#### **7.6 Role Permission Summary**

| **Capability**                | **Player** | **Captain** | **Turf Owner** | **Staf** | **Admin** |
| ----------------------------- | ---------- | ----------- | -------------- | -------- | --------- |
| Book turf / create match      | ✓          | ✓           | —              | —        | —         |
| Manage a team                 | —          | ✓           | —              | —        | —         |
| Manage turf listng & pricing  | —          | —           | ✓              | —        | ✓         |
| Check-in players / live score | Optonal    | Optonal     | ✓              | ✓        | —         |
| View turf revenue/analytcs    | —          | —           | ✓              | —        | ✓         |
| Manage platorm users/setngs   | —          | —           | —              | —        | ✓         |

## **8. Mobile Application Structure**

BFAM is delivered as one cross-platform mobile application (React Native + Expo, single codebase for Android and iOS) rather than three separate mobile products. The Player, Turf Owner, and Turf Staff experiences below are rolescoped sections within that same app — the screens a user sees depend on their authenticated role and permissions, not on a different install.

Screens are grouped below by area.

#### **8.1 Public / Authentication**

| **Screen**                | **Purpose**                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Splash Screen             | App launch branding                                                                                              |
| Onboarding                | First-run introducton to BFAM's value                                                                            |
| Login                     | Existng user sign-in                                                                                             |
| Signup                    | New user registraton                                                                                             |
| OTP Verifcaton            | Verify phone/email                                                                                               |
| Favorite Cricketer Search | Onboarding step: autocomplete selecton of a favorite<br>internatonal/IPL cricketer (optonal, skippable)          |
| BFAM ID Confrmaton        | Displays the player's newly issued, permanent public BFAM ID<br>(e.g., "You are BF1042") right afer profle setup |
| Forgot Password           | Password recovery                                                                                                |
| Role Selecton             | Choose Player, Turf Owner, or Turf Staf path                                                                     |
| Terms & Conditons         | Legal terms                                                                                                      |
| Privacy Policy            | Data handling policy                                                                                             |

#### **8.2 Player Application**

| **Screen**         | **Purpose**                                                                       |
| ------------------ | --------------------------------------------------------------------------------- |
| Home Dashboard     | Personalized overview: upcoming matches, quick actons                             |
| Discover           | Explore turfs, teams, players, matches nearby                                     |
| Turf Listng        | Browse available turfs                                                            |
| Turf Details       | Photos, facilites, pricing, reviews                                               |
| Turf Availability  | Slot calendar for a turf                                                          |
| Booking            | Select date/tme/duraton and confrm                                                |
| Payment            | Pay for a booking — UPI, payment gateway, Cash, Captain-Pays, or Split<br>Payment |
| Booking Confrmaton | Confrmaton summary                                                                |
| My Bookings        | List of past and upcoming bookings                                                |
| Create Game        | Set up a new match                                                                |

| **Screen**         | **Purpose**                                                                       |
| ------------------ | --------------------------------------------------------------------------------- |
| Game Room          | Central hub for a specifc match                                                   |
| Invite Players     | Invite friends/teammates to a match                                               |
| Player Confrmaton  | Confrm/decline partcipaton                                                        |
| Match Details      | Full details of a match                                                           |
| Match Chat         | Group chat for a match                                                            |
| Match Countdown    | Full-screen 10-second cinematc countdown when the scorer starts the<br>match      |
| Playing XI Reveal  | Stadium-style reveal of each team's lineup with captain indicator and BFAM<br>IDs |
| Toss Result        | Displays the toss outcome before the scoreboard appears                           |
| Live Score         | Real-tme scoreboard, including live viewer count and stadium sound cues           |
| Scorecard          | Detailed ball-by-ball / innings scorecard                                         |
| Match Result       | Final outcome and summary                                                         |
| Player Profle      | Public profle: BFAM ID, identty, favorite cricketer, stats, ratngs                |
| Player Statstcs    | Lifetme and season stats                                                          |
| Player Ratng       | Skill Ratng detail view                                                           |
| Fair Play Profle   | Fair Play Ratng detail view                                                       |
| Reliability Score  | Reliability detail view                                                           |
| Teams              | List of teams the player belongs to                                               |
| Create Team        | Set up a new team                                                                 |
| Team Details       | Roster, stats, history                                                            |
| Join Team          | Request to join an open team                                                      |
| Find Players       | Search/flter players                                                              |
| Find Opponents     | Search/flter opponent teams                                                       |
| Matchmaking        | Send/receive match challenges                                                     |
| Tournaments        | Browse tournaments                                                                |
| Tournament Details | Format, fxtures, rules                                                            |
| Fixtures           | Tournament schedule                                                               |
| Points Table       | Standings                                                                         |
| Leaderboards       | Platorm-wide rankings                                                             |
| Rewards            | Redeemable rewards catalog                                                        |
| BFAM Coins         | Coin balance and history                                                          |
| XP / Levels        | Progression detail                                                                |

| **Screen**      | **Purpose**            |
| --------------- | ---------------------- |
| Achievements    | Badges earned          |
| Notfcatons      | Notfcaton center       |
| Payment History | Transacton history     |
| Profle Setngs   | Account setngs         |
| Help & Support  | Support and complaints |

#### **8.3 Turf Owner (Mobile)**

Turf Owners get both a mobile experience (below) and a full web dashboard (Section 9) — owners often manage the business from a desktop while still needing mobile access on the go. Both surfaces call the same BFAM backend.

| **Screen**              | **Purpose**                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| Owner Dashboard         | Business overview                                                 |
| Today's Bookings        | Operatonal booking list                                           |
| Booking Details         | Single booking detail                                             |
| Turf Management         | Manage turf profle                                                |
| Availability Management | Manage open/blocked slots                                         |
| Pricing                 | Set/edit pricing                                                  |
| Match Management        | Manage matches at the turf, including startng the countdown intro |
| Live Score Management   | Owner/staf-run scoring interface                                  |
| Player Check-in         | Check players in on arrival                                       |
| Staf Management         | Manage staf accounts and permissions                              |
| Payments                | Payment records across all modes, including Cash reconciliaton    |
| Revenue                 | Revenue overview                                                  |
| Analytcs                | Booking/occupancy analytcs                                        |
| Maintenance             | Track maintenance tasks                                           |
| Ofers                   | Manage discounts and coupons                                      |
| Sound Setngs            | Enable/disable the stadium audio system for this turf             |

#### **8.4 Turf Staff (Mobile)**

Turf Staff are primarily mobile-first — check-in and live scoring are on-the-ground tasks — with the same functionality also available on Staff Web (Section 9) for turfs that prefer a fixed desk setup.

| **Screen**       | **Purpose**                                                            |
| ---------------- | ---------------------------------------------------------------------- |
| Today's Bookings | Bookings scheduled for today at this staf member's<br>assigned turf(s) |
| Check-In         | QR or manual check-in for arriving players                             |

| **Screen**         | **Purpose**                                                     |
| ------------------ | --------------------------------------------------------------- |
| Match Operatons    | Start/manage matches, including the countdown intro<br>sequence |
| Live Score Control | Turf-managed live scoring interface                             |

## **9. Web Dashboards — Admin, Turf Owner & Turf Staff**

The Player experience is delivered entirely through the BFAM cross-platform mobile app. Turf Owner and Turf Staff get that same mobile app (Section 8.3–8.4) plus a responsive web dashboard — owners often manage the business from a desktop while staff work mobile-first on the ground. Platform Admin is web-only. All web clients (Owner Web, Staff Web, Admin Web) are separate Next.js applications that call the same BFAM backend as the mobile app — there is no separate backend per client.

#### **9.1 Admin Web Functionality**

- User management (players, owners, staff)

- Turf and turf-owner management

- Team and match oversight

- Tournament management

- Payment and refund oversight, across UPI, gateway, and Cash

- Rewards and ratings configuration

- Reports and complaint handling

- Platform-wide analytics and settings

#### **9.2 Turf Owner Web Functionality**

- Advanced booking and revenue reports

- Tournament management for their turf

- Customer management

- Detailed occupancy and analytics dashboards

- Cash payment reconciliation alongside digital payments

- Stadium sound and countdown-intro settings for their turf

#### **9.3 Turf Staff Web Functionality**

- Today's bookings and check-in, as a desk-based alternative to Staff Mobile

- Match management and turf-managed live scoring

## **10. Complete Feature List**

The table below indexes every core feature defined in this PRD (Section 12) against its priority tier. Full detail for each feature is in Section 12.

| **#** | **Feature**                     | **Priority**                        |
| ----- | ------------------------------- | ----------------------------------- |
| 1     | Authentcaton & Role Management  | P0                                  |
| 2     | Player Profle                   | P0                                  |
| 3     | Team Management (Create/Manage) | P0                                  |
| 4     | Join Open Teams                 | P0                                  |
| 5     | Find Players                    | P0                                  |
| 6     | Team vs Team Matchmaking        | P1                                  |
| 7     | Turf Discovery                  | P0                                  |
| 8     | Turf Booking                    | P0                                  |
| 9     | Game / Match Creaton            | P0                                  |
| 10    | Game Room / Match Room          | P0                                  |
| 11    | Player Invitaton & Confrmaton   | P0                                  |
| 12    | Smart Match Coordinaton         | P0                                  |
| 13    | Smart Reminders                 | P0                                  |
| 14    | Atendance & Running-Late Status | P0                                  |
| 15    | Smart Auto Replacement          | P0 (basic) / P1 (smart<br>matching) |
| 16    | Payment System                  | P0                                  |
| 17    | Cancellaton & Refund            | P0                                  |
| 18    | Live Scoring                    | P0                                  |
| 19    | Player or Turf Staf Scoring     | P0                                  |
| 20    | Digital Scoreboard              | P1                                  |
| 21    | Match Statstcs                  | P0                                  |
| 22    | Fair Play System                | P1                                  |
| 23    | Fair Batng Rotaton              | P1                                  |
| 24    | Fair Bowling Rotaton            | P1                                  |
| 25    | New Player Protecton            | P1                                  |
| 26    | Fair Play Alerts                | P1                                  |
| 27    | Post-Match Fair Play Summary    | P1                                  |
| 28    | Smart Team Balancing            | P2                                  |

| **#** | **Feature**                      | **Priority**                  |
| ----- | -------------------------------- | ----------------------------- |
| 29    | Player Ratng System (Skill)      | P0 (basic) / P1<br>(advanced) |
| 30    | Reliability Score                | P1                            |
| 31    | Community Ratng                  | P1                            |
| 32    | Player Statstcs (Lifetme/Season) | P0                            |
| 33    | Rankings & Leaderboards          | P1                            |
| 34    | BFAM Coins                       | P1                            |
| 35    | XP & Player Levels               | P1                            |
| 36    | Rewards                          | P1                            |
| 37    | Achievements & Badges            | P1                            |
| 38    | Match Streaks                    | P1                            |
| 39    | Special Recogniton               | P2                            |
| 40    | Tournaments & Leagues            | P1                            |
| 41    | Tournament Points Table          | P1                            |
| 42    | Match Recording & Highlights     | P2                            |
| 43    | Match Chat & Communicaton        | P1                            |
| 44    | Rebook Same Players              | P1                            |
| 45    | Notfcatons                       | P0                            |
| 46    | Turf Owner Management            | P0                            |
| 47    | Staf Management                  | P0                            |
| 48    | Check-in                         | P0                            |
| 49    | Business Analytcs                | P1                            |
| 50    | Cancellaton / No-Show Analytcs   | P1                            |
| 51    | Memberships                      | P2                            |
| 52    | Ofers & Coupons                  | P1                            |
| 53    | Referral System                  | P1                            |
| 54    | Café                             | P2                            |
| 55    | Maintenance                      | P1                            |
| 56    | Reviews & Feedback               | P1                            |
| 57    | Support                          | P0                            |
| 58    | Locaton                          | P0                            |
| 59    | BFAM ID System                   | P0                            |
| 60    | Favorite Cricketer               | P0                            |

| **#** | **Feature**                     | **Priority** |
| ----- | ------------------------------- | ------------ |
| 61    | Cinematc Match Countdown Intro  | P0           |
| 62    | Mult-Payment Modes (incl. Cash) | P0           |
| 63    | Owner & Staf Mobile App         | P0           |
| 64    | Live Match Viewer Count         | P1           |
| 65    | Stadium Audio System            | P1           |

_Rows below the double line reflect Product Change Request v1.1 additions._

## **11. Feature Priorities**

Every feature is classified into P0 (MVP), P1 (Important), or P2 (Future/Advanced). Priorities reflect what is needed to actually run BFAM as a working product first, with community, gamification and advanced intelligence layered on afterward.

#### **11.1 P0 — Must Have / MVP**

The minimum system required to run real matches on BFAM end-to-end.

- Authentication & Role Management

- Player Profile

- BFAM ID System

- Favorite Cricketer

- Team Creation & basic management

- Join Team

- Find Players

- Turf Discovery

- Turf Booking

- Payment — UPI, gateway, Cash, Captain-Pays, Split Payment

- Match Creation

- Game Room

- Player Invitations & Confirmation

- Match Reminders

- Attendance tracking

- Basic Auto Replacement

- Cinematic Match Countdown Intro

- Live Score

- Match Statistics

- Basic Skill Rating

- Turf Owner Management (Web + Mobile)

- Staff Management (Web + Mobile)

- Check-in

- Notifications

- Support

- Location

#### **11.2 P1 — Important**

- Team vs Team Matchmaking

- Fair Play System (rotation, alerts, summary)

- Reliability Score

- Community Rating

- Player Rankings & Leaderboards

- Rewards, XP, BFAM Coins

- Achievements, Badges, Streaks

- Rebooking

- Match Chat

- Tournaments & Points Table

- Digital Scoreboard (in-app)

- Live Match Viewer Count

- Stadium Audio System

- Advanced player/opponent discovery

- Business & Cancellation Analytics

- Offers & Coupons

- Referral System

- Reviews & Feedback

- Maintenance tracking

#### **11.3 P2 — Future / Advanced**

- Match Recording & AI Highlights

- AI Player Performance Analysis

- AI Smart Team Balancing

- Smart demand prediction & dynamic pricing

- Advanced AI matchmaking

- Memberships

- Café ordering

- Special Recognition (Hall of Fame, monthly awards)

- IoT / arena hardware integration

- Premium BFAM ID Marketplace (e.g., BF7, BF18, BF45)

- Multiple stadium sound packs / owner-customizable audio

- Peak viewer analytics

_Reasoning: MVP focuses purely on making a real match happen — book, invite, confirm, pay, play, score. Fair play, reputation depth, and gamification (P1) meaningfully increase retention and community quality once the core loop works. AI-driven and hardware-dependent features (P2) add polish and differentiation but are not required to prove the core product._

## **12. Detailed Core Features**

#### **12.1 Authentication & Role Management**

###### **Priority: P0**

Establishes secure identity and role-based access for every user type.

- Registration, login, logout

- OTP verification

- Password management

- Profile creation

- Role-based access control

- Separate account contexts for Player, Turf Owner, Staff, Admin

#### **12.2 Player Profile**

###### **Priority: P0**

Every player has a persistent BFAM identity distinguishing four separate reputation signals: Skill Rating ≠ Fair Play Rating ≠ Reliability Score ≠ Community Rating.

- Name, profile picture, BFAM ID

- Playing role, batting style, bowling style, skill level, experience

- Career stats: matches, runs, wickets, strike rate, economy, highest score, catches, Player of the Match awards

- Skill Rating, Fair Play Rating, Reliability Score, Community Rating

- XP, BFAM Coins, Level

- Achievements, badges, current streak

- Match history, season statistics, lifetime statistics

#### **12.3 Team Management**

###### **Priority: P0**

Lets players form persistent teams rather than organizing from scratch every time.

- Create Team: name, logo, captain, members, description, skill level, statistics, match history, ranking

- Manage Team: invite/add/remove players, accept or reject join requests, leave team, change captain, view team statistics and history

#### **12.4 Join Open Teams**

###### **Priority: P0**

Helps a player without a team find one with vacant positions.

- Browse open teams with vacant positions

- Filter by skill level and location

- View team information and rating

- Request to join; captain approves or rejects

#### **12.5 Find Players**

###### **Priority: P0**

Helps a team or captain find a specific type of player quickly.

- Filter by location, skill level, playing role, availability, player rating, reliability, and Fair Play rating

- **_Example: "Find an intermediate-level bowler available tonight."_**

#### **12.6 Team vs Team Matchmaking**

###### **Priority: P1**

Lets teams find and challenge opponent teams directly.

- Create a match request; find opponents

- Send/receive/accept/reject challenges

- Match confirmation, details, and history

Depends on: Team Management, Turf Booking, Game / Match Creation.

#### **12.7 Turf Discovery**

###### **Priority: P0**

The entry point for finding a place to play.

- Turf list and details

- Photos, facilities, location, pricing, opening hours

- Availability, reviews, rating, map/navigation

#### **12.8 Turf Booking**

###### **Priority: P0**

Reserves a specific turf slot.

- Select date, time, duration, and turf

- View available/unavailable slots

- Booking confirmation and history

- Cancel, reschedule, or rebook

#### **12.9 Game / Match Creation**

###### **Priority: P0**

Turns a turf booking into an organized match.

- Match name/ID, turf, date, time, duration, format

- Number of players, team, opponent, player list

- Match organizer and scorer selection

- Payment method and match visibility

Supported match types: Friends Match, BFAM Fair Play Match, Tournament Match.

#### **12.10 Game Room / Match Room**

###### **Priority: P0**

The central hub for a specific match — every match gets a unique Match/Game ID.

- Match information: players, teams, turf, date/time

- Player confirmation and payment status

- Match chat and announcements

- Running-late status and replacement management

- Live score, match completion, and match summary

#### **12.11 Player Invitation & Confirmation**

###### **Priority: P0**

Coordinates who is actually playing.

- Invite friends/teammates, add players

- Share invitation link, WhatsApp sharing

- Player response and confirmation status

| **Status**  | **Meaning**               |
| ----------- | ------------------------- |
| Confrmed    | Commited to play          |
| Maybe       | Tentatve                  |
| Can't Play  | Declined                  |
| Pending     | Invited, awaitng response |
| No Response | No acton taken            |

#### **12.12 Smart Match Coordination**

###### **Priority: P0**

Automates the end-to-end journey so organizers make fewer phone calls.

_Book Turf → Create Game → Invite Players → Players Confirm → Payment → Smart Reminders → Attendance → Replacement if Needed → Play Match → Live Score → Match Results → Statistics → Ratings → Rewards → Rebook_

#### **12.13 Smart Reminders**

###### **Priority: P0**

Reduces no-shows and missed matches through timed nudges.

- 24-hour, 3-hour, 1-hour, and 15-minute match reminders

- Booking, payment, tournament, and replacement reminders

#### **12.14 Attendance & Running-Late Status**

###### **Priority: P0**

Keeps everyone informed in real time about who is actually showing up.

- Statuses: Confirmed, Attended, Late, Running Late, Cancelled, Replaced, No-show, No Response

- Players can post a running-late update; relevant players/captain/staff are notified automatically

##### **_Example: "I’m running 10 minutes late."_**

#### **12.15 Smart Auto Replacement**

###### **Priority: P0 (basic) / P1 (smart matching)**

Finds a substitute quickly when a player cancels.

_Player Cancels → Vacancy Detected → BFAM Finds Suitable Players → Suggested Players → Captain Invites → Player Accepts → Player Added_

Matching considers: location, availability, skill, playing role, rating, reliability, Fair Play, and previous participation.

#### **12.16 Payment System**

###### **Priority: P0**

Handles the money side of a match without manual collection, across every payment mode BFAM actually needs to support at grassroots turfs.

- Payment modes: UPI, payment gateway (card/netbanking/wallet), Cash, Captain-Pays (full amount upfront), Split Payment (each player pays their share)

- Every payment records its mode, status, who collected it, and a transaction reference for digital payments

- Cash payments still create a full payment record so they can be reconciled like any digital payment

- Payment status, pending payment, reminders, history, refunds, transaction history

#### **12.17 Cancellation & Refund**

###### **Priority: P0**

Defines how cancellations are handled financially.

- Configurable rules for early, late, and very-late cancellation, and no-shows

- Refund, partial refund, and penalty outcomes — exact rules are configurable by the turf owner/admin, not fixed by this PRD

#### **12.18 Live Scoring**

###### **Priority: P0**

A complete, real-time cricket scoring system.

- Runs, wickets, overs, balls, target, required run rate, current run rate

- Batsman, bowler, partnership, fall of wickets, extras, commentary, match result

- Ball events: 0, 1, 2, 3, 4, 6, Wide, No Ball, Bye, Leg Bye, Wicket

#### **12.19 Player or Turf Staff Scoring**

###### **Priority: P0**

Lets the organizer decide who runs the scoreboard for a given match.

- Player Managed Scoring: captain/player runs the scoreboard

- Turf Managed Scoring: turf owner/staff runs the scoreboard

- Score updates in real time regardless of who is scoring

#### **12.20 Digital Scoreboard**

###### **Priority: P1**

Displays the live score wherever players and spectators are looking.

- Available on mobile app, future web interface, and physical LCD/TV at the arena

- Updates in real time

#### **12.21 Match Statistics**

###### **Priority: P0**

Converts a completed match into lasting player records.

- Runs, balls, strike rate, overs, wickets, economy, catches, extras, partnerships

- Player of the Match and match result

- Automatically updates player career statistics

#### **12.22 Fair Play System**

###### **Priority: P1**

A dedicated system encouraging fair participation across three modes: Friends Match (no enforced rules), BFAM Fair Play Mode, and Tournament Mode.

- Equal opportunity tracking, batting rotation, bowling rotation

- Participation tracking, new player protection

- Fair Play alerts, post-match participation summary

- Team Fair Play Score and Individual Fair Play Rating

**_BFAM does not guarantee equal performance. It provides a system designed to encourage fair participation._**

#### **12.23 Fair Batting Rotation**

###### **Priority: P1**

Tracks batting opportunity within a match.

- Batting order, balls faced, players who have/haven't batted, new player participation

**_Example suggestion: "Nikhil has received significantly less batting opportunity. Consider giving him an earlier batting position."_**

#### **12.24 Fair Bowling Rotation**

###### **Priority: P1**

Tracks bowling opportunity within a match.

- Overs bowled, players who have/haven't bowled, bowling opportunity, recommendations where appropriate

#### **12.25 New Player Protection**

###### **Priority: P1**

Helps first-time players feel welcome and included.

- Identify new players and track first-time participation

- Track batting opportunity, bowling opportunity, and team inclusion

**_Goal: Make new players feel welcome._**

#### **12.26 Fair Play Alerts**

###### **Priority: P1**

Surfaces participation gaps during the match, without forcing action.

- Alerts for players who haven't batted or bowled, uneven participation, or new players receiving low opportunity

- Suggestions to captains are non-forcing

#### **12.27 Post-Match Fair Play Summary**

###### **Priority: P1**

Closes the loop on fairness after the match ends.

- Player participation, runs, balls, overs, wickets, fielding, Fair Play Score

- Team Fair Play Score is calculated

**_Example: 94/100 — Great Game! Well Protected!_**

#### **12.28 Smart Team Balancing**

###### **Priority: P2**

Suggests balanced teams when forming sides.

- Uses player rating, skill level, performance, playing role, and experience

- **_Goal: Balanced teams = Better matches._**

#### **12.29 Player Rating System (Skill Rating)**

###### **Priority: P0 (basic) / P1 (advanced)**

A performance-based numeric rating distinct from Fair Play, Reliability, and Community ratings.

- Considers runs, strike rate, wickets, economy, catches, match results, Player of the Match, and overall contribution

**_Example: BFAM Rating: 842_**

#### **12.30 Reliability Score**

###### **Priority: P1**

Measures dependability, kept fully separate from Skill Rating.

- Considers confirming on time, showing up, completing matches, avoiding last-minute cancellations and noshows, and regular participation

- Higher reliability may unlock better invitations, priority matchmaking, rewards, and special benefits

#### **12.31 Community Rating**

###### **Priority: P1**

Tracks community-oriented reputation.

- Sportsmanship, helping teams, welcoming new players, fair play, respectful behavior, reliability

#### **12.32 Player Statistics**

###### **Priority: P0**

Presents both lifetime and season-scoped records.

- Lifetime: matches, runs, wickets, strike rate, economy, best score, catches, Player of the Match

- Season: current matches, runs, wickets, best score, strike rate, economy, catches, Player of the Match, current streak

#### **12.33 Rankings & Leaderboards**

###### **Priority: P1**

Surfaces top performers across multiple dimensions.

- Top players, best batsmen, bowlers, all-rounders, and highest-rated players

- Most runs, wickets, sixes; best strike rate and economy; MVP

- Fair Play leaderboard, Reliability leaderboard, Tournament leaderboard

#### **12.34 BFAM Coins (BC)**

###### **Priority: P1**

A virtual currency rewarding positive platform behavior. Coin values are configurable, not hardcoded.

- Earned by completing matches, booking turf, winning matches, Player of the Match, referring players, bringing new teams, arriving on time, maintaining streaks, monthly loyalty, and Fair Play behavior

#### **12.35 XP & Player Levels**

###### **Priority: P1**

A separate progression system from BFAM Coins.

- Example levels: Newbie, Rookie, Player, Pro, Elite, Legend

- Players can view current XP, level, progress to next level, and XP history

#### **12.36 Rewards**

###### **Priority: P1**

Redeemable benefits earned through play and engagement.

- Booking discounts, free matches/challenges, merchandise, priority booking

- Exclusive badges, tournament discounts, café discounts, membership benefits

#### **12.37 Achievements & Badges**

###### **Priority: P1**

Recognizes specific milestones.

- Examples: First Match, Century Club, Six Machine, Hat-Trick Hero, Match Streak, BFAM Legend, Fair Play Champion, Reliable Player, Top Performer

#### **12.38 Match Streaks**

###### **Priority: P1**

Tracks consecutive participation to encourage regular play.

- Current streak, best streak, consecutive participation, streak rewards and bonuses

#### **12.39 Special Recognition**

###### **Priority: P2**

Highlights standout community members periodically.

- Player of the Month, Sportsman of the Month, Top Performer, Hall of Fame

- Team Loyalty Rewards, Reliability Recognition, Season Awards, Tournament Awards

#### **12.40 Tournaments & Leagues**

###### **Priority: P1**

Structured competitive play across teams.

- Tournament creation, team/player registration, entry fees

- Fixtures, match scheduling, live scores, points table

- Knockout bracket, semi-finals, finals, winner, MVP, awards

Formats: League, Knockout, Round Robin, Corporate tournament, Community tournament.

#### **12.41 Tournament Points Table**

###### **Priority: P1**

Automatically calculated tournament standings.

- Played, Won, Lost, Tie, No Result, Points, Net Run Rate

#### **12.42 Match Recording & Highlights**

###### **Priority: P2**

Future/advanced capability to capture and share match moments.

- Match recording and highlights; six/four/wicket highlights

- Best moments, player highlights, match video, share highlights

#### **12.43 Match Chat & Communication**

###### **Priority: P1**

Keeps coordination inside BFAM instead of external apps.

- Group chat, match announcements, location sharing

- Running-late updates, important messages, team coordination

**_Goal: Reduce dependency on external WhatsApp groups and phone calls._**

#### **12.44 Rebook Same Players**

###### **Priority: P1**

Makes it effortless for a group to play again.

##### **_Rebook Same Players_**

Reuses the same players, same team, same turf, same preferred time, and same match format.

#### **12.45 Notifications**

###### **Priority: P0**

Push notifications are the primary notification mechanism.

- Booking confirmation, match invitation, player confirmation, match reminder, payment reminder

- Player cancellation, replacement request/accepted, match starting, match result

- Rating update, reward received, tournament update

#### **12.46 Turf Owner Management**

###### **Priority: P0**

Core toolset for running a turf business.

- Turf details, photos, facilities, pricing, availability

- Bookings, customers, staff, matches, live score

- Revenue, occupancy, offers, maintenance

#### **12.47 Staff Management**

###### **Priority: P0**

Lets owners delegate day-to-day operations.

- Staff accounts and permissions

- Today's bookings, check-in, booking verification

- Match management, live scoring, customer assistance, turf status

#### **12.48 Check-in**

###### **Priority: P0**

Confirms physical arrival at the turf.

- Via booking confirmation, QR code, or staff verification

- Tracks Checked in, Late, No-show

#### **12.49 Business Analytics**

###### **Priority: P1**

Gives turf owners/admins visibility into performance.

- Total bookings, revenue, occupancy, peak hours, popular days

- Active players/teams, match count, tournament and membership revenue

- Customer growth, cancellation rate, no-show rate

#### **12.50 Cancellation / No-Show Analytics**

###### **Priority: P1**

Focused reporting on reliability issues.

- Cancellations, late cancellations, no-shows, replacement frequency, refunds, reliability impact

#### **12.51 Memberships**

###### **Priority: P2**

Recurring-revenue loyalty tier.

- Monthly/annual plans; booking, tournament, and café discounts

- Priority booking, exclusive events, membership expiry

#### **12.52 Offers & Coupons**

###### **Priority: P1**

Promotional tools for turf owners and the platform.

- Discount coupons, first-booking offers, weekend offers

- Membership offers, tournament offers, referral offers, player rewards

#### **12.53 Referral System**

###### **Priority: P1**

Grows the platform through existing users.

- Referral code, invite friends, referral tracking

- New-user and existing-user rewards

#### **12.54 Café (if applicable to the turf)**

###### **Priority: P2**

Ancillary revenue for turfs with an on-site café. This remains optional/future scope depending on the physical business setup.

- Menu, food/drink ordering, order tracking

- Online payment, café management, inventory

#### **12.55 Maintenance**

###### **Priority: P1**

Operational tracking for turf upkeep.

- Turf maintenance, lighting, nets, equipment, cleaning, electrical issues, other tasks

#### **12.56 Reviews & Feedback**

**Priority: P1**

Builds trust in turf quality and lets players submit general feedback.

- Turf: facilities, cleanliness, overall experience

- Staff: service, helpfulness

- General feedback submission

#### **12.57 Support**

###### **Priority: P0**

Ensures players and owners can get help.

- Help center, contact BFAM, call support, WhatsApp support

- Complaint submission: booking issue, payment issue, refund request

#### **12.58 Location**

###### **Priority: P0**

Helps players physically get to the turf.

- Turf location, maps, navigation, parking information, operating hours, contact details

#### **12.59 BFAM ID System**

###### **Priority: P0**

Gives every player a unique, permanent, India-wide public identity — distinct from any internal account ID — similar in spirit to a jersey number.

- Issued automatically at registration, sequential starting from BF1000 (e.g., BF1000, BF1001, BF1002)

- Immutable once assigned

- Displayed on Player Profile, Live Score, Scorecard, Statistics, and Rankings/Leaderboards

- Premium BFAM IDs (e.g., BF7, BF18, BF45, BF99) are reserved for a future marketplace, which is explicitly out of scope for now — no marketplace is designed at this stage

#### **12.60 Favorite Cricketer**

###### **Priority: P0**

Lets a player personalize their profile during onboarding without BFAM building or maintaining its own cricketer database.

- Fast, typo-tolerant autocomplete search covering international and IPL players, with photo preview

- Backed by a public/open-source cricket data API rather than a proprietary BFAM database

- BFAM stores only the selected player's name and an external reference ID

- Optional and skippable during registration

#### **12.61 Cinematic Match Countdown Intro**

###### **Priority: P0**

Turns the start of a live match into a stadium-style moment instead of a plain “begin scoring” tap.

- Full-screen 10-second countdown when the scorer starts the match

- Playing XI reveal for each team, showing player names, captain indicator, and BFAM IDs

- Toss result shown before the live scoreboard appears

- Optional background music toggle, controllable by the turf owner

#### **12.62 Live Match Viewer Count**

###### **Priority: P1**

Makes a live match feel like a real, watched event by showing how many people are currently following it.

- Displays current live viewers and total views on the Live Score screen (e.g., "👁 247 Watching Live")

- Updates in real time over WebSockets

- Correctly de-duplicates a single viewer's multiple sessions/devices

- Peak viewer tracking is deferred to a later phase

#### **12.63 Stadium Audio System**

###### **Priority: P1**

Adds event-triggered sound cues to live scoring so key moments feel bigger, without BFAM designing or licensing copyrighted sound assets.

- Sound events: six, four, wicket, fifty, century, hat-trick, match won, toss, countdown start

- Triggered directly from recorded score events and synchronized with the live scoreboard

- Turf owner can enable or disable sounds for their turf

- Multiple sound packs are future scope beyond the initial event-driven system

## **13. User Journeys**

#### **13.1 New Player Journey**

_Download App → Register → Choose Favorite Cricketer → Receive BFAM ID → Create Profile → Select Skill/Playing Role → Discover Turf/Teams → Join Team OR Create Team → Find Match → Book Turf → Join Game Room → Confirm Participation → Pay → Receive Reminders → Check In → Countdown & Playing XI → Play → Live Score (with Crowd Watching) → Match Statistics → Rating → Fair Play → XP/Coins → Rewards → Rebook_

#### **13.2 Team Captain Journey**

_Create Team → Add Players → Find Opponent → Book Turf → Create Match → Invite Players → Track Confirmations → Track Payments → Receive Reminders → Handle Replacement → Manage Match → Live Score → Match Completion → Statistics → Rewards → Rebook_

#### **13.3 Turf Owner Journey**

_Register Turf → Add Turf Details → Set Pricing → Set Availability → Receive Booking → Manage Players → Check-in → Manage Match → Manage Live Score → Complete Match → Receive Payment → View Revenue → View Analytics → Manage Customers → Manage Staff_

## **14. Match Lifecycle**

Every match on BFAM follows the same overall lifecycle, regardless of whether it is a Friends Match, a Fair Play match, or a Tournament match:

**1.** Book

↓

**2.** Create Game

↓

**3.** Invite

↓

**4.** Confirm

↓

**5.** Pay

↓

**6.** Remind

↓

**7.** Attendance

↓

**8.** Replace if needed

↓

**9.** Countdown Intro & Playing XI

↓

**10.** Toss

↓

**11.** Play

↓

**12.** Live Score

↓

**13.** Result

↓

**14.** Statistics

↓

**15.** Rating

↓

**16.** Fair Play

↓

**17.** Rewards

↓

**18.** Rebook

## **15. Business Rules**

High-level rules governing platform behavior. Numbers and thresholds referenced elsewhere in this document (coin values, XP formulas, cancellation windows) are configurable examples, not fixed business rules.

- Only available turf slots can be booked.

- A turf slot cannot be double-booked.

- Match participants must be confirmed before the match starts.

- Payment status must be tracked at all times.

- A cancelled player may trigger the replacement workflow.

- Player statistics update automatically after match completion.

- Ratings update based on match performance.

- Fair Play tracking occurs during Fair Play (and Tournament) matches.

- Rewards are awarded based on configured rules, not hardcoded values.

- XP and BFAM Coins are separate systems and do not convert into one another by default.

- Reliability Score is tracked separately from Skill Rating.

- A captain can manage their own team/match, not other teams' matches.

- Turf owners control their own turf's availability and pricing.

- Staff access is permission-based, set by the turf owner.

- Admin has platform-level control across all turfs, users, and teams.

## **16. Notifications & Communication**

#### **16.1 Notification Types**

- Booking confirmation

- Match invitation

- Player confirmation

- Match reminder

- Payment reminder

- Player cancellation

- Replacement request / replacement accepted

- Match starting

- Match result

- Rating update

- Reward received

- Tournament update

Mobile push notifications are the primary notification mechanism.

#### **16.2 Match Chat & Communication**

- Group chat scoped to the Game Room

- Match announcements and important messages

- Location sharing and running-late updates

- Team coordination, invitation link sharing, and WhatsApp sharing

## **17. Payments**

#### **17.1 Payment Models**

- Pay During Booking — captain/user pays the turf fee while booking

- Pay After Match — the team plays first and pays at the end

- Split Payment — individual players pay their own share

#### **17.2 Payment Tracking**

- Captain, individual, and team payment types

- Online payment processing

- Payment status: paid, pending

- Payment reminders and full payment/transaction history

- Refunds

#### **17.3 Cancellation & Refund**

- Configurable rules for early, late, and very-late cancellation, and no-shows

- Outcomes: full refund, partial refund, or penalty — exact thresholds are configured by the turf owner/admin

## **18. Fair Play System**

A dedicated BFAM system that encourages every participant to get a fair opportunity to play, without guaranteeing equal performance outcomes.

#### **18.1 Modes**

| **Mode**            | **Descripton**                                        |
| ------------------- | ----------------------------------------------------- |
| Friends Match       | Players play freely without enforced fair-play rules. |
| BFAM Fair Play Mode | The system actvely encourages fair partcipaton.       |
| Tournament Mode     | Tournament-specifc rules and formats apply.           |

#### **18.2 Components**

- Equal opportunity tracking

- Fair batting rotation and fair bowling rotation

- Participation tracking and new player protection

- Fair Play alerts during the match

- Post-match participation summary

- Team Fair Play Score and Individual Fair Play Rating

**_BFAM does not guarantee equal performance. It provides a system designed to encourage fair participation._**

## **19. Rating & Reputation System**

BFAM maintains four distinct reputation signals per player. They must never be merged into a single score.

| **Signal**        | **What It Measures**                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Skill Ratng       | On-feld performance: runs, strike rate, wickets, economy, catches, match results, Player<br>of the Match, overall contributon. Example: BFAM Ratng 842. |
| Fair Play Ratng   | How fairly a player partcipates and shares opportunity with others, tracked via the Fair<br>Play System.                                                |
| Reliability Score | Dependability: confrming on tme, showing up, completng matches, avoiding<br>cancellatons and no-shows, regular partcipaton.                             |
| Community Ratng   | Sportsmanship, helping teams, welcoming new players, fair play, and respectul behavior.                                                                 |

Higher Reliability may unlock better invitations, priority matchmaking, rewards, and special benefits.

#### **19.1 Rankings & Leaderboards**

- Top players, best batsmen/bowlers/all-rounders, highest-rated players

- Most runs, most wickets, most sixes, best strike rate, best economy, MVP

- Fair Play leaderboard, Reliability leaderboard, Tournament leaderboard

## **20. Rewards & Gamification**

#### **20.1 BFAM Coins (BC)**

A virtual currency, earned through completing matches, booking turf, winning matches, Player of the Match, referring players, bringing new teams, arriving on time, maintaining match streaks, monthly loyalty, and Fair Play behavior. Coin values are configurable, not hardcoded.

#### **20.2 XP & Player Levels**

A progression system separate from BFAM Coins. Example levels: Newbie, Rookie, Player, Pro, Elite, Legend. Players can view current XP, level, progress toward the next level, and XP history.

#### **20.3 Rewards**

- Booking discounts, free matches/challenges, merchandise

- Priority booking, exclusive badges, tournament discounts, café discounts, membership benefits

#### **20.4 Achievements & Badges**

Examples: First Match, Century Club, Six Machine, Hat-Trick Hero, Match Streak, BFAM Legend, Fair Play Champion, Reliable Player, Top Performer.

#### **20.5 Match Streaks**

Tracks current streak, best streak, consecutive participation, and streak rewards/bonuses.

#### **20.6 Special Recognition (Future)**

Player of the Month, Sportsman of the Month, Top Performer, Hall of Fame, Team Loyalty Rewards, Reliability Recognition, Season Awards, Tournament Awards.

## **21. Tournaments & Leagues**

- Tournament creation, team registration, player registration, entry fees

- Fixtures, match scheduling, live scores, points table

- Knockout bracket, semi-finals, finals, winner, MVP, awards

#### **21.1 Formats**

- League

- Knockout

- Round Robin

- Corporate tournament

- Community tournament

#### **21.2 Tournament Points Table**

Automatically calculated: Played, Won, Lost, Tie, No Result, Points, Net Run Rate.

## **22. Turf Owner & Staff Management**

#### **22.1 Turf Owner**

- Turf details, photos, facilities, pricing, availability

- Bookings, customers, staff, matches, live score

- Revenue, occupancy, offers, maintenance

#### **22.2 Staff**

- Staff accounts and permissions

- Today's bookings, check-in, booking verification

- Match management, live scoring, customer assistance, turf status

#### **22.3 Check-in**

- Via booking confirmation, QR code, or staff verification

- Tracks Checked in, Late, No-show

## **23. Analytics**

#### **23.1 Business Analytics**

- Total bookings, revenue, occupancy, peak hours, popular days

- Active players, active teams, match count

- Tournament revenue, membership revenue

- Customer growth, cancellation rate, no-show rate

#### **23.2 Cancellation / No-Show Analytics**

- Cancellations, late cancellations, no-shows

- Replacement frequency, refunds, reliability impact

## **24. Non-Functional Requirements**

#### **24.1 Performance**

- Fast application response

- Real-time scoreboard updates

- Efficient booking availability checks

#### **24.2 Reliability**

- No double bookings

- Reliable payment status tracking

- Reliable score synchronization across devices

#### **24.3 Security**

- Secure authentication (JWT)

- Role-based access control (RBAC)

- Secure payment processing

- Input validation and API protection

#### **24.4 Scalability**

The system should be designed so BFAM can eventually expand from one turf, to multiple turfs, to multiple cities.

#### **24.5 Availability**

The application should remain usable during active matches and peak booking periods.

#### **24.6 Mobile-First Requirements**

- Mobile-first navigation and fast loading

- Push notifications and real-time updates

- Camera and location support; QR scanning

- Mobile payments and deep links

- Shareable invitations and WhatsApp sharing

- Responsive layouts across different phone sizes

The player experience should be optimized for one-handed, quick interactions during real-world match situations.

#### **24.7 Cross-Platform Delivery**

BFAM will be delivered as a cross-platform mobile application using a single shared codebase for Android and iOS — not as two independently developed native applications. This applies to the Player, Turf Owner, and Turf Staff mobile experiences alike; role-based navigation and permissions determine what each user sees within that one codebase (see Section 8).

## **25. MVP Scope**

#### **25.1 MVP Hypothesis**

The first version of BFAM should not attempt to build every feature in this PRD. The MVP exists to prove one critical hypothesis:

##### **_Can BFAM make organizing and playing a box-cricket match significantly easier than doing everything manually through calls and WhatsApp?_**

The MVP should allow a group of players to discover/book a turf, create a match, invite players, pay, play the match, update live scores, and receive statistics. Once this core loop works reliably, BFAM can gradually introduce matchmaking, Fair Play, reliability, rewards, XP, tournaments, advanced analytics, and AI features.

#### **25.2 MVP Core Loop**

**Player** ↓ **Profile** ↓ **Find / Book Turf** ↓ **Create Team** ↓ **Create Match** ↓ **Invite Players** ↓ **Confirm Players** ↓ **Payment** ↓ **Game Room** ↓ **Play** ↓ **Live Score** ↓ **Match Result** ↓ **Statistics** ↓ **Basic Rating** ↓ **Rebook**

#### **25.3 MVP Feature List**

The MVP focuses on making a real, complete box-cricket match happen on BFAM, from booking to statistics, without the deeper gamification and community layers.

- Authentication & Role Management

- Player Profile

- BFAM ID System

- Favorite Cricketer

- Team Creation & basic management

- Join Team

- Find Players

- Turf Discovery & Booking

- Payment — UPI, gateway, Cash, Captain-Pays, Split Payment

- Game / Match Creation

- Game Room

- Player Invitation & Confirmation

- Smart Reminders

- Attendance tracking

- Basic Auto Replacement

- Cinematic Match Countdown Intro

- Live Scoring

- Match Statistics

- Basic Skill Rating

- Turf Owner & Staff Management (Web + Mobile)

- Check-in

- Notifications

- Support

- Location

## **26. Phase 2 Scope**

- Team vs Team Matchmaking

- Full Fair Play System (rotation, alerts, post-match summary)

- Reliability Score and Community Rating

- Rankings & Leaderboards

- BFAM Coins, XP & Levels, Rewards, Achievements, Streaks

- Rebooking and Match Chat

- Tournaments & Leagues with Points Table

- Digital Scoreboard (in-app)

- Live Match Viewer Count

- Stadium Audio System

- Business & Cancellation/No-Show Analytics

- Offers & Coupons, Referral System, Reviews & Feedback, Maintenance tracking

## **27. Future Scope**

Marked explicitly as future scope; not part of MVP or required for BFAM's initial success.

- AI Player Performance Analysis

- AI Match Highlights / Automatic Video Highlights

- AI Team Formation and Smart Team Balancing

- Smart Player Matching and Smart Opponent Matching

- Demand Prediction and Dynamic Turf Pricing

- AI-based player recommendations

- Camera integration and Smart digital scoreboard hardware

- IoT-based turf management

- Memberships

- Café ordering

- Special Recognition (Hall of Fame, monthly awards)

- Match Recording & Highlights

- Premium BFAM ID Marketplace (e.g., BF7, BF18, BF45, BF99)

- Multiple stadium sound packs / owner-customizable audio

- Peak viewer analytics

## **28. Success Metrics / KPIs**

#### **28.1 Player Metrics**

- Number of registered players

- Monthly active players

- Match participation

- Average matches per player per month

- Player retention

- Team creation rate

- Team joining rate

- Rebooking rate

#### **28.2 Booking Metrics**

- Total bookings

- Booking conversion rate

- Turf occupancy

- Repeat booking rate

- Cancellation rate

- No-show rate

#### **28.3 Match Metrics**

- Matches created

- Matches completed

- Average players per match

- Replacement success rate

- Confirmation rate

- On-time arrival rate

#### **28.4 Financial Metrics**

- Booking revenue

- Average booking value

- Payment completion rate

- Membership revenue

- Tournament revenue

- Café revenue

#### **28.5 Community Metrics**

- Active teams

- Player matchmaking success

- Opponent matchmaking success

- Fair Play scores

- Reliability scores

- Referral rate

#### **28.6 Engagement Metrics**

- XP earned

- Rewards redeemed

- Match streaks

- Leaderboard engagement

- Tournament participation

- Rebooking rate

## **29. Product Differentiators**

#### **29.1 Complete Cricket Ecosystem**

Booking + Teams + Matchmaking + Live Scoring + Stats + Rewards, in one product.

#### **29.2 Smart Match Coordination**

Book → Invite → Confirm → Pay → Remind → Replace → Play, fully coordinated inside the app.

#### **29.3 Fair Play**

Encourages every participant to receive opportunities to bat and bowl.

#### **29.4 Player Identity**

Skill + Fair Play + Reliability + Community reputation, kept as four distinct signals.

#### **29.5 Rewards & Progression**

BFAM Coins + XP + Levels + Badges + Rankings.

#### **29.6 Community**

Find players, create teams, find opponents, and build recurring groups.

#### **29.7 Live Experience**

Live scoring + statistics + highlights + arena scoreboard.

#### **29.8 Rebooking & Retention**

Makes it easy for the same group to play again.

## **30. Complete Site Map — Screen-Level Detail**

BFAM is mobile-first, so “page” means mobile application screen. Admin and Turf Owner functionality can additionally be provided through the web dashboard (Section 9). Priority uses Must-have / Should-have / Nice-to-have, mapped to the P0/P1/P2 tiers used elsewhere in this document.

#### **30.1 Public & Authentication Screens**

| **Screen**        | **Purpose**                                 | **Priority** |
| ----------------- | ------------------------------------------- | ------------ |
| Splash Screen     | BFAM branding and app initalizaton          | Must-have    |
| Onboarding        | Explain BFAM's core value to frst-tme users | Should-have  |
| Login             | Existng users sign in                       | Must-have    |
| Signup            | Create a new account                        | Must-have    |
| OTP Verifcaton    | Verify phone/email                          | Must-have    |
| Forgot Password   | Recover account access                      | Should-have  |
| Role Selecton     | Choose Player / Turf Owner / Staf path      | Must-have    |
| Terms & Conditons | Legal terms                                 | Must-have    |
| Privacy Policy    | Data handling informaton                    | Must-have    |
| Help / FAQ        | Basic self-serve support                    | Should-have  |

#### **30.2 Player Home & Turf Screens**

| **Screen**         | **Purpose**                                                                                                                                | **Priority** |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| Player Home        | Personalized overview: upcoming match/booking, quick<br>actons, stats, ratng, XP/Coins, notfcatons                                         | Must-have    |
| Discover           | Explore turfs, teams, players, matches, tournaments, nearby<br>games                                                                       | Must-have    |
| Turf Listng        | Browse turfs with name, image, locaton, ratng, price,<br>distance, available slots; flter by<br>locaton/price/ratng/availability/facilites | Must-have    |
| Turf Details       | Photos, descripton, facilites, locaton, pricing, hours, reviews,<br>ratng, available slots, navigaton                                      | Must-have    |
| Turf Availability  | Calendar of available/booked slots, pricing, duraton                                                                                       | Must-have    |
| Booking            | Select date, tme, duraton, payment method; confrm                                                                                          | Must-have    |
| Booking Confrmaton | Booking ID, turf, date/tme/duraton, amount, payment status,<br>Match/Game ID                                                               | Must-have    |
| My Bookings        | Upcoming, completed, and cancelled bookings with details and<br>payment status                                                             | Must-have    |

#### **30.3 Team Screens**

| **Screen**      | **Purpose**                                                                                            | **Priority** |
| --------------- | ------------------------------------------------------------------------------------------------------ | ------------ |
| My Teams        | Teams joined, role in each, team ratng, upcoming team<br>matches                                       | Must-have    |
| Create Team     | Name, logo, descripton, skill level, playing format, open<br>positons                                  | Must-have    |
| Team Details    | Logo, captain, members, skill level, ratng, match history,<br>statstcs, rankings                       | Must-have    |
| Team Management | Captain tools: invite, accept/reject requests, remove players,<br>change captain, open/close vacancies | Must-have    |
| Open Teams      | Discover teams with vacancies; flter by<br>locaton/skill/role/vacancies/ratng                          | Must-have    |
| Join Team       | View team → request to join → captain reviews →<br>accept/reject                                       | Must-have    |

#### **30.4 Player Discovery & Matchmaking Screens**

| **Screen**                          | **Purpose**                                                                                                                                                 | **Priority** |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Find Players                        | Filter by locaton, skill, role, availability, ratng, reliability, Fair<br>Play                                                                              | Should-have  |
| Player Profle                       | Profle, skill ratng, statstcs, Fair Play, reliability, community<br>ratng, achievements, badges, match history                                              | Must-have    |
| Find Opponents                      | Discover opponent teams: name, locaton, skill, ratng,<br>availability, recent matches                                                                       | Should-have  |
| Match Challenge                     | Find team → challenge → select date/turf → send request                                                                                                     | Should-have  |
| Match Requests                      | Sent/received challenges: accepted, rejected, pending                                                                                                       | Should-have  |
| **31.5 Match & Live**<br>**Screen** | **Match Screens**<br>**Purpose**                                                                                                                            | **Priority** |
| Create Game                         | Match name, turf, date/tme/duraton, format, team,<br>opponent, players, scorer, payment method, visibility                                                  | Must-have    |
| Game Room                           | Central hub: match details, players, teams, turf, date/tme,<br>confrmatons, payments, chat, announcements, running-late,<br>replacement, live score, result | Must-have    |
| Invite Players                      | Invite friends/team members; share link; WhatsApp sharing                                                                                                   | Must-have    |
| Player Confrmaton                   | Confrmed / Maybe / Can't Play / Pending / No Response                                                                                                       | Must-have    |
| Atendance                           | Confrmed, Checked in, Running late, Cancelled, Replaced, No-<br>show                                                                                        | Must-have    |
| Replacement                         | Vacancy → suggested players → invite → accept → added                                                                                                       | Should-have  |
| Live Score                          | Score, overs, wickets, current batsmen, bowler, target,                                                                                                     | Must-have    |

#### **30.5 Match & Live Match Screens**

| **Screen**        | **Purpose**<br>required runs, run rate, commentary                               | **Priority** |
| ----------------- | -------------------------------------------------------------------------------- | ------------ |
| Scoring Interface | Record dot/1/2/3/4/6, Wide, No Ball, Bye, Leg Bye, Wicket                        | Must-have    |
| Scorer Selecton   | Choose Player Scoring or Turf Staf Scoring before the match                      | Must-have    |
| Scorecard         | Complete innings informaton                                                      | Must-have    |
| Match Result      | Winner, fnal score, Player of the Match, statstcs, ratngs, Fair<br>Play, rewards | Must-have    |

#### **30.6 Statistics, Reputation & Rewards Screens**

| **Screen**      | **Purpose**                                                                                                                    | **Priority** |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| Player Statstcs | Lifetme and season stats: matches, runs, wickets, strike rate,<br>economy, best score, catches, awards                         | Must-have    |
| Ratng           | BFAM Skill Ratng, ratng history, performance trends                                                                            | Should-have  |
| Reliability     | Atendance, cancellatons, no-shows, confrmaton behavior                                                                         | Should-have  |
| Fair Play       | Fair Play ratng, match partcipaton, Team Fair Play Score                                                                       | Should-have  |
| Leaderboards    | Top players, best batsmen/bowlers/all-rounders, most<br>runs/wickets, best strike rate/economy, MVP, Fair Play,<br>Reliability | Should-have  |
| Rewards         | BFAM Coins, XP, level, badges, achievements, streaks,<br>redeemable rewards                                                    | Should-have  |

#### **30.7 Tournament, Communication & Payment Screens**

| **Screen**                                                   | **Purpose**                                                                                                                     | **Priority** |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Tournament Listng / Details                                  | Browse tournaments; format, rules                                                                                               | Should-have  |
| Registraton / Fixtures / Points<br>Table / Bracket / Results | Full tournament lifecycle screens                                                                                               | Should-have  |
| Match Chat                                                   | Group chat, announcements, running-late messages, locaton<br>sharing                                                            | Should-have  |
| Notfcatons                                                   | Match invitatons, booking confrmaton, payment/match<br>reminders, replacement requests, results, rewards,<br>tournament updates | Must-have    |
| Payment Selecton /<br>Checkout / Status                      | Choose method, pay, view status                                                                                                 | Must-have    |
| Split Payment                                                | Individual share tracking among players                                                                                         | Must-have    |
| Payment History / Refund<br>Status / Booking Invoice         | Transacton records and receipts                                                                                                 | Must-have    |

#### **30.8 Player Settings**

| **Screen**                                   | **Purpose**                  | **Priority** |
| -------------------------------------------- | ---------------------------- | ------------ |
| Profle Setngs                                | Edit profle informaton       | Must-have    |
| Notfcaton Setngs                             | Manage notfcaton preferences | Must-have    |
| Privacy Setngs                               | Control profle visibility    | Must-have    |
| Payment Methods                              | Manage saved payment methods | Must-have    |
| Language                                     | Select app language          | Should-have  |
| Help & Support / Terms /<br>Privacy / Logout | Standard account screens     | Must-have    |

#### **30.9 Turf Owner Dashboard (Mobile)**

| **Screen**              | **Purpose**                                                                                  | **Priority** |
| ----------------------- | -------------------------------------------------------------------------------------------- | ------------ |
| Dashboard               | Today's bookings, revenue, occupancy, upcoming matches,<br>today's players, pending payments | Must-have    |
| Turf Management         | Turf details, photos, facilites, pricing, operatng hours                                     | Must-have    |
| Availability Management | Available slots, block slots, maintenance slots, holiday schedule                            | Must-have    |
| Booking Management      | Upcoming bookings, details, customer info, payment status,<br>cancellaton                    | Must-have    |
| Match Management        | Today's matches, players, teams, match status, scoring                                       | Must-have    |
| Staf Management         | Add/remove staf, permissions, staf actvity                                                   | Must-have    |
| Revenue & Analytcs      | Revenue, bookings, occupancy, peak hours, cancellaton,<br>customer growth                    | Should-have  |

#### **30.10 Admin Dashboard (Web)**

| **Screen**            | **Purpose**                                                                 | **Priority** |
| --------------------- | --------------------------------------------------------------------------- | ------------ |
| Admin Overview        | Total users, actve users, turfs, bookings, matches, revenue,<br>tournaments | Must-have    |
| User Management       | Players, captains, owners, staf, account status                             | Must-have    |
| Turf Management       | Approve, manage, suspend turf; pricing; performance                         | Must-have    |
| Match Management      | Matches, disputes, scores, results                                          | Should-have  |
| Tournament Management | Create tournament, manage registratons, fxtures, results                    | Should-have  |
| Reports & Analytcs    | Platorm performance, revenue, bookings, users, match actvity                | Should-have  |

## **31. Expanded Core Features**

Each feature below follows the same structure: detailed functionality, user interaction flow, technical requirements, priority, and success criteria. This expands on the feature summaries in Section 12 and is intended to guide sprint planning and QA acceptance criteria. Technical requirements are kept high-level and framework-agnostic here; a separate BFAM Technical Architecture Document can later map these to the specific React Native / Node.js / MySQL / Socket.IO / Razorpay / AWS stack.

#### **31.1 Authentication & Role Management**

Secure registration and sign-in for players, turf owners, staff, and admins, with permissions scoped to account type.

##### **User Interaction Flow**

_Open BFAM → Login / Signup → OTP Verification → Create Profile → Select Role → BFAM Dashboard_

##### **Technical Requirements**

- JWT authentication

- Secure password hashing

- OTP verification

- Role-based access control

- Protected APIs

- Session/token management

- Input validation

###### **Priority: Must-have**

##### **Success Criteria**

- Users can successfully register and log in.

- Unauthorized users cannot access protected functionality.

- Users only access functionality permitted for their role.

#### **31.2 Player Profile**

Every player receives a permanent BFAM identity containing cricket information, performance, and reputation.

##### **User Interaction Flow**

_Signup → Create Profile → Select Playing Role → Add Skill Information → Profile Created → Statistics Automatically Updated_

##### **Technical Requirements**

- Player profile data model

- Image storage

- Statistics association

- Profile privacy controls

###### **Priority: Must-have**

##### **Success Criteria**

- Every player has a unique BFAM profile.

- Match results automatically update relevant statistics.

#### **31.3 Team Creation & Management**

Players can create and manage cricket teams, with captain-level controls over membership.

##### **User Interaction Flow**

_My Teams → Create Team → Add Team Details → Invite Players → Players Accept → Team Ready_

##### **Technical Requirements**

- Team/member relationship management

- Captain permissions

- Join-request system

- Team status management

###### **Priority: Must-have**

##### **Success Criteria**

- A player can create a team.

- Captain can manage members.

- Players can join/leave according to permissions.

#### **31.4 Join Open Teams**

Players without a team can find teams that have vacant positions and request to join.

##### **User Interaction Flow**

_Open Teams → Apply Filters → Select Team → View Vacancies → Request Join → Captain Approves → Player Added_

##### **Technical Requirements**

- Vacancy tracking

- Join requests

- Captain approval workflow

- Notifications

###### **Priority: Must-have**

##### **Success Criteria**

- Players can discover available teams.

- Captains can approve/reject requests.

- Team vacancies update correctly.

#### **31.5 Find Players**

Players and captains can search for a specific type of player using multiple filters.

##### **User Interaction Flow**

_Find Players → Apply Filters → View Players → Open Profile → Invite Player_

##### **Technical Requirements**

- Search engine

- Filtering

- Location support

- Availability filtering

###### **Priority: Should-have**

##### **Success Criteria**

- Users can find relevant players using location, skill, and playing-role filters.

#### **31.6 Team vs Team Matchmaking**

Teams can find and challenge other teams for a match.

##### **User Interaction Flow**

_Find Opponent → View Teams → Send Challenge → Opponent Receives Request → Accept → Match Created_

##### **Technical Requirements**

- Match request system

- Notifications

- Availability matching

- Team status tracking

###### **Priority: Should-have**

##### **Success Criteria**

- Teams can discover opponents.

- Challenges can be accepted/rejected.

- Accepted challenges create match records.

#### **31.7 Turf Discovery**

Players can discover nearby BFAM turfs based on location, price, rating, and availability.

##### **User Interaction Flow**

_Discover → Turfs → Search / Filter → Select Turf → View Details → Check Availability_

##### **Technical Requirements**

- Location services

- Map integration

- Turf search

- Filtering

- Availability API

###### **Priority: Must-have**

##### **Success Criteria**

- Users can discover relevant turfs.

- Turf availability is accurate.

- Users can navigate to the turf.

#### **31.8 Turf Booking**

Players can book available turf slots directly through BFAM.

##### **User Interaction Flow**

_Select Turf → Select Date → Select Time → Select Duration → Confirm → Payment → Booking Confirmed_

##### **Technical Requirements**

- Availability engine

- Transactional booking

- Double-booking prevention

- Payment integration

- Booking confirmation

###### **Priority: Must-have**

##### **Success Criteria**

- Users can successfully book available slots.

- No double booking occurs.

- Booking confirmation is generated immediately after successful booking/payment.

#### **31.9 Flexible Payment System**

Supports one person paying the full fee, players paying individually, and payment either during booking or after the match.

##### **User Interaction Flow**

_Create Booking → Select Payment Method → Captain Pays OR Players Split Payment OR Pay Later → Payment Tracking_

##### **Technical Requirements**

- Payment gateway integration (e.g., Razorpay)

- Payment status tracking

- Split payment tracking

- Webhooks

- Refund handling

- Transaction history

###### **Priority: Must-have**

##### **Success Criteria**

- Payment status is accurately tracked.

- Successful payments are reflected in the booking.

- Failed payments don't create false booking confirmations.

#### **31.10 Match Creation**

After booking a turf, users can create the actual cricket match with all required participants.

##### **User Interaction Flow**

_Booking → Create Game → Select Team → Add Opponent → Add Players → Select Scorer → Game Created_

##### **Technical Requirements**

- Match entity

- Team association

- Player association

- Turf association

- Booking association

###### **Priority: Must-have**

##### **Success Criteria**

- Every match has a unique Match ID and contains all required participants and booking information.

#### **31.11 Game Room**

Every match gets a centralized Game Room containing everything required to coordinate the game.

##### **User Interaction Flow**

_Open Match → Game Room → Players → Payments → Chat → Attendance → Live Score → Result_

##### **Technical Requirements**

- Real-time updates

- Match state management

- WebSockets

- Push notifications

- Role-based permissions

###### **Priority: Must-have**

##### **Success Criteria**

- Players can manage the majority of match-related activities from one screen.

#### **31.12 Player Invitations & Confirmation**

Players can invite friends/team members and track who is actually participating.

##### **User Interaction Flow**

_Invite Player → Notification → Player Responds → Confirmed / Maybe / Can't Play → Match List Updated_

##### **Technical Requirements**

- Push notifications

- Deep links

- Invitation IDs

- Player status tracking

- WhatsApp sharing

###### **Priority: Must-have**

##### **Success Criteria**

- Captain can see exactly who is confirmed, pending, unavailable, or not responding.

#### **31.13 Smart Match Coordination**

Turns match organization into one connected workflow instead of multiple WhatsApp conversations.

##### **User Interaction Flow**

_Book → Create Game → Invite → Confirm → Pay → Remind → Attend → Replace → Play_

##### **Technical Requirements**

- Event-driven backend

- Push notifications

- Match state machine

- Scheduled jobs

###### **Priority: Must-have**

##### **Success Criteria**

- A captain can organize a match without manually tracking players through external applications.

#### **31.14 Smart Reminders**

Automatically reminds players about upcoming matches and pending actions.

##### **User Interaction Flow**

_Match Created → Scheduler → Reminder → Player Confirms / Acts_

##### **Technical Requirements**

- Push notification service

- Scheduled jobs

- Notification preferences

- Event triggers

###### **Priority: Must-have**

##### **Success Criteria**

- Players receive reminders before matches.

- Pending payments/actions are reduced.

#### **31.15 Attendance & Running Late**

Players can communicate their attendance status in real time.

##### **User Interaction Flow**

_Upcoming Match → Confirm → Check In OR Running Late OR Cancel_

##### **Technical Requirements**

- Attendance state

- Push notifications

- QR check-in

- Timestamp tracking

###### **Priority: Must-have**

##### **Success Criteria**

- Captain/staff can see the current attendance status of every player.

#### **31.16 Smart Replacement**

If someone cancels, BFAM helps the captain find a suitable replacement quickly.

##### **User Interaction Flow**

_Player Cancels → Vacancy → Find Suitable Players → Captain Invites → Player Accepts → Replacement Confirmed_

##### **Technical Requirements**

- Player search

- Availability matching

- Skill matching

- Notifications

- Match roster updates

###### **Priority: Should-have**

##### **Success Criteria**

- Replacement players can be found and added without restarting the entire match-organizing process.

#### **31.17 Live Scoring**

A complete, real-time cricket scoring system visible to all match participants and viewers.

##### **User Interaction Flow**

_Start Match → Select Teams → Select Batsman/Bowler → Record Ball → Score Updates → All Viewers See Update_

##### **Technical Requirements**

- WebSockets / Socket.IO

- Real-time synchronization

- Score validation

- Persistent score state

- Offline-safe scoring considerations

###### **Priority: Must-have**

##### **Success Criteria**

- Score updates appear in near real time.

- No scoring events are lost.

- The scorecard remains consistent across users.

#### **31.18 Player / Turf Staff Scoring**

BFAM supports two scoring modes: player-managed (captain/player runs the scoreboard) and turf-managed (owner/staff runs it).

##### **User Interaction Flow**

_Create Match → Select Scoring Mode → Player OR Staff → Live Scoring_

##### **Technical Requirements**

- Role-based scoring permissions

- Real-time synchronization

- Match scorer assignment

###### **Priority: Must-have**

##### **Success Criteria**

- Both scoring modes work correctly without conflicting updates.

#### **31.19 Match Statistics**

Once a match ends, BFAM converts the scorecard into permanent player statistics.

##### **User Interaction Flow**

_Match Ends → Scorecard Finalized → Calculate Statistics → Update Player Profiles → Update Rankings_

##### **Technical Requirements**

- Statistics calculation engine

- Immutable match result

- Player-stat aggregation

###### **Priority: Must-have**

##### **Success Criteria**

- Player statistics are automatically updated after completed matches.

#### **31.20 Player Rating (Skill Rating)**

Generates a performance-based Skill Rating from runs, strike rate, wickets, economy, catches, match contribution, and Player of the Match awards.

##### **User Interaction Flow**

_Match Completed → Statistics Calculated → Rating Formula Applied → Rating Updated → Rating History Recorded_

##### **Technical Requirements**

- Rating calculation engine

- Rating history

- Configurable formula

###### **Priority: Should-have**

##### **Success Criteria**

- Players receive consistent ratings based on their recorded match performance.

#### **31.21 Reliability Score**

Measures how dependable a player is, independent of cricket skill — attendance, confirming matches, cancellations, no-shows, regular participation.

##### **User Interaction Flow**

_Match Invitation → Player Response Tracked → Attendance Recorded → Reliability Score Updated_

##### **Technical Requirements**

- Behavior tracking engine

- Historical aggregation

- Configurable weighting

###### **Priority: Should-have**

##### **Success Criteria**

- Captains can distinguish between a “good player” and a “good player who actually shows up.”

#### **31.22 Fair Play System**

Encourages balanced participation by tracking batting/bowling opportunity and new-player participation.

##### **User Interaction Flow**

_Fair Play Match → Match Starts → Track Participation → Detect Imbalance → Suggest Action → Post-Match Fair Play Score_

##### **Technical Requirements**

- Real-time participation tracking

- Rule engine

- Notifications/suggestions

- Fair Play score calculation

###### **Priority: Should-have**

##### **Success Criteria**

- Teams receive meaningful participation insights without the system unnecessarily controlling the game.

#### **31.23 Rewards & Gamification**

Players earn BFAM Coins, XP, levels, badges, achievements, and streaks through play and positive behavior.

##### **User Interaction Flow**

_Play Match → Performance Recorded → XP / Coins Awarded → Level Progress → Achievement Unlocked → Reward Issued_

##### **Technical Requirements**

- Rewards engine

- XP engine

- Wallet/ledger for virtual coins

- Achievement rule set

###### **Priority: Should-have**

##### **Success Criteria**

- Players can clearly understand how they earned XP/coins and what rewards they unlocked.

#### **31.24 Leaderboards**

Competitive rankings across multiple performance and behavior categories.

##### **User Interaction Flow**

_Match Completed → Stats Aggregated → Leaderboard Recalculated → Player Views Ranking_

##### **Technical Requirements**

- Aggregation engine

- Ranking queries

- Period filters

###### **Priority: Should-have**

##### **Success Criteria**

- Leaderboards correctly reflect player performance for the selected period/category.

#### **31.25 Tournaments & Leagues**

Lets organizers create structured competitions with registration, fixtures, and results.

##### **User Interaction Flow**

_Create Tournament → Team Registration → Fixtures → Matches → Live Scores → Points Table → Knockout → Final → Winner_

##### **Technical Requirements**

- Tournament engine

- Fixture generation

- Points calculation

- Bracket management

- Live-score integration

###### **Priority: Should-have**

##### **Success Criteria**

- A complete tournament can be created, managed, and completed through BFAM.

#### **31.26 Turf Owner Management**

Turf owners manage the operational side of their business: turf, pricing, availability, bookings, customers, matches, staff, payments, and maintenance.

##### **User Interaction Flow**

_Owner Login → Dashboard → Manage Turf / Bookings / Staff / Payments → View Analytics_

##### **Technical Requirements**

- Owner RBAC

- Booking management

- Analytics

- Staff permissions

###### **Priority: Must-have**

##### **Success Criteria**

- A turf owner can operate their daily turf business without needing separate manual systems.

#### **31.27 Staff Management**

Owners can create staff accounts with specific, scoped permissions.

##### **User Interaction Flow**

_Owner → Add Staff → Assign Permissions → Staff Login → Perform Assigned Operations_

##### **Technical Requirements**

- Role-based access control

- Permission management

- Activity logs

###### **Priority: Must-have**

##### **Success Criteria**

- Staff members only access functionality assigned to them.

#### **31.28 Check-In & QR**

Players can check into their booking using QR code scanning or staff verification.

##### **User Interaction Flow**

_Arrive at Turf → Show QR → Scan → Booking Verified → Checked In_

##### **Technical Requirements**

- QR generation

- QR scanning

- Booking validation

- Timestamp recording

###### **Priority: Should-have**

##### **Success Criteria**

- Players can be checked in quickly and attendance is automatically recorded.

#### **31.29 Turf Analytics**

Gives owners visibility into bookings, revenue, occupancy, peak hours, popular days, cancellations, no-shows, and customer growth.

##### **User Interaction Flow**

_Owner Opens Analytics → Select Date Range → View Metrics → Export/Review_

##### **Technical Requirements**

- Aggregation queries

- Analytics dashboard

- Charts

- Date filtering

###### **Priority: Should-have**

##### **Success Criteria**

- Owners can identify their busiest periods, revenue trends, and operational problems.

#### **31.30 Reviews & Feedback**

Players can review turf quality, cleanliness, facilities, staff, and overall experience.

##### **User Interaction Flow**

_Match Completed → Prompt for Review → Submit Rating & Comment → Review Published_

##### **Technical Requirements**

- Review storage

- Moderation rules

- Aggregate rating calculation

###### **Priority: Should-have**

##### **Success Criteria**

- Players can submit reviews, and future users can use them to make informed booking decisions.

#### **31.31 Match Chat**

Each Game Room contains a dedicated chat to reduce dependence on external WhatsApp groups.

##### **User Interaction Flow**

_Open Game Room → Open Chat → Send/Receive Messages → Receive Push Notification_

##### **Technical Requirements**

- WebSockets

- Message persistence

- Push notifications

- Basic moderation

###### **Priority: Should-have**

##### **Success Criteria**

- Players can coordinate match-related communication directly inside BFAM.

#### **31.32 Rebook Same Players**

After a successful match, users can repeat the same group, turf, time, and format with minimal effort.

##### **User Interaction Flow**

_Match Completed → Rebook Same Players → Select Date/Time → Book Turf → New Match Created_

##### **Technical Requirements**

- Template/last-match reuse logic

- Booking + invitation pre-fill

###### **Priority: Should-have**

##### **Success Criteria**

- A recurring group can organize another match with minimal effort.

#### **31.33 Memberships**

BFAM/turf owners can offer membership plans with booking discounts, priority booking, tournament discounts, rewards, and exclusive events.

##### **User Interaction Flow**

_Browse Plans → Purchase Membership → Membership Active → Benefits Applied Automatically → Renewal/Expiry_

##### **Technical Requirements**

- Subscription billing

- Entitlement checks

- Expiry handling

###### **Priority: Nice-to-have**

##### **Success Criteria**

- Members receive configured benefits and owners can track membership status.

#### **31.34 Offers & Coupons**

Promotional mechanisms such as first-booking, weekend, referral, tournament, and membership offers.

##### **User Interaction Flow**

_Apply Coupon at Checkout → Validate Coupon → Discount Applied → Booking Confirmed_

##### **Technical Requirements**

- Coupon validation engine

- Expiry and usage-limit rules

###### **Priority: Should-have**

##### **Success Criteria**

- Valid offers are correctly applied and invalid/expired coupons are rejected.

#### **31.35 Referral System**

Players can invite friends and receive rewards once the referred friend completes a qualifying action.

##### **User Interaction Flow**

_Player Shares Referral Code → Friend Joins → Friend Completes Qualifying Action → Reward Issued_

##### **Technical Requirements**

- Referral code generation

- Attribution tracking

- Reward trigger rules

###### **Priority: Should-have**

##### **Success Criteria**

- Referrals are tracked accurately and rewards are issued according to configured rules.

#### **31.36 Café (if applicable to the turf)**

For turfs with an on-site café: menu, food/drink ordering, order tracking, online payment, and inventory.

##### **User Interaction Flow**

_Browse Menu → Add to Order → Pay → Order Prepared → Order Collected_

##### **Technical Requirements**

- Menu management

- Order tracking

- Payment integration

- Inventory tracking

###### **Priority: Nice-to-have**

##### **Success Criteria**

- Orders are placed, paid for, and fulfilled correctly; inventory reflects sales.

#### **31.37 Maintenance**

Turf owners/staff track nets, lighting, equipment, cleaning, and electrical issues.

##### **User Interaction Flow**

_Staff Logs Issue → Issue Tracked → Slot Marked Unavailable if Needed → Issue Resolved → Slot Reopened_

##### **Technical Requirements**

- Maintenance ticket tracking

- Slot-blocking integration with Availability Management

###### **Priority: Should-have**

##### **Success Criteria**

- Owners can track maintenance issues and prevent unavailable/unsafe slots from being booked.

#### **31.38 Support & Complaints**

Users can report booking problems, payment issues, turf problems, match disputes, and general complaints.

##### **User Interaction Flow**

_Submit Complaint → Ticket Created → Routed to Admin/Owner → Status Updated → Resolved_

##### **Technical Requirements**

- Ticketing system

- Status tracking

- Escalation rules

###### **Priority: Should-have**

##### **Success Criteria**

- Every complaint receives a trackable status and is handled by the appropriate admin/owner.

#### **31.39 Notifications**

Central notification system covering booking, invitations, confirmations, payments, cancellations, replacements, match start, results, rewards, and tournaments.

##### **User Interaction Flow**

_Event Occurs → Notification Triggered → Push Sent → User Taps / Acts_

##### **Technical Requirements**

- Push notification service

- Notification preferences

- Event-based triggers

- Deep links

###### **Priority: Must-have**

##### **Success Criteria**

- Important match and booking events generate timely notifications.

#### **31.40 Location & Navigation**

Users can find the physical turf and navigate to it from within the app.

##### **User Interaction Flow**

_View Turf → Tap Navigate → Maps App Opens with Directions_

##### **Technical Requirements**

- GPS/location permission

- Maps SDK/API

- Distance calculation

- Deep linking into navigation apps

###### **Priority: Must-have**

##### **Success Criteria**

- Users can easily find a turf and navigate to the correct location.

#### **31.41 Match Recording & Highlights (Future)**

Future functionality for recording matches and automatically creating shareable highlights (sixes, fours, wickets, best moments).

##### **User Interaction Flow**

_Match Recorded → Highlight Moments Detected → Clips Generated → Player Shares Highlight_

##### **Technical Requirements**

- Video capture/storage

- Highlight detection (manual or AI-assisted)

- Sharing integration

###### **Priority: Nice-to-have / Future**

##### **Success Criteria**

- Recorded matches can be converted into shareable highlights.

#### **31.42 AI Player & Match Intelligence (Future)**

Future AI layer for performance analysis, smart player recommendations, team balancing, opponent matching, match insights, demand prediction, and dynamic pricing.

##### **User Interaction Flow**

_Sufficient Historical Data Collected → AI Model Applied → Recommendation/Insight Generated → Surfaced to User_

##### **Technical Requirements**

- Data pipeline for historical stats

- Recommendation/ML model

- Model retraining process

###### **Priority: Nice-to-have / Future**

##### **Success Criteria**

- Recommendations are relevant and measurably improve matchmaking or engagement. AI is not required for the initial BFAM MVP.

#### **31.43 Recommended BFAM Priority Matrix**

A consolidated view of the expanded features against MVP / Phase 2 / Future, for quick sprint-planning reference.

| **Area**             | **MVP** | **Phase 2** | **Future** |
| -------------------- | ------- | ----------- | ---------- |
| Authentcaton         | ✓       |             |            |
| Player Profle        | ✓       |             |            |
| Team Creaton         | ✓       |             |            |
| Join Teams           | ✓       |             |            |
| Find Players         |         | ✓           |            |
| Turf Discovery       | ✓       |             |            |
| Turf Booking         | ✓       |             |            |
| Payments             | ✓       |             |            |
| Match Creaton        | ✓       |             |            |
| Game Room            | ✓       |             |            |
| Invitatons           | ✓       |             |            |
| Atendance            | ✓       |             |            |
| Replacement          |         | ✓           |            |
| Live Score           | ✓       |             |            |
| Player Statstcs      | ✓       |             |            |
| Player Ratng         |         | ✓           |            |
| Reliability          |         | ✓           |            |
| Fair Play            |         | ✓           |            |
| Rewards / XP / Coins |         | ✓           |            |
| Leaderboards         |         | ✓           |            |
| Matchmaking          |         | ✓           |            |
| Tournaments          |         | ✓           |            |
| Chat                 |         | ✓           |            |
| Rebooking            |         | ✓           |            |
| Turf Management      | ✓       |             |            |
| Staf Management      | ✓       |             |            |
| Analytcs             |         | ✓           |            |
| Memberships          |         |             | ✓          |
| Café                 |         |             | ✓          |

| **Area**         | **MVP** | **Phase 2** | **Future** |
| ---------------- | ------- | ----------- | ---------- |
| Video Highlights |         |             | ✓          |
| AI Features      |         |             | ✓          |
| IoT              |         |             | ✓          |

#### **31.44 The BFAM MVP Loop**

If development starts soon, this is the loop to treat as the heart of the entire application — the first technical milestone should be proving that this works end-to-end before building out the other 35+ features:

**PLAYER** ↓ **Create Profile** ↓ **Create / Join Team** ↓ **Find / Book Turf** ↓ **Create Match** ↓ **Invite Players** ↓ **Confirm Players** ↓ **PAY** ↓ **GAME ROOM** ↓ **CHECK-IN** ↓ **PLAY MATCH** ↓ **LIVE SCORE** ↓ **MATCH RESULT** ↓ **PLAYER STATISTICS** ↓ **RATING** ↓ **REBOOK**

## **32. Additional Recommendations — Gaps to Consider**

Beyond what has been specified, the following are worth deciding on early because they touch many features at once (payments, live scoring, onboarding, and compliance). None are required to start development, but each is cheaper to decide now than to retrofit later.

#### **32.1 Weather & Rain Policy**

Outdoor/semi-covered turfs are weather-dependent. Define how a rain-affected or abandoned match is handled: automatic refund vs. reschedule credit, and whether the Fair Play/statistics engine treats an abandoned match as a completed one. This affects Cancellation & Refund (Section 17) and Match Statistics (Section 12.21).

#### **32.2 Dispute Resolution for Scoring & Results**

Two players may disagree on a scoring decision, or a captain may dispute a final result. A lightweight in-app dispute flow (flag a match → both sides state their case → admin/staff resolves) prevents this from becoming an unresolved support ticket and protects the integrity of Ratings and Leaderboards.

#### **32.3 Offline-First Safeguards for Live Scoring**

Box-cricket turfs can have poor network coverage. The scoring interface should queue ball-by-ball events locally and sync when connectivity returns, rather than losing scoring data. This is a refinement of the technical requirements under Live Scoring (Section 31.17).

#### **32.4 Guest / One-Off Player Flow**

Not every participant will want a full BFAM account before their first match — a friend invited last-minute, for example. Consider a lightweight guest-join flow (name + phone number, no full profile) that can later be converted into a full account, so the invitation/confirmation flow (Section 31.12) doesn't create a signup barrier at the door.

#### **32.5 Social Login**

Google and Apple sign-in reduce signup friction alongside phone/OTP authentication, particularly for iOS App Store review requirements (Apple requires Sign in with Apple if other third-party logins are offered).

#### **32.6 Multi-Language Support**

Given a primarily India-based initial audience, consider Hindi and regional-language support (e.g., Gujarati) alongside English from the Language setting (Section 30.8), rather than retrofitting localization later.

#### **32.7 Minors & Age Policy**

Box cricket often includes players under 18. Define a minimum age for independent account creation and whether a parent/guardian consent step is required, particularly given payment and chat features.

#### **32.8 Data Privacy & Consent**

Location, contact list access (for invitations), and payment data all require clear consent flows and a privacy policy that meets applicable regulations (e.g., India's DPDP Act). This should be finalized before the Terms & Conditions / Privacy Policy screens (Section 30.1) are built.

#### **32.9 Liability & Injury Disclaimer**

Cricket carries injury risk. A liability waiver accepted at signup or first booking, plus a simple in-app process for reporting an injury during a match, protects both players and turf owners and should be referenced from Support & Complaints (Section 31.38).

#### **32.10 Equipment & Ball Type Configuration**

Box cricket is played with different ball types (tennis ball, leather ball, hard tennis) and formats (6, 8, or 10 overs) across regions. Match Creation (Section 31.10) should treat ball type and format as configurable fields rather than assuming one standard, since this affects scoring rules and player expectations.

#### **32.11 App Store / Play Store Compliance & Versioning**

Plan for standard mobile release requirements: account deletion flow, in-app purchase compliance if BFAM Coins are ever purchasable with real money, and a versioning/update strategy so older app versions don't break against a newer backend.

#### **32.12 Accessibility & Dark Mode**

Basic accessibility (readable contrast, scalable text, screen-reader labels on key actions like Book/Pay/Confirm) and a dark mode option are low-cost additions that meaningfully improve usability for outdoor, high-glare use during matches.

#### **32.13 Analytics & Product Telemetry**

Separate from Business Analytics (Section 23), BFAM itself should track product usage (funnel drop-off from Discover → Book → Pay, invitation acceptance rates, live-score session length) to guide which P1/P2 features to prioritize after MVP launch.

#### **32.14 Staff Verification**

Since staff can check in players and handle on-ground payments, consider a basic verification step (ID/document upload reviewed by the turf owner) before a staff account gets live permissions.

## **33. Final Product Vision**

BFAM should evolve from a turf booking platform into a complete digital box-cricket ecosystem where players can discover, connect, organize, play, compete, improve, and build a community. Every player carries that identity with them as a permanent BFAM ID, and every match can feel like a real occasion — countdown, Playing XI, toss, and a crowd watching live.

The long-term BFAM experience should be:

**_Find your game. Find your people. Play. Improve. Compete. Belong._**

**_BFAM — More than a turf. It's a movement._**

###### **Appendix — System Architecture (Conceptual, Non-Technical)**

_BFAM is delivered as one cross-platform mobile application — a single React Native + Expo + TypeScript codebase producing both Android and iOS builds — alongside separate Next.js web applications for Turf Owner, Turf Staff, and Platform Admin. All clients call the same backend and share the same database; there is no separate backend per client._

###### **BFAM**

↓ **Cross-Platform Mobile Application Web Applications React Native + Expo + TypeScript Next.js + TypeScript + Tailwind CSS Android iOS Owner Web Staff Web Admin Web**

↓ **Same APIs (REST + Socket.IO)**

↓ **BFAM Backend — Authentication · Booking · Teams · Matches · Scoring · Payments · Statistics · Ratings · Rewards · Tournaments · Notifications** ↓ **MySQL · Redis · S3 / CDN Storage**

###### **BFAM Mobile App — One Codebase, Role-Based Experience**

**BFAM Cross-Platform Mobile App**

↓ **Player Experience | Turf Owner Experience | Turf Staff Experience** ↓

Screens and navigation shown depend on the authenticated user's role and permissions.
