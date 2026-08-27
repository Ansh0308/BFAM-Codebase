# BFAM Phase 0 - Project Setup & Verification Guide

## Overview

This document provides step-by-step instructions to verify that BFAM Phase 0 infrastructure is properly configured and working. Phase 0 establishes the foundational monorepo, CI/CD, and basic app scaffolding with no feature screens or database tables.

## Prerequisites

- Node.js 20+ and npm installed
- Docker and Docker Compose installed
- Git configured
- For mobile development: Expo CLI (`npm install -g expo-cli`)
- For iOS development: Xcode (macOS only)
- For Android development: Android Studio with SDK configured

## Project Structure

```
BFAM-Codebase/
├── apps/
│   ├── backend/       # Node.js + Express API + Socket.IO
│   ├── mobile/        # React Native + Expo + NativeWind
│   └── web/           # Next.js + Tailwind CSS
├── packages/
│   ├── api-client/    # Shared API client library
│   └── shared-types/  # Shared TypeScript types
├── docker-compose.yml # MySQL + Redis services
├── package.json       # Monorepo root (npm workspaces)
├── eslint.config.js   # Shared ESLint config
├── prettier.config.js # Shared Prettier config
└── tailwind.config.shared.js # Shared Tailwind tokens
```

## Definition of Done - Verification Checklist

### 1. Empty App Boots on Android

**Steps:**

```bash
# Terminal 1: Start Expo server
cd apps/mobile
npm run android

# Expo CLI will launch Android emulator and build app
```

**Expected Result:**

- Android emulator starts (or connects to physical device)
- App loads successfully with BFAM splash/loading screen
- Fonts (Anton, Archivo Black, Inter) render correctly
- Status bar displays properly
- No runtime errors in console

**Verification Commands:**

```bash
# Type-check mobile app
npm run type-check --workspace=apps/mobile

# Lint mobile app
npm run lint --workspace=apps/mobile
```

### 2. Empty App Boots on iOS

**Steps:**

```bash
# Terminal 1: Start Expo server
cd apps/mobile
npm run ios

# Expo CLI will launch iOS simulator and build app
```

**Expected Result:**

- iOS simulator starts (or connects to physical device)
- App loads successfully with BFAM splash/loading screen
- Fonts (Anton, Archivo Black, Inter) render correctly
- Safe area and notch handling work properly
- No runtime errors in console

**Verification:**
Same type-check and lint commands as Android above.

### 3. Empty App Boots on Web

**Steps:**

```bash
# Terminal 1: Start Next.js development server
cd apps/web
npm run dev

# Navigate to http://localhost:3000 in browser
```

**Expected Result:**

- Next.js development server starts on port 3000
- App loads in browser with BFAM branding
- Fonts (Anton, Archivo Black, Inter) render correctly via Google Fonts
- Tailwind CSS styles are applied
- No build errors or warnings

**Verification Commands:**

```bash
# Type-check web app
npm run type-check --workspace=apps/web

# Build web app (production check)
npm run build --workspace=apps/web

# Lint web app
npm run lint --workspace=apps/web
```

### 4. Backend Responds to Health-Check Endpoint

**Setup:**

```bash
# Terminal 1: Start Docker services
docker-compose up -d

# Terminal 2: Start backend server
cd apps/backend
npm run dev

# Backend should start on http://localhost:5000
```

**Verification - HTTP Health Check:**

```bash
# In another terminal, hit the REST health endpoint
curl http://localhost:5000/health

# Expected response:
# {
#   "status": "ok",
#   "uptime": 12.345,
#   "timestamp": "2026-08-27T10:30:45.123Z"
# }
```

**Verification - WebSocket Health Check:**

```bash
# Use Node.js to test Socket.IO health-check namespace
node

# In Node REPL:
const io = require('socket.io-client');
const socket = io('http://localhost:5000/health-check');

socket.on('health_status', (data) => {
  console.log('Received health status:', data);
  socket.disconnect();
  process.exit(0);
});

socket.on('error', (error) => {
  console.error('Connection error:', error);
  process.exit(1);
});
```

**Expected Output:**

```
Received health status: {
  status: 'ok',
  timestamp: '2026-08-27T10:30:45.123Z'
}
```

### 5. Database Connection Verified

**Steps:**

```bash
# Ensure Docker Compose is running (from step 4)
docker-compose ps

# Should show: mysql and redis containers as "Up"

# Backend logs should show:
# "Database connection has been established successfully."
```

**Verification:**

```bash
# Connect to MySQL from CLI
docker exec -it bfam-mysql mysql -u bfam_user -p bfam_dev -e "SELECT 1;"

# When prompted for password, enter: bfam_password
# Expected: mysql> exit (without error)

# Test Redis connection
docker exec -it bfam-redis redis-cli ping

# Expected: PONG
```

### 6. CI/CD Pipeline Passes

