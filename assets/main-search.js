class MainSearch extends SearchForm {
  constructor() {
    super();
    this.allSearchInputs = document.querySelectorAll('input[type="search"]');
    this.setupEventListeners();
  }

  setupEventListeners() {
    let allSearchForms = [];
    this.allSearchInputs.forEach((input) => allSearchForms.push(input.form));
    this.input.addEventListener('focus', this.onInputFocus.bind(this));
    if (allSearchForms.length < 2) return;
    allSearchForms.forEach((form) => form.addEventListener('reset', this.onFormReset.bind(this)));
    this.allSearchInputs.forEach((input) => input.addEventListener('input', this.onInput.bind(this)));
  }

  onFormReset(event) {
    super.onFormReset(event);
    if (super.shouldResetForm()) {
      this.keepInSync('', this.input);
    }
  }

  onInput(event) {
    const target = event.target;
    this.keepInSync(target.value, target);
  }

  onInputFocus() {
    const isSmallScreen = window.innerWidth < 750;
    if (isSmallScreen) {
      this.scrollIntoView({ behavior: 'smooth' });
    }
  }

  keepInSync(value, target) {
    this.allSearchInputs.forEach((input) => {
      if (input !== target) {
        input.value = value;
      }
    });
  }
}

customElements.define('main-search', MainSearch);

/*
 * Search results without full page loads. On the search page, submitting a search form (the one on the page or
 * the one in the header) fetches the results section with the Section Rendering API and swaps only the region
 * below the search box: status, filters, sort, product grid and pagination. The query goes into the URL with
 * pushState, and Back/Forward re-render the results for that URL, so every state can be shared and reloaded.
 *
 * Filters and sort are applied by facets.js, which renders the same region; this only owns query changes.
 */
class SearchResults {
  static get region() {
    return document.querySelector('[data-search-results]');
  }

  /** The form's params, minus empty values. A query typed on the page keeps the active filters and sort order. */
  static paramsFromForm(form) {
    const params = new URLSearchParams();
    new FormData(form).forEach((value, key) => {
      if (value !== '') params.append(key, value);
    });
    if (form.hasAttribute('data-keep-refinements')) {
      new URLSearchParams(window.location.search).forEach((value, key) => {
        if (key.startsWith('filter.') || key === 'sort_by') params.append(key, value);
      });
    }
    return params.toString();
  }

  static onSubmit(event) {
    const form = event.target;
    if (event.defaultPrevented || !(form instanceof HTMLFormElement) || !SearchResults.region) return;
    if (new URL(form.action, window.location.href).pathname !== window.location.pathname) return;

    event.preventDefault();
    form.closest('predictive-search')?.close?.();
    form.closest('details-modal')?.close?.();
    SearchResults.render(SearchResults.paramsFromForm(form));
  }

  static render(searchParams, updateURL = true) {
    const region = SearchResults.region;
    const pageUrl = `${window.location.pathname}${searchParams ? `?${searchParams}` : ''}`;
    const sectionUrl = `${window.location.pathname}?${searchParams ? `${searchParams}&` : ''}section_id=${
      region.dataset.sectionId
    }`;

    FacetFiltersForm.pendingSearchQuery = new URLSearchParams(searchParams).get('q') || '';
    const controller = FacetFiltersForm.beginRequest();
    region.setAttribute('aria-busy', 'true');
    region.classList.add('template-search__region--loading');

    return fetch(sectionUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Search request failed: ${response.status}`);
        return response.text();
      })
      .then((responseText) => {
        if (controller.signal.aborted) return;
        const html = new DOMParser().parseFromString(responseText, 'text/html');
        const newRegion = html.querySelector('[data-search-results]');
        if (!newRegion) throw new Error('Search section is missing its results region');

        SearchResults.swap(html, newRegion, searchParams);
        if (updateURL) history.pushState({ searchParams }, '', pageUrl);
      })
      .catch((error) => {
        if (controller.signal.aborted || error.name === 'AbortError') return;
        console.error(error);
        // The plain page still works: fall back to a normal navigation rather than leaving stale results.
        window.location.assign(pageUrl);
      });
  }

  static swap(html, newRegion, searchParams) {
    const region = SearchResults.region;
    const replace = (selector) => {
      const current = document.querySelector(selector);
      const next = html.querySelector(selector);
      if (current && next) current.innerHTML = next.innerHTML;
    };

    region.innerHTML = newRegion.innerHTML;
    region.dataset.pageTitle = newRegion.dataset.pageTitle;
    region.querySelectorAll('.scroll-trigger').forEach((element) => element.classList.add('scroll-trigger--cancel'));
    region.removeAttribute('aria-busy');
    region.classList.remove('template-search__region--loading');

    replace('[data-search-status]');
    replace('.template-search__header h1');
    const wrapper = document.querySelector('.template-search');
    const newWrapper = html.querySelector('.template-search');
    if (wrapper && newWrapper) wrapper.className = newWrapper.className;
    FacetFiltersForm.renderSEO(html);

    // Every search box on the page shows the query that is now displayed.
    const query = new URLSearchParams(searchParams).get('q') || '';
    document.querySelectorAll('input[type="search"][name="q"]').forEach((input) => {
      if (input.value !== query) input.value = query;
    });
    document.querySelectorAll('main-search, search-form, predictive-search').forEach((element) => {
      if (element.resetButton) element.toggleResetButton();
    });

    // The status paragraph announces itself (role="status"); with filters on, the count lives in the sidebar.
    const announcer = document.querySelector('[data-search-announcer]');
    const count = region.querySelector('#ProductCount');
    if (announcer && count) announcer.textContent = count.textContent.trim().replace(/\s+/g, ' ');

    if (typeof FacetFiltersForm !== 'undefined') FacetFiltersForm.searchParamsPrev = searchParams;
    FacetFiltersForm.pendingSearchQuery = undefined;
  }
}

document.addEventListener('submit', SearchResults.onSubmit);
window.addEventListener('popstate', () => {
  if (SearchResults.region) SearchResults.render(window.location.search.slice(1), false);
});
