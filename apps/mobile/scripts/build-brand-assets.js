// Builds every raster brand asset from the two vector shapes in src/assets/brand
// (mark.svg = the B monogram with batter and bowler, wordmark.svg = the BFAM
// lettering; both traced from the approved brand sheet):
//
//   src/assets/brand/logo-stacked.png     monogram over wordmark and tagline
//   src/assets/brand/logo-horizontal.png  monogram beside wordmark and tagline
//   src/assets/brand/logo-mark.png        monogram only
//   assets/icon.png                       1024 app icon (iOS + Android legacy)
//   assets/adaptive-icon.png              Android adaptive-icon foreground
//   public/apple-touch-icon.png, icon-192.png, icon-512.png, favicon.png   web / iPhone home screen
//
// Run from apps/mobile:  node scripts/build-brand-assets.js
// The PNG output is committed; re-run only if the artwork changes.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const BRAND = path.join(ROOT, 'src', 'assets', 'brand');
const ASSETS = path.join(ROOT, 'assets');
const PUBLIC = path.join(ROOT, 'public');
const INTER_BOLD = path.join(
  ROOT,
  '..',
  '..',
  'node_modules',
  '@expo-google-fonts',
  'inter',
  'Inter_700Bold.ttf',
);

const RED = '#E10600';
const INK = '#0B0B0B';

fs.mkdirSync(ASSETS, { recursive: true });

// Renders one of the traced SVGs in a chosen colour, cropped to its artwork.
async function shape(file, fill, width) {
  const svg = fs
    .readFileSync(path.join(BRAND, file), 'utf8')
    .replace(/fill="#[0-9A-Fa-f]{6}"/g, `fill="${fill}"`);
  const big = await sharp(Buffer.from(svg), { density: 96 }).png().toBuffer();
  const trimmed = await sharp(big).trim({ threshold: 5 }).png().toBuffer();
  return sharp(trimmed).resize({ width }).png().toBuffer();
}

async function tagline(width, color) {
  const text = await sharp({
    text: {
      text: `<span foreground="${color}" letter_spacing="7000">BROTHER FROM ANOTHER MOTHER</span>`,
      font: 'Inter Bold',
      fontfile: INTER_BOLD,
      rgba: true,
      dpi: 600,
    },
  })
    .png()
    .toBuffer();
  return sharp(text).trim({ threshold: 5 }).resize({ width }).png().toBuffer();
}

const dims = async (buf) => {
  const m = await sharp(buf).metadata();
  return { w: m.width, h: m.height };
};

async function stacked() {
  const canvasW = 1000;
  const mark = await shape('mark.svg', RED, 860);
  const word = await shape('wordmark.svg', RED, canvasW);
  const tag = await tagline(canvasW, INK);
  const [m, w, t] = await Promise.all([dims(mark), dims(word), dims(tag)]);
  const gap1 = 60;
  const gap2 = 34;
  const height = m.h + gap1 + w.h + gap2 + t.h;
  await sharp({
    create: { width: canvasW, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: mark, left: Math.round((canvasW - m.w) / 2), top: 0 },
      { input: word, left: 0, top: m.h + gap1 },
      { input: tag, left: 0, top: m.h + gap1 + w.h + gap2 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(BRAND, 'logo-stacked.png'));
  console.log('logo-stacked.png', canvasW + 'x' + height);
}

async function horizontal() {
  const wordW = 640;
  const word = await shape('wordmark.svg', RED, wordW);
  const tag = await tagline(wordW, INK);
  const [w, t] = await Promise.all([dims(word), dims(tag)]);
  const columnH = w.h + 30 + t.h;
  const mark = await shape('mark.svg', RED, Math.round(columnH * 1.75));
  const m = await dims(mark);
  const gap = 44;
  const height = Math.max(m.h, columnH);
  const width = m.w + gap + wordW;
  await sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: mark, left: 0, top: Math.round((height - m.h) / 2) },
      { input: word, left: m.w + gap, top: Math.round((height - columnH) / 2) },
      { input: tag, left: m.w + gap, top: Math.round((height - columnH) / 2) + w.h + 30 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(BRAND, 'logo-horizontal.png'));
  console.log('logo-horizontal.png', width + 'x' + height);
}

async function markOnly() {
  const buf = await shape('mark.svg', RED, 720);
  await sharp(buf).png({ compressionLevel: 9 }).toFile(path.join(BRAND, 'logo-mark.png'));
  const m = await dims(buf);
  console.log('logo-mark.png', m.w + 'x' + m.h);
}

// Red tile with a subtle top-to-bottom gradient and the white monogram.
async function tile(size, markRatio, file, { transparent = false } = {}) {
  const markW = Math.round(size * markRatio);
  const mark = await shape('mark.svg', '#FFFFFF', markW);
  const m = await dims(mark);
  const layers = [
    { input: mark, left: Math.round((size - m.w) / 2), top: Math.round((size - m.h) / 2) },
  ];
  let base;
  if (transparent) {
    base = sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    });
  } else {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F02A1A"/><stop offset="1" stop-color="#C40800"/></linearGradient></defs><rect width="${size}" height="${size}" fill="url(#g)"/></svg>`;
    base = sharp(Buffer.from(svg));
  }
  let out = base.composite(layers);
  if (!transparent) out = out.flatten({ background: '#D80000' }).removeAlpha();
  await out.png({ compressionLevel: 9 }).toFile(file);
  console.log(path.relative(ROOT, file), size + 'x' + size);
}

(async () => {
  await stacked();
  await horizontal();
  await markOnly();
  await tile(1024, 0.62, path.join(ASSETS, 'icon.png'));
  await tile(1024, 0.5, path.join(ASSETS, 'adaptive-icon.png'), { transparent: true });
  await tile(180, 0.66, path.join(PUBLIC, 'apple-touch-icon.png'));
  await tile(192, 0.62, path.join(PUBLIC, 'icon-192.png'));
  await tile(512, 0.5, path.join(PUBLIC, 'icon-512.png'));
  await tile(64, 0.7, path.join(PUBLIC, 'favicon.png'));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
