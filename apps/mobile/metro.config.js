// Standard Expo + npm-workspaces monorepo recipe (see
// https://docs.expo.dev/guides/monorepos/) — the minimal official version.
// An earlier attempt also set resolver.nodeModulesPaths and
// disableHierarchicalLookup, which appeared to cause Metro to stall
// indefinitely while resolving the symlinked @bfam/* workspace packages
// (a resolution loop between apps/mobile/node_modules and the monorepo
// root's node_modules). watchFolders alone is sufficient for Metro to see
// packages/* through the npm workspace symlinks.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// process.cwd() rather than __dirname — this repo's eslint config doesn't
// list __dirname as a known global, and expo start always runs from this
// directory anyway.
const projectRoot = process.cwd();
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [path.resolve(monorepoRoot, 'packages')];
// This sandboxed environment appears to kill Metro's parallel jest-worker
// transform processes (SIGTERM, exitCode=143), likely a process/resource
// limit — forcing a single in-band worker avoids spawning the pool that
// gets killed.
config.maxWorkers = 1;

module.exports = config;
