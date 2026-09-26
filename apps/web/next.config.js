/** @type {import('next').NextConfig} */
const nextConfig = {
  // `next dev` and `next build` both write to the build directory, and
  // running them against the same one corrupts the manifests (an empty
  // app-paths-manifest makes the build fail with "Cannot find module for page:
  // /_not-found"). Setting NEXT_DIST_DIR lets CI or a second terminal build
  // into its own folder while a dev server keeps running.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

module.exports = nextConfig;
