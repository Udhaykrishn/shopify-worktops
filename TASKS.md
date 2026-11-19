# Shopify Developer Practical Assessment — Work Plan

**Client context:** Work-Tops (work-tops.com) — UK store selling stone worktops, tiles and sinks (granite, quartz, marble). Customers order cut-to-size worktops and request quotes.

**Time box:** about 4 hours, 5 hours at most.
**Stack:** your own Partner development store, Dawn (or another OS 2.0 theme), Shopify CLI, Git.
**Rules:** don't touch the live store. Demo product data is available from them on request.

---

## How it's scored (use this to decide where your time goes)

| Area | Weight | What it means for you |
|---|---|---|
| Working functionality and cart integrity (Tasks 1 + 2) | **35%** | The core. Spend most of your time here. |
| Code quality: modular Liquid, clean JS, secure input handling | **25%** | Applies to every task. Use sections, snippets and blocks, no inline spaghetti. |
| Performance, SEO, structured data (Task 3) | 15% | Needs before/after Lighthouse reports. |
| Front-end fixes and accessibility (Task 4) | 10% | Small. Keep fixes tight and well explained. |
| Written reasoning and communication (README + Task 5) | 15% | Cheap marks. Don't leave it to the last 5 minutes. |

**Bonus (optional):** a Shopify Function for the pricing rules, or an AJAX cart drawer that shows the dimensions. The cart drawer is the cheaper bonus, because Dawn already ships one.

---

## Suggested time budget (~4h20 including buffer)

| # | Phase | Time |
|---|---|---|
| 0 | Setup | 15 min |
| 1 | Task 1: custom-size worktop | 80 min |
| 2 | Task 2: collection filtering | 55 min |
| 3 | Task 3: performance and SEO | 45 min |
| 4 | Task 4: front-end bug fixes | 25 min |
| 5 | Task 5: written answers | 20 min |
| 6 | README, Lighthouse reports, submission | 20 min |

---

## Phase 0: Setup

- [ ] Create a Partner account and a development store.
- [ ] `shopify theme init` (Dawn), `git init`, first commit "Initial Dawn theme".
- [ ] `shopify theme dev --store <store>` for local preview.
- [ ] Ask for the demo product data. If it hasn't arrived, generate a CSV of quartz, granite and marble products.
- [ ] Create a "Worktop" product with options **Thickness** (20mm, 30mm) × **Edge profile** (Straight, Bullnose, Bevelled) = 6 variants, priced **per m²**.
- [ ] Create a "Quartz Worktops" collection.

---

## Task 1: Custom-size worktop ordering (core, highest weight)

**Deliverable:** a product template `templates/product.worktop.json` with a configurator section.

