# Front-end verification

All checks target unpublished theme 190265196835, not work-tops.com.

| Problem | Cause | Fix and evidence |
|---|---|---|
| New assessment menu opened with Enter but did not close with Escape or update aria-expanded | Dawn initializes disclosure accessibility for IDs beginning `Details-`; the new menu originally lacked that prefix | Renamed the disclosure to `Details-AssessmentMenu`. Browser Enter opened it with aria-expanded=true; Escape closed it, restored focus to the summary and set aria-expanded=false. |
| Large nested menu needs a narrow-screen layout | An absolutely positioned multi-column desktop panel can overflow a small header | Assessment panel uses normal flow and one column on mobile, two columns at tablet CSS breakpoint, and a bounded scrolling four-column desktop panel. Mobile 375px DOM check showed static positioning and no horizontal overflow. |
| FAQ requires keyboard support | Click-only panels omit native disclosure behaviour | Existing homepage FAQ retains native details/summary and Dawn initialization. Enter opened the first item and aria-expanded became true in the browser. |
| Repeated decorative images consume rendering work | Each old SVG paints several multi-octave turbulence filters | Cache the preserved drawings as responsive WebP images. The assessment preview rendered 62 img elements and 48 clearly labelled review samples; explicit dimensions and existing aspect ratios reserve space. |
| Nonblocking drawer CSS trial caused CLS about 0.58 | The drawer’s positioning CSS was also deferred, letting its initial markup affect document flow | Reverted that trial; drawer styles remain critical. Rejected reports are preserved in `lighthouse/rejected-async-css/`. Use only the final `lighthouse/after/` results for the retained version. |
| Article adapt image sizing used the wrong context | Card consulted section.settings instead of its documented media_height argument | Use the passed argument so the image ratio is reserved consistently wherever the card is reused. |

Cart browser check: 299mm length displayed the minimum error, aria-invalid=true, and a disabled Add to cart button. At 1000×600mm, billed area became 0.60m² and total $151.20. The quote modal received the product, variant and size and focused Name. Cart drawer and checkout displayed all three public dimension properties and the same total. Screenshots are in `screenshots/`. No order or contact email was submitted.

Full tablet/touch, every variant, failure recovery and catalogue-scale filter verification must be distinguished from the sampled browser checks above.
