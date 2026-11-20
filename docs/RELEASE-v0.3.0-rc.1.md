# v0.3.0-rc.1

Release candidate for the Work-Tops assessment. Existing feature history and version tags are preserved.

- Fix escaped cart property rendering, exact area-unit validation, quote context recovery and AJAX/search/SEO race handling.
- Preserve the existing illustrations as responsive WebP assets, prioritize hero media and reduce unnecessary card assets.
- Add a separate large assessment homepage with product/story carousels, 48 labelled demo reviews and accessible navigation.
- Add push/PR CI with Theme Check, regression tests, unique unpublished preview uploads, three mobile audits per route, strict budgets, artifacts and safe cleanup.
- Include written answers, before/after reports, Rich Results evidence and explicit remaining gates.

Validation: six regression test files pass; Theme Check has zero errors and two inherited warnings. Google Rich Results code test has three valid items. The preview is https://mi-task-store.myshopify.com/?preview_theme_id=190265196835.

This is not a completed performance release: every measured route exceeds the 2500ms LCP budget. Native Colour/Finish/Thickness filters, GBP configuration, completed-order Admin verification, quote receipt, full tablet/touch coverage and the Theme Access CI secret remain outstanding. See VERIFICATION.md for evidence and limits.
