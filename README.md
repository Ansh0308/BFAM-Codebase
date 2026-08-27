# BFAM - Cricket Turf Booking & Live Scoring Platform

**BFAM** is a comprehensive mobile-first platform for discovering and booking cricket turfs, organizing teams, live match scoring, and player ratings across India.

## Current Status: Phase 0 - Infrastructure ✓

Phase 0 establishes the foundational monorepo, CI/CD pipelines, and app scaffolding with **no feature screens or database tables** yet. Focus is on ensuring the empty apps boot successfully on all three platforms (Android, iOS, Web) and the backend responds to health checks.

### ✅ Phase 0 Complete

- Monorepo with npm workspaces (backend, mobile, web, shared packages)
- Mobile app with Expo + React Native + TypeScript
- Web admin dashboard with Next.js + TypeScript + Tailwind CSS
- Backend with Node.js + Express + TypeScript + Socket.IO
- Design tokens and fonts configured in shared Tailwind config
- ESLint + Prettier + Husky for code quality
- GitHub Actions CI/CD pipeline
- Sentry error tracking integration
- Docker Compose for local MySQL + Redis
- TypeScript strict mode throughout

---

## Quick Start

### For Phase 0 Verification

Follow the complete setup and verification guide:

📖 **[PHASE_0_SETUP.md](./PHASE_0_SETUP.md)** - Step-by-step verification of all definitions of done

Key commands to get running:

```bash
# Install all dependencies
npm install

# Start Docker services (MySQL + Redis)
docker-compose up -d

# In separate terminals:

# Backend
cd apps/backend && npm run dev

# Web
cd apps/web && npm run dev

# Mobile
cd apps/mobile && npm start
```

### For New Developers

1. **Read the project docs:**
   - [PHASE_0_SETUP.md](./PHASE_0_SETUP.md) - Setup and verification guide
   - [BFAM_Design_Document.md](./BFAM_Design_Document.md) - Design system and tokens
   - [BFAM_Tech_Stack_Document_v1.1.md](./BFAM_Tech_Stack_Document_v1.1.md) - Technology decisions
   - [BFAM_PRD_v2.2.md](./BFAM_PRD_v2.2.md) - Product requirements

2. **Set up your environment:**
   - Ensure Node.js 20+, Docker, and Expo CLI are installed
   - Run `npm install` at the monorepo root
   - Create `.env.local` files in each app using `.env.example` templates

3. **Start coding:**
   - All packages are linked via npm workspaces
   - Changes to shared types are automatically available to all apps
   - Use `npm run lint` and `npm run format` before committing

---

## Project Structure

```
BFAM-Codebase/
│
├── apps/
│   ├── backend/          # Node.js Express API + Socket.IO
│   │   ├── src/
│   │   │   ├── app.ts              # Express app setup
│   │   │   ├── index.ts            # Server entry + Socket.IO
│   │   │   ├── config/             # Database, Sentry, sequelize
│   │   │   ├── middleware/         # JWT auth, RBAC
│   │   │   ├── services/           # Business logic
│   │   │   ├── models/             # Sequelize models (empty in Phase 0)
│   │   │   ├── migrations/         # Database migrations
│   │   │   └── __tests__/          # Unit & integration tests
│   │   ├── .env.example
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── mobile/           # React Native + Expo + NativeWind
│   │   ├── App.tsx              # Entry point with font + Sentry init
│   │   ├── babel.config.js      # Expo + NativeWind config
│   │   ├── tailwind.config.js   # Extends shared config
│   │   ├── .env.example
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/              # Next.js + TypeScript + Tailwind
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx    # Root layout with fonts
│       │   │   ├── page.tsx      # Home page
│       │   │   └── globals.css   # Global styles
│       │   └── components/
│       ├── sentry.client.config.ts
│       ├── sentry.server.config.ts
│       ├── .env.example
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── shared-types/     # Shared TypeScript types (User, Player, Match, etc.)
│   │   ├── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── api-client/       # Shared API client (fetch wrapper + endpoints)
│       ├── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── .github/
│   └── workflows/
│       └── ci.yml                 # GitHub Actions: lint, type-check, test
│
├── .husky/
│   └── pre-commit                 # Run lint-staged before commits
│
├── docker-compose.yml             # MySQL 8.0 + Redis 7.0
│
├── tailwind.config.shared.js       # Shared design tokens (all colors, spacing, fonts)
├── eslint.config.js               # Monorepo ESLint config
├── prettier.config.js             # Monorepo Prettier config
├── package.json                   # Monorepo root with npm workspaces
│
└── PHASE_0_SETUP.md               # ← START HERE for setup & verification
```

