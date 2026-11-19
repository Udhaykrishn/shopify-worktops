/*
 * <worktop-configurator>: cut-to-size worktop inputs, live price and add-to-cart gate.
 * The browser only helps the customer. The cart re-checks every worktop line in Liquid
 * (snippets/worktop-line-status.liquid) and blocks checkout when anything does not match.
 */

(() => {
  const parseDimension = (raw) => {
    const value = String(raw ?? '').trim();
    return /^\d+$/.test(value) ? Number(value) : Number.NaN;
  };

  const validateDimension = (raw, min, max) => {
    const trimmed = String(raw ?? '').trim();
    if (trimmed === '') return 'required';
    const value = parseDimension(trimmed);
    if (!Number.isSafeInteger(value)) return 'integer';
    if (value < min) return 'min';
    if (value > max) return 'max';
    return null;
  };

  const calcAreaMm2 = (lengthMm, widthMm) => lengthMm * widthMm;

  // Same integer maths as the Liquid check: ceil(area / unit) without floating point.
  const calcQuantity = (areaMm2, unitMm2) => Math.floor((areaMm2 + unitMm2 - 1) / unitMm2);

  const areaDecimals = (unitMm2) => Math.max(2, Math.ceil(-Math.log10(unitMm2 / 1e6)));

  const calcBilledAreaM2 = (quantity, unitMm2) => (quantity * unitMm2) / 1e6;

  const pricePerM2 = (unitPriceCents, unitMm2) => Math.floor((unitPriceCents * 1e6) / unitMm2);

  const calcTotal = (quantity, unitPriceCents) => quantity * unitPriceCents;

  const formatMoney = (cents, currency, locale) => {
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
    } catch {
      return (cents / 100).toFixed(2);
    }
  };

  const formatNumber = (value, decimals, locale) => {
    try {
      return new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);
    } catch {
      return value.toFixed(decimals);
    }
  };

  if (!customElements.get('worktop-configurator')) {
    customElements.define(
      'worktop-configurator',
      class WorktopConfigurator extends HTMLElement {
        connectedCallback() {
          this.productInfo = this.closest('product-info') || document;
          this.onSubmit = this.onSubmit.bind(this);
          this.productInfo.addEventListener('submit', this.onSubmit, true);

          if (this.hasAttribute('data-disabled')) {
            this.config = null;
            this.setSubmitHint(true);
            return;
          }

          try {
            this.config = JSON.parse(this.querySelector('[data-worktop-config]').textContent);
          } catch {
            this.config = null;
            return;
          }

          this.inputs = {
            length: this.querySelector('[data-worktop-input="length"]'),
            width: this.querySelector('[data-worktop-input="width"]'),
          };
          this.fields = {};
          this.querySelectorAll('[data-worktop-field]').forEach((input) => {
            this.fields[input.dataset.worktopField] = input;
          });
          this.output = {
            perM2: this.querySelector('[data-worktop-per-m2]'),
            area: this.querySelector('[data-worktop-area]'),
            total: this.querySelector('[data-worktop-total]'),
            status: this.querySelector('[data-worktop-status]'),
          };
          this.touched = new Set();

          this.onInput = this.onInput.bind(this);
          this.onBlur = this.onBlur.bind(this);
          this.onKeydown = this.onKeydown.bind(this);
          Object.values(this.inputs).forEach((input) => {
            input.addEventListener('input', this.onInput);
            input.addEventListener('blur', this.onBlur);
            input.addEventListener('keydown', this.onKeydown);
          });

          if (typeof subscribe === 'function' && window.PUB_SUB_EVENTS) {
            this.variantUnsubscriber = subscribe(PUB_SUB_EVENTS.variantChange, this.onVariantChange.bind(this));
            this.cartUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, () => this.update());
          }

          this.update();
        }

        disconnectedCallback() {
          this.productInfo?.removeEventListener('submit', this.onSubmit, true);
          clearTimeout(this.debounceTimer);
          this.variantUnsubscriber?.();
          this.cartUnsubscriber?.();
        }

        get form() {
          return document.getElementById(this.dataset.formId);
        }

        get submitButton() {
          return this.form?.querySelector('[type="submit"][name="add"]');
        }

        onInput(event) {
          clearTimeout(this.debounceTimer);
          this.debounceTimer = setTimeout(() => {
            if (this.touched.has(event.target.dataset.worktopInput)) this.showError(event.target);
            this.update();
          }, 300);
        }

        onBlur(event) {
          this.touched.add(event.target.dataset.worktopInput);
          this.showError(event.target);
          this.update();
        }

        onKeydown(event) {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          clearTimeout(this.debounceTimer);
          this.update();
          const button = this.submitButton;
          if (this.form && button) this.form.requestSubmit(button);
        }

        onSubmit(event) {
          if (event.target.id !== this.dataset.formId) return;

          if (!this.config) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }

          clearTimeout(this.debounceTimer);
          const state = this.update();
          if (state.valid) {
            this.output.status.textContent = '';
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          Object.values(this.inputs).forEach((input) => {
            this.touched.add(input.dataset.worktopInput);
            this.showError(input);
          });
          this.output.status.textContent = this.config.strings.invalidSubmit;
          const firstInvalid = Object.values(this.inputs).find((input) => this.errorFor(input));
          firstInvalid?.focus();
        }

        onVariantChange({ data }) {
          if (!this.config || data?.sectionId !== this.dataset.sectionId) return;

          const variant = data.variant;
          this.config.variantId = variant?.id ?? null;
          this.config.variantTitle = variant?.title ?? '';
          this.config.unitPrice = Number(variant?.price) || 0;
          this.config.available = Boolean(variant?.available);

          const serverPerM2 = data.html?.querySelector(`#WorktopBreakdown-${data.sectionId} [data-worktop-per-m2]`);
          if (serverPerM2 && variant) {
            this.output.perM2.textContent = serverPerM2.textContent.trim();
          } else if (variant) {
            this.output.perM2.textContent = this.money(pricePerM2(this.config.unitPrice, this.config.unitMm2));
          } else {
            this.output.perM2.textContent = this.config.strings.placeholder;
          }

          this.update();
        }

        errorFor(input) {
          return validateDimension(input.value, Number(input.dataset.min), Number(input.dataset.max));
        }

        errorMessage(input, code) {
          const strings = this.config.strings;
          if (code === 'min') return strings.min.replace('[min]', input.dataset.min);
          if (code === 'max') return strings.max.replace('[max]', input.dataset.max);
          return strings[code] || '';
        }

        showError(input) {
          const code = this.errorFor(input);
          const errorElement = this.querySelector(`[data-worktop-error="${input.dataset.worktopInput}"]`);
          if (errorElement) errorElement.textContent = code ? this.errorMessage(input, code) : '';
          if (code) {
            input.setAttribute('aria-invalid', 'true');
          } else {
            input.removeAttribute('aria-invalid');
          }
        }

        money(cents) {
          return formatMoney(cents, this.config.currency, this.config.locale);
        }

        calculate() {
          const lengthValid = !this.errorFor(this.inputs.length);
          const widthValid = !this.errorFor(this.inputs.width);
          if (!lengthValid || !widthValid) return { valid: false };

          const lengthMm = parseDimension(this.inputs.length.value);
          const widthMm = parseDimension(this.inputs.width.value);
          const unitMm2 = this.config.unitMm2;
          const quantity = calcQuantity(calcAreaMm2(lengthMm, widthMm), unitMm2);
          const areaM2 = calcBilledAreaM2(quantity, unitMm2);

          return {
            valid: Boolean(this.config.variantId) && this.config.available,
            sized: true,
            lengthMm,
            widthMm,
            quantity,
            areaM2,
            decimals: areaDecimals(unitMm2),
            totalCents: calcTotal(quantity, this.config.unitPrice),
          };
        }

        update() {
          const state = this.calculate();
          const { strings, locale } = this.config;

          if (state.sized) {
            this.fields.quantity.value = String(state.quantity);
            this.fields.length.value = String(state.lengthMm);
            this.fields.width.value = String(state.widthMm);
            this.fields.area.value = state.areaM2.toFixed(state.decimals);
            this.output.area.textContent = strings.area.replace(
              '[area]',
              formatNumber(state.areaM2, state.decimals, locale)
            );
            this.output.total.textContent = this.config.variantId ? this.money(state.totalCents) : strings.placeholder;
          } else {
            Object.values(this.fields).forEach((input) => (input.value = ''));
            this.output.area.textContent = strings.placeholder;
            this.output.total.textContent = strings.placeholder;
          }

          if (state.valid) this.output.status.textContent = '';
          this.setSubmitHint(!state.valid);

          this.dispatchEvent(
            new CustomEvent('worktop:change', {
              bubbles: true,
              detail: {
                productId: this.dataset.productId,
                variantId: this.config.variantId,
                variantTitle: this.config.variantTitle,
                lengthMm: state.sized ? state.lengthMm : null,
                widthMm: state.sized ? state.widthMm : null,
                areaM2: state.sized ? this.fields.area.value : null,
              },
            })
          );

          return state;
        }

        // aria-disabled keeps the button focusable so the click can explain what is wrong.
        // It is only a hint: the capture-phase submit listener is the real gate.
        setSubmitHint(blocked) {
          const button = this.submitButton;
          if (!button || button.disabled) return;
          if (blocked) {
            button.setAttribute('aria-disabled', 'true');
          } else if (!button.classList.contains('loading')) {
            button.removeAttribute('aria-disabled');
          }
        }
      }
    );
  }
})();
