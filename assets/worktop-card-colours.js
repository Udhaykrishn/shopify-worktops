/*
 * <card-colours>: the colour tray on a worktop product card.
 * On devices that can hover, CSS shows the tray on hover and keyboard focus.
 * On touch screens the "N colours" button opens and closes the tray; a tap outside or Esc closes it.
 *
 * Picking a colour swaps the card to that product without a page load: the card for the picked product is fetched
 * with the Section Rendering API (sections/worktop-card.liquid) and its content replaces this card's content.
 * The card's own layout (image ratio, quote button) is kept. Modified clicks (new tab) still follow the link.
 */
(() => {
  if (customElements.get('card-colours')) return;

  let swapCount = 0;
  const pendingSwaps = new WeakMap();

  /** The fetched card's IDs use the placeholder `SWAPUID`; give each swap its own prefix so IDs stay unique. */
  const uniqueCardHtml = (html) => {
    swapCount += 1;
    return html.replaceAll('SWAPUID', `card-swap-${swapCount}`);
  };

  /** Moves the fetched card's content into the current card, keeping the current card's layout. */
  const swapCardContent = (card, freshCard) => {
    const hasQuote = Boolean(card.querySelector('.card__quote'));
    const hasSecondaryImage = card.querySelectorAll('.card__media img').length > 1;

    if (!hasQuote) freshCard.querySelector('.card__quote')?.remove();
    if (!hasSecondaryImage) freshCard.querySelectorAll('.card__media img:nth-of-type(n+2)').forEach((img) => img.remove());

    [
      ['.card__inner', '.card__inner'],
      ['.card > .card__content', '.card > .card__content'],
    ].forEach(([currentSelector, freshSelector]) => {
      const current = card.querySelector(currentSelector);
      const fresh = freshCard.querySelector(freshSelector);
      if (current && fresh) current.replaceChildren(...fresh.childNodes);
    });
  };

  customElements.define(
    'card-colours',
    class CardColours extends HTMLElement {
      connectedCallback() {
        this.button = this.querySelector('.colour-swatches__toggle');

        this.onToggle = this.onToggle.bind(this);
        this.onDocumentClick = this.onDocumentClick.bind(this);
        this.onKeydown = this.onKeydown.bind(this);
        this.onSwatchClick = this.onSwatchClick.bind(this);
        this.button?.addEventListener('click', this.onToggle);
        this.addEventListener('keydown', this.onKeydown);
        this.addEventListener('click', this.onSwatchClick);
      }

      disconnectedCallback() {
        this.button?.removeEventListener('click', this.onToggle);
        this.removeEventListener('keydown', this.onKeydown);
        this.removeEventListener('click', this.onSwatchClick);
        document.removeEventListener('click', this.onDocumentClick);
      }

      onToggle(event) {
        // The card's link overlay sits underneath: keep the tap from opening the product.
        event.preventDefault();
        event.stopPropagation();
        this.setOpen(this.button.getAttribute('aria-expanded') !== 'true');
      }

      setOpen(open) {
        if (!this.button) return;
        this.button.setAttribute('aria-expanded', String(open));
        this.toggleAttribute('open', open);
        if (open) {
          document.addEventListener('click', this.onDocumentClick);
        } else {
          document.removeEventListener('click', this.onDocumentClick);
        }
      }

      onDocumentClick(event) {
        if (!this.contains(event.target)) this.setOpen(false);
      }

      onKeydown(event) {
        if (event.key !== 'Escape' || !this.hasAttribute('open')) return;
        this.setOpen(false);
        this.button.focus();
      }

      onSwatchClick(event) {
        const swatch = event.target.closest('.colour-swatches__swatch');
        if (!swatch || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        event.preventDefault();
        event.stopPropagation();
        if (swatch.getAttribute('aria-current') === 'true') return;
        this.swapTo(swatch.href);
      }

      swapTo(productUrl) {
        const card = this.closest('.card-wrapper');
        if (!card) {
          window.location.assign(productUrl);
          return;
        }

        const wasOpen = this.hasAttribute('open');
        const hadFocus = this.contains(document.activeElement);
        const requestUrl = new URL(productUrl, window.location.href);
        requestUrl.search = '';
        requestUrl.searchParams.set('section_id', 'worktop-card');

        pendingSwaps.get(card)?.abort();
        const controller = new AbortController();
        pendingSwaps.set(card, controller);
        card.setAttribute('aria-busy', 'true');
        card.classList.add('card-wrapper--swapping');

        fetch(requestUrl, { signal: controller.signal })
          .then((response) => {
            if (!response.ok) throw new Error(`Card request failed: ${response.status}`);
            return response.text();
          })
          .then((responseText) => {
            const html = new DOMParser().parseFromString(uniqueCardHtml(responseText), 'text/html');
            const freshCard = html.querySelector('.card-wrapper');
            if (!freshCard) throw new Error('Card section returned no card');

            swapCardContent(card, freshCard);
            card.querySelectorAll('.scroll-trigger').forEach((element) => element.classList.add('scroll-trigger--cancel'));

            // The tray was replaced too: reopen it and return focus to the colour that is now shown.
            const tray = card.querySelector('card-colours');
            if (wasOpen) tray?.setOpen(true);
            if (hadFocus) tray?.querySelector('.colour-swatches__swatch[aria-current="true"]')?.focus();
          })
          .catch((error) => {
            if (error.name === 'AbortError') return;
            console.error(error);
            window.location.assign(productUrl);
          })
          .finally(() => {
            if (pendingSwaps.get(card) !== controller) return;
            pendingSwaps.delete(card);
            card.removeAttribute('aria-busy');
            card.classList.remove('card-wrapper--swapping');
          });
      }
    }
  );
})();
