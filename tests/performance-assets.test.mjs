import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import test from 'node:test';
import sharp from 'sharp';
import { Liquid } from 'liquidjs';

test('every preserved catalogue illustration has valid responsive raster files and matching schema coverage', async () => {
  const manifest = JSON.parse(await readFile(new URL('../data/stone-art/manifest.json', import.meta.url), 'utf8'));
  const illustration = await readFile(new URL('../snippets/worktop-stone-art.liquid', import.meta.url), 'utf8');
  const schema = await readFile(new URL('../snippets/structured-data-product.liquid', import.meta.url), 'utf8');
  const mapping = await readFile(new URL('../snippets/worktop-art-url.liquid', import.meta.url), 'utf8');
  assert.match(illustration, /render 'worktop-art-url'/);
  assert.match(schema, /render 'worktop-art-url'/);
  for (const { handle } of manifest.products) {
    assert.ok(mapping.includes(`|${handle}|`), handle);
    for (const width of [400, 800, 1200]) {
      const metadata = await sharp(new URL(`../assets/worktop-art-${handle}-${width}.webp`, import.meta.url).pathname).metadata();
      assert.equal(metadata.format, 'webp');
      assert.equal(metadata.width, width);
      assert.equal(metadata.height, width);
    }
  }
});

test('critical inline CSS remains within the platform size limit and has no relative resource URLs', async () => {
  for (const name of ['component-cart-drawer', 'component-cart', 'component-totals', 'component-discounts', 'quantity-popover', 'worktop-cart', 'home-hero', 'section-breadcrumbs']) {
    const path = new URL(`../assets/${name}.css`, import.meta.url);
    assert.ok((await stat(path)).size < 15000, name);
    const css = await readFile(path, 'utf8');
    for (const [, url] of css.matchAll(/url\(\s*['"]?([^'"\s)]+)/g)) {
      assert.match(url, /^(?:https?:|data:|\/\/|\/|#)/, `${name}: ${url}`);
    }
  }
});

test('optional CSS follows announcement count, rating blocks and all deferred media types', async () => {
  const engine = new Liquid();
  engine.registerFilter('asset_url', (name) => name);
  engine.registerFilter('stylesheet_tag', (name) => `<link href="${name}">`);
  const announcement = (await readFile(new URL('../sections/announcement-bar.liquid', import.meta.url), 'utf8')).split('{%- liquid')[0];
  assert.doesNotMatch(engine.parseAndRenderSync(announcement, { section: { blocks: [{}] } }), /component-slider/);
  assert.match(engine.parseAndRenderSync(announcement, { section: { blocks: [{}, {}] } }), /component-slider/);
  const product = await readFile(new URL('../sections/main-product.liquid', import.meta.url), 'utf8');
  const conditional = product.slice(product.indexOf('  {%- liquid'), product.indexOf('  {% unless product.has_only_default_variant'));
  const render = (blocks, media) => engine.parseAndRenderSync(conditional, { section: { blocks }, product: { media } });
  assert.equal(render([], []).trim(), '');
  assert.match(render([], [{ media_type: 'image' }]), /component-slider/);
  assert.match(render([{ type: 'complementary' }], []), /component-slider/);
  assert.match(render([{ type: 'rating' }], []), /component-rating/);
  for (const media_type of ['video', 'external_video', 'model']) {
    assert.match(render([], [{ media_type }]), /component-deferred-media/, media_type);
  }
});

test('generated critical CSS preserves every source byte and stylesheet order within safe inline sizes', async () => {
  for (const name of ['base', 'brand', 'section-main-product', 'component-facets']) {
    const original = await readFile(`assets/${name}.css`, 'utf8');
    const snippet = await readFile(`snippets/perf-${name}-css.liquid`, 'utf8');
    const names = [...snippet.matchAll(/'([^']+\.css)' \| inline_asset_content/g)].map(match => match[1]);
    assert.ok(names.length > 0);
    const chunks = await Promise.all(names.map(async file => {
      const chunk = await readFile(`assets/${file}`, 'utf8');
      assert.ok(Buffer.byteLength(chunk) < 15000);
      assert.doesNotMatch(chunk, /<\/style/i);
      return chunk;
    }));
    assert.equal(chunks.join(''), original, name);
    for (const [, url] of original.matchAll(/url\(\s*['"]?([^'"\s)]+)/g)) {
      assert.ok(/^(?:https?:|data:|\/\/|\/|#)/.test(url) || url === './sparkle.gif', `${name}: ${url}`);
    }
    assert.match(snippet, /replace: '\.\/sparkle.gif', sparkle_url/);
  }
});

test('LCP preload matches the existing responsive artwork and excludes native media and later collection pages', async () => {
  const engine = new Liquid({ root: new URL('../snippets/', import.meta.url).pathname, extname: '.liquid' });
  engine.registerTag('doc', {
    parse(_token, remaining) { while (remaining.length) if (remaining.shift().name === 'enddoc') return; },
    render() { return ''; },
  });
  engine.registerFilter('asset_url', name => `//example.test/assets/${name}`);
  const product = { handle: 'concrete-white-quartz', featured_media: null };
  const render = (globals) => engine.renderFileSync('perf-lcp-preload', globals, { globals });
  const output = render({ request: { page_type: 'product' }, product });
  assert.match(output, /imagesizes="\(min-width: 990px\) 50vw, 100vw"/);
  assert.match(output, /-400.webp 400w, .*?-800.webp 800w, .*?-1200.webp 1200w/);
  assert.doesNotMatch(render({ request: { page_type: 'product' }, product: { ...product, featured_media: { id: 1 } } }), /rel="preload"/);
  assert.doesNotMatch(render({ request: { page_type: 'product' }, product: { handle: 'unknown' } }), /rel="preload"/);
  const collection = { products: [product] };
  assert.match(render({ request: { page_type: 'collection' }, current_page: 1, collection }), /33vw, 50vw/);
  assert.doesNotMatch(render({ request: { page_type: 'collection' }, current_page: 2, collection }), /rel="preload"/);
});

// Cover every literal inline CSS call, including future section additions.
test('all inline stylesheets stay within Shopify limits and preserve relative asset resolution', async () => {
  for (const folder of ['layout', 'sections', 'snippets']) {
    for (const name of (await readdir(folder)).filter(name => name.endsWith('.liquid'))) {
      const liquid = await readFile(`${folder}/${name}`, 'utf8');
      for (const [, asset] of liquid.matchAll(/'([^']+\.css)' \| inline_asset_content/g)) {
        const css = await readFile(`assets/${asset}`, 'utf8');
        assert.ok(Buffer.byteLength(css) < 15000, asset);
        for (const [, url] of css.matchAll(/url\(\s*['"]?([^'"\s)]+)/g)) {
          if (!/^(?:https?:|data:|\/\/|\/|#)/.test(url)) {
            assert.equal(url, './sparkle.gif', asset);
            assert.match(liquid, /replace: '\.\/sparkle.gif', sparkle_url/);
          }
        }
      }
    }
  }
});

test('optimized fonts retain original merchant choices and are smaller than their pinned sources', async () => {
  const { createHash } = await import('node:crypto');
  const manifest = JSON.parse(await readFile('data/font-performance/manifest.json', 'utf8'));
  for (const font of manifest.fonts) {
    const bytes = await readFile(font.file);
    assert.equal(bytes.subarray(0, 4).toString(), 'wOF2');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), font.sha256);
    assert.ok(bytes.length < font.sourceBytes);
  }
  const engine = new Liquid();
  engine.registerTag('doc', {
    parse(_token, remaining) { while (remaining.length) if (remaining.shift().name === 'enddoc') return; },
    render() { return ''; },
  });
  engine.registerFilter('asset_url', name => name);
  engine.registerFilter('font_url', font => font?.url || '');
  const snippet = await readFile('snippets/perf-fonts.liquid', 'utf8');
  const render = settings => engine.parseAndRenderSync(snippet, { settings });
  assert.doesNotMatch(render({ type_header_font: { family: 'Other' }, type_body_font: { family: 'Other' } }), /@font-face/);
  assert.match(render({ type_header_font: { family: 'Fraunces', url: '/fonts/fraunces/fraunces_n4.test.woff2' } }), /perf-fraunces-optical/);
  assert.doesNotMatch(render({ type_header_font: { family: 'Fraunces', url: '/fonts/fraunces/fraunces_n7.test.woff2' } }), /@font-face/);
  assert.doesNotMatch(render({ type_body_font: { family: '"DM Sans"', url: '/fonts/dm_sans/dmsans_n4.test.woff2' } }), /@font-face/);
});
