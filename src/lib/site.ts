import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, ArrowRight, ChartNoAxesColumnIncreasing, FlaskConical, Scale, BookOpen, House, Gauge, ListChecks, Syringe } from 'lucide-react';
import appManifest from '../../package.json';
import { SCIENCE_FAQ } from './scienceFaq';
import { TOOL_QUESTIONS, type ToolId } from './toolFaq';

/** The current suite release, not an invented independent version per tool. */
export const APP_MAJOR_VERSION = `v${appManifest.version.split('.')[0]}`;

export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://dcxr.thedabcorner.site/').replace(/\/?$/, '/');
export const SITE_NAME = 'Decarboxulator';
export const PUBLISHER_NAME = 'thelabcorner';
export const PUBLISHER_URL = 'https://thedabcorner.site/';
export const CREATOR_NAME = 'Jackson Cummings';
export const CREATOR_URL = 'https://thedabcorner.site';
export const SOURCE_URL = 'https://github.com/thelabcorner/decarboxulator';
export const SITE_DESCRIPTION = 'Convert THCa to THC using the 0.877 factor. Estimate CO2 loss, batch yield, edible THC dosing, cartridge blends and decarboxylation progress.';

export const TOOLS = [
  { id: 'conversion', path: '/tools/thca-to-thc', name: 'THCa → THC', short: 'Forward conversion', eyebrow: 'Stoichiometry', heading: 'THCa to THC', summary: 'Enter a THCa mass to calculate potential THC and CO2 released.', title: 'THCa to THC Calculator: Yield & CO2', description: 'Enter a THCa mass to calculate theoretical THC yield, CO2 released and retained mass using the 314.46/358.47 molar-mass ratio. Actual recovery may be lower.', icon: ArrowRight },
  { id: 'reverse-conversion', path: '/tools/thc-to-thca', name: 'THC → THCa', short: 'Reverse planning', eyebrow: 'Stoichiometry', heading: 'THC to THCa', summary: 'Enter your target THC mass to find the equivalent starting THCa.', title: 'THC to THCa Calculator: Starting Mass', description: 'Calculate starting THCa for a target THC mass with the 0.877 conversion factor. This inverse mass calculation does not convert THC back into THCa.', icon: ArrowLeft },
  { id: 'batch', path: '/tools/batch-yield', name: 'Batch yield', short: 'Batch yield', eyebrow: 'Production', heading: 'Batch yield', summary: 'Calculate THC, CO2 loss and remaining mass from batch weight and THCa percentage.', title: 'THCa Batch Yield Calculator', description: 'Estimate THC, CO2 loss and final sample weight from batch mass and THCa percentage. Other components are assumed unchanged in this theoretical model.', icon: Scale },
  { id: 'analysis', path: '/tools/thca-percentage', name: 'THCa analyzer', short: 'Mass-loss analysis', eyebrow: 'Analytical', heading: 'THCa from mass loss', summary: 'Compare initial and final weights to estimate starting THCa under a CO2-only loss model.', title: 'THCa Percentage from Mass Loss', description: 'Estimate starting THCa percentage from before-and-after mass loss. Water, solvents and other volatile losses can make the CO2-based result inaccurate.', icon: ChartNoAxesColumnIncreasing },
  { id: 'edibles', path: '/tools/edible-dosage', name: 'Edible formulation', short: 'Edible dosage', eyebrow: 'Formulation', heading: 'Edible formulation', summary: 'Build a multi-ingredient recipe and calculate potential THC per serving.', title: 'Edible THC Dosage Calculator', description: 'Estimate THC mg per serving from ingredient weights and potency. Adjust THCa conversion, THC recovery and serving count independently for your recipe.', icon: FlaskConical },
  { id: 'pressure', path: '/tools/max-pressure', name: 'Vessel pressure', short: 'Gas pressure model', eyebrow: 'Physical model', heading: 'Vessel pressure', summary: 'Model trapped-air heating and CO2 pressure in a fixed headspace.', title: 'THCa CO2 Pressure Calculator', description: 'Model ideal-gas pressure from trapped air and CO2 released by THCa in a fixed headspace. This estimate is not a vessel rating or safe operating limit.', icon: Gauge },
  { id: 'tracker', path: '/tools/decarb-tracker', name: 'Progress tracker', short: 'Decarb tracker', eyebrow: 'Measurement', heading: 'Decarboxylation tracker', summary: 'Record vessel weight over time and inspect apparent CO2-based conversion.', title: 'Decarboxylation Progress Tracker', description: 'Log vessel weights, estimate CO2-based conversion and export decarb sessions. Weight loss alone cannot confirm chemical conversion or completed processing.', icon: ListChecks },
  { id: 'cartridge', path: '/tools/cartridge-formulation', name: 'Cartridge formulation', short: 'Cart fill', eyebrow: 'Formulation', heading: 'Cartridge formulation', summary: 'Plan ingredient ratios for a final cartridge fill or an available starting batch.', title: 'Cartridge Formulation Calculator', description: 'Plan cartridge fill weights and ingredient ratios for target fills or available batches. Compare starting and finished masses with optional THCa conversion.', icon: Syringe },
] as const satisfies ReadonlyArray<{id:string;path:string;name:string;short:string;eyebrow:string;title:string;description:string;heading:string;summary:string;icon:LucideIcon}>;

