/* global __dirname */
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Standard Expo + npm-workspaces monorepo recipe (see
// https://docs.expo.dev/guides/monorepos/): only watch what apps/mobile
// actually imports across the workspace boundary (packages/*), not the
// whole monorepo root — that would also pull apps/backend and apps/web's
// own (much larger, irrelevant) node_modules into Metro's file crawl.
config.watchFolders = [path.resolve(monorepoRoot, 'packages')];
// This sandboxed environment appears to kill Metro's parallel jest-worker
// transform processes (SIGTERM, exitCode=143), likely a process/resource
// limit — forcing a single in-band worker avoids spawning the pool that
// gets killed. Harmless (just slower) on a normal machine.
config.maxWorkers = 1;

module.exports = withNativeWind(config, { input: './global.css' });
