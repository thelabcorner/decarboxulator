# Decarboxulator™ v4

A mobile-first cannabinoid **calculator studio** built with React 19, TanStack Start/Router, TypeScript, and Vite. The design adopts the compact, professional zinc/New York vocabulary of Gallery and the Zoomport playground, including the identical green accent (`#aaff00`). No Bootstrap, no default-blue component theme.

This is the Decarboxulator V4 source tree. The main branch publishes the prerendered site through the GitHub Pages deployment workflow. Historical calculator URLs are preserved by equivalent-tool redirects.

## Run

```bash
npm ci
npm run dev
npm test
npm run build
```

Development server: `http://localhost:3000` by default; Vite automatically selects an available port when this one is occupied. The current development studio is also reachable at `http://localhost:42061` (bound to `0.0.0.0` for same-LAN mobile testing).

To verify the compiled production app in locally installed Chrome or Edge:

```bash
npm run build
npm run test:ui
npm run test:calculators
npm run test:offline
npm run test:tracker-ui
npm run test:webkit
```

Both browser suites take an immutable snapshot of `dist/client` and start a temporary, loopback-only HTTP server automatically. This prevents concurrent Vite rebuilds from changing fingerprinted assets during a test run. Set `SMOKE_URL` only when intentionally testing another server. The responsive suite discovers and checks all routes (currently eleven) across 320/375/430/768/1440px, including command search, mobile viewport/keyboard constraints, independent scrolling, saved calculations, sharing, and native-install gating. The offline suite verifies service-worker activation, cached calculator navigation and hydration with the network disabled, and route-specific scroll restoration. The UI suite additionally runs mobile/desktop WebKit geometry tests (including a simulated keyboard-constrained viewport) and checks the tracker's horizontal measurement-log ScrollView. `test:webkit` runs that cross-engine stage without the longer Chromium suite. Desktop Playwright WebKit with iPhone viewport emulation is not a substitute for a physical iOS Safari test. Mobile keeps the status bar consistently hidden, rather than letting input focus shift the tap targets. Screenshots are written to ignored `artifacts/`.

## Architecture

