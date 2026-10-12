# Decarboxulator V4 — SEOptimer follow-up and root discovery repair

Date: 2026-10-12. Scope: published GitHub Pages origin `https://thelabcorner.github.io/`, calculator prefix `/decarboxulator/`, and historic V3 indexed URLs.

## Findings traced to their actual owner

- V4 in `thelabcorner/decarboxulator` already generates `/decarboxulator/sitemap.xml` (11 canonical pages) and a **prefix-scoped** `/decarboxulator/robots.txt`, as well as the historic sitemap at `/decarboxulator/resources/assets/sitemap.xml`.
- The host root is owned by `thelabcorner/thelabcorner.github.io` and had neither `/robots.txt` nor `/sitemap.xml`; real HTTP requests returned 404. A path-level robots.txt is not the host-level crawler policy. This is the true technical deficiency behind SEOptimer's missing sitemap/robots findings.
- The homepage's former 65-character title and long meta description could be made more concise. The initial HTML included roughly 234 text tokens with only H1/H2 headings; the revised homepage includes scientific material, a more informative heading structure, and four additional internal links.
- Unicode CO₂ occurs throughout route metadata, visible UI, FAQ answers and Satori previews. Standardize displayed text on `CO2` to match ordinary user searches while keeping the chemistry and quantitative definitions unchanged.

## Changes

1. In the **user-site root repository**, add an actual root `robots.txt` with `Allow: /` and a `Sitemap:` pointer. Do not interfere with other hosted projects such as `/apollonian-gasket/`.
2. Add root `sitemap.xml` as a standards-compliant sitemap index, referencing the existing *dynamically generated* V4 sitemap. No duplicate hard-coded 11-route ledger, and no redirected V3 URLs in the canonical sitemap.
3. Extend root repository CI to validate sitemap and robots files whenever either file changes.
4. In V4, replace Unicode chemical subscripts in human-facing text and OG previews. Preserve molecular formulas numerically and model calculations exactly as before.
5. Shorten homepage, all eight calculator, FAQ, and reference search titles; keep route-specific, scientifically honest descriptions at or under 160 characters.
6. Add practical stoichiometric explanation beneath the workbench and directory: 0.87723 ratio, theoretical example, mass-balance caveats, and links to specialized calculators. Maintain the premium zinc workbench above the fold.
7. Strengthen the build-time SEO contract: all 11 prerendered pages require canonical URLs, no Unicode CO₂, title length <= 60 visible characters, and description length <= 160 characters.

## Preservation gate

- Absolutely no changes to historic V3 path routing, reverse-hash behavior, existing canonical sitemap URLs or permanent-move mechanisms.
- No noindex on migrating URLs; no new duplicate canonical destinations; no custom-domain switch until DNS is operational.
- Verify browser navigation and Google Analytics routing alongside generated metadata.
- The GitHub user root itself is a redirect and is intentionally **excluded** from the sitemap; the root sitemap is an *index of canonical V4 pages*, not a feed of redirect pages.

## What SEOptimer's remaining requests mean

- **Backlink building:** not technically fixable through page metadata. Requires earned editorial references from relevant scientific/how-to resources; don't buy links or add irrelevant footers.
- **Hreflang:** unnecessary for an English-only site; don't invent nonexistent translations.
- **Local Business schema / business phone and address:** inappropriate for a free scientific web calculator unless a real public business identity and address are intentionally published. Don't fabricate an address.
- **SPF/DMARC:** relevant to the zone's outbound mail authentication, not the app's HTML SEO; adding fictitious DNS records could break mail.
- **Social channels / Facebook Pixel:** account/marketing choices, not proven search-ranking fixes; do not invent a presence or install trackers without purpose.
- **llms.txt:** optional emerging convention, not a substitute for crawler-readable HTML and sitemap; no demonstrated search-ranking benefit.
- **Rendered content:** avoid arbitrary word-count stuffing. Content was expanded only with accurate, user-facing explanations; scientific FAQ pages remain independently crawlable.
- **Mobile PageSpeed:** measure via Lighthouse on the deployed version; a per-page lab score is not proof of real-world Core Web Vitals.

## Follow-up measurement

After production deployment, verify HTTP 200 and XML/robots MIME types at the root URLs and the existing nested sitemap; verify all 11 canonical pages match the sitemap; run mobile Lighthouse on root V4, forward calculator, and FAQ. Track Google-selected canonicals, indexed migration URLs, query impressions and clicks in Search Console. Ranking gains are not inferred from test passes.
