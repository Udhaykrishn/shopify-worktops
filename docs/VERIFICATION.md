# Verification evidence

Updated 20 November 2026. Statuses distinguish source tests from deployed behaviour.

| Gate | Evidence / status |
|---|---|
| Connected store | Shopify MCP independently verified Mi-Task. Current currency USD; store-level GBP change pending Admin access. |
| Existing catalogue | Admin read returned 28 active products; public Colour/Finish reference definitions and integer dimension fields exist. |
| GitHub repository | Private Udhaykrishn/shopify-worktops-assessment created; remote linked. Release candidate v0.3.0-rc.1 prepared for the approved push. |
| Theme Check | Final retained source: 0 errors, 2 warnings. Saved in theme-check.json. Warnings concern inherited orphaned quick-order-product-row and valid Liquid offset: continue. |
| Toolkit validation | Core, raster, assessment and retained layout changes passed during implementation. A final repeat was refused by the MCP tool's approval policy; no new pass is claimed for that repeat. |
| Regression tests | All 6 test files pass: cart Liquid/property URLs, quote recovery, AJAX metadata/races, Lighthouse budgets, preview identity and all 84 WebP sizes. |
| Baseline mobile home | before-home.json/html: Performance 38, LCP 6303.7115 ms, CLS 0; published theme, 20 Nov 2026. |
| After mobile performance | Three runs/page against unpublished theme 190265196835. Medians: home 55 / LCP 5791ms, product 67 / 5373ms, collection 71 / 3172ms, assessment 85 / 3626ms. All CLS 0. Full budgets FAIL; see lighthouse/after/summary.md. |
| Native filters | Definitions verified; deployed collection exposed Availability only. Colour/Finish/Thickness activation pending Search & Discovery Admin access. |
| Rich Results | Google code test found 3 valid items; non-critical Product/Merchant Listing issues remain. URL test could not crawl preview. Source and screenshots saved; see RICH-RESULTS.md. |
| Cart → checkout → Admin | Browser sampled 1000×600mm: 60 billing units, $151.20, all public dimension properties present in cart drawer and checkout. Admin visibility needs a completed test order; no transaction was created. |
| Quote delivery | Pending intentional submission and receipt; local recovery/spam checks alone do not prove delivery. |
| Keyboard/tablet/mobile/CLS | Menu Enter/Space/Escape and focus restoration sampled; FAQ Enter and 375px overflow check passed. Three retained mobile lab runs/page measured CLS 0. Full tablet/touch coverage is pending; see FRONTEND-FIXES.md. |
| CI secrets / run | Workflow prepared and SHOPIFY_CI_ENABLED=true verified. Theme Access Actions secret is missing, so the hosted performance job cannot create its audit theme. No hosted performance success claimed. |

The original homepage is preserved; `/?view=assessment` adds product carousels, eight demo stories, 48 labelled sample reviews and the assessment mega-menu. The retained draft is unpublished; the store's main theme was not changed.

The initial homepage baseline is not a before measurement of the subsequently created larger assessment workload. Record the first workload measurement separately and compare later tuning on the same workload.
