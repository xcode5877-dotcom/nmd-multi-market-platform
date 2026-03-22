#!/usr/bin/env node
/**
 * Generate adaptive icon assets: solid teal background + foreground PNGs for all mipmap densities.
 * Run from repo root: node apps/native-assets/customer/android-project/scripts/generate-adaptive-icon.js
 */
import sharp from 'sharp';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RES_BASE = join(__dirname, '..', 'app', 'src', 'main', 'res');

const TEAL_HEX = '#1DA1B2';
const DENSITIES = [
  { name: 'mipmap-mdpi', size: 108 },
  { name: 'mipmap-hdpi', size: 162 },
  { name: 'mipmap-xhdpi', size: 216 },
  { name: 'mipmap-xxhdpi', size: 324 },
  { name: 'mipmap-xxxhdpi', size: 432 },
];

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

function hexToRgb(hex) {
  const m = hex.slice(1).match(/(..)(..)(..)/);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 29, g: 161, b: 178 };
}

async function main() {
  const foregroundPath = join(__dirname, '..', 'ic_launcher_foreground_432.png');
  let foregroundBuffer;
  try {
    const { readFile } = await import('fs/promises');
    foregroundBuffer = await readFile(foregroundPath);
  } catch (e) {
    console.error('Foreground image not found at', foregroundPath);
    process.exit(1);
  }

  const rgb = hexToRgb(TEAL_HEX);

  for (const { name, size } of DENSITIES) {
    const outDir = join(RES_BASE, name);
    await ensureDir(outDir);

    const bgPng = await sharp({
      create: {
        width: size,
        height: size,
        channels: 3,
        background: { r: rgb.r, g: rgb.g, b: rgb.b },
      },
    })
      .png()
      .toBuffer();

    await writeFile(join(outDir, 'ic_launcher_background.png'), bgPng);
    console.log('Wrote', name, 'ic_launcher_background.png', size + 'x' + size);

    const fgResized = await sharp(foregroundBuffer)
      .resize(size, size)
      .png()
      .toBuffer();
    await writeFile(join(outDir, 'ic_launcher_foreground.png'), fgResized);
    console.log('Wrote', name, 'ic_launcher_foreground.png', size + 'x' + size);

    // Legacy composite (ic_launcher.png and ic_launcher_round.png) for API < 26
    const composite = await sharp(bgPng)
      .composite([{ input: fgResized, left: 0, top: 0 }])
      .png()
      .toBuffer();
    await writeFile(join(outDir, 'ic_launcher.png'), composite);
    await writeFile(join(outDir, 'ic_launcher_round.png'), composite);
    console.log('Wrote', name, 'ic_launcher.png + ic_launcher_round.png (legacy)');
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
