// Adds the home-screen ("Add to Home Screen") tags to the exported index.html.
// Expo's single-page web export ignores app/+html.tsx, so the shell is patched
// after `expo export`. Run by `npm run export:web`; safe to run twice.
const fs = require('fs');
const path = require('path');

const dist = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist'));
const file = path.join(dist, 'index.html');
if (!fs.existsSync(file)) {
  console.error('patch-web-html: ' + file + ' not found (run the export first)');
  process.exit(1);
}

const TAGS = [
  '<link rel="manifest" href="/manifest.webmanifest">',
  '<link rel="icon" type="image/png" href="/favicon.png">',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
  '<meta name="theme-color" content="#D80000">',
  '<meta name="application-name" content="BFAM">',
  '<meta name="apple-mobile-web-app-title" content="BFAM">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
].join('\n    ');

let html = fs.readFileSync(file, 'utf8');
if (!html.includes('rel="manifest"')) {
  html = html.replace('</head>', '    ' + TAGS + '\n  </head>');
}
html = html.replace(/<title>[^<]*<\/title>/, '<title>BFAM</title>');
fs.writeFileSync(file, html);
console.log('patch-web-html: home-screen tags written to ' + file);
