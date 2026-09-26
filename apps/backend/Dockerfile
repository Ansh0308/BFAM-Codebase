# BFAM backend image.
#
# Build from the REPO ROOT (this is an npm-workspaces monorepo):
#   docker build -f apps/backend/Dockerfile -t bfam-backend .
#
# Runtime settings are environment variables — see apps/backend/.env.example and
# deploy/azure.env.example. The container runs the database migrations itself at
# start-up, so pointing it at an empty MySQL is enough.

# Toolchain, in case a native module (bcrypt) has no prebuilt binary for the
# platform. It is used by the two install stages below and never reaches the
# runtime image.
FROM node:20-bookworm-slim AS toolchain
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

# ---- 1. build: full install, compile TypeScript ------------------------------
FROM toolchain AS build

# Manifests first so the (slow) dependency layer is cached until they change.
COPY package.json package-lock.json ./
COPY scripts ./scripts
COPY packages ./packages
COPY apps/backend/package.json apps/backend/
COPY apps/mobile/package.json apps/mobile/
COPY apps/web/package.json apps/web/

# Only the backend and the shared packages are installed (not the mobile/web
# dependency trees). The root postinstall builds packages/shared-types and
# packages/api-client.
RUN npm ci \
      --workspace=apps/backend \
      --workspace=packages/shared-types \
      --workspace=packages/api-client \
      --include-workspace-root

COPY apps/backend ./apps/backend
RUN npm run build --workspace=apps/backend

# ---- 2. prod-deps: production dependencies only ------------------------------
# A separate install rather than `npm prune`: prune re-resolves the WHOLE
# monorepo and would pull the mobile and web dependency trees back in.
FROM toolchain AS prod-deps

COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps/backend/package.json apps/backend/
COPY apps/mobile/package.json apps/mobile/
COPY apps/web/package.json apps/web/

# The root lifecycle scripts (husky, workspace builds) are development tooling,
# so they are skipped; the one native module the backend needs is then built
# explicitly and checked, so a broken binary fails the build, not the first login.
RUN npm ci --omit=dev --workspace=apps/backend --ignore-scripts \
 && npm rebuild bcrypt \
 && node -e "require('bcrypt')"

# ---- 3. runtime: production dependencies + compiled output only ---------------
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=5000 \
    # Booking times are India wall-clock; the code is explicit about it, but keep
    # the container's clock in India for logs and any date formatting.
    TZ=Asia/Kolkata
WORKDIR /repo

COPY --from=prod-deps --chown=node:node /repo/node_modules ./node_modules
# node_modules/@bfam/* are links into the workspace folders, so they must exist.
COPY --from=prod-deps --chown=node:node /repo/packages/shared-types ./packages/shared-types
COPY --from=build --chown=node:node /repo/apps/backend/package.json ./apps/backend/package.json
COPY --from=build --chown=node:node /repo/apps/backend/dist ./apps/backend/dist

USER node
WORKDIR /repo/apps/backend
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
