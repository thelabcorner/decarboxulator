# Decarboxulator V4: SEO and Lighthouse migration QA; 2026-10-12

## Baseline: independent production Lighthouse 12.8.2 (mobile)

| Route | Performance | Accessibility | Best Practices | SEO | FCP | LCP | TBT | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| / | 98 | 95 | 96 | 100 | 2.0s | 2.0s | 40ms | 0 |
| /tools/thca-to-thc/ | 85 | 95 | 96 | 100 | 2.0s | 3.9s | 80ms | 0 |
| /faq/ | 98 | 94 | 96 | 100 | 1.8s | 2.0s | 50ms | 0 |

Canonical production: https://thelabcorner.github.io/decarboxulator/ while the custom domain is unresolved.

## What the supplied SEOptimer screenshots mean

The screenshot displays an old Redirecting to Calculators intermediary, not the canonical V4 calculator. Meta-description, schema, sitemap and robots recommendations for that intermediary are not evidence that V4 destination pages lack those elements. The V4 destinations already scored 100 Lighthouse SEO.

## Changes

- Removed restrictive mobile viewport maximum-scale/user-scalable settings so pinch zoom works.
- Raised mobile reading sizes for home tool listing, workbench copy, FAQ and scientific explanations while preserving compact zinc/New York layout.
- Rebuilt V3 migration fallback using authentic Activation Delta geometry, restrained zinc surfaces, brand lime, responsive light/dark styling, direct destination labels, creator and GitHub credits.
- Updated headline to 'Upgrading your experience.' and the destination call to action to 'Continue to [calculator]'.
- Preserved zero-second HTML meta-refresh, JS location.replace, all 15 original legacy mappings and 13 aliases, matching canonical, query-string preservation and reverse-conversion hash behavior.
- Added scripts/qa-legacy-migration.mjs to validate navigation and mobile fallback in Chrome in both themes.

## Verification

Production build: 11 prerendered canonical routes, 15 historical redirects, 13 extensionless aliases, two retired predictor notices.
Automated tests: 151 passed. Internal crawl: 202 internal links across 11 pages, no dangling routes. FAQ parity: 85 Q/A pairs. Browser migration: 46 checks passed. Lint: zero errors, eight preexisting warnings.

Local Lighthouse (concurrent localhost runs) returned 100 accessibility and 100 SEO for all three canonical routes. Mobile legible-text coverage increased to 59.65% on home, 92% on the forward calculator and 97.55% on FAQ. Because those three local runs were simultaneous and resource-contended, their ~60 performance scores are NOT directly comparable to the independent production baseline. Re-run sequentially on deployed production to assess speed.

## Ongoing strict SEO preservation rule

Do not delete, exclude via noindex, or change indexed V3 redirect endpoints without confirmed replacement evidence. Keep V4 canonicals on the working GitHub Pages host until the custom DNS is actually live. Measure Google-selected canonical, index coverage, queries and impressions in Search Console before changing established page topics/titles.

## Next

Investigate forward converter 3.9s LCP via Chrome tracing and bundle coverage; repeat mobile lighthouse after deployment; keep any future performance optimizations regression-gated.
