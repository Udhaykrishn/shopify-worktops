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

  const writeStored = (formId, values) => {
    try {
      window.sessionStorage.setItem(storageKey(formId), JSON.stringify(values));
    } catch {
      // Storage can be unavailable (private mode, blocked site data). Refilling is only a convenience.
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

        this.requiredInputs = Array.from(this.form.querySelectorAll('input[required]'));
        this.onSubmit = this.onSubmit.bind(this);
        this.onBlur = this.onBlur.bind(this);
        this.onWorktopChange = this.onWorktopChange.bind(this);

        this.form.addEventListener('submit', this.onSubmit);
        this.requiredInputs.forEach((input) => input.addEventListener('blur', this.onBlur));
        document.addEventListener('worktop:change', this.onWorktopChange);

        const stored = readStored(this.form.id);
        if (stored && this.querySelector('[data-quote-errors]')) this.restoreFields(stored);

        const productField = this.querySelector('[data-quote-field="product"]');
        if (productField && productField.value) {
          const urlField = this.querySelector('[data-quote-field="product_url"]');
          this.setProduct({ title: productField.value, url: urlField ? urlField.value : '' });
        }

        const message = this.querySelector('[data-quote-success], [data-quote-errors]');
        if (message) {
          message.scrollIntoView({ block: 'center' });
          message.focus({ preventScroll: true });
        }
      }

      disconnectedCallback() {
        document.removeEventListener('worktop:change', this.onWorktopChange);
      }

      onBlur(event) {
        if (!isBlank(event.target.value) || event.target.hasAttribute('aria-invalid')) this.showError(event.target);
      }

      onSubmit(event) {
        const blockedMessage = this.querySelector('[data-quote-blocked]');
        if (blockedMessage) blockedMessage.hidden = true;

        const honeypot = this.form.querySelector('[data-quote-honeypot]');
        if (honeypot && !isBlank(honeypot.value)) {
          event.preventDefault();
          if (blockedMessage) {
            blockedMessage.hidden = false;
            blockedMessage.focus();
          }
          return;
        }

        const invalid = this.requiredInputs.filter((input) => this.showError(input));
        if (invalid.length) {
          event.preventDefault();
          invalid[0].focus();
          return;
        }

        writeStored(this.form.id, this.collectFields());
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
          } else if (isBlank(field.value)) {
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

        const variantLabel = this.querySelector('[data-quote-variant-label]');
        if (variantLabel) {
          const showVariant = detail.variantTitle && detail.variantTitle !== 'Default Title';
          variantLabel.textContent = showVariant ? `, ${detail.variantTitle}` : '';
        }

        const sizeLabel = this.querySelector('[data-quote-size-label]');
        if (sizeLabel) {
          sizeLabel.textContent = hasSize
            ? (this.strings.size || '')
                .replace('[length]', detail.lengthMm)
                .replace('[width]', detail.widthMm)
                .replace('[area]', detail.areaM2)
            : this.strings.placeholder || '';
        }
      }
    }
  );
})();
