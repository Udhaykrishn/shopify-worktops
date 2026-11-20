/*
 * <card-colours>: the colour tray on a worktop product card.
 * On devices that can hover, CSS shows the tray on hover and keyboard focus and this element does nothing.
 * On touch screens the "N colours" button opens and closes the tray; a tap outside or Esc closes it.
 */
(() => {
  if (customElements.get('card-colours')) return;

  customElements.define(
    'card-colours',
    class CardColours extends HTMLElement {
      connectedCallback() {
        this.button = this.querySelector('.colour-swatches__toggle');
        if (!this.button) return;

        this.onToggle = this.onToggle.bind(this);
        this.onDocumentClick = this.onDocumentClick.bind(this);
        this.onKeydown = this.onKeydown.bind(this);
        this.button.addEventListener('click', this.onToggle);
        this.addEventListener('keydown', this.onKeydown);
      }

      disconnectedCallback() {
        this.button?.removeEventListener('click', this.onToggle);
        this.removeEventListener('keydown', this.onKeydown);
        document.removeEventListener('click', this.onDocumentClick);
      }

      onToggle(event) {
        // The card's link overlay sits underneath: keep the tap from opening the product.
        event.preventDefault();
        event.stopPropagation();
        this.setOpen(this.button.getAttribute('aria-expanded') !== 'true');
      }

      setOpen(open) {
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
    }
  );
})();
