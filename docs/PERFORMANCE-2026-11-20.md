# Performance optimization — 20 November 2026

Scope: improve Lighthouse performance without changing the existing design, layout or functionality. The current user targets are **Performance >90, LCP <2500 ms and CLS <0.1**. Every measured run must pass all three; a passing median alone is insufficient.

The candidate is the unpublished [Work-Tops performance review theme](https://mi-task-store.myshopify.com/?preview_theme_id=190267228451). The published development-store theme was not changed by this optimization pass.

## Measurements

Lighthouse default mobile simulated throttling, three runs per page, on theme **190267228451**. [HTML/JSON reports and all per-run results](lighthouse/optimization-2026-11-20/verified-performance/summary.md) are retained. Earlier trials are exploratory, not a matched before/after comparison.

| Page | Median score (range) | Median LCP (range) | Median CLS (maximum) |
|---|---:|---:|---:|
| Home | 93 (89–96) | 2.156 s (2.019–3.078) | 0 (0) |
| Product | 92 (90–93) | 2.607 s (2.319–3.078) | 0 (0) |
| Collection | 79 (75–84) | 4.549 s (4.078–5.335) | 0 (0) |
| Assessment workload | 92 (91–95) | 2.283 s (2.160–2.505) | 0 (0.039) |

**The complete target is not achieved.** Home and assessment medians pass all three targets, but each has one failing run. Product median LCP remains over 2.5 s. Collection score and LCP fail on all three runs. CLS passes throughout. The strict every-run audit therefore exits with failure.

## Changes

| Optimization | Reason and boundary |
|---|---|
| Inline critical styles in their original cascade positions | Removes separate render-blocking requests. CSS declarations and rule order are preserved. Larger sources are split only between complete rules to meet Shopify's inline asset limit. |
| Load optional section styles only when used | Avoids loading slider, rating, deferred-media and drawer recommendation styles when the corresponding content is absent. |
| Move font preload hints before large styles | Starts the same configured fonts earlier without changing typography. |
| Reduce the current Fraunces font file | Freezes unused SOFT/WONK axes at their existing defaults while preserving the optical-size axis and all 355 mapped characters. Its file shrinks from 79,436 to 45,204 bytes (43%). DM Sans remains unchanged. |
| Preload existing responsive product and collection artwork | Starts the likely above-fold image sooner. The preload uses the existing responsive image sizes and excludes native media, unknown artwork and later collection pages. |
| Keep the audit preflight tab blank during measurement | Prevents a second storefront instance from competing with the measured page. This changes the test runner, not the storefront. |

Shopify's required header content, platform scripts, customer accounts, payments and existing interactions remain enabled. No performance budget was relaxed.

## Design and checks

The [final comparisons](lighthouse/optimization-2026-11-20/verified-visual-check.json) match measured geometry and styles on home, product and collection at 390, 768 and 1440 px with the optimized font active. All nine have one H1 and no horizontal overflow. The tablet product repeat explicitly waited for lazy recommendations on both themes before comparing 41 elements. These are geometry/style checks, not pixel-for-pixel screenshot equality.

Font verification records all 355 mapped characters, matching advances and line metrics, a retained optical-size axis and at most half a font unit of outline rounding. Fifteen browser text cases had zero measured width difference with the optimized Fraunces request confirmed. Source hashes, verification results and the retained SIL OFL notices accompany the font asset.

Regression tests verify that generated CSS reconstructs each original stylesheet byte-for-byte, keeps inline assets below Shopify's size limit, preserves relative asset resolution and matches responsive preload conditions. The latest regression run passed 33 tests. Theme Check reported zero errors and four warnings; the toolkit validator also reported zero errors.

## Regenerating and measuring

Edit the original stylesheets, then regenerate their inline copies:

```bash
node scripts/critical-css.mjs
npm test
npm run check:theme
```

Generated font assets are included with the candidate. To regenerate them, use `python scripts/optimize-fonts.py` with development packages `fonttools==4.68.0` and `brotli==1.2.1`; the script verifies the downloaded source hashes before writing assets.

After an approved upload to the candidate theme, run:

```bash
LIGHTHOUSE_RUNS=3 \
LIGHTHOUSE_BASE_URL='https://mi-task-store.myshopify.com/?preview_theme_id=190267228451' \
LIGHTHOUSE_OUTPUT_DIR=docs/lighthouse/optimization-2026-11-20/verified-performance \
LIGHTHOUSE_LABEL=verified-performance \
CHROME_PATH=/usr/bin/google-chrome \
node scripts/lighthouse.mjs
```

The runner checks the returned page and theme ID, saves HTML/JSON reports and fails when any run misses a budget. Remote preview results identify the rendered theme; they do not prove that a dirty local checkout exactly matches every remote file. Lab results do not establish field Core Web Vitals.
