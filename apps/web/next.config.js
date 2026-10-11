const path = require('path');

// The admin portal is served from the same host as the API, under /portal (see
// deploy/Caddyfile), so the build is told its path prefix. Empty for local development.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

// The Docker image (apps/web/Dockerfile) builds a self-contained server; local
// `next dev` / `next build` are left as they were.
const standalone = process.env.NEXT_OUTPUT === 'standalone';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // `next dev` and `next build` both write to the build directory, and
  // running them against the same one corrupts the manifests (an empty
  // app-paths-manifest makes the build fail with "Cannot find module for page:
  // /_not-found"). Setting NEXT_DIST_DIR lets CI or a second terminal build
  // into its own folder while a dev server keeps running.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  basePath,
  ...(standalone
    ? {
        output: 'standalone',
        // This is an npm-workspaces monorepo: trace files from the repo root so the
        // shared packages (@bfam/api-client, @bfam/shared-types) are included.
        outputFileTracingRoot: path.join(__dirname, '../../'),
      }
    : {}),
};

module.exports = nextConfig;