| Location | Responsibility |
|---|---|
| `src/lib/decarb.ts` | Pure, deterministic chemistry functions; internal masses in grams |
| `src/lib/pressure.ts` | Fixed-headspace ideal-gas pressure model and validated temperature units |
| `src/components/PressureWorkbench.tsx` | Dedicated pressure instrument: editable gas assumptions, parameter inspector, responsive operating-point analysis |
| `src/components/PressureHeatmap.tsx` | 7×7 selectable pressure field, 5×5 mobile view, current-scenario crosshair, keyboard inspection |
| `src/lib/cartridge.ts` | Target-fill inverse mass balance, THCa treatment, and compound accounting |
| `src/lib/history.ts` | Versioned local calculation library with validated imports and exports |
| `src/lib/trackerSessions.ts` | Versioned IndexedDB laboratory runs, atomic initialization, validation, legacy recovery |
| `src/lib/useTrackerSessions.ts` | Session lifecycle, queued autosave, completion, editing, reload recovery and save-state reporting |
| `src/lib/trackerBackup.ts` | Strict individual/session-archive JSON backup, validated import, safe deduplication |
| `src/components/TrackerWorkbench.tsx` | Technician-first Setup → Monitor → Analysis → Log with gravimetric interpretation |
| `src/components/TrackerSessionLibrary.tsx` | Searchable on-device run library, completion, reopen, duplicate and portable backup |
| `src/lib/share.ts` | Validated, versioned and portable calculation URL snapshots |
| `src/lib/trackerSessions.ts` | Schema-validated IndexedDB lab sessions and atomic writes |
| `src/lib/trackerBackup.ts` | Strict portable tracker archives, round-trip export/import and collision-safe restore |
| `src/components/TrackerSessionLibrary.tsx` | On-device run review, archival exports and deliberate JSON recovery |
| `src/lib/site.ts` | Central tool registry; metadata, canonicals, JSON-LD |
| `src/components/ui.tsx` | Reusable dense UI primitives: Panel, FieldGrid, Selector, Metric, Results, Notices |
| `src/components/NumberField.tsx` | Accessible numeric input with validation |
| `src/components/Calculators.tsx` | State-driven calculator interaction panels |
| `src/components/CalculatorStudio.tsx` | Shared compact calculator application shell: live KPI, keyboard-accessible Calculator/Breakdown/Heatmap tabs, route-preserving input state |
| `src/components/CalculatorStudio.css` | Premium tracker-aligned New York/zinc density, mobile-first 320px layout and light/dark parity |
| `src/components/StudioLayout.tsx` | Responsive navigation, shell, user theme preference |
| `src/components/ShareDialog.tsx` | Compact link sharing with clipboard and native mobile sharing |
| `src/components/ActivationDeltaMark.tsx` | Theme-aware Activation Delta brand symbol in the always-visible rail |
| `src/components/ScrollView.tsx` | Shared native-momentum ScrollView, compact overlay thumbs and per-route scroll restoration |
| `src/components/InstallAppDialog.tsx` | Explicitly invoked, platform-aware PWA installation guide |
| `public/brand/activation-delta.svg` | Canonical mint delta + molecular group, source for favicons, app icons and social previews |
| `src/routes/` | Independent, indexable calculator and science pages |
| `tests/decarb.test.ts` | Stoichiometry, inverse consistency, mass conservation, invalid data |
| `tests/scientific-audit.test.ts` | Reference-mass checks, dimensional analysis, stoichiometry and physical limits |
| `tests/pressure-study.test.ts` | Independent pressure derivation, finite-difference sensitivity checks, 1,200 parameter sweeps, axis and unit invariance |
| `tests/scientific-property.test.ts` | Thousands of deterministic model-invariant test cases |
| `SCIENTIFIC_VALIDATION.md` | Equation ledger, source links, assumptions, evidence boundary and test contract |
| `scripts/verify-seo.mjs` | Check prerendered HTML structure, canonical, structured metadata |
| `scripts/generate-seo.mjs` | Generate sitemap and robots from built and canonical-validated route pages |
| `scripts/og-pages.json` | Curated route-specific Satori artwork content |
| `scripts/og-registry.mjs` | Discover all static routes and automatically add social-preview defaults; fail on orphan curated entries |
| `scripts/render-assets.mjs` | Render OG PNG and app icons from editable SVG assets |
| `scripts/generate-offline.mjs` | Generate a scoped, versioned offline cache for prerendered calculators and assets |
| `scripts/qa-snapshot-server.mjs` | Isolate production browser QA from concurrent builds |

The `Inter Variable` font is self-hosted through the package build. Theme settings are persisted in browser localStorage; no analytics or user accounts are required.

## Progress tracker laboratory sessions

The progress tracker has been rebuilt around independent laboratory runs. New runs open in **Setup**; configure the empty-vessel tare, source THCa assay/mass and balance readability, then begin recording. **Monitor** captures vessel+contents mass, timestamp, optional independently observed temperature (°C), and a technician note. **Analysis** retains the gravimetric composition, CO₂-loss and rate plots; **Log** provides timestamped reading review. A session can be paused and resumed, manually marked complete, reopened, cloned as a new setup, or removed after confirmation. Closing the run records its workflow status; **it does not assert 100% chemical conversion**.

Run records are saved in IndexedDB database `decarboxulator-v4-tracker` (stores `sessions` and `meta`). Writes are serialized and the UI announces *Saved* only once the write transaction completes; storage errors remain visible and permit retry. Creating the first session is atomic across concurrent starts/StrictMode. The previous `decarboxulator-v4:workspace:tracker` localStorage record is automatically imported once when the IndexedDB collection is empty, without deleting the original. Existing records and unsupported schema versions are never silently overwritten.

Each session currently accepts up to 500 readings; the session library holds up to 500 runs. Use **Sessions → Export all** (JSON) for regular portable backups, **Import JSON** to restore supported records with collision/duplicate handling, or per-session JSON and CSV to inspect and archive measurements. Import is size-bounded, so exceptionally large archives may need to be exported/imported individually. **IndexedDB is device/browser-profile local**, not cloud synchronized or immune to browser storage eviction, private-mode cleanup, or clearing site data. For research-quality records, export and retain independent backups. Other v4 settings and the separate saved-calculations library still use localStorage until their own storage migration; the tracker itself no longer writes run data to localStorage.

Verification: `npm test`, `npm run test:tracker` for Chrome live IndexedDB create/edit/reload/complete/reopen/migration/export, and `npm run test:webkit` for iPhone-sized WebKit UI interactions.

