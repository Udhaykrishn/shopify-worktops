import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function loadFacets(extra = {}) {
  const context = vm.createContext({
    HTMLElement: class {},
    AbortController,
    URLSearchParams,
    console,
    window: { location: { search: '', pathname: '/collections/quartz', href: 'https://example.test/collections/quartz' }, addEventListener() {} },
    document: { addEventListener() {} },
    customElements: { define() {} },
    ...extra,
  });
  vm.runInContext(`${readFileSync(new URL('../assets/facets.js', import.meta.url), 'utf8')}\nglobalThis.Facets = FacetFiltersForm;`, context);
  return context.Facets;
}

test('cached filtering aborts an older fetch before it can change results or metadata', async () => {
  let resolve;
  const Facets = loadFacets({ fetch: () => new Promise((done) => { resolve = done; }) });
  const rendered = [];
  Facets.renderSection = (html) => rendered.push(html);
  const oldRequest = Facets.renderSectionFromFetch('/older', null, null, Facets.beginRequest());
  Facets.filterData = [{ url: '/cached', html: 'cached metadata' }];
  Facets.beginRequest();
  Facets.renderSectionFromCache((entry) => entry.url === '/cached');
  resolve({ ok: true, text: async () => 'stale metadata' });
  await oldRequest;
  assert.deepEqual(rendered, ['cached metadata']);
  assert.equal(Facets.filterData.length, 1);
});

test('keyboard or queued refinements retain a newly submitted search instead of restoring the previous query', () => {
  const Facets = loadFacets();
  Facets.pendingSearchQuery = 'new stone';
  const params = new URLSearchParams(Facets.keepPendingQuery('q=old+stone&filter.p.available=1&page=2'));
  assert.equal(params.get('q'), 'new stone');
  assert.equal(params.get('filter.p.available'), '1');
  assert.equal(params.has('page'), false);
  Facets.pendingSearchQuery = undefined;
  assert.equal(Facets.keepPendingQuery('q=old+stone&page=2'), 'q=old+stone&page=2');
});

test('latest fetch wins even when an aborted transport still resolves', async () => {
  const pending = [];
  const Facets = loadFacets({ fetch: () => new Promise((resolve) => pending.push(resolve)) });
  const rendered = [];
  Facets.renderSection = (html) => rendered.push(html);
  const first = Facets.renderSectionFromFetch('/first', null, null, Facets.beginRequest());
  const second = Facets.renderSectionFromFetch('/second', null, null, Facets.beginRequest());
  pending[1]({ ok: true, text: async () => 'second' });
  await second;
  pending[0]({ ok: true, text: async () => 'first' });
  await first;
  assert.deepEqual(rendered, ['second']);
});

test('metadata sync adds noindex for filtering and removes it when returning to an indexable page', () => {
  const nodes = new Map();
  function node(tag, attributes = {}, textContent = '') {
    return {
      tagName: tag.toUpperCase(), textContent,
      getAttribute: (key) => attributes[key] ?? null,
      setAttribute(key, value) { attributes[key] = value; },
      remove() { for (const [key, value] of nodes) if (value === this) nodes.delete(key); },
    };
  }
  const selector = (item) => item.tagName === 'LINK' ? 'link[rel="canonical"]' : `meta[name="${item.getAttribute('name')}"]`;
  const document = {
    addEventListener() {}, title: '',
    head: { querySelector: (key) => nodes.get(key), append: (item) => nodes.set(selector(item), item) },
    createElement: (tag) => node(tag),
  };
  const Facets = loadFacets({ document });
  const page = (title, canonical, description, robots) => {
    const source = new Map([
      ['title', node('title', {}, title)],
      ['link[rel="canonical"]', node('link', { rel: 'canonical', href: canonical })],
    ]);
    if (description) source.set('meta[name="description"]', node('meta', { name: 'description', content: description }));
    if (robots) source.set('meta[name="robots"]', node('meta', { name: 'robots', content: robots }));
    return { querySelector: () => ({ content: { querySelector: (key) => source.get(key) } }) };
  };
  Facets.renderSEO(page('Quartz', 'https://example.test/collections/quartz', 'Description', 'noindex, follow'));
  assert.equal(nodes.get('meta[name="robots"]').getAttribute('content'), 'noindex, follow');
  Facets.renderSEO(page('Quartz – Page 2', 'https://example.test/collections/quartz?page=2'));
  assert.equal(document.title, 'Quartz – Page 2');
  assert.equal(nodes.get('link[rel="canonical"]').getAttribute('href'), 'https://example.test/collections/quartz?page=2');
  assert.equal(nodes.has('meta[name="robots"]'), false);
  assert.equal(nodes.has('meta[name="description"]'), false);
});
