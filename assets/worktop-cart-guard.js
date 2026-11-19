/*
 * <worktop-cart-guard>: copies the server's worktop verdict onto checkout controls that Dawn does not
 * re-render. It is rendered inside the markup Dawn does re-render, so it reconnects with a fresh verdict.
 *
 * data-context="page": the cart page re-renders only line items and subtotal after a change, so the
 * checkout button and express checkout buttons keep their old state.
 * data-context="notification": the popup notification's checkout form is rendered once at page load,
 * before the add. When blocked it is hidden so only "View cart" (with the line errors) remains.
 *
 * The server-rendered state is correct on a full page load. This only keeps AJAX updates in step.
 */
if (!customElements.get('worktop-cart-guard')) {
  customElements.define(
    'worktop-cart-guard',
    class WorktopCartGuard extends HTMLElement {
      connectedCallback() {
        const blocked = this.dataset.blocked === 'true';
        if (this.dataset.context === 'notification') {
          this.syncNotification(blocked);
        } else {
          this.syncPage(blocked);
        }
      }

      syncPage(blocked) {
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

      syncNotification(blocked) {
        const form = document.getElementById('cart-notification-form');
        if (!form) return;
        form.hidden = blocked;
        form.querySelectorAll('[name="checkout"]').forEach((button) => {
          button.disabled = blocked;
        });
      }
    }
  );
}
