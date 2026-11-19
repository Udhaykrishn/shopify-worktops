/*
 * <worktop-cart-guard>: Dawn re-renders only the cart page's line items and subtotal after a quantity
 * change or removal, so the checkout button and express checkout buttons keep their old state.
 * The guard is rendered inside the re-rendered line items with the server's verdict and copies it onto
 * those buttons each time it is (re)connected. The server-rendered state is correct on a full page load.
 */
if (!customElements.get('worktop-cart-guard')) {
  customElements.define(
    'worktop-cart-guard',
    class WorktopCartGuard extends HTMLElement {
      connectedCallback() {
        const blocked = this.dataset.blocked === 'true';
        const checkout = document.getElementById('checkout');
        const note = document.getElementById('WorktopCheckoutBlocked-page');

        if (checkout) {
          checkout.disabled = blocked;
          if (blocked) {
            checkout.setAttribute('aria-describedby', 'WorktopCheckoutBlocked-page');
          } else {
            checkout.removeAttribute('aria-describedby');
          }
        }
        if (note) note.hidden = !blocked;
        document.querySelectorAll('.cart__dynamic-checkout-buttons').forEach((element) => {
          element.hidden = blocked;
        });
      }
    }
  );
}
