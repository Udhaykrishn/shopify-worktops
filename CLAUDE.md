# CLAUDE.md

Shopify Developer Practical Assessment (2–5 yrs) for **Work-Tops**, a UK store selling stone worktops cut to size. The work is an Online Store 2.0 theme built on **Dawn**, in the candidate's own development store.

- Brief and task checklist: [TASKS.md](TASKS.md)
- Stack, data model, folder layout, security and performance rules: [ARCHITECTURE.md](ARCHITECTURE.md)
- Read the relevant section of both files before starting any task.

## Hard rules

- **Never touch the live store (work-tops.com).** Work only in the dev store.
- **Stack is fixed:** Liquid + Dawn + vanilla JS (Custom Elements) + plain CSS. Don't add React, Vue, Tailwind, jQuery, Hydrogen, a bundler or an external database.
- **Never put secrets in the theme.** Theme code is public. No Admin API tokens.
- **Time box is about 4h (5h max).** Prefer extending Dawn over rewriting it. Scoring weights: Tasks 1+2 = 35%, code quality = 25%, Task 3 = 15%, written = 15%, Task 4 = 10%.
- Ask before `shopify theme push/publish`, `git commit` and `git push`.

## Commands

```bash
shopify theme dev --store <store>.myshopify.com     # local preview with hot reload
shopify theme check                                  # lint, must show 0 errors
shopify theme push --unpublished --store <store>     # preview theme for the submission link
npx prettier --check "**/*.{liquid,js,css,json}"     # formatting
```

## Code conventions

- **Theme folders are flat and fixed.** Group files with a prefix per feature: `worktop-*`, `quote-*`, `facet-*`, `seo-*`, `structured-data-*`, `faq-*`, `mega-menu-*`.
- **Liquid:** use `{% render %}` (never `include`) and document each snippet's parameters at the top. Merchant-changeable values go in schema settings or metafields. All text goes through `{{ 'key' | t }}` with keys in `locales/en.default.json`. Escape user input (`| escape`). Pass data to JS with `| json`.
- **JS:** one Custom Element per feature in `assets/<feature>.js`, loaded with `defer` from its own section. Keep maths in small pure functions. Use `textContent` instead of `innerHTML` with user data. Use `AbortController` for fetches.
- **CSS:** BEM-style class names scoped to the component, Dawn's CSS variables, mobile-first, no `!important`. Reserve space for dynamic text so nothing shifts.
- **Accessibility:** labels, `aria-describedby`/`aria-invalid` for errors, `aria-live` for the price, `aria-expanded`/`aria-controls` for toggles, full keyboard support.
- **Commits:** one feature per commit, conventional style: `feat(worktop): …`, `fix(a11y): …`, `perf(home): …`, `docs: …`.

## Shopify tooling: use it, don't guess

Three official Shopify sources are available. Use them in this order:

| Tool | What it gives | When |
|---|---|---|
| **Shopify AI Toolkit: `shopify` skill** (plugin `shopify-ai-toolkit`) | Topic rules (`references/<topic>.md`), docs search and validators (`scripts/search_docs.mjs`, Liquid/GraphQL validation) | **Load first** for any Shopify work. Topics for this project: `liquid`, `custom-data` (metafields and metaobjects; **must** be loaded before any metafield/metaobject work), `use-shopify-cli`, `admin` (only for import/seed scripts), `functions` (only for the bonus) |
| **Shopify Dev MCP** (`shopify-dev-mcp` in `.mcp.json`) | `learn_shopify_api`, `search_docs_chunks`, `validate_theme` as MCP tools | Docs lookups and theme validation, especially inside subagents with restricted tools |
| **claude.ai Shopify connector** | Read and write the dev store (products, metaobjects, GraphQL) | Only after the user authenticates it in claude.ai connector settings. Read-only checks by default; write to the store only when the user asks |

Rules:
1. **Before writing Liquid**, load the `shopify` skill, read its `liquid` topic (and `custom-data` if metafields or metaobjects are involved), then search the docs for the specific feature (storefront filtering, Section Rendering API, line item properties, cart AJAX API, contact form).
2. **After editing theme files**, run the toolkit's Liquid validation or the MCP's `validate_theme`, **and** `shopify theme check`. Fix every error before a task counts as done.
3. Don't use the deprecated toolkit stubs (`shopify-liquid`, `shopify-custom-data` and so on); they only redirect to `shopify`. The `shopify-devkit` and `shopify-app-builder` plugins overlap with the toolkit, so prefer the official toolkit to keep one source of truth.

## AI agent workflow

Project subagents are in `.claude/agents/`. The **main session orchestrates**: subagents can't start other subagents, so the main session passes each agent's output to the next one.

```
  ┌─────────────┐   ┌──────────────────┐   ┌───────────────────────────────┐   ┌─────────────┐   ┌────────┐
  │ 1. PLAN     │──►│ 2. BUILD         │──►│ 3. REVIEW (in parallel)       │──►│ 4. DOCS     │──►│5.COMMIT│
  │ shopify-    │   │ liquid-developer │   │ cart-security-reviewer        │   │ docs-writer │   │ main   │
  │ architect   │   │ validate_theme + │   │ perf-seo-auditor              │   │ README/     │   │ (asks  │
  │             │   │ theme check      │   │ a11y-qa-tester                │   │ ANSWERS     │   │ user)  │
  └─────────────┘   └──────────────────┘   └──────────────┬────────────────┘   └─────────────┘   └────────┘
                             ▲                            │ findings
                             └──── fix loop (max 2) ──────┘
```

| Step | Agent | Input → Output |
|---|---|---|
| 1. Plan | `shopify-architect` | Task section from TASKS.md → file list, data model, approach, risks (no code) |
| 2. Build | `liquid-developer` | The plan → working code, `validate_theme` and `shopify theme check` clean |
| 3a. Review | `cart-security-reviewer` | Diff → findings on cart integrity, input validation, XSS, spam (Tasks 1, 2, cart drawer) |
| 3b. Review | `perf-seo-auditor` | Diff or URL → Lighthouse numbers, image/script issues, headings, JSON-LD, canonical/noindex (Task 3; also Task 2 SEO) |
| 3c. Review | `a11y-qa-tester` | Running preview → keyboard, ARIA, responsive and CLS findings with steps to reproduce (all UI tasks, Task 4) |
| 4. Docs | `docs-writer` | What was built + review notes → README section, Task 5 answers, commit message |
| 5. Commit | main session | Proposes the commit and runs it after the user approves |

**Which reviewers to run for each task**

| Task | Reviewers |
|---|---|
| Task 1: worktop configurator, cart integrity, quote form | cart-security + a11y |
| Task 2: metaobjects, filters, swatches, AJAX, SEO rules | cart-security (input/URL handling) + perf-seo + a11y |
| Task 3: homepage performance, JSON-LD, meta | perf-seo |
| Task 4: mega-menu, FAQ, image CLS | a11y + perf-seo (CLS) |
| Task 5 and README | docs-writer only |

**Definition of done (every task)**
- [ ] Meets every numbered requirement for that task in TASKS.md
- [ ] `validate_theme` and `shopify theme check` show 0 errors
- [ ] Reviewer findings fixed, or listed in the README as known trade-offs
- [ ] Works on mobile and desktop, and with keyboard only
- [ ] README section written, commit proposed
