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

function submission({ response, protect, fail, invalid = false, honeypot = '' } = {}) {
  const elements = new Map();
  const calls = [];
  const messages = new Map(['blocked', 'success', 'errors'].map((key) => [key, {
    hidden: true, textContent: '', focus() { this.focused = true; }, querySelector() { return this; },
  }]));
  const button = { textContent: 'Request my free quote', disabled: false };
  const payload = new Map([
    ['form_type', 'contact'], ['utf8', '✓'], ['contact[name]', 'Ada'], ['contact[email]', 'ada@example.com'],
    ['contact[postcode]', 'SW1A 1AA'], ['contact[phone]', '123'], ['contact[timeframe]', 'Within a month'],
    ['contact[body]', 'My project'], ['contact[product]', 'Stone'], ['contact[variant]', '20mm'],
    ['contact[length_mm]', '1200'], ['contact[width_mm]', '600'], ['contact[area_m2]', '0.72'],
  ]);
  const nativeForm = {
    id: 'QuoteForm-test', action: '/contact#contact_form', payload,
    setAttribute(name, value) { this[name] = value; }, removeAttribute(name) { delete this[name]; },
    querySelector: () => ({ value: honeypot }),
  };
  const context = vm.createContext({
    HTMLElement: class {}, URL, AbortController, setTimeout, clearTimeout,
    window: { location: new URL('https://example.test/products/stone?preview_theme_id=1'), Shopify: { captcha: { protect } } },
    FormData: class extends Map { constructor(form) { super(form.payload); } },
    DOMParser: class {
      parseFromString(text) {
        return { getElementById: (id) => text === 'wrong form' || id !== nativeForm.id ? null : {
          querySelector: (selector) => text === 'success' && selector.includes('success') ? {} :
            text === 'invalid' && selector.includes('errors') ? { textContent: 'Email is invalid' } : null,
        } };
      }
    },
    fetch: async (url, options) => {
      calls.push({ url, ...options });
      if (fail) throw new Error('network');
      return response ? response() : { ok: true, url: 'https://example.test/products/stone', text: async () => 'success' };
    },
    customElements: { get: (key) => elements.get(key), define: (key, value) => elements.set(key, value) },
  });
  vm.runInContext(readFileSync(new URL('../assets/quote-form.js', import.meta.url), 'utf8'), context);
  const form = new (elements.get('quote-form'))();
  Object.assign(form, {
    form: nativeForm, button, buttonLabel: button.textContent, isConnected: true, submitted: false,
    requiredInputs: invalid ? [{ focus() { this.focused = true; } }] : [], showError: () => invalid,
    strings: { submitting: 'Sending…', failed: 'Unconfirmed. Try again.', challenge: 'Security check needed.' },
    querySelector: (selector) => messages.get(selector.match(/data-quote-(\w+)/)?.[1]),
    querySelectorAll: () => [messages.get('success'), messages.get('errors')],
    closest: () => null,
  });
  const event = { prevented: 0, preventDefault() { this.prevented++; }, stopImmediatePropagation() { this.stopped = true; } };
  return { form, event, calls, messages, button, payload, nativeForm };
}

test('AJAX prevents navigation, preserves complete Shopify payload and locks pending and successful submissions', async () => {
  let ready;
  const fixture = submission({ protect: (form, callback) => {
    form.payload.set('h-captcha-response', 'captcha-token');
    ready = callback;
  } });
  const { form, event, calls, button, nativeForm, messages } = fixture;
  const pending = form.onSubmit(event);
  assert.equal(event.prevented, 1);
  assert.equal(event.stopped, true);
  assert.equal(button.disabled, true);
  assert.equal(button.textContent, 'Sending…');
  assert.equal(nativeForm['aria-busy'], 'true');
  await form.onSubmit(event);
  assert.equal(calls.length, 0);
  ready();
  await pending;
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].credentials, 'same-origin');
  for (const [name, value] of fixture.payload) assert.equal(calls[0].body.get(name), value);
  assert.equal(calls[0].body.get('return_to'), '/products/stone?preview_theme_id=1#QuoteForm-test');
  assert.equal(calls[0].signal instanceof AbortSignal, true);
  assert.equal(messages.get('success').hidden, false);
  assert.equal(button.disabled, true);
  assert.equal(nativeForm['aria-busy'], undefined);
  await form.onSubmit(event);
  assert.equal(calls.length, 1);
});

