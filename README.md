# Work-Tops — Shopify developer assessment

Dawn 16.2.0, Liquid, vanilla JavaScript Custom Elements and plain CSS. The theme has no storefront build step. Shopify owns catalogue, custom data, cart, orders and contact delivery.

- **Live storefront:** https://mi-task-store.myshopify.com/ — `Work-Tops-performance-review` (theme ID `190267228451`, confirmed `[live]` by Shopify CLI on 20 November 2026).
- **Assessment workload on the live theme:** https://mi-task-store.myshopify.com/?view=assessment
- **Historical unpublished assessment preview:** https://mi-task-store.myshopify.com/?preview_theme_id=190265196835 (`Work-Tops-v0.3.0-rc.1`); this is **not** the currently published theme.
- **Repository:** https://github.com/Udhaykrishn/shopify-worktops
- Written answers: [docs/ANSWERS.md](docs/ANSWERS.md).
- Requirements and data model: [TASKS.md](TASKS.md), [ARCHITECTURE.md](ARCHITECTURE.md).

## Local setup and validation

Use Node 22.19 or newer and `npm ci`. Run `npm test` and `npm run check:theme`. The dependencies are development tools; they are not shipped to browsers. Authenticate Shopify CLI against `mi-task-store.myshopify.com` before an approved preview upload. Never target work-tops.com. Keep credentials in the CLI’s authentication store or environment, never theme files.

The existing homepage, typography, colours and component layout are preserved. The separate assessment homepage provides the larger demonstration workload. New demo content is explicitly labelled, and no sample testimonial is emitted as an aggregate rating.

## Worktop prices and manipulation

The six variants combine 20/30 mm thickness with Straight/Bullnose/Bevelled edges. Catalogue variant prices represent **0.01 m²**, fixed at 10,000 mm² across every consumer. Changing a theme setting cannot silently reinterpret those catalogue prices.

For length L and width W in millimetres, area = L×W/1,000,000; billable units = ceil(L×W/10,000). Shopify charges its server-owned variant price × quantity. A 1000×600 mm piece consumes 60 units; at a variant price of 2.52, its total is 151.20 in the actual cart currency. A 1001×600 mm piece is billed as 0.61 m². The rounding is upward per piece. Whole multiples of a configured line’s unit quantity represent identical pieces.

Length, Width and billed Area are public line item properties so Shopify can carry them to checkout and the order. Cart page, drawer and notification render property values as escaped text, with restricted URL handling for uploaded files. The cart rechecks integer dimensions, product limits, exact billed-area formatting and quantity. Invalid lines show a reason and disable the theme’s checkout controls. Dynamic checkout is disabled for worktops.

### How a customer could pay less by editing the page

**Concrete tampering example:** select a 1000 × 600 mm worktop. Its area is 0.60 m², so the configurator calculates `ceil(1000 × 600 / 10,000) = 60` billable units. If Shopify's variant price is 2.52 per 0.01 m², the legitimate line total is **151.20** in the store currency. A customer could open browser DevTools, change the submitted quantity from **60 to 1**, or skip the configurator and send a direct `/cart/add.js` request containing that variant with quantity 1. If that line reaches checkout, Shopify's normal variant-price calculation would charge **2.52** rather than 151.20. They could also change the submitted dimension properties to make an incorrectly priced line appear valid. Editing the displayed price or hidden total alone cannot change Shopify's server-owned variant price; changing quantity is the more important risk.

**Mitigations in this assessment:** the product UI checks integer length/width against the configured minimum and slab maximum, rounds billable area **up** to 0.01 m² increments, and derives displayed totals from the selected Shopify variant price. Dimensions and billed area are included as public line item properties. When the theme cart is rendered, it recalculates the required billed units from the recorded dimensions, verifies the formatting and permitted bounds, and compares them to the line quantity. It shows an error and disables the theme's checkout controls for mismatches. Dynamic checkout buttons are disabled for worktops. These measures discourage mistakes and catch ordinary browser-side tampering **when the theme cart is visited**.

