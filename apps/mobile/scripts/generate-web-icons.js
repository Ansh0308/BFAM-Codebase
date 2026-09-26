// Generates the BFAM app icons (red tile, white "BFAM" in the brand's Anton face)
// used by the mobile-web build: the iPhone home-screen icon, the web-app manifest
// icons and the favicon. Run from apps/mobile:  node scripts/generate-web-icons.js
// The output (public/*.png) is committed, so this only needs re-running if the
// artwork changes. Uses `sharp`, which is already installed in the monorepo.
const path = require('path');
const sharp = require('sharp');

const BRAND_RED = '#D80000';
const FONT = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'node_modules',
  '@expo-google-fonts',
  'anton',
  'Anton_400Regular.ttf',
);
const OUT = path.join(__dirname, '..', 'public');

async function makeIcon(size, file) {
  // The wordmark takes ~72% of the width, which also keeps it inside the
  // "safe zone" of a maskable (rounded/circular) icon.
  const label = await sharp({
    text: {
      text: '<span foreground="white">BFAM</span>',
      font: 'Anton',
      fontfile: FONT,
      rgba: true,
      dpi: 1200,
    },
  })
    .png()
    .toBuffer();
  const maxWidth = Math.round(size * 0.72);
  const scaled = await sharp(label).resize({ width: maxWidth }).png().toBuffer();
  const scaledMeta = await sharp(scaled).metadata();

  await sharp({ create: { width: size, height: size, channels: 4, background: BRAND_RED } })
    .composite([
      {
        input: scaled,
        left: Math.round((size - scaledMeta.width) / 2),
        top: Math.round((size - scaledMeta.height) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, file));
  console.log('wrote', file, size + 'x' + size);
}

(async () => {
  await makeIcon(180, 'apple-touch-icon.png');
  await makeIcon(192, 'icon-192.png');
  await makeIcon(512, 'icon-512.png');
  await makeIcon(64, 'favicon.png');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
