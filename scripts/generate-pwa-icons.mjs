// Generates the PWA / home-screen icons referenced by
// public/manifest.webmanifest and app/layout.tsx from the GastroBridge brand
// mark (components/fernly/brand-mark.tsx: bridge arch on the Bordeaux accent).
//
//   node scripts/generate-pwa-icons.mjs
//
// Output: public/icons/{icon-192,icon-512,icon-maskable-512,badge-72}.png and
// app/apple-icon.png (Next file convention → <link rel="apple-touch-icon">).

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "icons");
mkdirSync(outDir, { recursive: true });

// Bordeaux accent steps (600 → 800), see the Fernly redesign spec §3.
const ACC_600 = "#B91C3C";
const ACC_800 = "#5A1424";

// Same arch as BrandMark, in a 24×24 box.
const GLYPH = `
  <path d="M3 17.5h18" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"/>
  <path d="M5 17.5V14a7 7 0 0 1 14 0v3.5" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"/>
  <path d="M9.2 17.5v-2.6M14.8 17.5v-2.6M12 17.5v-3.4" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8" fill="none"/>`;

/**
 * @param size      output px
 * @param radius    corner radius as a fraction of size (0 = full bleed)
 * @param glyphFrac glyph box as a fraction of size
 */
function svg(size, radius, glyphFrac) {
  const g = size * glyphFrac;
  const offset = (size - g) / 2;
  const scale = g / 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="${ACC_600}"/>
      <stop offset="1" stop-color="${ACC_800}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * radius}" fill="url(#bg)"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">${GLYPH}</g>
</svg>`;
}

const targets = [
  // "any": rounded tile like the in-app mark.
  { file: "icon-192.png", size: 192, radius: 0.22, glyph: 0.6 },
  { file: "icon-512.png", size: 512, radius: 0.22, glyph: 0.6 },
  // "maskable": full bleed, glyph inside the 80% safe zone.
  { file: "icon-maskable-512.png", size: 512, radius: 0, glyph: 0.5 },
  // iOS rounds the corners itself and does not support transparency.
  { file: "../../app/apple-icon.png", size: 180, radius: 0, glyph: 0.6 },
  // Notification badge.
  { file: "badge-72.png", size: 72, radius: 0.22, glyph: 0.66 },
];

for (const t of targets) {
  await sharp(Buffer.from(svg(t.size, t.radius, t.glyph)))
    .png({ compressionLevel: 9 })
    .toFile(join(outDir, t.file));
  console.log("wrote", join("public/icons", t.file));
}
