# Architecture & Tech Decisions

## 1. Short answer

| Question | Answer |
|---|---|
| **Framework** | **Shopify Liquid + the Dawn theme (Online Store 2.0)**, with **vanilla JavaScript** (Web Components, the same pattern Dawn uses) and plain CSS. |
| **Database** | **None. Shopify is the database.** Products, variants, metafields, metaobjects, cart, orders and contact-form submissions all live in Shopify. |
| **Build tools** | No build step. Use Shopify CLI, Git/GitHub, Theme Check, Prettier and Lighthouse. |
| **Hosting** | Shopify hosts the theme. The preview link comes from your dev store. |

### Why not React / Next.js / Vue / Tailwind / Hydrogen?

- The brief says **"Use Dawn or any Online Store 2.0 theme, with Shopify CLI and Git"** and "without requiring Shopify Functions or a custom app". They're testing **theme development**.
- The scoring asks for **"modular Liquid, clean JS"**. A JS framework would hide the Liquid skills they want to see.
- **Performance (Task 3)**: every framework adds JavaScript, which lowers the Lighthouse score. Dawn is built to ship almost no JS.
- Task 2 asks for the **Section Rendering API** and Task 3 asks for **JSON-LD in Liquid**. Both are theme features.
- Hydrogen (Shopify's React framework) is headless. It needs separate hosting and doesn't use Dawn, so it's off-brief.

### Why Dawn (and not Horizon or another theme)?

- Dawn already has AJAX facet filtering (`facets.js` using the Section Rendering API), a cart drawer and good accessibility to build on.
- Every Shopify reviewer knows it, so they can easily see what **you** changed.
- You extend it rather than rewrite it, which fits the 4-hour limit.

---

## 2. Data model (where each piece of data lives)

| Data | Where in Shopify | Why |
|---|---|---|
| Worktop product, thickness × edge variants, price per m² | Product + variants | Native, and the price comes from the server |
| Min/max length, width and slab limits | **Product metafields** (`custom.min_length_mm` and so on, integer) | Editable per product by the merchant, readable in Liquid for validation |
| Colour (name, hex, swatch image) | **Metaobject** `colour`, referenced by product metafield `custom.colour` | Structured, reusable, one source of truth, native filters and swatches |
| Finish (name, optional swatch) | **Metaobject** `finish`, referenced by product metafield `custom.finish` | Same reasons |
| Thickness filter | Variant option | Native filter, no extra data needed |
| Customer dimensions | **Line item properties** (`Length (mm)`, `Width (mm)`, `Area (m²)`) | Shown in cart, checkout and admin order |
| Quote requests | Shopify **contact form** (`{% form 'contact' %}`) → store email / Admin | No backend or database needed |
| Homepage reviews, FAQ, banners | **Section and block settings** (theme editor) | Merchant-editable, no code changes needed |
| Text strings | `locales/en.default.json` with the `t` filter | Translatable, nothing hard-coded |

> An external database would only make sense with a custom app (for example storing quotes in Postgres). The brief rules that out, and it would add security and hosting risk for no benefit.

---

## 3. How the pieces fit together

```
                ┌──────────────── Shopify (hosted) ────────────────┐
 Browser        │                                                  │
 ─────────      │  templates/*.json  ──►  sections/*.liquid        │
 HTML  ◄────────┤                           │  render              │
                │                           ▼                      │
                │                     snippets/*.liquid            │
                │                           │ reads                │
                │        products · variants · metafields ·        │
                │        metaobjects · cart · settings             │
                └──────────────────────────────────────────────────┘
   │
   │ JS (Web Components, deferred, loaded only by the section that needs it)
   ├── <worktop-configurator>  → validates input, shows live price, POST /cart/add.js
   ├── <facet-filters>         → GET ?section_id=… (Section Rendering API), pushState/popstate
   ├── <quote-form>            → prefills hidden fields, honeypot
   └── <cart-drawer>           → shows dimensions, re-renders via Section Rendering API
```

**Cart integrity flow (Task 1.4):**

```
Browser enters L × W  ──►  JS: area → quantity = ceil(area / 0.01 m²)
                                   + properties[Length], properties[Width]
                       ──►  Shopify: total = variant price (per 0.01 m²) × quantity   ← server-side price
                       ──►  Cart Liquid: recalculate quantity from properties, check limits
                                   mismatch / out of range → line error + checkout button disabled
                       ──►  (Bonus) Cart & Checkout Validation Function → real server-side block
```

---

## 4. Folder structure

Shopify themes have a **fixed folder layout**. You can't create subfolders inside `sections/`, `snippets/` and so on. "Clean folders" therefore means **consistent file-name prefixes** plus separate repo-level folders for things that aren't part of the theme.

```
shopify-task/                     ← Git repo root = theme root
├── assets/
│   ├── worktop-configurator.js
│   ├── worktop-configurator.css
│   ├── quote-form.js
│   ├── facet-swatches.css
│   └── (Dawn files…)
├── blocks/                       (only if you use theme blocks)
├── config/
│   ├── settings_schema.json
│   └── settings_data.json
├── layout/theme.liquid
├── locales/en.default.json       ← all new strings go here
├── sections/
│   ├── worktop-configurator.liquid
│   ├── quote-request.liquid
│   ├── home-reviews.liquid
│   ├── home-blog-carousel.liquid
│   ├── faq-accordion.liquid
│   └── (Dawn sections…)
├── snippets/
│   ├── worktop-price-breakdown.liquid
│   ├── worktop-cart-validation.liquid
│   ├── quote-form.liquid
│   ├── facet-swatch.liquid
│   ├── seo-meta.liquid
│   ├── structured-data-product.liquid
│   └── structured-data-breadcrumb.liquid
├── templates/
│   ├── product.worktop.json
│   ├── collection.json
│   └── page.debug-fixes.json     (Task 4 demo page)
│
├── docs/                         ← not uploaded to Shopify
│   ├── ANSWERS.md                (Task 5)
│   ├── lighthouse/before.html
│   ├── lighthouse/after.html
│   └── screenshots/
├── data/                         ← sample products CSV, metaobject seed
├── .shopifyignore                ← lists docs/, data/, *.md so they aren't pushed
├── .theme-check.yml
├── .prettierrc
├── .github/workflows/theme-check.yml
└── README.md
```

**Naming rules**
- One feature = one prefix: `worktop-*`, `quote-*`, `facet-*`, `seo-*`, `structured-data-*`.
- Sections are things the merchant adds in the editor. Snippets are reusable pieces with documented parameters.
- Each section loads its own CSS and JS. Nothing feature-specific goes into `theme.liquid`.

---

## 5. Code quality

### Liquid
- Use `{% render %}` with explicit parameters. Never use `{% include %}`.
- Document each snippet's parameters at the top (with `{% doc %}`, or a comment block).
- Make every value a merchant might change a **schema setting** or a **metafield**. No magic numbers in code.
- All text goes through `{{ 'key' | t }}`.
- Keep logic out of templates. Templates are JSON and only list sections.
- Avoid `all_products[...]` and nested loops over large collections. Paginate (24 per page).

### JavaScript
- Use **Custom Elements** (`class WorktopConfigurator extends HTMLElement`), one feature per file, no global variables.
- Load with `<script src="…" defer>` inside the section that needs it.
- Write the price maths as small pure functions (`calcArea`, `calcQuantity`) so they're easy to read and test.
- Cancel old filter requests with `AbortController` and debounce input events.
- Use `textContent`, never `innerHTML`, with user input.
- Don't add jQuery or other libraries.

### CSS
- Use component-scoped class names (BEM style: `.worktop-config__field--error`).
- Reuse Dawn's CSS custom properties (colours, spacing).
- Mobile-first. No `!important`. Reserve space for errors and prices to avoid CLS.

### Tooling
- `shopify theme check`: Shopify's official linter. Zero errors before you submit.
- Prettier with `@shopify/prettier-plugin-liquid` for consistent formatting.
- A GitHub Action running Theme Check on each push. It costs little and makes a strong code-quality signal.
- **Commits:** small and meaningful, e.g. `feat(worktop): add live price breakdown`, `fix(a11y): keyboard support for FAQ accordion`.

---

## 6. Security

| Risk | Mitigation |
|---|---|
| Customer edits the page to pay less | The price is calculated by Shopify (quantity = area units). Cart Liquid re-validates the properties against the quantity and the limits, and disables checkout on a mismatch. A Shopify Function is the real server-side block (bonus). Explain the remaining gaps in the README. |
| Direct `POST /cart/add.js` with fake data | Caught by the same cart-level validation. Staff can see the dimensions on the order before cutting. |
| XSS through line item properties | Properties are user input. Always output them with `| escape`, and pass data to JS with the `| json` filter. |
| Invalid numbers (`NaN`, negative, `1e9`, decimals) | Parse and clamp in JS **and** check again in Liquid. Use `inputmode="numeric"` with `min`/`max`/`step` (helps users, isn't trusted). |
| Spam on the quote form | Honeypot field that is hidden from people but filled by bots, plus Shopify's built-in contact-form captcha. Validate required fields. |
| Leaked secrets | Theme code is public. Never put Admin API tokens or private keys in the theme. None are needed here. |
| SEO duplicate content (filtered URLs) | `noindex, follow` plus canonical pointing to the base collection on filtered and sorted URLs. |

---

## 7. Performance

- **No framework, no jQuery.** That alone keeps JS tiny.
- **Images:** `image_url` + `image_tag` with `widths`, `sizes`, `width`/`height`. The hero gets `loading="eager" fetchpriority="high"`. Everything else gets `loading="lazy"`.
- **Scripts:** `defer` everything, and load section JS only when that section is on the page.
- **CSS:** load per-section stylesheets and remove unused Dawn and app CSS.
- **Fonts:** `font-display: swap`, preload only the main font.
- **CLS:** fixed aspect ratios for images and carousels, reserved space for dynamic text.
- **Filtering:** the Section Rendering API fetches only the product grid, not the whole page.
- **Liquid:** paginate, avoid heavy loops, cache values in variables.
- **Measure:** Lighthouse mobile before and after. Save both reports in `docs/lighthouse/`.

---

## 8. Accessibility

- Every input has a `<label>`. Errors are linked with `aria-describedby`, and invalid fields get `aria-invalid="true"`.
- Live price uses an `aria-live="polite"` region.
- Accordion and menu buttons use `aria-expanded` and `aria-controls`. Esc closes menus. Visible focus outlines.
- Everything works with keyboard only. Respect `prefers-reduced-motion` in carousels.

---

## 9. Tools to install

| Tool | Purpose | Install |
|---|---|---|
| Node.js 22 LTS | Needed by Shopify CLI | nodejs.org or `nvm install 22` |
| Shopify CLI | `theme init`, `dev`, `push`, `check` | `npm install -g @shopify/cli@latest` |
| Git + GitHub account | Repo and commits | Probably already installed |
| Prettier + Liquid plugin | Formatting | `npm i -D prettier @shopify/prettier-plugin-liquid` |
| Lighthouse | Before/after reports | Chrome DevTools → Lighthouse, or `npm i -g lighthouse` |
| Shopify Search & Discovery app | Turn on metafield filters | Install free from the Shopify App Store into the dev store |

---

## 10. Testing checklist (do this before submitting)

- [ ] Below-min, above-max and empty dimensions, letters, decimals → clear error, can't add to cart.
- [ ] Change the quantity in the cart, or edit a property in DevTools → line flagged, checkout disabled.
- [ ] Dimensions visible in cart, drawer, checkout and admin order.
- [ ] Quote form prefilled. Honeypot blocks a filled submission.
- [ ] Filters: combine colour + finish + thickness, refresh the page, use the back button → state kept.
- [ ] Filtered URL has `noindex` and canonical to the base collection.
- [ ] Rich Results Test passes for a product page.
- [ ] Lighthouse mobile ≥ 80, LCP < 2.5s, CLS < 0.1.
- [ ] Keyboard-only pass through product, filters, menu and FAQ.
- [ ] `shopify theme check` shows 0 errors.
