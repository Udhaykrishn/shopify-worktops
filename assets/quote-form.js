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
        const honeypot = this.form.querySelector('[data-quote-honeypot]');
        if (honeypot && !isBlank(honeypot.value)) {
          event.preventDefault();
          return;
        }

        const invalid = this.requiredInputs.filter((input) => this.showError(input));
        if (invalid.length) {
          event.preventDefault();
          invalid[0].focus();
        }
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
