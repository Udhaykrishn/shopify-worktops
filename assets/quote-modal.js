/*
 * <quote-modal>: opens the quote request form in a native <dialog>.
 * showModal() gives focus trapping, Esc to close and an inert page behind it. Any element with
 * `data-quote-open` opens the modal; card buttons also pass the product through data attributes.
 * Triggers are links to `<product url>#quote`, so without JavaScript (or without a modal on the page)
 * they still reach a page that can show the form.
 */
(() => {
  if (customElements.get('quote-modal')) return;

  const OPEN_CLASS = 'quote-modal-open';

  customElements.define(
    'quote-modal',
    class QuoteModal extends HTMLElement {
      connectedCallback() {
        this.dialog = this.querySelector('dialog');
        if (!this.dialog) return;

        this.opener = null;
        this.onClick = this.onClick.bind(this);
        this.onClose = this.onClose.bind(this);
        this.addEventListener('click', this.onClick);
        this.dialog.addEventListener('close', this.onClose);

        // After a form post the page reloads: reopen so the success or error message is seen.
        const hasResult = this.querySelector('[data-quote-success]:not([hidden]), [data-quote-errors]:not([hidden])');
        if (hasResult || window.location.hash === '#quote') this.open();
      }

      disconnectedCallback() {
        this.removeEventListener('click', this.onClick);
        this.dialog?.removeEventListener('close', this.onClose);
      }

      open(opener = null, product = null) {
        if (product) {
          const form = this.querySelector('quote-form');
          if (form && typeof form.setProduct === 'function') form.setProduct(product);
        }

        this.opener = opener;
        if (!this.dialog.open) this.dialog.showModal();
        document.body.classList.add(OPEN_CLASS);

        // Start on the result message after a post, otherwise on the first field to fill in.
        // (Left alone, the browser would focus the scrollable panel.)
        const target =
          this.querySelector('[data-quote-success]:not([hidden]), [data-quote-errors]:not([hidden])') ||
          this.querySelector('.quote-form__form input:not([type="hidden"]):not([tabindex="-1"])');
        if (target) target.focus();
      }

      close() {
        if (this.dialog.open) this.dialog.close();
      }

      onClick(event) {
        // A click on the dialog element itself is a click on the backdrop (the panel fills the dialog).
        if (event.target === this.dialog || event.target.closest('[data-quote-modal-close]')) this.close();
      }

      onClose() {
        document.body.classList.remove(OPEN_CLASS);
        if (window.location.hash === '#quote') {
          history.replaceState(history.state, '', window.location.pathname + window.location.search);
        }
        if (this.opener && this.opener.isConnected) this.opener.focus();
        this.opener = null;
      }
    }
  );

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-quote-open]');
    if (!trigger) return;

    const modal = document.querySelector('quote-modal');
    if (!modal || typeof modal.open !== 'function') return; // Let the link navigate.

    const { productTitle, productUrl } = trigger.dataset;
    // On a product page the form belongs to that product, so a card for another product
    // (for example in related products) navigates to its own page instead.
    if (productTitle && modal.querySelector('quote-form[data-product-id]')) return;

    event.preventDefault();
    modal.open(trigger, productTitle ? { title: productTitle, url: productUrl || '' } : null);
  });
})();