test('the quote modal closes once only after a confirmed successful response', async () => {
  let respond;
  let closes = 0;
  const { form, event } = submission({ response: () => new Promise((resolve) => { respond = resolve; }) });
  form.closest = (selector) => {
    assert.equal(selector, 'quote-modal');
    return { close() { closes++; } };
  };
  const pending = form.onSubmit(event);
  assert.equal(closes, 0);
  await form.onSubmit(event);
  assert.equal(closes, 0);
  respond({ ok: true, url: '', text: async () => 'success' });
  await pending;
  assert.equal(closes, 1);
  await form.onSubmit(event);
  assert.equal(closes, 1);
});

for (const [name, options, expected] of [
  ['server validation', { response: async () => ({ ok: true, url: '', text: async () => 'invalid' }) }, 'errors'],
  ['HTTP failure', { response: async () => ({ ok: false }) }, 'blocked'],
  ['network failure', { fail: true }, 'blocked'],
  ['challenge', { response: async () => ({ ok: true, url: 'https://example.test/challenge', text: async () => '' }) }, 'blocked'],
  ['unconfirmed HTTP 200', { response: async () => ({ ok: true, url: '', text: async () => 'no visible success' }) }, 'blocked'],
  ['unrelated form success', { response: async () => ({ ok: true, url: '', text: async () => 'wrong form' }) }, 'blocked'],
]) {
  test(`${name} retains details, displays an error and enables a deliberate retry`, async () => {
    const { form, event, calls, messages, button, payload } = submission(options);
    let closes = 0;
    form.closest = () => ({ close() { closes++; } });
    const before = [...payload];
    await form.onSubmit(event);
    assert.equal(event.prevented, 1);
    assert.equal(calls.length, 1);
    assert.equal(messages.get(expected).hidden, false);
    assert.equal(messages.get('success').hidden, true);
    assert.equal(closes, 0);
    assert.equal(button.disabled, false);
    assert.equal(button.textContent, 'Request my free quote');
    assert.deepEqual([...payload], before);
    if (name === 'challenge') assert.equal(messages.get('blocked').textContent, 'Security check needed.');
  });
}

test('invalid required fields and honeypot never navigate or send a request', async () => {
  for (const options of [{ invalid: true }, { honeypot: 'spam' }]) {
    const { form, event, calls } = submission(options);
    await form.onSubmit(event);
    assert.equal(event.prevented, 1);
    assert.equal(calls.length, 0);
  }
});

test('captcha wait timeout aborts before POST and restores the form', async () => {
  const { form, event, calls, button, messages } = submission({ protect() {} });
  const pending = form.onSubmit(event);
  form.request.abort();
  await pending;
  assert.equal(calls.length, 0);
  assert.equal(button.disabled, false);
  assert.equal(messages.get('blocked').hidden, false);
});

 test('a different collection product unlocks a new quote after a confirmed submission', async () => {
  const { form, event, messages, button } = submission();
  await form.onSubmit(event);
  assert.equal(form.submitted, true);
  const query = form.querySelector;
  const product = { value: 'First stone' };
  const url = { value: '/products/first' };
  form.querySelector = (selector) => selector === '[data-quote-field="product"]' ? product :
    selector === '[data-quote-field="product_url"]' ? url : selector.includes('data-quote-') &&
    (selector.includes('label') || selector.includes('selection')) ? null : query(selector);
  form.setProduct({ title: 'First stone', url: '/products/first' });
  assert.equal(form.submitted, true);
  form.setProduct({ title: 'Second stone', url: '/products/second' });
  assert.equal(form.submitted, false);
  assert.equal(button.disabled, false);
  assert.equal(messages.get('success').hidden, true);
});

test('collection product cannot change while captcha or a request is pending', async () => {
  let ready;
  const { form, event, payload } = submission({ protect: (nativeForm, callback) => { ready = callback; } });
  const pending = form.onSubmit(event);
  form.setProduct({ title: 'Wrong product', url: '/products/wrong' });
  assert.equal(payload.get('contact[product]'), 'Stone');
  ready();
  await pending;
});