## Active calculators

1. THCa → THC and THC → THCa: two searchable entry routes that share one inverse/forward molecular mass calculator and workspace.
2. Batch yield: theoretical THC, CO₂ mass loss, final mass and concentration.
3. THCa percentage analyzer: infer acid fraction under *strict* all-loss-is-CO₂ assumptions; rejects physically impossible values.
4. Edible formulation: potential THC from THCa and existing THC, explicit acid conversion/recovery percentage, divided by serving count.
5. Vessel pressure: idealized sealed gas pressure, with explicit limits and no inferred vessel-safety rating.
6. Progress tracker: inferred CO₂-only reaction completion using successive weights, rejecting impossible loss.
7. Cartridge formulation: final cartridge fill target back-solved to starting compound masses, explicit THCa conversion/retention mode.

The seven non-tracker workbenches now use the tracker-inspired **Calculator Studio**. Calculator opens with a prominent live result, a compact editable form, and key result metrics. Breakdown shows the full mass balance, output details, and scientific limitations; vessel pressure has a purpose-built interactive pressure landscape, with an accessible selectable scenario grid, 5×5 mobile and 7×7 desktop layouts, and model-assumption controls. Input values, URL sharing, and the saved-calculation library remain owned by the existing calculators and persist when switching views. Header, tab bar, panel density, and responsive layout are shared across routes. `npm run test:calculators` validates the entire family in Chromium and WebKit at four viewport widths, including live recomputation, tab switching, no document overflow, mobile font size, and pressure heatmap navigation.

The reference page explains the 0.87723 mass ratio, equation provenance, and assumptions.

### Portable laboratory records

The progress tracker autosaves individual sessions and readings in the device's IndexedDB. In **Progress tracker → Sessions**, use **Export all** to download a versioned JSON archive of every run, or choose **JSON** on an individual run. **Import JSON** restores either format. Archives are limited to 16 MiB to bound untrusted imports; malformed archives fail as a whole rather than partially importing. A fully populated 500-session library may exceed that limit. In that case, filter by status or batch name and use **Export shown** to create smaller, individually restorable JSON archives. Oversized exports are blocked with a clear message instead of producing an unrecoverable backup. Existing runs and the current selection are retained; repeat imports skip identical runs, identifier collisions receive new identifiers, and imported running sessions reopen as **paused** so they do not resume recording unexpectedly. Only a completed IndexedDB commit means the restored records are durable; watch the save status before leaving the page. Browser storage can be cleared externally, so periodic exported archives remain important. CSV exports are measurement-only and are **not** sufficient to restore a run.

The portable-backup contract is covered by `tests/tracker-backup.test.ts` and `npm run test:tracker-ui`, which verifies export, import, deduplication, rejection, and reload persistence in isolated browser profiles. The snapshot test server supports both `/` and `/decarboxulator/` deployment base paths.

All seven calculator families are represented in V4; feature-level parity against every behavior in the original site still needs independent review. See [SCIENTIFIC_VALIDATION.md](SCIENTIFIC_VALIDATION.md) for assumptions and physical limitations.

## Sharing, SEO & static hosting

The Share panel exposes a versioned `?v=1` snapshot URL with the exact input parameters, copy action, and native device sharing if supported. Legacy parameter-only links are still accepted. Localhost and private LAN links are identified as local-only; the app never silently changes them to an undeployed production host. Social previews use the route image—not a custom server-rendered image of the entered values.

`npm run build` prerenders eleven complete HTML pages into `dist/client`. Each includes a distinct H1, descriptive page content, title, description, canonical URL, Open Graph + Twitter cards, and shared navigational links. Calculator routes expose `WebApplication` JSON-LD; the scientific reference exposes a cited `TechArticle` entity linked to its canonical `WebPage`. The build verifies each relationship and checks that cited references appear in the prerendered HTML. The science guide is indexable without JavaScript execution. The build generates a sitemap from all eleven prerendered pages and validates their metadata. Fourteen source-URL redirects preserve verified historical V1/V2 calculator pages, including old input-finder and rosin-analyzer paths and conversion direction fragments. Thirteen additional directory-index aliases cover the original extensionless navigation links. Both variants are unindexed and excluded from the sitemap. The old nonfunctional time predictor has two unindexed informational pages instead of a misleading calculator redirect. A server supporting HTTP 301/308 should use those instead of HTML redirects. OG previews are generated by **Vercel Satori + Resvg**, without an image-generation API, using the route-aware application-workbench layout in `scripts/render-assets.mjs` and Activation Delta identity. The route registry (`scripts/og-registry.mjs`) discovers every static route: curated copy and numerical references in `scripts/og-pages.json` are used when present; new static routes automatically receive a fallback composition. Orphan or duplicate content fails the asset build. The exported assets are deterministic 1200 × 630 PNGs (one per route), with creator credit to Jackson Cummings, `thedabcorner.site`, and the public GitHub source. `public/og-card.svg` is an optional editable static composition.

