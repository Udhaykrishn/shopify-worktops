import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Liquid } from 'liquidjs';

const engine = new Liquid({ root: fileURLToPath(new URL('../snippets/', import.meta.url)), extname: '.liquid' });
engine.registerTag('doc', {
  parse(_token, remaining) {
    while (remaining.length) if (remaining.shift().name === 'enddoc') return;
    throw new Error('Unclosed LiquidDoc');
  },
  render() { return ''; },
});
engine.registerFilter('t', (key) => key);
engine.registerFilter('asset_url', (name) => `//example.test/assets/${name}`);

function head(overrides = {}) {
  const globals = {
    request: { page_type: 'index', origin: 'https://example.test' },
    canonical_url: 'https://example.test/',
    shop: { name: 'Stone & More' },
    template: {}, current_page: 1, page_title: 'Worktops', ...overrides,
  };
  // Shopify's standard objects remain available across isolated render scopes.
  return engine.renderFileSync('seo-meta', globals, { globals });
}

test('assessment is noindex while the ordinary homepage keeps its description and stays indexable', () => {
  assert.doesNotMatch(head(), /name="robots"/);
  const assessment = head({ template: { suffix: 'assessment' } });
  assert.match(assessment, /name="robots" content="noindex, follow"/);
  assert.match(assessment, /name="description"/);
  assert.match(assessment, /rel="canonical" href="https:\/\/example.test\/"/);
});

test('plain pagination is self canonical; sorting, active values, price ranges and tags canonicalize to the collection', () => {
  const request = { page_type: 'collection', origin: 'https://example.test' };
  const collection = { title: 'Quartz', url: '/collections/quartz', filters: [] };
  const page = head({ request, collection, current_page: 2 });
  assert.match(page, /href="https:\/\/example.test\/collections\/quartz\?page=2"/);
  assert.doesNotMatch(page, /name="robots"/);
  for (const change of [
    { collection: { ...collection, sort_by: 'price-ascending' } },
    { collection: { ...collection, filters: [{ type: 'list', active_values: ['White'] }] } },
    { collection: { ...collection, filters: [{ type: 'price_range', min_value: { value: 0 } }] } },
    { current_tags: ['White'] },
  ]) {
    const filtered = head({ request, collection, current_page: 2, ...change });
    assert.match(filtered, /name="robots" content="noindex, follow"/);
    assert.match(filtered, /href="https:\/\/example.test\/collections\/quartz"/);
    assert.doesNotMatch(filtered, /href="[^"]*page=/);
  }
});

test('head social tags share the resolved canonical/description and escape merchant text', () => {
  const html = head({
    social_tags: true,
    page_description: 'Cut "to size" & polished.',
    request: { page_type: 'collection', origin: 'https://example.test' },
    collection: { url: '/collections/quartz', filters: [], sort_by: 'price-ascending' },
    canonical_url: 'https://example.test/collections/quartz?sort_by=price-ascending',
  });
  assert.match(html, /property="og:url" content="https:\/\/example.test\/collections\/quartz"/);
  assert.match(html, /property="og:site_name" content="Stone &amp; More"/);
  const description = html.match(/name="description" content="([^"]+)"/)[1];
  assert.ok(html.includes(`property="og:description" content="${description}"`));
  assert.doesNotMatch(head(), /property="og:/);
});

test('product social price uses the displayed worktop rate per square metre and decimal machine values', () => {
  for (const [suffix, price, expected] of [['worktop', 252, '252'], ['', 1299, '12.99']]) {
    const html = head({
      social_tags: true, request: { page_type: 'product' },
      product: { template_suffix: suffix, price, metafields: { custom: {} } },
      cart: { currency: { iso_code: 'GBP' } },
    });
    assert.match(html, new RegExp(`property="og:price:amount" content="${expected.replace('.', '\\.')}"`));
    assert.match(html, /property="og:price:currency" content="GBP"/);
  }
});

test('internal search remains noindex', () => {
  assert.match(head({ request: { page_type: 'search' } }), /name="robots" content="noindex, follow"/);
});

test('a product without native media shares its displayed illustration with social metadata and JSON-LD', () => {
  const product = {
    title: 'Concrete White Quartz', handle: 'concrete-white-quartz', template_suffix: 'worktop', price: 252,
    metafields: { custom: {} }, variants: [], media: [], selected_or_first_available_variant: {},
  };
  const globals = { request: { page_type: 'product', origin: 'https://example.test' }, product, shop: { name: 'Worktops', currency: 'GBP' } };
  const html = head({ ...globals, social_tags: true });
  const url = 'https://example.test/assets/worktop-art-concrete-white-quartz-1200.webp';
  assert.ok(html.includes(`property="og:image" content="${url}"`));
  const schema = engine.renderFileSync('structured-data-product', globals, { globals });
  assert.deepEqual(JSON.parse(schema.match(/<script[^>]*>([\s\S]*)<\/script>/)[1]).image, [url]);
  assert.doesNotMatch(head({ ...globals, product: { ...product, handle: 'unknown' }, social_tags: true }), /property="og:image"/);
});
