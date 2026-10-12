# GitHub Pages → Decarboxulator V4 domain cutover

## Current production
- Repository: https://github.com/thelabcorner/decarboxulator
- V4 source: `main`
- Deployment: `.github/workflows/deploy-pages.yml` (GitHub Actions → Pages)
- Existing public origin: https://thelabcorner.github.io/decarboxulator/
- Preferred canonical domain (not enabled until DNS is verified): https://dcxr.thedabcorner.site/
- Additional hostname: https://decarboxulator.thedabcorner.site/ (301 redirect to preferred hostname)

**SEO safety rule:** Do not configure the GitHub Pages custom domain before the corresponding DNS CNAME is live. Do not delete historical paths, force-push away the V3 branches, or add a `noindex` to the current 11 canonical pages.

## Cloudflare free-plan DNS

The currently signed-in Wrangler OAuth session can list zones but receives HTTP 403 from DNS Records and Single Redirects APIs. It cannot finish these changes. Use a scoped Cloudflare API token with **Zone → DNS → Edit**, **Zone → Zone → Read**, and **Zone → Dynamic URL Redirects → Edit** for only the `thedabcorner.site` zone.

With `CLOUDFLARE_API_TOKEN` set in your terminal, run:

```sh
node scripts/setup-domain.mjs              # inspect, without writing
node scripts/setup-domain.mjs --apply      # idempotent write, refuses conflicting DNS/rules
node scripts/setup-domain.mjs --verify     # public DNS and HTTP checks (no token necessary)
```

The script configures these records without touching other subdomains:

| Name | Type | Target | Cloudflare proxy |
| --- | --- | --- | --- |
| `dcxr.thedabcorner.site` | CNAME | `thelabcorner.github.io` | **DNS only** |
| `decarboxulator.thedabcorner.site` | CNAME | `thelabcorner.github.io` | **Proxied** |

It also adds one Single Redirect rule matching `http.host eq "decarboxulator.thedabcorner.site"` with a **301 permanent** redirect to `concat("https://dcxr.thedabcorner.site", http.request.uri.path)` and **Preserve query string**. Cloudflare requires proxied traffic for this rule. Preserve paths and query parameters to avoid collapsing separately indexed calculator routes onto the homepage.

### Final GitHub Pages switch

After the public DNS-only CNAME for `dcxr` resolves to `thelabcorner.github.io`, and after the `--apply` script reports success:

```sh
# Set the Pages custom hostname, not the secondary redirect hostname.
gh api -X PUT repos/thelabcorner/decarboxulator/pages -f cname=dcxr.thedabcorner.site

# Switch GitHub Actions build from the old /decarboxulator/ mount to the new root hostname.
gh variable set DCX_CUSTOM_DOMAIN -R thelabcorner/decarboxulator --body dcxr.thedabcorner.site
gh workflow run deploy-pages.yml -R thelabcorner/decarboxulator --ref main
gh run list -R thelabcorner/decarboxulator --workflow deploy-pages.yml --limit 3
```

The `build:domain` script renders the same eleven Satori OG images, creates canonical `https://dcxr.thedabcorner.site/` metadata, generates a root-scope service worker/sitemap and copies `CNAME` into the deployed Pages artifact. **Do not set the workflow variable on its own** before configuring the GitHub Pages hostname, since the root-domain artifact is not mount-compatible with the historical GitHub project path.

If the GitHub Pages API rejects the custom domain, preserve the currently running `build:pages` workflow and do not flip the build variable. Confirm Cloudflare DNS, GitHub domain ownership and Pages HTTPS status before retrying.

## Live acceptance tests

- `https://dcxr.thedabcorner.site/` returns 200 and a **single** canonical link to itself.
- `https://dcxr.thedabcorner.site/tools/thca-to-thc/` returns 200, correct calculator content and route-specific OG PNG.
- `https://dcxr.thedabcorner.site/faq/` returns 200, a FAQ schema and `/og/faq.png`.
- `https://decarboxulator.thedabcorner.site/tools/thca-to-thc/?v=1` returns HTTP **301** to `https://dcxr.thedabcorner.site/tools/thca-to-thc/?v=1`.
- `https://thelabcorner.github.io/decarboxulator/pages/v2/thca-thc-calculator.html` still lands on the equivalent V4 calculator.
- The historic `#backward` direction resolves to the reverse THC-to-THCa calculator (fragment is browser-side, so it must remain an HTML redirect, not a blanket server 301).
- All older source URLs are excluded from the canonical sitemap; current calculators, FAQ and reference remain indexable.
- The GitHub Pages `https_enforced` property and TLS certificate are verified before declaring the migration complete.

Keep the legacy `decarboxulator` branch as an archival/rollback record; `main` holds the new source and the workflow deploys it.

## Avoiding SEO damage

- Don't collapse all historical paths onto the homepage.
- Keep a 1:1 conceptual destination for the historical calculators; the time predictor remains explicitly retired rather than pretending its forecast was valid.
- Keep the existing GitHub Pages URLs responding (GitHub may automatically redirect them to the custom domain after cutover). For existing HTML aliases, preserve the zero-second meta refresh, target canonical, and JavaScript `location.replace`. Do **not** put `noindex` on actively migrating pages: it competes with the canonicalization/redirect signals. The retired time predictor is intentionally different: its explanatory notice remains `noindex,follow`.
- Keep the original `index-old.html` destination and `resources/assets/sitemap.xml` endpoint in every deploy. The historical sitemap URL now serves the same 11 canonical destinations as `sitemap.xml`, maintaining Search Console continuity.
- The original Google Search Console HTML-verification meta tag is retained on all indexable V4 routes. If you change verification methods later, confirm the original property is still verified first.
- The build-time SEO crawl checks real SSR links for mount escapes and missing destinations, alongside the 1:1 redirect checks and FAQ parity. Do not relax this guard to make an invalid release pass.
- Do not publish two separate canonical domains. The secondary hostname returns 301; only `dcxr` is included in the future sitemap.
- After cutover, submit the new `https://dcxr.thedabcorner.site/sitemap.xml` in Google Search Console. Track indexed URL transitions and 404s; do not delete older mappings prematurely.
