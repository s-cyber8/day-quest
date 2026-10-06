// Generates PWA icons from the cut-out avatar (run: npm run icons).
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const src = 'public/assets/avatar/rafael-football.png';
mkdirSync('public/icons', { recursive: true });
const meta = await sharp(src).metadata();
// head + torso crop so the face reads at small sizes
const crop = await sharp(src).extract({ left: 0, top: 0, width: meta.width, height: Math.round(meta.height * 0.72) }).toBuffer();

async function make(size, fill, name) {
  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d6eefb"/><stop offset="1" stop-color="#9fd3f0"/></linearGradient></defs><rect width="${size}" height="${size}" fill="url(#g)"/><circle cx="${size * 0.5}" cy="${size * 0.55}" r="${size * 0.36}" fill="#fff" opacity=".35"/></svg>`);
  const inner = await sharp(crop).resize({ width: Math.round(size * fill), height: Math.round(size * fill), fit: 'inside' }).toBuffer();
  const im = await sharp(inner).metadata();
  await sharp(bg).composite([{ input: inner, left: Math.round((size - im.width) / 2), top: Math.round(size * 0.97 - im.height) }]).png().toFile(`public/icons/${name}.png`);
}
await make(192, 0.9, 'icon-192');
await make(512, 0.9, 'icon-512');
await make(512, 0.6, 'maskable-512'); // inside the maskable safe zone
await make(180, 0.9, 'apple-touch-icon');
console.log('icons ok');
