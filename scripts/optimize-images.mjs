import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');

function writeOptimized(abs, buf) {
  const tmp = `${abs}.tmp`;
  fs.writeFileSync(tmp, buf);
  try {
    fs.unlinkSync(abs);
  } catch (_) { /* file may not exist yet */ }
  fs.renameSync(tmp, abs);
}

async function optimizeJpeg(file, maxWidth = 1400, quality = 82) {
  const abs = path.join(root, file);
  const before = fs.statSync(abs).size;
  const img = sharp(abs);
  const meta = await img.metadata();
  let pipeline = img.rotate();
  if (meta.width > maxWidth) {
    pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
  }
  const buf = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
  if (buf.length < before) {
    writeOptimized(abs, buf);
  }
  const after = fs.statSync(abs).size;
  return { file, before, after };
}

async function optimizePng(file, maxDim = null) {
  const abs = path.join(root, file);
  const before = fs.statSync(abs).size;
  let pipeline = sharp(abs).rotate();
  if (maxDim) {
    const meta = await pipeline.metadata();
    if (meta.width > maxDim || meta.height > maxDim) {
      pipeline = pipeline.resize({ width: maxDim, height: maxDim, fit: 'inside', withoutEnlargement: true });
    }
  }
  const buf = await pipeline.png({ compressionLevel: 9, palette: true, quality: 80 }).toBuffer();
  if (buf.length < before) {
    writeOptimized(abs, buf);
  }
  const after = fs.statSync(abs).size;
  return { file, before, after };
}

function fmt(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

const results = [];

// Homepage slideshow – displayed at ~900px max
for (let i = 1; i <= 6; i++) {
  results.push(await optimizeJpeg(`assets/img/slideshow/NewSlide${i}.jpg`, 1200, 80));
}

// Oversized icon
results.push(await optimizePng('assets/img/icons/insta.png', 128));

// Discography page – album art & singles (displayed ≤ 400px)
const discographyJpegs = [
  'assets/img/album/bites.jpg',
  'assets/img/album/loveyou.jpg',
  'assets/img/album/caferedux.jpg',
  'assets/img/album/slowpoke.jpg',
  'assets/img/album/kow.jpg',
  'assets/img/album/redux.jpg',
  'assets/img/album/saturn.jpg',
  'assets/img/album/imtw.jpg',
  'assets/img/album/feelslikefluid.jpg',
  'assets/img/album/rawhide.jpg',
  'assets/img/album/hardthing.jpg',
  'assets/img/album/iseewhatidont! Cover.jpg',
  'assets/img/album/Everything I Loved!TN.jpg',
  'assets/img/album/Jack The Rockstar_TN.jpeg',
  'assets/img/IMG_9906.jpg',
  'assets/img/puncherz/puncherzthumb1.jpg',
];
for (const f of discographyJpegs) {
  if (fs.existsSync(path.join(root, f))) {
    results.push(await optimizeJpeg(f, 800, 82));
  }
}

// Thumbnail PNGs used on discography / video pages
const thumbPngs = [
  'assets/img/BitesTB.png',
  'assets/img/HalfAMindTB.jpg',
  'assets/img/CowboyTB.jpg',
  'assets/img/ExtraTB.jpg',
  'assets/img/LifeTB.png',
  'assets/img/album/cafe-blur.png',
  'assets/img/album/loveyou-blur.jpg',
  'assets/img/album/kow-blur.jpg',
];
for (const f of thumbPngs) {
  const abs = path.join(root, f);
  if (!fs.existsSync(abs)) continue;
  if (/\.png$/i.test(f)) {
    results.push(await optimizePng(f, 1200));
  } else {
    results.push(await optimizeJpeg(f, 800, 82));
  }
}

// Star dot backgrounds on discography page
for (const color of ['orange', 'white', 'yellow', 'red', 'blue']) {
  const f = `assets/img/dots/${color} stars.png`;
  if (fs.existsSync(path.join(root, f))) {
    results.push(await optimizePng(f, 512));
  }
}

console.log('Optimization results:');
let saved = 0;
for (const r of results) {
  const delta = r.before - r.after;
  saved += Math.max(0, delta);
  const pct = r.before ? ((1 - r.after / r.before) * 100).toFixed(0) : 0;
  console.log(`  ${r.file}: ${fmt(r.before)} → ${fmt(r.after)} (${pct}% saved)`);
}
console.log(`\nTotal saved: ${fmt(saved)}`);
