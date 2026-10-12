# Decarboxulator editorial and search standards

## Purpose

Decarboxulator is a calculator studio for cannabinoid stoichiometry, formulation, and measurement. Its interface should read like technical software. Do not introduce landing-page slogans, subscriptions, conversion funnels, inflated product claims, or pseudo-scientific certainty.

Editorial reference: [Peter Yang's No AI Slop](https://github.com/petergyang/no-ai-slop), particularly `skills/no-ai-slop/SKILL.md` and `eval.md`. Apply the portability test: a sentence that could appear unchanged in another calculator's UI needs a more specific purpose or removal.

## Two separate copy layers

- **Application headings and descriptions**: concise and task-oriented. Tell the user what to enter and what the tool returns. These live in `TOOLS[].heading` and `TOOLS[].summary` in `src/lib/site.ts`.
- **Search metadata**: individual, descriptive titles and snippets covering the actual calculator, its inputs and its most consequential assumptions. These live in `TOOLS[].title` and `TOOLS[].description`. Do not render long SEO titles in the workbench simply to insert more keywords.

All titles and snippets must be grounded in implemented behavior. Avoid multiple pages that differ only by a generic suffix. The THC → THCa route is **inverse planning**, not a reverse chemical reaction. The progress tracker measures apparent CO₂-based completion; it does not assay cannabinoids. The pressure calculator is a restricted ideal-gas model; it does not calculate a pressure-rated vessel limit.

## Scientific writing

- Name the compound, model, unit, and assumption rather than calling a result \"accurate\" or \"precise\" in the abstract.
- Use **theoretical** for 314.46/358.47 mass equivalence and **estimated** or **apparent** for quantities inferred from mass loss.
- Do not label expected CO₂ loss as observed conversion without stating the CO₂-only assumption.
- Explain assumptions where users interpret a result, not in a promotional hero block.
- Keep distinct THC, THCa, CBD, CBN and CBG quantities separate; avoid collapsing dose totals without explicit equations.
- Preserve source links to PubChem and published analytical references. Do not introduce unverifiable yields, safety guidance or kinetic guarantees.

## Crawl and share requirements

- Every calculator and the science reference must prerender unique HTML with exactly one H1, one canonical URL, an individual title and description, and visible, readable reference content.
- The home page lists all eight **calculator routes**. Forward and inverse routes share the same conversion engine, but have separate URLs, headings and search intent.
- The science guide and calculator FAQs must remain synchronized with their JSON-LD, and all questions and answers must appear in prerendered HTML. Google ended FAQ rich results in May 2026, so this markup is descriptive only, not a ranking tactic or rich-result promise.
- Route OG images are static Satori PNGs, 1200 × 630. Do not introduce server-generated or per-user preview images without a new product decision.
- Keep user-input snapshot URLs shareable without exposing saved-library data. The canonical URL excludes query-string state.
- Keep old V3 URLs redirected without indexing duplicate content.
- Preserve the historical V1/V2 `.html` paths and the extensionless paths used by the original navigation. Redirect only to an equivalent calculation. The nonfunctional experimental time predictor needs an explicit noindex retirement notice, not an invented completion-time calculator.
- Avoid unsupported credentials, claims of medical expertise, product advertisements, and generic \"best ever\" language.

## Maintenance checks

Run `npm test`, `npm run typecheck`, `npm run build` (which includes Satori rendering, prerendered SEO and FAQ verification), and `npm run test:ui` when changing route headings or navigation. `tests/editorial-seo.test.ts` checks distinct copy, mathematical caveats, sitemap-route-to-OG data correspondence, publisher identity and the homepage directory.

Google's [title-link guidance](https://developers.google.com/search/docs/appearance/title-link) and [snippet guidance](https://developers.google.com/search/docs/appearance/snippet) favor concise, distinctive, useful text. Google's [May/June 2026 FAQ changes](https://developers.google.com/search/updates) ended FAQ rich results entirely; keep the visible Q&A for readers, not search decoration.
