import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import sharp from 'sharp';

test('every preserved catalogue illustration has valid responsive raster files and matching schema coverage', async () => {
  const manifest = JSON.parse(await readFile(new URL('../data/stone-art/manifest.json', import.meta.url), 'utf8'));
  const illustration = await readFile(new URL('../snippets/worktop-stone-art.liquid', import.meta.url), 'utf8');
  const schema = await readFile(new URL('../snippets/structured-data-product.liquid', import.meta.url), 'utf8');
  for (const { handle } of manifest.products) {
    assert.ok(illustration.includes(`|${handle}|`), handle);
    assert.ok(schema.includes(`|${handle}|`), handle);
    for (const width of [400, 800, 1200]) {
      const metadata = await sharp(new URL(`../assets/worktop-art-${handle}-${width}.webp`, import.meta.url).pathname).metadata();
      assert.equal(metadata.format, 'webp');
      assert.equal(metadata.width, width);
      assert.equal(metadata.height, width);
    }
  }
});