**GitHub Actions Verification:**

1. **Commit Changes:**

```bash
git add .
git commit -m "feat: Phase 0 infrastructure setup"
git push origin main
```

2. **Check CI Pipeline:**
   - Navigate to GitHub repository → Actions tab
   - Verify latest workflow run shows:
     - ✅ ESLint Checks: PASSED
     - ✅ TypeScript Compile Verification: PASSED
     - ✅ Unit & Integration Tests: PASSED
   - Overall status shows as "All checks passed"

3. **Manual CI Verification (without GitHub):**

```bash
# From monorepo root
npm install        # Install all workspaces
npm run lint       # ESLint across all packages
npm run type-check # TypeScript type-check across all packages
npm run test       # Run all tests
```

**Expected Output:**

```
✓ ESLint checks passed (0 errors, 0 warnings)
✓ TypeScript compilation successful
✓ All tests passed
  - Backend health tests: 1 passed
  - Backend auth tests: 4 passed
  - Backend BFAM ID allocator tests: 3 passed
```

---

## Quick Start Guide

### First-Time Setup

```bash
# 1. Install monorepo dependencies
npm install

# 2. Start Docker services (MySQL + Redis)
docker-compose up -d

# 3. In separate terminals, start each app:

# Terminal A: Backend
cd apps/backend
npm run dev
# Expected: "BFAM Backend Server listening on port 5000"

# Terminal B: Web
cd apps/web
npm run dev
# Expected: "▲ Next.js 14.2.5 ... ready - started server on 0.0.0.0:3000"

# Terminal C: Mobile (Expo)
cd apps/mobile
npm run web
# Expected: "Starting dev server on http://localhost:19006"
```

### Environment Setup

1. **Backend (.env):**

```bash
cp apps/backend/.env.example apps/backend/.env.local
# Edit .env.local and set:
# - DB_HOST=localhost (from docker-compose)
# - DB_PASSWORD=bfam_password (from docker-compose)
# - JWT_SECRET=your-secret-key (generate one for dev)
# - SENTRY_DSN= (optional, leave empty for Phase 0)
```

2. **Mobile (.env):**

```bash
cp apps/mobile/.env.example apps/mobile/.env.local
# Edit .env.local:
# - EXPO_PUBLIC_API_BASE_URL=http://localhost:5000
# - EXPO_PUBLIC_SENTRY_DSN= (optional)
```

3. **Web (.env):**

```bash
cp apps/web/.env.example apps/web/.env.local
# Edit .env.local:
# - NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
# - NEXT_PUBLIC_SENTRY_DSN= (optional)
```

### Running Tests

```bash
# Run all tests across the monorepo
npm run test

# Run backend tests specifically
npm run test --workspace=apps/backend

# Run backend health check test
npm run test -- health.test.ts
```

---

## Architecture Overview

### Technology Stack (Phase 0)

| Layer          | Technology                | Purpose                               |
| -------------- | ------------------------- | ------------------------------------- |
| **Frontend**   | React Native + Expo       | iOS/Android cross-platform            |
| **Web**        | Next.js + TypeScript      | Admin dashboard (Phase 2)             |
| **Styling**    | NativeWind + Tailwind CSS | Shared design tokens                  |
| **Backend**    | Node.js + Express         | REST API + Socket.IO                  |
| **Real-time**  | Socket.IO                 | Health-check namespace only (Phase 0) |
| **Database**   | MySQL + Sequelize         | Relational data                       |
| **Caching**    | Redis                     | Socket.IO pub/sub, future caching     |
| **Auth**       | JWT + bcrypt              | Token-based authentication            |
| **Monitoring** | Sentry (optional)         | Error tracking                        |
| **CI/CD**      | GitHub Actions            | Lint, type-check, test on PR          |

### Design Tokens (from Design Document §7)

All colors, spacing, and typography are centralized in `tailwind.config.shared.js` and applied to both mobile and web apps:

**Colors:**

- Brand Red: `#D80000` (primary accent)
- Text: Primary `#111111`, Secondary `#444444`, Tertiary `#767676`
- Surfaces: White `#FFFFFF`, Alt `#F8F8F8`
- Borders: Subtle `#EEEDEE`, Strong `#E0E0E0`

**Spacing (8px base unit):**

- space-1: 4px, space-2: 8px, space-3: 12px, space-4: 16px, space-5: 24px, space-6: 32px, space-7: 40px

**Fonts:**

- Display: Anton / Archivo Black (headlines)
- UI: Inter (body, buttons, labels)

### API Endpoints (Phase 0)

```
GET /health                       # Health check (REST)
GET /ws:/health-check             # Health check (WebSocket namespace)

POST /auth/dev-token              # Dev token issuance (testing only)
GET /auth/me (JWT required)       # Current user info
GET /rbac/admin-check             # Admin role verification

POST /payments/razorpay/webhook   # Razorpay webhook handler
POST /push/expo-token             # Register push notification token
```

