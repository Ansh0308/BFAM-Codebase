# BFAM admin portal (Owner / Staff / Admin web console) image.
#
# Build from the REPO ROOT (this is an npm-workspaces monorepo):
#   docker build -f apps/web/Dockerfile -t bfam-web .
#
# The portal is served under /portal on the same host as the API (deploy/Caddyfile
# sends /portal to this container and everything else to the backend), so it calls
# the API on its own origin: NEXT_PUBLIC_API_URL is left empty on purpose. Both
# values are baked in at build time (Next inlines NEXT_PUBLIC_*), which is why they
# are build arguments and not runtime settings.

FROM node:20-bookworm-slim AS build
WORKDIR /repo

# Manifests first so the (slow) dependency layer is cached until they change.
COPY package.json package-lock.json ./
COPY scripts ./scripts
COPY packages ./packages
COPY apps/backend/package.json apps/backend/
COPY apps/mobile/package.json apps/mobile/
COPY apps/web/package.json apps/web/

# Only the portal and the shared packages are installed (not the backend/mobile
# dependency trees). The root postinstall builds packages/shared-types and
# packages/api-client.
RUN npm ci \
      --workspace=apps/web \
      --workspace=packages/shared-types \
      --workspace=packages/api-client \
      --include-workspace-root

COPY apps/web ./apps/web

ARG NEXT_PUBLIC_BASE_PATH=/portal
ARG NEXT_PUBLIC_API_URL=
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=apps/web

# ---- runtime: the self-contained server Next traced, nothing else -----------------
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=Asia/Kolkata
WORKDIR /repo

COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public

USER node
WORKDIR /repo/apps/web
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/portal/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