Every prerendered route publishes an absolute HTTPS `og:image`, `og:image:secure_url`, dimensions, MIME type, accessible alt text, and Twitter/X `summary_large_image` metadata. Snapchat URL previews, Discord, LinkedIn, Slack, Facebook, WhatsApp, Telegram and Apple Messages generally consume the **same Open Graph preview**, so no platform-specific image generator is necessary. A `twitter:img:src` fallback is also provided for Snapchat's URL Preview Service. The preview URLs are static, publicly fetchable after deployment, and do not require JavaScript or authentication. The SEO verifier asserts exact per-route PNGs, no duplicate pixels, correct sizes, source/creator URLs, and FAQ/TechArticle entity separation. This validates build output, **not** a third-party platform's cache or live crawler response.

Run `npm run assets:render` to regenerate every static route's OG PNGs, SVG favicon, touch icon, and manifest icons after editing `public/brand/activation-delta.svg`. The identity uses Decarboxulator's canonical lime `#aaff00` (the same `--accent` as the application), with the original white molecular branch and round joins. In dark mode the mark is unboxed; in light mode it sits on a zinc-900 ground so the lime and white remain legible without changing brand color. The script also produces a separate full-bleed maskable icon with a safe zone. Keep the React mark and editable `og-card.svg` in sync with the canonical vector paths; `tests/brand.test.tsx` checks geometric parity.

For a **GitHub Pages project site** mounted at `/decarboxulator/`, use:

```bash
npm run build:pages
```

This configures Vite's asset base, TanStack Router's base path, and canonical URL for `https://thelabcorner.github.io/decarboxulator/`. Deploy the contents of `dist/client`. Eleven canonical pages are emitted once: the prerender filter prevents duplicate paths under a nested `/decarboxulator/` directory. The Pages build also now generates the same historical redirects and offline service worker as the standard production build.

**Before deploying:** the GitHub account/repository and the intended public domain must actually match this example production URL. Otherwise update `VITE_BASE_PATH`, `VITE_SITE_URL`, the build script, and the canonical configuration. Do not publish a preview site under the canonical of a different production site.

On GitHub Pages project sites, the generated `/decarboxulator/robots.txt` is *not* an origin-level `/robots.txt` (robots exclusion rules only apply at the origin root). The `sitemap.xml` at the project URL can still be submitted directly via Google Search Console. Historical V2 and earlier HTML links are carried by `scripts/legacy-redirects.json`. Keep that mapping accurate when adding old routes; do not map an obsolete tool to a materially different calculation. Review redirects and the target canonical domain before publishing.

The generated app manifest and `sw.js` support standalone mobile display and offline calculations on secure origins. The worker precaches all prerendered routes and required application assets atomically; it does not cache user data or arbitrary responses. Browser installation instructions are never opened automatically: the user must click the **download icon in the left rail**. Native browser install prompts require a second explicit click where the browser supports them. A private-LAN HTTP address (such as `192.168.x.x`) is not a secure context, so the install dialog explains why HTTPS hosting is needed for reliable PWA behavior.

## Scientific scope

The theoretical conversion factor is `MW_THC / MW_THCA = 314.46 / 358.47`. Its inverse is *mass equivalence*, not a chemically reversible process. Batch calculations assume complete conversion and zero changes other than THCa-derived CO₂. Gravimetric inversion cannot distinguish CO₂ from water, solvent or terpene losses and is not a validated assay. Per-serving formulation is an idealized homogeneous mixture estimate, not a direct potency measurement or clinical guidance.

All these limitations are surfaced in the live UI and in static explanation content.
