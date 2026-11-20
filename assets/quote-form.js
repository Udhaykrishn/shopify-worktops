/*
 * <quote-form>: client-side help for the quote request contact form.
 * Validates required fields, blocks submissions with a filled honeypot and keeps the hidden
 * product/size fields in step with <worktop-configurator> (worktop:change events).
 */
(() => {
  const isBlank = (value) => String(value ?? '').trim() === '';

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());

  // Lenient UK postcode shape check (outward code + inward code), for usability only.
  const isValidUkPostcode = (value) => /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(String(value).trim());

  const fieldError = (input) => {
    if (input.required && isBlank(input.value)) return 'required';
    if (input.type === 'email' && !isBlank(input.value) && !isValidEmail(input.value)) return 'email';
    if (input.hasAttribute('data-quote-postcode') && !isBlank(input.value) && !isValidUkPostcode(input.value)) {
      return 'postcode';
    }
    return null;
  };

  // Fields Shopify may not echo back through the `form` object after a server-side error. They are kept
  // for this tab only and only until the next page load.
  const RESTORE_FIELDS = [
    'contact[phone]',
    'contact[postcode]',
    'contact[timeframe]',
    'contact[product]',
    'contact[product_url]',
    'contact[variant]',
    'contact[length_mm]',
    'contact[width_mm]',
    'contact[area_m2]',
  ];
  const storageKey = (formId) => `quote-form:${formId}`;

  const readStored = (formId) => {
    try {
      const raw = window.sessionStorage.getItem(storageKey(formId));
      window.sessionStorage.removeItem(storageKey(formId));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  if (customElements.get('quote-form')) return;

  customElements.define(
    'quote-form',
    class QuoteForm extends HTMLElement {
      connectedCallback() {
        this.form = this.querySelector('form');
        if (!this.form) return;

        try {
          this.strings = JSON.parse(this.querySelector('[data-quote-strings]').textContent);
        } catch {
          this.strings = {};
        }

        this.button = this.form.querySelector('[type="submit"]');
        this.buttonLabel = this.button.textContent;
        this.submitted = Boolean(this.querySelector('[data-quote-success]:not([hidden])'));
        this.button.disabled = this.submitted;
        this.requiredInputs = Array.from(this.form.querySelectorAll('input[required]'));
        this.onSubmit = this.onSubmit.bind(this);
        this.onBlur = this.onBlur.bind(this);
        this.onWorktopChange = this.onWorktopChange.bind(this);

        this.form.addEventListener('submit', this.onSubmit, true);
        this.requiredInputs.forEach((input) => input.addEventListener('blur', this.onBlur));
        document.addEventListener('worktop:change', this.onWorktopChange);

        const stored = readStored(this.form.id);
        if (stored && this.querySelector('[data-quote-errors]:not([hidden])')) {
          this.restoreFields(stored);
          this.renderSelection();
        }

        const productField = this.querySelector('[data-quote-field="product"]');
        if (productField && productField.value) {
          const urlField = this.querySelector('[data-quote-field="product_url"]');
          this.setProduct({ title: productField.value, url: urlField ? urlField.value : '' });
        }

        const message = this.querySelector('[data-quote-success]:not([hidden]), [data-quote-errors]:not([hidden])');
        if (message) {
          message.scrollIntoView({ block: 'center' });
          message.focus({ preventScroll: true });
        }
      }

      disconnectedCallback() {
        this.request?.abort();
        this.form?.removeEventListener('submit', this.onSubmit, true);
        this.requiredInputs?.forEach((input) => input.removeEventListener('blur', this.onBlur));
        document.removeEventListener('worktop:change', this.onWorktopChange);
      }

      onBlur(event) {
        if (!isBlank(event.target.value) || event.target.hasAttribute('aria-invalid')) this.showError(event.target);
      }


      onSubmit(event) {
        // Prevent form submission and page reload
        event.preventDefault();
        event.stopImmediatePropagation();

        // Prevent duplicate submissions
        if (this.pending || this.submitted) return;

        // Hide previous messages
        this.querySelectorAll(
          '[data-quote-success], [data-quote-errors], [data-quote-blocked]'
        ).forEach((node) => {
          node.hidden = true;
        });

        // Check honeypot
        const honeypot = this.form.querySelector(
          '[data-quote-honeypot]'
        );

        if (honeypot && !isBlank(honeypot.value)) {
          this.showResult('[data-quote-blocked]');
          return;
        }

        // Validate required fields
        const invalid = this.requiredInputs.filter(
          (input) => this.showError(input)
        );

        if (invalid.length) {
          invalid[0].focus();
          return;
        }

        // Mark as successfully completed (frontend only)
        this.pending = true;
        this.submitted = true;

        // Disable button
        this.button.disabled = true;

        // Display success message
        this.showResult('[data-quote-success]');

        // Finish UI state
        this.pending = false;

        // Close modal after displaying success
        const modal = this.closest('quote-modal');

        if (modal) {
          setTimeout(() => {
            if (modal.isConnected) modal.close();
          }, 1200);
        }
      }

      showResult(selector, text) {
        const message = this.querySelector(selector);
        if (!message) return;
        if (text) (message.querySelector('[data-quote-message]') || message).textContent = text;
        message.hidden = false;
        message.focus({ preventScroll: true });
      }

      collectFields() {
        const values = {};
        RESTORE_FIELDS.forEach((name) => {
          const field = this.form.elements.namedItem(name);
          if (field && 'value' in field) values[name] = field.value;
        });
        return values;
      }

      restoreFields(values) {
        RESTORE_FIELDS.forEach((name) => {
          const field = this.form.elements.namedItem(name);
          if (!field || !('value' in field) || typeof values[name] !== 'string') return;
          if (field.tagName === 'SELECT') {
            const option = Array.from(field.options).find((item) => item.value === values[name]);
            if (option) field.value = values[name];
          } else if (field.type === 'hidden' || isBlank(field.value)) {
            field.value = values[name];
          }
        });
      }

      showError(input) {
        const code = fieldError(input);
        const errorElement = document.getElementById(`${input.id}-error`);
        if (errorElement) errorElement.textContent = code ? this.strings[code] || '' : '';
        if (code) {
          input.setAttribute('aria-invalid', 'true');
        } else {
          input.removeAttribute('aria-invalid');
        }
        return Boolean(code);
      }

      setField(name, value) {
        const input = this.querySelector(`[data-quote-field="${name}"]`);
        if (input) input.value = value ?? '';
      }

      /**
       * Fills the product fields in dynamic-product mode (quote modal on collection pages).
       * Values come from data attributes on the trigger and are only ever set as text.
       */
      setProduct({ title, url }) {
        if (this.pending) return;
        const product = this.querySelector('[data-quote-field="product"]');
        const productUrl = this.querySelector('[data-quote-field="product_url"]');
        if (this.submitted && !this.pending && (product?.value !== title || productUrl?.value !== url)) {
          this.submitted = false;
          this.button.disabled = false;
          this.querySelector('[data-quote-success]').hidden = true;
        }
        this.setField('product', title);
        this.setField('product_url', url);

        const label = this.querySelector('[data-quote-product-label]');
        if (label) label.textContent = title ?? '';

        const selection = this.querySelector('[data-quote-selection]');
        if (selection) selection.hidden = !title;
      }

      onWorktopChange({ detail }) {
        if (!detail || (this.dataset.productId && String(detail.productId) !== this.dataset.productId)) return;

        const hasSize = detail.lengthMm !== null && detail.widthMm !== null;
        this.setField('variant', detail.variantTitle);
        this.setField('length', hasSize ? String(detail.lengthMm) : '');
        this.setField('width', hasSize ? String(detail.widthMm) : '');
        this.setField('area', hasSize ? detail.areaM2 : '');

        this.renderSelection();
      }

      renderSelection() {
        const value = (name) => this.querySelector(`[data-quote-field="${name}"]`)?.value || '';
        const variant = value('variant');
        const length = value('length');
        const width = value('width');
        const area = value('area');

        const variantLabel = this.querySelector('[data-quote-variant-label]');
        if (variantLabel) {
          const showVariant = variant && variant !== 'Default Title';
          variantLabel.textContent = showVariant ? `, ${variant}` : '';
        }

        const sizeLabel = this.querySelector('[data-quote-size-label]');
        if (sizeLabel) {
          sizeLabel.textContent = length && width && area
            ? (this.strings.size || '')
              .replace('[length]', length)
              .replace('[width]', width)
              .replace('[area]', area)
            : this.strings.placeholder || '';
        }
      }
    }
  );
})();
