/*
 * <colour-picker>: the colour swatches on a worktop product page.
 *
 * Each colour of a stone is its own product, so a swatch is a link to another product page. Picking one swaps the
 * page content in place instead of loading a new page: the product page is fetched, the content of <main> is
 * replaced, and the head (title, description, canonical, Open Graph) is updated. The URL changes with pushState,
 * so the address can be shared and Back/Forward step through the colours viewed.
 *
 * State the shopper already entered carries over: the cut-to-size dimensions and the selected options
 * (thickness, edge profile) when the new colour offers the same values. Modified clicks still open the link.
 */
(() => {
  if (customElements.get('colour-picker')) return;

  const HEAD_SELECTORS = [
    'meta[name="description"]',
    'link[rel="canonical"]',
    'meta[property="og:title"]',
    'meta[property="og:url"]',
    'meta[property="og:description"]',
    'meta[property="og:image"]',
    'meta[property="og:image:secure_url"]',
    'meta[name="twitter:title"]',
    'meta[name="twitter:description"]',
  ];

  let controller = null;
  let renderedPath = window.location.pathname;

  /** What the shopper entered on the current product, to restore on the next one. */
  const captureState = (main) => ({
    dimensions: Array.from(main.querySelectorAll('[data-worktop-input]')).map((input) => [
      input.dataset.worktopInput,
      input.value,
    ]),
    options: Array.from(main.querySelectorAll('variant-selects input[type="radio"]:checked, variant-selects select')).map(
      (input) => [input.name, input.value]
    ),
  });

  /** Returns true when an option changed, which makes Dawn fetch the matching variant. */
  const restoreState = (main, { dimensions, options }) => {
    let optionChanged = false;
    options.forEach(([name, value]) => {
      const radio = Array.from(main.querySelectorAll('variant-selects input[type="radio"]')).find(
        (input) => input.name === name && input.value === value
      );
      const select = Array.from(main.querySelectorAll('variant-selects select')).find((input) => input.name === name);
      const changed = radio && !radio.checked ? radio : select && select.value !== value ? select : null;
      if (!changed || (select && !Array.from(select.options).some((option) => option.value === value))) return;

      if (changed === radio) radio.checked = true;
      else select.value = value;
      changed.dispatchEvent(new Event('change', { bubbles: true }));
      optionChanged = true;
    });

    dimensions.forEach(([key, value]) => {
      const input = main.querySelector(`[data-worktop-input="${CSS.escape(key)}"]`);
      if (!input || !value || input.value === value) return;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    return optionChanged;
  };

  const focusCurrentSwatch = () => document.querySelector('colour-picker [aria-current="true"]')?.focus();

  const updateHead = (html) => {
    const title = html.querySelector('head title');
    if (title) document.title = title.textContent.trim();

    HEAD_SELECTORS.forEach((selector) => {
      const current = document.head.querySelector(selector);
      const next = html.head.querySelector(selector);
      if (current && next) current.replaceWith(document.importNode(next, true));
    });
  };

  /** Scripts inserted with the new content don't run; load the ones this page hasn't loaded yet. */
  const loadNewScripts = (main) => {
    const loaded = new Set(Array.from(document.scripts, (script) => script.src).filter(Boolean));
    main.querySelectorAll('script[src]').forEach((script) => {
      if (loaded.has(script.src)) return;
      const replacement = document.createElement('script');
      Array.from(script.attributes).forEach(({ name, value }) => replacement.setAttribute(name, value));
      script.replaceWith(replacement);
    });
  };

  const showProduct = (productUrl, { push = true, focusCurrent = false } = {}) => {
    const main = document.getElementById('MainContent');
    const picker = main?.querySelector('colour-picker');
    if (!main) {
      window.location.assign(productUrl);
      return;
    }

    controller?.abort();
    controller = new AbortController();
    const state = captureState(main);
    picker?.setAttribute('aria-busy', 'true');
    picker?.classList.add('colour-swatches--loading');

    fetch(productUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Product request failed: ${response.status}`);
        return response.text();
      })
      .then((responseText) => {
        const html = new DOMParser().parseFromString(responseText, 'text/html');
        const newMain = html.getElementById('MainContent');
        if (!newMain) throw new Error('Product page has no main content');

        const scrollY = window.scrollY;
        newMain.querySelectorAll('.scroll-trigger').forEach((element) => element.classList.add('scroll-trigger--cancel'));
        main.replaceChildren(...Array.from(newMain.childNodes, (node) => document.importNode(node, true)));
        main.dataset.template = newMain.dataset.template || main.dataset.template;
        loadNewScripts(main);
        updateHead(html);
        window.scrollTo({ top: scrollY, behavior: 'instant' });

        const url = new URL(productUrl, window.location.href);
        renderedPath = url.pathname;
        if (push) history.pushState({ colourPicker: true }, '', url.pathname + url.search);

        window.Shopify?.PaymentButton?.init();
        const optionChanged = restoreState(main, state);
        if (!focusCurrent) return;
        if (optionChanged && typeof subscribe === 'function') {
          // Dawn focuses the changed option once the variant has loaded; keep focus on the colour instead.
          const unsubscribe = subscribe(PUB_SUB_EVENTS.variantChange, () => {
            unsubscribe();
            requestAnimationFrame(focusCurrentSwatch);
          });
        }
        focusCurrentSwatch();
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        console.error(error);
        window.location.assign(productUrl);
      });
  };

  window.addEventListener('popstate', () => {
    if (window.location.pathname === renderedPath || !document.querySelector('colour-picker')) return;
    showProduct(window.location.href, { push: false });
  });

  customElements.define(
    'colour-picker',
    class ColourPicker extends HTMLElement {
      connectedCallback() {
        this.onClick = this.onClick.bind(this);
        this.addEventListener('click', this.onClick);
      }

      disconnectedCallback() {
        this.removeEventListener('click', this.onClick);
      }

      onClick(event) {
        const swatch = event.target.closest('.colour-swatches__swatch');
        if (!swatch || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        event.preventDefault();
        if (swatch.getAttribute('aria-current') === 'true') return;
        showProduct(swatch.href, { focusCurrent: this.contains(document.activeElement) });
      }
    }
  );
})();
