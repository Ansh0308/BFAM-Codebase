// expo-router pulls in schema-utils -> ajv-keywords, which declares `ajv` as
// a PEER dependency (^8.8.2) rather than a real one. npm's `overrides` field
// cannot force a nested copy for a peer dependency, so the workspace root's
// hoisted ajv@6 (needed by eslint's @eslint/eslintrc) wins Node's module
// resolution instead, and `expo start --web` crashes with:
//   "Cannot find module 'ajv/dist/compile/codegen'"
// (that path only exists on ajv@8). The fix is a real, physically nested
// ajv@8 copy specifically under ajv-keywords, copied from another package
// that already depends on ajv@8 as a REAL dependency (schema-utils itself).
// npm prunes untracked nested folders on every `npm install`, so this must
// be re-applied via postinstall rather than done once by hand.
/* global __dirname */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const source = path.join(root, 'node_modules', 'schema-utils', 'node_modules', 'ajv');
const destDir = path.join(root, 'node_modules', 'ajv-keywords', 'node_modules');
const dest = path.join(destDir, 'ajv');

if (!fs.existsSync(source)) {
  // expo-router (and therefore schema-utils/ajv-keywords) isn't installed —
  // nothing to fix.
  process.exit(0);
}

if (fs.existsSync(dest)) {
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.cpSync(source, dest, { recursive: true });
console.log(
  '[fix-ajv-keywords] Nested a real ajv@8 copy under ajv-keywords for expo-router/schema-utils.',
);
