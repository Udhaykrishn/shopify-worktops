# Work-Tops — Shopify developer assessment

Dawn 16.2.0, Liquid, vanilla JavaScript Custom Elements and plain CSS. The theme has no storefront build step. Shopify owns catalogue, custom data, cart, orders and contact delivery.

- Development store: https://mi-task-store.myshopify.com/
- Repository: https://github.com/Udhaykrishn/shopify-worktops-assessment
- Unpublished preview: https://mi-task-store.myshopify.com/?preview_theme_id=190265196835
- Assessment workload: `/?view=assessment` on the reviewed theme preview.
- Written answers: [docs/ANSWERS.md](docs/ANSWERS.md).
- Requirements and data model: [TASKS.md](TASKS.md), [ARCHITECTURE.md](ARCHITECTURE.md).

## Local setup and validation

Use Node 22.19 or newer and `npm ci`. Run `npm test` and `npm run check:theme`. The dependencies are development tools; they are not shipped to browsers. Authenticate Shopify CLI against `mi-task-store.myshopify.com` before an approved preview upload. Never target work-tops.com. Keep credentials in the CLI’s authentication store or environment, never theme files.

The existing homepage, typography, colours and component layout are preserved. The separate assessment homepage provides the larger demonstration workload. New demo content is explicitly labelled, and no sample testimonial is emitted as an aggregate rating.

## Worktop prices and manipulation

The six variants combine 20/30 mm thickness with Straight/Bullnose/Bevelled edges. Catalogue variant prices represent **0.01 m²**, fixed at 10,000 mm² across every consumer. Changing a theme setting cannot silently reinterpret those catalogue prices.

For length L and width W in millimetres, area = L×W/1,000,000; billable units = ceil(L×W/10,000). Shopify charges its server-owned variant price × quantity. A 1000×600 mm piece consumes 60 units; at a variant price of 2.52, its total is 151.20 in the actual cart currency. A 1001×600 mm piece is billed as 0.61 m². The rounding is upward per piece. Whole multiples of a configured line’s unit quantity represent identical pieces.

Length, Width and billed Area are public line item properties so Shopify can carry them to checkout and the order. Cart page, drawer and notification render property values as escaped text, with restricted URL handling for uploaded files. The cart rechecks integer dimensions, product limits, exact billed-area formatting and quantity. Invalid lines show a reason and disable the theme’s checkout controls. Dynamic checkout is disabled for worktops.

Someone can edit hidden fields, change quantity or properties, call `/cart/add.js` directly, or navigate directly to `/checkout`. The cart checks catch mismatches when that cart is rendered; they cannot prevent all direct checkout/API/permalink bypasses. A Cart and Checkout Validation Function is the server-side enforcement upgrade. It is optional in this assessment and is not claimed as implemented. Staff must check dimensions before fabrication. No client-supplied total determines Shopify’s price.

The reusable Shopify contact form includes name, email, postcode, notes and product/variant/dimension context. Native field validation, a honeypot and Shopify CAPTCHA provide basic spam controls. Server error recovery restores the submitted context. The no-JavaScript form remains reachable. Delivery still requires a real submission and receipt check.

## Native filtering and indexing

Colour and Finish are merchant-owned metaobjects referenced by product metafields, with public storefront access. Thickness is a variant option. Configure those three native filters in Shopify Search & Discovery; theme markup alone cannot enable store-level filters. The theme reads Shopify’s filter values and counts, renders colour swatches, and uses the Section Rendering API for results, sort and pagination. Requests cancel older work; cached responses and browser Back/Forward also synchronize title, description, canonical and robots metadata.

Base collections and ordinary pagination are indexable with self-canonicals. Filtered, sorted and tagged collection views use `noindex, follow` and canonicalize to the base collection. Internal search is noindex. A valuable combination such as White Quartz should be a dedicated collection with original content, rather than an indexed filter URL. Product/collection description fallbacks and one page H1 support the normal pages.

## Performance and SEO

The baseline and later measurements live in [docs/lighthouse/](docs/lighthouse/). A result is valid only for the recorded URL, rendered theme and timestamp; a published-store audit does not prove that local changes are deployed. Targets are mobile Performance ≥80, LCP <2500 ms and CLS <0.1. Lab measurements do not establish field Core Web Vitals.

The original homepage baseline on 20 November 2026 recorded Performance 38, LCP 6304 ms and CLS 0 (Lighthouse 13.5.0, default mobile simulation). It predates deployment of this change. Do not interpret a new workload page as a directly comparable before/after pair with the original homepage.

The retained preview was measured three times per page. Median results were home **55 / 5791 ms / 0 CLS**, product **67 / 5373 ms / 0 CLS**, collection **71 / 3172 ms / 0 CLS**, and assessment workload **85 / 3626 ms / 0 CLS**. All four pages fail the complete budget because LCP remains above 2500 ms; the normal pages also fail the performance score target. Full HTML/JSON and per-run failures are saved under `docs/lighthouse/after/`. These local remote-page audits identify the rendered theme but do not cryptographically associate it with the current Git commit; the CI upload manifest provides that association when credentials are configured.

Concrete theme improvements include cached responsive WebP illustrations in place of repeatedly painted SVG turbulence, eager/high-priority above-fold hero media, explicit image dimensions, lazy loading below-fold product media, conditional card/section assets and moving first-paint styles/font hints before Shopify’s streamed header content. Shopify’s required `content_for_header` remains intact. Platform pixels, account scripts and apps can still affect load time.

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

See [docs/VERIFICATION.md](docs/VERIFICATION.md) for confirmed checks and pending external gates. GBP is a store/market setting: displaying a pound sign over USD prices would be incorrect. Native filter activation, GBP configuration, Admin order visibility, quote receipt, performance targets and a credentialed CI audit remain outstanding. Browser checks confirmed dimension properties and matching totals in the cart drawer and checkout; no order or contact email was submitted.

With more time: enforce worktop validation server-side with a Function, use approved photography and genuine customer reviews, add measured field monitoring, and test a representative large native catalogue. The theme paginates server-side; it does not download the full catalogue to simulate filtering.