/** Stable IDs avoid positional coupling between page routes and the tool directory. */
export function getTool(id: (typeof TOOLS)[number]['id']) {
  const tool = TOOLS.find(entry => entry.id === id);
  if (!tool) throw new Error('Unknown calculator: ' + id);
  return tool;
}

export const GUIDE_PATH = '/learn/decarboxylation-math';
export const FAQ_PATH = '/faq';
export const HOME = { path: '/', title: 'THCa to THC Calculator & Decarb Tools', description: SITE_DESCRIPTION };
export const FAQ = { path: FAQ_PATH, title: 'Decarboxylation FAQ: Chemistry & Safety', description: `Answers to ${SCIENCE_FAQ.length} questions about chemistry, processing, measurement, formulation and safe interpretation of decarboxylation models.` };
export const GUIDE = { path: GUIDE_PATH, title: 'THCa Decarboxylation Math & CO2', description: `Reference the THCa → THC + CO2 reaction, molar masses, the 0.87723 factor, mass-loss assumptions and headspace limits. Explore ${SCIENCE_FAQ.length} chemistry questions.` };

export function canonical(path: string) {
  const route = path.replace(/^\/+|\/+$/g, '');
  return new URL(route ? `${route}/` : '', SITE_URL).toString();
}

/** Static Satori artwork is generated for each prerendered route. */
export function ogImagePath(path: string) {
  const route = path.split('/').filter(Boolean).join('-');
  return route ? `og/${route}.png` : 'og-image.png';
}

