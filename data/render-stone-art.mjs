import { readFile, readdir } from 'node:fs/promises';
import sharp from 'sharp';

// Rasterize the preserved illustrations once instead of repainting SVG turbulence on every card.
const source = new URL('./stone-art/', import.meta.url);
for (const file of (await readdir(source)).filter((name) => name.endsWith('.svg'))) {
  const svg = await readFile(new URL(file, source));
  for (const width of [400, 800, 1200]) {
    await sharp(svg, { density: 192 })
      .resize(width, width)
      .webp({ quality: 88 })
      .toFile(new URL(`../assets/worktop-art-${file.slice(0, -4)}-${width}.webp`, import.meta.url).pathname);
  }
}