---

## Troubleshooting

### Mobile App Won't Start

```bash
# Clear Expo cache
expo start --clear

# Clear node_modules and reinstall
cd apps/mobile
rm -rf node_modules
npm install

# Ensure Expo CLI is up to date
npm install -g expo-cli@latest
```

### Backend Connection Refused

```bash
# Verify Docker is running
docker ps

# Start Docker services if needed
docker-compose up -d

# Check MySQL is accessible
docker logs bfam-mysql | grep "ready for connections"

# Restart backend
cd apps/backend
npm run dev
```

### TypeScript Errors

```bash
# Rebuild shared packages
npm run build --workspaces --if-present

# Run type-check to identify issues
npm run type-check

# Clear Next.js cache
rm -rf apps/web/.next
npm run build --workspace=apps/web
```

### ESLint / Prettier Issues

```bash
# Fix all files
npm run format

# Lint with auto-fix
npm run lint -- --fix
```

### Database Issues

```bash
# Reset MySQL (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d

# Run migrations (when they exist in Phase 1)
npm run db:migrate --workspace=apps/backend
```

---

## Next Steps (Phase 1)

Once Phase 0 verification is complete:

1. **Database Schema** - Create empty migration scaffold and first tables
2. **Feature Screens** - Build Home, Discover, Turf Detail screens
3. **Authentication** - Implement phone OTP, JWT refresh, logout
4. **Real-time Socket.IO** - Add live scoring, chat namespaces
5. **Payment Integration** - Razorpay webhook processing
6. **Push Notifications** - Expo push notification delivery

---

## Useful Commands

```bash
# Monorepo
npm install                    # Install all packages
npm run lint                   # Lint all code
npm run type-check            # TypeScript check
npm run format                # Prettier format all files
npm run test                  # Run all tests

# Backend
cd apps/backend
npm run dev                   # Start dev server (ts-node-dev)
npm run build                 # Build TypeScript to dist/
npm run test -- health.test   # Run specific test
npm run db:migrate            # Run Sequelize migrations (Phase 1+)

# Mobile
cd apps/mobile
npm start                     # Start Expo dev server
npm run android               # Build and run on Android
npm run ios                   # Build and run on iOS
npm run web                   # Run on web (Expo web)

# Web
cd apps/web
npm run dev                   # Start Next.js dev server (port 3000)
npm run build                 # Production build
npm run start                 # Run production server

# Docker
docker-compose up -d          # Start MySQL + Redis in background
docker-compose logs -f        # View service logs
docker-compose down           # Stop services
docker-compose down -v        # Stop and delete volumes
```

---

## Configuration Files Reference

- **Root monorepo:** [package.json](../package.json)
- **Tailwind shared config:** [tailwind.config.shared.js](../tailwind.config.shared.js)
- **ESLint:** [eslint.config.js](../eslint.config.js)
- **Prettier:** [prettier.config.js](../prettier.config.js)
- **Backend config:** [apps/backend/src/config/](../apps/backend/src/config/)
- **Sentry (backend):** [apps/backend/src/config/sentry.ts](../apps/backend/src/config/sentry.ts)
- **Sentry (web):** [apps/web/sentry.client.config.ts](../apps/web/sentry.client.config.ts)
- **Socket.IO (backend):** [apps/backend/src/index.ts](../apps/backend/src/index.ts)

---

## Verification Summary

| Requirement                  | Status | Verification Method                           |
| ---------------------------- | ------ | --------------------------------------------- |
| Android app boots            | ✓      | `npm run android` in apps/mobile              |
| iOS app boots                | ✓      | `npm run ios` in apps/mobile                  |
| Web app boots                | ✓      | `npm run dev` in apps/web → localhost:3000    |
| Backend health REST endpoint | ✓      | `curl http://localhost:5000/health`           |
| Backend health WebSocket     | ✓      | Socket.IO client to `/health-check` namespace |
| Database connection          | ✓      | Backend startup logs + Docker healthcheck     |
| CI pipeline passes           | ✓      | GitHub Actions: lint, type-check, test on PR  |
| Design tokens applied        | ✓      | Tailwind colors, spacing in both apps         |
| Fonts loaded (Anton, Inter)  | ✓      | Visual inspection on all three platforms      |
| TypeScript strict mode       | ✓      | `npm run type-check`                          |
| ESLint + Prettier configured | ✓      | `npm run lint` and `npm run format`           |
| Husky pre-commit hooks       | ✓      | Try committing with lint violations (blocked) |
| Sentry integrated            | ✓      | ENV var configuration, no errors without DSN  |

---

**Phase 0 Status: COMPLETE ✓**

All foundational infrastructure is in place. Ready for Phase 1 feature development.

Last Updated: August 27, 2026