| # | Requirement | Implementation notes |
|---|---|---|
| 1.1 | Length (mm) and width (mm) inputs with min/max validation and accessible errors | Store limits in product metafields (`custom.min_length`, `custom.max_length`, `custom.min_width`, `custom.max_width`, slab limits) so the merchant can edit them. Use `<label>`, `aria-describedby`, `aria-invalid` and an error element with reserved height. |
| 1.2 | Live price breakdown: area, price per m², total | Area = L × W / 1,000,000. Recalculate when dimensions or the variant change. Put the total in an `aria-live="polite"` region. Format money in GBP. |
| 1.3 | Add to cart with dimensions as line item properties, visible in cart, checkout and admin | `properties[Length (mm)]`, `properties[Width (mm)]`, `properties[Area (m²)]`. Keys without a `_` prefix are shown everywhere. Check that the cart template renders them (Dawn does). |
| 1.4 | "Don't trust the browser": invalid input must not reach checkout unnoticed | See the cart integrity section below. **This is the most important design decision in the test.** |
| 1.5 | "Request a free quote" form as a reusable section or block | `{% form 'contact' %}` with name, email, postcode and notes. Hidden fields prefilled with product, variant and dimensions. Add a honeypot field (Shopify's built-in contact form captcha also helps). Build it as a snippet plus a section so it can be reused on other templates. |
| 1.6 | Responsive, keyboard-accessible, no layout shift | Reserve space for error and price elements. Visible focus states. Test with Tab only. |

### Cart integrity: the key problem

Line item properties **do not change the price**. Shopify charges the variant price × quantity. So if the price depends on area, you need a way to make Shopify itself charge for the area, and to catch tampering.

Recommended approach (justify it in the README):

1. **Quantity encodes area.** Price the variant per 0.01 m² (or per 0.1 m²) and set quantity = `ceil(area / unit)`. Shopify's own price × quantity then produces the correct total, so the price comes from the server, not the browser.
2. **Cart-level validation in Liquid.** In the cart template and drawer, recalculate the expected quantity from the stored Length and Width properties, and check min/max limits. If anything doesn't match, show an error on the line and disable the checkout button.
3. **Admin visibility.** Dimensions are stored on the order, so staff can spot a mismatch before cutting.
4. **(Bonus) Shopify Function: Cart and Checkout Validation.** This is the only true server-side block that the browser can't get around. Mention it even if you don't build it.

**README must explain:** how someone could get a lower price by editing the page (change the quantity, edit the hidden properties, or post to `/cart/add.js` directly), and how your approach limits that, including what it *doesn't* fully prevent without a Function.

---

## Task 2: Collection filtering ("Quartz Worktops")

| # | Requirement | Implementation notes |
|---|---|---|
| 2.1 | Colour and Finish as **metaobjects** (name plus swatch image or hex), referenced from product metafields. Justify this over tags. | Metaobject definitions `colour` (name, hex, swatch image) and `finish` (name). Product metafields `custom.colour` and `custom.finish` as metaobject references. **Why not tags:** structured data, one source of truth, swatch data in one place, renaming is safe, works with native filtering, no typos. |
| 2.2 | Filters for colour, finish and thickness using **native storefront filtering** | Enable them in the **Search & Discovery** app: metafield filters for colour and finish, variant option filter for thickness. |
| 2.3 | Swatches for the colour filter | Render the swatch (hex or image) from the filter value in `facets.liquid` / a snippet. |
| 2.4 | Update results **without a full page reload**, filter state in the URL, back button works | Use the Section Rendering API (`?section_id=...`). `history.pushState` on change, handle `popstate`. Dawn's `facets.js` already does most of this, so extend it rather than rewriting it. |
| 2.5 | Avoid duplicate content: canonical and `noindex` rules for filtered URLs | Filtered and sorted URLs: canonical points to the base collection, plus `noindex, follow`. Index only the base collection (and plain pagination). For high-value combinations such as "White Quartz Worktops", create dedicated collections with their own content instead of indexing filter URLs. Write this decision down. |

---

## Task 3: Performance and SEO

**Setup:** build a long, image-heavy homepage: product carousels, blog carousel, 40+ reviews, mega-menu.

- [ ] **Run Lighthouse (mobile) BEFORE optimising** and save the report. Target **Performance ≥ 80, LCP < 2.5s, CLS < 0.1**.
- [ ] Fix at least 5 Liquid/JS issues and note each one:
  1. Responsive images: `image_url` + `image_tag` with `widths` and `sizes`, explicit width and height.
  2. LCP hero: `loading="eager"` and `fetchpriority="high"`. Everything below the fold: `loading="lazy"`.
  3. `defer` non-critical scripts. Load the carousel and review JS only when the section exists.
  4. Load section CSS/JS conditionally (inside the section, not globally in `theme.liquid`).
  5. Remove unused JS/CSS and the default apps/scripts you don't need.
  6. (Extra) `font-display: swap`, preconnect, reserved space for carousels.
- [ ] **Single H1** per page and a correct heading hierarchy (section titles as H2, cards as H3).
- [ ] **JSON-LD** in Liquid: `Product` (name, image, price, currency, availability, brand) and `BreadcrumbList`. **No `aggregateRating`** unless there are real reviews. Validate in Google's Rich Results Test and take a screenshot.
- [ ] Title, meta description and canonical logic for collection and product pages (handle paginated and filtered URLs).
- [ ] **Run Lighthouse AFTER** and save the report.

---

## Task 4: Debug and fix front-end issues

Build or reproduce a page with these bugs, fix them, and document each one in the README (problem → cause → fix).

| # | Bug | Fix outline |
|---|---|---|
| 4.1 | Mega-menu overlaps content on mid-size screens and breaks on mobile (touch, focus, keyboard) | Correct positioning and z-index, a breakpoint for tablet widths, toggle buttons with `aria-expanded`, Esc closes it, focus management, tap to open on touch instead of hover. |
| 4.2 | FAQ accordion with no keyboard support or ARIA | `<button aria-expanded aria-controls>` + `hidden` panel, or native `<details>/<summary>`. Enter and Space work. |
| 4.3 | Images cause layout shift and aren't responsive | Width and height or `aspect-ratio`, `srcset`/`sizes`, lazy-load below the fold. |

---

## Task 5: Short written answers (max 1 page)

1. When would you use **metaobjects**, **metafields** and **tags** in this store?
2. Migrating to a new theme: what do you check and how do you roll back? Cover redirects, structured data, metadata and staging.
3. A customer says the checkout price differs from the product page. How do you debug it?
4. How would you safely bulk-import 200+ products with variants, metafields and images so the import can be re-run? What could go wrong?

Save as `docs/ANSWERS.md` (or a section of the README).

---

## Submission checklist

- [ ] GitHub repo with **clear commits** (roughly one commit per task or sub-feature, not one big commit).
- [ ] Preview URL, plus the store password if needed.
- [ ] Lighthouse before and after reports (HTML or JSON in `docs/lighthouse/`).
- [ ] README: setup, architecture decisions, trade-offs, what you'd do with more time, the price manipulation explanation (Task 1), the indexing rules (Task 2), and the bug fixes (Task 4).
- [ ] Task 5 answers.

## Suggested files to add to Dawn

```
templates/product.worktop.json
sections/worktop-configurator.liquid
sections/quote-request.liquid
snippets/quote-form.liquid
snippets/worktop-price-breakdown.liquid
snippets/structured-data-product.liquid
snippets/structured-data-breadcrumb.liquid
snippets/meta-tags.liquid            (edited: canonical and noindex logic)
snippets/facet-swatch.liquid
assets/worktop-configurator.js
assets/worktop-configurator.css
sections/faq-accordion.liquid        (Task 4)
sections/mega-menu.liquid            (Task 4, or edits to the header)
docs/ANSWERS.md
docs/lighthouse/before.html, after.html
README.md
```
