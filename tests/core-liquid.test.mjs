import assert from 'node:assert/strict';
import test from 'node:test';
import { Liquid } from 'liquidjs';
import { fileURLToPath } from 'node:url';

const engine = new Liquid({ root: fileURLToPath(new URL('../snippets/', import.meta.url)), extname: '.liquid' });
engine.registerTag('doc', {
  parse(_token, remaining) {
    while (remaining.length) if (remaining.shift().name === 'enddoc') return;
    throw new Error('Unclosed LiquidDoc');
  },
  render() { return ''; },
});
// Shopify floors division when its divisor is an integer; LiquidJS uses JavaScript division by default.
engine.registerFilter('divided_by', (value, divisor) => Number.isInteger(divisor) ? Math.floor(value / divisor) : value / divisor);

const property = (value) => engine.renderFileSync('worktop-property-value', { value }).trim();

test('cart properties cannot turn javascript, data, protocol-relative or query values into upload links', () => {
  for (const value of [
    'javascript:alert("/uploads/x")',
    'data:text/html,<svg onload=alert(1)>/uploads/x',
    '//example.test/uploads/x',
    'https://example.test/?next=/uploads/x',
    'https://example.test/#/uploads/x',
    '<img src=x onerror=alert(1)>',
    '/\\example.test/uploads/x',
  ]) {
    const html = property(value);
    assert.equal(html.includes('<a '), false, value);
    assert.equal(html.includes('<img'), false, value);
    assert.equal(html.includes('<svg'), false, value);
  }
});

test('actual HTTP(S) and root upload paths render escaped file links with opener isolation', () => {
  for (const value of ['https://cdn.shopify.com/s/files/1/1/uploads/cut.png', 'http://example.test/uploads/cut.png', '/uploads/cut.png']) {
    const html = property(value);
    assert.match(html, /<a href=/);
    assert.match(html, /rel="noopener noreferrer"/);
    assert.match(html, />cut.png<\/a>/);
  }
  assert.match(property('/uploads/cut".png'), /href="\/uploads\/cut&#34;.png"/);
});

function status(properties, quantity = 60, overrides = {}) {
  const custom = {};
  for (const [key, value] of Object.entries({ min_length_mm: 300, max_length_mm: 3200, min_width_mm: 300, max_width_mm: 1600, ...overrides })) custom[key] = { value };
  return engine.renderFileSync('worktop-line-status', { item: { product: { template_suffix: 'worktop', metafields: { custom } }, properties, quantity } }).trim();
}
const valid = { 'Length (mm)': '1000', 'Width (mm)': '600', 'Area (m²)': '0.60' };

test('cart validation accepts exact billed area and whole multiples for identical pieces', () => {
  assert.equal(status(valid), 'ok 60');
  assert.equal(status(valid, 120), 'ok 60');
  assert.equal(status({ ...valid, 'Length (mm)': '1001', 'Area (m²)': '0.61' }, 61), 'ok 61');
  assert.equal(status(valid, 59), 'qty_mismatch 60');
});

test('cart validation rejects numeric coercion tricks and fails closed on invalid dimensions/limits', () => {
  for (const area of ['0.6', '0.60junk', '6e-1', '0.604', 'NaN', 'Infinity', '<script>']) {
    assert.equal(status({ ...valid, 'Area (m²)': area }), 'area_mismatch 60', area);
  }
  for (const length of ['1e3', '1000.0', '01000', '+1000']) {
    assert.equal(status({ ...valid, 'Length (mm)': length }), 'invalid 0', length);
  }
  assert.equal(status({ ...valid, 'Length (mm)': '299' }), 'out_of_range 0');
  assert.equal(status({ ...valid, 'Length (mm)': '-1000' }), 'out_of_range 0');
  assert.equal(status({ ...valid, 'Area (m²)': '' }), 'missing 0');
  assert.equal(status(valid, 60, { min_width_mm: 0 }), 'out_of_range 0');
});