**Security limitation:** these checks run in storefront Liquid/JavaScript, not in Shopify's checkout validation layer. A determined customer could submit an inconsistent line directly through the Cart API, bypass the theme cart using a checkout link/permalink, or tamper with the dimensions and quantity together. The current implementation **cannot guarantee that an underpriced custom-size order is blocked server-side**. A production release should use a **Cart and Checkout Validation Function** to reject invalid dimensions, quantities and property inconsistencies at the server boundary, and should use a server-enforced pricing strategy when arbitrary dimensions cannot be represented safely by catalogue unit pricing. This Function is **not implemented** for the assessment. Staff must verify recorded dimensions and the charged amount before fabrication. No client-supplied total is accepted as an authoritative Shopify price.

The reusable Shopify contact form includes name, email, postcode, notes and product/variant/dimension context. Valid submissions previously fell through to a native POST and reloaded the page; the shared component now submits with Fetch and shows loading, confirmed success or errors in place, preserving the existing layout. Confirmed success closes the quote modal and restores focus to its opener; pending or failed submissions keep it open. It retains all form fields and CAPTCHA data, blocks duplicate requests, and keeps entered details on failure. Native field validation, a honeypot and Shopify CAPTCHA remain in place. The no-JavaScript form remains reachable. Local regression tests and intercepted Chrome checks at 375, 768, 1024 and 1440 px cover submission, payload, focus and modal behaviour. Real Shopify delivery and CAPTCHA tokens still require a storefront receipt check; Shopify challenge redirects show an inline error and cannot be completed automatically by this form.

## Native filtering and indexing

Colour and Finish are merchant-owned metaobjects referenced by product metafields, with public storefront access. Thickness is a variant option. Configure those three native filters in Shopify Search & Discovery; theme markup alone cannot enable store-level filters. The theme reads Shopify’s filter values and counts, renders colour swatches, and uses the Section Rendering API for results, sort and pagination. Requests cancel older work; cached responses and browser Back/Forward also synchronize title, description, canonical and robots metadata.

Base collections and ordinary pagination are indexable with self-canonicals. Filtered, sorted and tagged collection views use `noindex, follow` and canonicalize to the base collection. Internal search is noindex. A valuable combination such as White Quartz should be a dedicated collection with original content, rather than an indexed filter URL. Product/collection description fallbacks and one page H1 support the normal pages.

## Performance and SEO

### Targets, audit scope and status

The **assessment's required mobile targets** are **Performance ≥80, LCP <2.5 s and CLS <0.1**. The separate **stretch/CI gate** in this project is stricter: **Performance >90, LCP <2.5 s and CLS <0.1 on every run**. The stretch gate is not the assessment threshold. The performance theme is now **published**, but the last retained audit did **not** pass the full stretch gate, and not every assessed page satisfied the assignment's LCP threshold.

Lighthouse measurements are **mobile simulated lab tests**, not field Core Web Vitals. Scores depend on the tested URL, deployed theme, device conditions and run. The historical assessment preview is theme `190265196835`; the later performance theme is `190267228451`, **now marked live by Shopify CLI**. Its archived Lighthouse tests were conducted **while it was unpublished**. These results must not be conflated, and the publication status alone does not prove that the current remote files match a particular local Git commit or that the store's password protection is disabled.

### Latest retained optimized-theme audit — mobile (3 runs per page, measured before publication)