type Page = { path: string; title: string; description: string };
export function pageHead(page: Page) {
  const url = canonical(page.path);
  const ogUrl = new URL(ogImagePath(page.path), SITE_URL).toString();
  const ogAlt = page.title + ' | Decarboxulator scientific calculation studio';
  const isGuide = page.path === GUIDE_PATH;
  const isFaq = page.path === FAQ_PATH;
  const matchedTool = TOOLS.find(tool => tool.path === page.path);
  const faqToolId: ToolId | undefined = matchedTool?.id;
  const faqs = isGuide || isFaq ? SCIENCE_FAQ : faqToolId ? TOOL_QUESTIONS[faqToolId] : [];
  return {
    meta: [
      { title: page.title + ' | Decarboxulator' },
      { name: 'description', content: page.description },
      // Retain the original V3 Search Console HTML-tag verification across the
      // GitHub Pages migration. This was present in the historical site source.
      { name: 'google-site-verification', content: 'zehT3yCzGEa80mOM6j42f99nbI5144vL1prN8kHSaJc' },
      { name: 'robots', content: 'index, follow, max-image-preview:large' },
      { property: 'og:type', content: 'website' },
      { property: 'og:locale', content: 'en_US' },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:title', content: page.title },
      { property: 'og:description', content: page.description },
      { property: 'og:url', content: url },
      { property: 'og:image', content: ogUrl },
      { property: 'og:image:secure_url', content: ogUrl },
      { property: 'og:image:type', content: 'image/png' },
      { property: 'og:image:alt', content: ogAlt },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: page.title },
      { name: 'twitter:description', content: page.description },
      { name: 'twitter:image', content: ogUrl },
      { name: 'twitter:image:alt', content: ogAlt },
      // Snapchat URL Preview Service accepts OG and this documented Twitter fallback.
      { name: 'twitter:img:src', content: ogUrl },
    ],
    links: [{ rel: 'canonical', href: url }],
    scripts: [{
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'Organization', '@id': `${SITE_URL}#publisher`, name: PUBLISHER_NAME, url: PUBLISHER_URL },
          { '@type': 'Person', '@id': `${SITE_URL}#creator`, name: CREATOR_NAME, url: CREATOR_URL },
          { '@type': 'WebSite', '@id': `${SITE_URL}#website`, name: SITE_NAME,
            url: SITE_URL, publisher: { '@id': `${SITE_URL}#publisher` }, creator: { '@id': `${SITE_URL}#creator` }, inLanguage: 'en' },
          { '@type': 'WebPage', '@id': `${url}#webpage`, url, name: page.title,
            description: page.description, inLanguage: 'en',
            isPartOf: { '@id': `${SITE_URL}#website` },
            mainEntity: { '@id': isGuide ? `${url}#reference` : isFaq ? `${url}#faq` : `${url}#calculator` },
            ...(faqs.length ? { hasPart: { '@id': `${url}#faq` } } : {}),
            ...(page.path === '/' ? {} : { breadcrumb: { '@id': `${url}#breadcrumbs` } }),
          },
          ...(isGuide ? [{
            '@type': 'TechArticle', '@id': `${url}#reference`,
            headline: page.title, description: page.description, inLanguage: 'en',
            mainEntityOfPage: { '@id': `${url}#webpage` },
            publisher: { '@id': `${SITE_URL}#publisher` },
            author: { '@id': `${SITE_URL}#creator` },
            about: [
              { '@type': 'Thing', name: 'Tetrahydrocannabinolic acid decarboxylation' },
              { '@type': 'Thing', name: 'Cannabinoid mass balance' },
            ],
            citation: [
              'https://pubchem.ncbi.nlm.nih.gov/compound/98523',
              'https://pubchem.ncbi.nlm.nih.gov/compound/16078',
              'https://pubchem.ncbi.nlm.nih.gov/compound/280',
              'https://pubmed.ncbi.nlm.nih.gov/28861498/',
              'https://pubmed.ncbi.nlm.nih.gov/15734104/',
            ],
          }] : isFaq ? [] : [{
            '@type': 'WebApplication', '@id': `${url}#calculator`,
            name: page.path === '/' ? SITE_NAME : page.title,
url, description: page.description, inLanguage: 'en',
             mainEntityOfPage: { '@id': `${url}#webpage` },
             applicationCategory: 'EducationalApplication',
            creator: { '@id': `${SITE_URL}#creator` },
            operatingSystem: 'Any', isAccessibleForFree: true,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            publisher: { '@id': `${SITE_URL}#publisher` },
          }]),
          ...(faqs.length ? [{
            '@type': 'FAQPage', '@id': `${url}#faq`,
            url: isGuide || isFaq ? `${url}#science-questions` : `${url}#tool-questions`,
            name: isGuide || isFaq ? 'Decarboxylation science questions' : `${page.title} questions and limitations`,
            isPartOf: { '@id': `${url}#webpage` },
            mainEntity: faqs.map(faq => ({
              '@type': 'Question',
              name: faq.question,
              acceptedAnswer: { '@type': 'Answer', text: faq.answer },
            })),
          }] : []),
          ...(page.path === '/' ? [{
             '@type': 'ItemList', '@id': `${url}#tools`, name: 'Decarboxulator calculators',
             itemListElement: TOOLS.map((tool, index) => ({
               '@type': 'ListItem', position: index + 1, name: tool.name, url: canonical(tool.path),
             })),
           }] : [{
            '@type': 'BreadcrumbList', '@id': `${url}#breadcrumbs`,
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Decarboxulator', item: SITE_URL },
              { '@type': 'ListItem', position: 2, name: page.title, item: url },
            ],
          }]),
        ],
      }),
    }],
  };
}

export const NAV_ITEMS = [
  { path: '/', name: 'Overview', icon: House, version: null },
  ...TOOLS.map(tool => ({path:tool.path, name: tool.name, icon:tool.icon, version: APP_MAJOR_VERSION})),
  { path: FAQ_PATH, name: 'FAQ', icon: BookOpen, version: null },
  { path: GUIDE_PATH, name: 'The science', icon: BookOpen, version: null },
];
