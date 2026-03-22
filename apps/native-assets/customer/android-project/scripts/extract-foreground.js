import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const src = path.join(__dirname, '../app_icon_source.png');
  const outDir = path.join(__dirname, '../app/src/main/res/drawable');
  const out = path.join(outDir, 'ic_launcher_foreground.png');
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const luminance = (r + g + b) / 3;
    if (luminance < 220) data[i + 3] = 0;
  }
  fs.mkdirSync(outDir, { recursive: true });
  await sharp(Buffer.from(data), { raw: { width, height, channels: 4 } }).png().toFile(out);
  console.log('Foreground written to', out);
}
main().catch((e) => console.error(e));