[Optimization record with full per-run ranges, HTML/JSON and regeneration commands](docs/PERFORMANCE-2026-11-20.md). These measurements were taken when theme `190267228451` was **unpublished**; the same theme ID is **now live** at [the storefront](https://mi-task-store.myshopify.com/). No new post-publication audit is claimed.

| Page | Median Performance (range) | Median LCP (range) | Median CLS (max) | Assessment requirements |
|---|---:|---:|---:|---|
| Home | **93** (89–96) | **2.156 s** (2.019–3.078) | **0** (0) | Median passes; an LCP run fails |
| Product | **92** (90–93) | **2.607 s** (2.319–3.078) | **0** (0) | **Fails LCP** |
| Collection | **79** (75–84) | **4.549 s** (4.078–5.335) | **0** (0) | **Fails score and LCP** |
| Assessment workload | **92** (91–95) | **2.283 s** (2.160–2.505) | **0** (0.039) | Median passes; an LCP run fails |

The homepage and assessment-workload **medians** meet all three assignment thresholds, but at least one run in each exceeds 2.5 s LCP. Product LCP and collection score/LCP remain outside budget. **All reported CLS results pass.** The project's strict every-run performance check therefore still **FAILS**; no 90+ / sub-2.5 s universal pass is claimed.

### Additional Chrome DevTools browser checks — desktop vs mobile

The following **single-run browser screenshots** were taken on `https://mi-task-store.myshopify.com/` before the publication status was confirmed, **not** on a verified uploaded-commit preview. They provide useful diagnostics but **are not a controlled before/after comparison** or proof of the current published theme's metrics, and should not replace the archived multi-run evidence.

| Browser run | Performance | FCP | LCP | TBT | CLS | Best Practices |
|---|---:|---:|---:|---:|---:|---:|
| Desktop Chrome profile | **98** | 0.7 s | **1.0 s** | 0 ms | 0.051 | 73 |
| Mobile Chrome profile, extension warning | **78** | 2.2 s | **3.6 s** | 310 ms | 0 | 73 |
| Mobile Chrome Incognito | **85** | 2.0 s | **2.9 s** | 360 ms | 0 | 96 |

The desktop screenshot meets the performance, LCP and CLS targets in that run. Incognito mobile meets the assessment's **score ≥80** and **CLS <0.1**, but **does not meet LCP <2.5 s**. Chrome explicitly reported extension interference in the earlier non-Incognito mobile audit. The changes between these browser runs cannot be attributed solely to extensions.

### Baseline and older assessment-preview evidence

On **20 November 2026**, the original published-homepage baseline scored **38**, with **6.304 s LCP** and **0 CLS** (Lighthouse 13.5.0, default mobile simulation). In the older unpublished assessment preview (**theme 190265196835**, 3 runs each), mobile medians were: **home 55 / 5.791 s / 0 CLS; product 67 / 5.373 s / 0; collection 71 / 3.172 s / 0; assessment 85 / 3.626 s / 0**. Those results **failed** the complete assignment budget, and are retained in [docs/lighthouse/](docs/lighthouse/) with HTML/JSON reports. The original homepage and the newly built assessment workload are different workloads; do not describe them as a matched before/after pair. The remote runs identify a rendered theme but are not cryptographic proof of a clean checked-out commit; the CI upload manifest is designed to provide source-to-preview association when enabled.

### Changes, findings and remaining work

Implemented optimizations include cached 400/800/1200 px responsive WebP illustrations instead of repeatedly painted SVG turbulence; appropriate above-fold image priority and preloading; explicit image dimensions/aspect ratios; lazy loading below-fold media; conditional section assets; earlier font preloads; inlined critical styles in original cascade order; and a smaller Fraunces font. These are documented in the [optimization record](docs/PERFORMANCE-2026-11-20.md). Shopify's mandatory `content_for_header` remains intact.

Mobile Lighthouse also identified a network dependency tree containing Shopify-hosted platform scripts/telemetry, unnecessary connection hints on the measured page, and an image-delivery opportunity for `worktop-art-fantasy-brown-granite-400.webp` (approximately **48 KiB estimated potential savings**). These are **diagnostic opportunities**, not claimed fixes. Collection-page LCP is still the largest unresolved performance issue; keep the existing layout and verify the actual LCP element and loading sequence before changing media or removing platform functionality.

The 28 existing decorative illustrations were preserved as SVG sources in `data/stone-art/`. `node data/render-stone-art.mjs` regenerates their 400/800/1200 px WebP assets. They are illustrations, not product photographs. Known catalogue handles use these cached files; unrecognized products retain the dynamic SVG fallback. If a product’s illustration/colour changes, regenerate its asset and handle mapping. A production catalogue should use approved product photography.

Product JSON-LD uses visible catalogue values and the actual currency. Worktop offers describe the visible price per square metre with unit code MTK; no fabricated review rating is added. BreadcrumbList mirrors the product/collection hierarchy. Google's Rich Results code test detected three valid items, with non-critical Product/Merchant Listing issues. The URL crawl of the preview failed. See [the evidence and screenshots](docs/RICH-RESULTS.md); code validation does not establish public crawlability.

## CI and version control

`.github/workflows/theme-quality.yml` runs Theme Check and regression tests on pushes, pull requests and manual dispatch. Trusted runs upload the checked-out commit to a uniquely named **unpublished** Mi-Task theme, verify its ID, run three mobile audits each for home, product, collection and assessment workload, and enforce all three budgets on every run. HTML, JSON, commit/theme manifest and a workflow summary are retained for 30 days, including failures. Cleanup verifies the created theme’s unique name, ID and unpublished role before deletion. CI never publishes a theme.

Repository variable `SHOPIFY_CI_ENABLED=true` has been configured. The remaining prerequisite is a Theme Access password in Actions secret `SHOPIFY_CLI_THEME_TOKEN`; it has not been provisioned. Add `SHOPIFY_STORE_PASSWORD` only if storefront access requires it. Optional `LIGHTHOUSE_STRESS_PATH` changes the assessment route. Never paste these credentials into the repository or chat. Missing setup fails visibly; it does not count as passing performance evidence. Fork PRs run static checks without deployment credentials and report that performance still needs a trusted run. This workflow does not use `pull_request_target`.

Existing feature history and tags are retained. Use conventional commits and annotated semantic version tags for reviewed checkpoints; use `-rc.N` while any release evidence is pending. A Git commit alone cannot trigger hosted CI until it is pushed to GitHub.

## Front-end fixes and verification

FAQ uses native details/summary so Enter/Space, focus and disclosure semantics work without a custom keyboard widget. Assessment navigation exercises nested desktop disclosure and mobile touch navigation using Dawn’s focus/Esc support. Images reserve their ratio and dimensions; error and price regions reserve space. Record observed tablet/mobile/keyboard behaviour and measured CLS in the evidence log before claiming those runtime gates passed.

Problem → cause → fix: stale SEO after AJAX navigation came from updating only results markup; section responses now include inert metadata and all render/cache/history paths update the head. Quote error context was lost because only name/email were restored; product variant and dimensions now restore together. Arbitrary upload-looking properties could become unsafe links; a shared escaped renderer checks the URL shape and scheme. The incomplete unused client-only filter experiment caused five Theme Check errors; its sources are preserved under `docs/archive/unused-facets/` and are excluded from theme deployment.

## Remaining release evidence / trade-offs

Shopify CLI reports `Work-Tops-performance-review` (`190267228451`) as the **live** theme. See [docs/VERIFICATION.md](docs/VERIFICATION.md) for the previously recorded checks and still-pending external gates; that evidence was gathered before the publication status was updated. GBP is a store/market setting: displaying a pound sign over USD prices would be incorrect. Native filter activation, GBP configuration, Admin order visibility, quote receipt, performance targets and a credentialed CI audit remain outstanding. Browser checks confirmed dimension properties and matching totals in the cart drawer and checkout; no order or contact email was submitted.

With more time: enforce worktop validation server-side with a Function, use approved photography and genuine customer reviews, add measured field monitoring, and test a representative large native catalogue. The theme paginates server-side; it does not download the full catalogue to simulate filtering.
