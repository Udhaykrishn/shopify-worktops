import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function quote() {
  const elements = new Map();
  const storage = new Map();
  const context = vm.createContext({
    HTMLElement: class {},
    document: { addEventListener() {}, removeEventListener() {} },
    window: { sessionStorage: { getItem: (key) => storage.get(key), removeItem: (key) => storage.delete(key), setItem: (key, value) => storage.set(key, value) } },
    customElements: { get: (key) => elements.get(key), define: (key, value) => elements.set(key, value) },
  });
  vm.runInContext(readFileSync(new URL('../assets/quote-form.js', import.meta.url), 'utf8'), context);
  const form = new (elements.get('quote-form'))();
  const fields = new Map();
  const labels = new Map();
  ['variant', 'length', 'width', 'area'].forEach((key) => labels.set(`[data-quote-${key === 'variant' ? 'variant' : 'size'}-label]`, { textContent: '' }));
  const fieldNames = { product: 'product', product_url: 'product_url', variant: 'variant', length: 'length_mm', width: 'width_mm', area: 'area_m2' };
  Object.entries(fieldNames).forEach(([key, name]) => {
    const field = { value: key === 'variant' ? '20mm / Straight' : '', type: 'hidden', tagName: 'INPUT' };
    fields.set(`contact[${name}]`, field);
    labels.set(`[data-quote-field="${key}"]`, field);
  });
  form.form = { elements: { namedItem: (name) => fields.get(name) } };
  form.strings = { size: '[length] × [width] mm ([area] m²)', placeholder: 'Choose size' };
  form.querySelector = (selector) => labels.get(selector);
  form.dataset = { productId: '123' };
  return { form, fields, labels };
}

test('server-error recovery keeps the submitted variant, dimensions and visible summary together', () => {
  const { form, fields, labels } = quote();
  form.restoreFields({ 'contact[variant]': '30mm / Bullnose', 'contact[length_mm]': '1000', 'contact[width_mm]': '600', 'contact[area_m2]': '0.60' });
  form.renderSelection();
  assert.equal(fields.get('contact[variant]').value, '30mm / Bullnose');
  assert.equal(labels.get('[data-quote-variant-label]').textContent, ', 30mm / Bullnose');
  assert.equal(labels.get('[data-quote-size-label]').textContent, '1000 × 600 mm (0.60 m²)');
  assert.equal(form.collectFields()['contact[area_m2]'], '0.60');
});

test('a subsequent selection updates the same hidden fields and labels using text', () => {
  const { form, fields, labels } = quote();
  form.onWorktopChange({ detail: { productId: '123', variantTitle: '<script>demo</script>', lengthMm: 1200, widthMm: 500, areaM2: '0.60' } });
  assert.equal(fields.get('contact[length_mm]').value, '1200');
  assert.equal(labels.get('[data-quote-variant-label]').textContent, ', <script>demo</script>');
  form.onWorktopChange({ detail: { productId: 'another', variantTitle: 'Wrong', lengthMm: 2000, widthMm: 1000, areaM2: '2.00' } });
  assert.equal(fields.get('contact[length_mm]').value, '1200');
});

test('the existing modal reopens and focuses a server error after a form post', () => {
  const elements = new Map();
  const classes = new Set();
  const context = vm.createContext({
    HTMLElement: class {},
    document: { addEventListener() {}, body: { classList: { add: (value) => classes.add(value) } } },
    window: { location: { hash: '' } },
    customElements: { get: (key) => elements.get(key), define: (key, value) => elements.set(key, value) },
  });
  vm.runInContext(readFileSync(new URL('../assets/quote-modal.js', import.meta.url), 'utf8'), context);
  const modal = new (elements.get('quote-modal'))();
  const dialog = { open: false, addEventListener() {}, showModal() { this.open = true; } };
  const message = { focused: false, focus() { this.focused = true; } };
  modal.querySelector = (selector) => selector === 'dialog' ? dialog : message;
  modal.addEventListener = () => {};
  modal.connectedCallback();
  assert.equal(dialog.open, true);
  assert.equal(message.focused, true);
  assert.equal(classes.has('quote-modal-open'), true);
});
