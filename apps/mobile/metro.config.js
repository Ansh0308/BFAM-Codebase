/* global __dirname */
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// A custom `config.watchFolders` pointing at packages/* was tried here for
// the npm-workspaces monorepo recipe, but on Windows it made Metro emit
// bundle request URLs with literal backslashes (e.g.
// "..\\..\\node_modules\\expo-router\\entry.bundle"), which 404s. Metro's
// own default monorepo root detection (it walks up to the nearest
// package-lock.json) already resolves the @bfam/* workspace symlinks
// correctly without it, so it's simplest to just rely on that default.
// This sandboxed environment appears to kill Metro's parallel jest-worker
// transform processes (SIGTERM, exitCode=143), likely a process/resource
// limit — forcing a single in-band worker avoids spawning the pool that
// gets killed. Harmless (just slower) on a normal machine.
config.maxWorkers = 1;

module.exports = withNativeWind(config, { input: './global.css' });