---

## Technology Stack (Phase 0)

| Layer              | Tech                      | Why                                                        |
| ------------------ | ------------------------- | ---------------------------------------------------------- |
| **Mobile**         | React Native + Expo       | Single codebase for iOS/Android; fast iteration            |
| **Web**            | Next.js 14                | Server-side rendering, API routes, SSG for admin dashboard |
| **Styling**        | Tailwind CSS + NativeWind | Utility-first, shared tokens across mobile and web         |
| **Backend**        | Node.js + Express         | JavaScript everywhere; lightweight and fast                |
| **Real-time**      | Socket.IO                 | WebSocket-based live scoring and chat                      |
| **Database**       | MySQL + Sequelize         | Relational data model, strong consistency for bookings     |
| **Cache/Pub-Sub**  | Redis                     | Socket.IO pub/sub, caching, rate limiting                  |
| **Auth**           | JWT + bcrypt              | Stateless, scalable authentication                         |
| **Error Tracking** | Sentry                    | Production error monitoring and debugging                  |
| **CI/CD**          | GitHub Actions            | Lint, type-check, test on every PR                         |
| **Code Quality**   | ESLint + Prettier + Husky | Consistent style; pre-commit validation                    |

---

## Design System

All colors, spacing, typography, and component styles are centralized in the **Design Document (§7)** and implemented in `tailwind.config.shared.js`.

### Colors (Brand: Red + Monochrome)

- **Brand Red:** `#D80000` (primary)
- **Text:** Black `#111111`, Gray `#444444`, Light `#767676`
- **Surfaces:** White `#FFFFFF`, Alt `#F8F8F8`

### Typography (Display + UI)

- **Display Font:** Anton / Archivo Black (headlines)
- **UI Font:** Inter (body, buttons, labels)

### Spacing (8px base)

- `space-1`: 4px | `space-2`: 8px | `space-3`: 12px | `space-4`: 16px
- `space-5`: 24px | `space-6`: 32px | `space-7`: 40px

See [BFAM_Design_Document.md](./BFAM_Design_Document.md) for the complete design system.

---

## API Endpoints (Phase 0)

### REST Endpoints

- `GET /health` - Health check with uptime
- `POST /auth/dev-token` - Dev token issuance (testing only)
- `GET /auth/me` - Current user info (requires JWT)
- `GET /rbac/admin-check` - Admin role check (requires JWT)
- `POST /payments/razorpay/webhook` - Razorpay webhook handler
- `POST /push/expo-token` - Register push notification token

### WebSocket (Socket.IO)

- `/health-check` namespace - Ping/pong for server health monitoring

---

## Development Workflow

### Before Committing

```bash
npm run format      # Prettier format all files
npm run lint        # ESLint check (auto-fixed where possible)
npm run type-check  # TypeScript compilation check
npm run test        # Run all tests
git add .
git commit -m "feat: Description of change"
git push origin branch-name
```

Husky's `pre-commit` hook will run `lint-staged` to check staged files.

### Code Quality Rules

- **TypeScript:** Strict mode enabled (`tsconfig.json` in each app)
- **Formatting:** Prettier (100 char line width, 2-space indentation)
- **Linting:** ESLint with TypeScript rules
- **Unused vars:** Only `_` prefixed params are allowed as unused
- **Any types:** Warned (not errored) for gradual typing

---

## Environment Variables

Copy `.env.example` to `.env.local` in each app and configure:

### Backend (apps/backend/.env.local)

```
NODE_ENV=development
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=bfam_dev
DB_USER=bfam_user
DB_PASSWORD=bfam_password
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-dev-secret-key
SENTRY_DSN= # Optional
```

### Mobile (apps/mobile/.env.local)

```
EXPO_PUBLIC_API_BASE_URL=http://localhost:5000
EXPO_PUBLIC_SENTRY_DSN= # Optional
```

### Web (apps/web/.env.local)

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
NEXT_PUBLIC_SENTRY_DSN= # Optional
```

**⚠️ IMPORTANT:** Never commit real secrets (API keys, DB passwords, JWT secrets). Use `.env.local` (git-ignored) for sensitive values.

---

## Testing

```bash
# Run all tests
npm run test

# Run backend tests only
npm run test --workspace=apps/backend

# Run specific test file
npm run test -- health.test.ts

# Run with coverage
npm run test -- --coverage
```

Tests are in `src/__tests__/` directories and use Jest + Supertest.

---

## Docker

Start local MySQL + Redis (required for backend):

```bash
# Start services in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Reset (delete volumes)
docker-compose down -v
```

Services:

- **MySQL:** Port 3306 (user: `bfam_user`, password: `bfam_password`)
- **Redis:** Port 6379 (no auth)

---

## Troubleshooting

See [PHASE_0_SETUP.md - Troubleshooting](./PHASE_0_SETUP.md#troubleshooting) for detailed solutions.

Quick fixes:

- `npm install` - Missing dependencies
- `docker-compose up -d` - Database not running
- `npm run type-check` - TypeScript errors
- `npm run format` - Code style issues

---

## Useful Commands

```bash
# Monorepo
npm install                # Install all packages
npm run lint               # Lint all code
npm run type-check         # TypeScript check
npm run format             # Format all code
npm run test               # Run all tests

# Backend
npm run dev --workspace=apps/backend
npm run build --workspace=apps/backend
npm run db:migrate --workspace=apps/backend

# Mobile
npm run android --workspace=apps/mobile
npm run ios --workspace=apps/mobile
npm run web --workspace=apps/mobile

# Web
npm run dev --workspace=apps/web
npm run build --workspace=apps/web
npm run start --workspace=apps/web

# Docker
docker-compose up -d
docker-compose down
docker-compose logs -f
```

---

## Next: Phase 1 - Feature Development

After Phase 0 verification is complete, Phase 1 will add:

- Feature screens (Home, Discover, Turf Detail, Player Profile, etc.)
- Database schema and migrations
- Authentication (phone OTP, JWT refresh)
- Real-time Socket.IO namespaces (live scoring, chat)
- Payment integration with Razorpay
- Push notification delivery with Expo

---

## Documentation

- [PHASE_0_SETUP.md](./PHASE_0_SETUP.md) - **Start here** for setup & verification
- [BFAM_PRD_v2.2.md](./BFAM_PRD_v2.2.md) - Product requirements and features
- [BFAM_Design_Document.md](./BFAM_Design_Document.md) - Design system and UI specs
- [BFAM_Tech_Stack_Document_v1.1.md](./BFAM_Tech_Stack_Document_v1.1.md) - Technology decisions
- [BFAM_Development_Workflow.md](./BFAM_Development_Workflow.md) - Git workflow and conventions

---

## Team

- **Mobile Lead:** [Your Name]
- **Backend Lead:** [Your Name]
- **Product:** [Your Name]

---

## License

Internal - BFAM Contributors Only

---

**Last Updated:** August 27, 2026
**Phase Status:** 0 - Infrastructure ✓
