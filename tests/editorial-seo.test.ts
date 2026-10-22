import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CREATOR_NAME, CREATOR_URL, FAQ, GUIDE, HOME, PUBLISHER_NAME, PUBLISHER_URL, SOURCE_URL, TOOLS, canonical, pageHead } from '../src/lib/site';
import { SCIENCE_FAQ } from '../src/lib/scienceFaq';
import { TOOL_QUESTIONS } from '../src/lib/toolFaq';

type OgPage = {
  path: string;
  title: string[];
  description: string;
  value: string;
  valueLabel: string;
};
const OG_PAGES = JSON.parse(readFileSync(new URL('../scripts/og-pages.json', import.meta.url), 'utf8')) as OgPage[];

function graphFor(page: {path: string; title: string; description: string}) {
  return JSON.parse(pageHead(page).scripts[0].children)['@graph'] as Array<Record<string, unknown>>;
}

/** Peter Yang's No AI Slop banned vocabulary, applied only to authored public-facing prose. */
const EMPTY_PROMISES = /\b(?:delve|foster|leverage|utilize|facilitate|empower|streamline|robust|cutting-edge|paradigm shift|game changer|tapestry|realm|beacon|multifaceted|meticulous|intricate|paramount|transformative|elevate|embark|supercharge|harness|ever-evolving|pivotal moment|testament to|what nobody tells you|let's dive in|in today's world)\b/i;

describe('scientific editorial and search copy', () => {
  it('separates concise in-app workbench headings from route-specific search descriptions', () => {
    expect(TOOLS).toHaveLength(12);
    expect(new Set(TOOLS.map(tool => tool.heading)).size).toBe(TOOLS.length);
    expect(new Set(TOOLS.map(tool => tool.description)).size).toBe(TOOLS.length);
    for (const tool of TOOLS) {
      expect(tool.heading.length, tool.id + ' heading').toBeLessThan(36);
      expect(tool.summary.length, tool.id + ' workbench summary').toBeLessThan(115);
      expect(tool.description.length, tool.id + ' meta description').toBeGreaterThanOrEqual(85);
      expect(tool.description.length, tool.id + ' meta description').toBeLessThan(210);
      expect(tool.description, tool.id).not.toBe(tool.summary);
      expect(canonical(tool.path)).toContain('/tools/');
    }
  });

  it('keeps important scientific boundaries explicit in the relevant search snippets', () => {
    const byId = Object.fromEntries(TOOLS.map(tool => [tool.id, tool.description]));
    expect(byId['conversion']).toMatch(/theoretical|actual recovery/i);
    expect(byId['reverse-conversion']).toMatch(/inverse mass calculation/i);
    expect(byId['batch']).toMatch(/assumed unchanged/i);
    expect(byId['analysis']).toMatch(/water|solvents|volatile/i);
    expect(byId['edibles']).toMatch(/THCa conversion|THC recovery/i);
    expect(byId['pressure']).toMatch(/not a vessel rating|safe operating limit/i);
    expect(byId['tracker']).toMatch(/weight loss alone cannot confirm/i);
    expect(byId['cartridge']).toMatch(/starting and finished masses/i);
    expect(byId['extract']).toMatch(/extract blends|extract/i);
  });

  it('uses grounded, direct copy without banned hype in authored metadata and FAQs', () => {
    const passages = [
      HOME.title, HOME.description, GUIDE.title, GUIDE.description,
      ...TOOLS.flatMap(tool => [tool.title, tool.heading, tool.summary, tool.description]),
      ...SCIENCE_FAQ.flatMap(faq => [faq.question, faq.answer]),
      ...Object.values(TOOL_QUESTIONS).flatMap(items => items.flatMap(item => [item.question, item.answer])),
      ...OG_PAGES.flatMap(page => [page.description, ...page.title]),
    ];
    for (const passage of passages) {
      expect(passage, 'Inflated or generic language: ' + passage).not.toMatch(EMPTY_PROMISES);
    }
    expect(SCIENCE_FAQ.length).toBeGreaterThanOrEqual(30);
    expect(Object.values(TOOL_QUESTIONS).every(items => items.length > 0)).toBe(true);
  });

  it('keeps static OG copy in step with the actual routes, not fabricated page counts', () => {
    const routes = [HOME, ...TOOLS, FAQ, GUIDE];
    expect(OG_PAGES.map(page => page.path)).toEqual(routes.map(page => page.path));
    expect(OG_PAGES[0].value).toBe(String(TOOLS.length).padStart(2, '0'));
    expect(OG_PAGES[0].valueLabel).toBe('CALCULATOR ROUTES');
    for (const page of OG_PAGES) {
      expect(page.description.length, page.path).toBeGreaterThan(45);
      expect(page.title.length, page.path).toBeGreaterThanOrEqual(1);
    }
  });

  it('provides Snapchat-compatible and general Open Graph preview metadata for every route', () => {
    // Preserve the user's required plain-text chemical notation in snippets
    // and generated previews; Unicode subscripts are harder to search for.
    const searchable = [HOME, ...TOOLS, FAQ, GUIDE];
    for (const route of searchable) {
      const head = pageHead(route);
      const authored = [route.title, route.description,
        ...head.meta.map(item => item.content ?? '')];
      expect(authored.join(' '), route.path).not.toContain('CO₂');
    }
    const routes = [HOME, ...TOOLS, FAQ, GUIDE];
    for (const route of routes) {
      const head = pageHead(route);
      const get = (name: string) => head.meta.find(item => 'property' in item
        ? item.property === name : 'name' in item && item.name === name);
      const image = get('og:image');
      expect(image?.content, route.path).toMatch(/^https:\/\/[^?#]+\.png$/);
      expect(get('og:image:secure_url')?.content).toBe(image?.content);
      expect(get('og:image:width')?.content).toBe('1200');
      expect(get('og:image:height')?.content).toBe('630');
      expect(get('twitter:card')?.content).toBe('summary_large_image');
      expect(get('twitter:img:src')?.content).toBe(image?.content);
      expect(get('twitter:image')?.content).toBe(image?.content);
      const graph = graphFor(route);
      const creator = graph.find(item => item['@type'] === 'Person');
      expect(creator?.name).toBe(CREATOR_NAME);
      expect(creator?.url).toBe(CREATOR_URL);
    }
    expect(SOURCE_URL).toBe('https://github.com/thelabcorner/decarboxulator');
    const faqGraph = graphFor(FAQ);
    expect(faqGraph.find(item => item['@type'] === 'WebApplication')).toBeUndefined();
    expect(faqGraph.find(item => item['@type'] === 'FAQPage')).toBeDefined();
  });

  it('describes the publisher as thelabcorner and lists all eight tools on the overview', () => {
    const graph = graphFor(HOME);
    const publisher = graph.find(item => item['@type'] === 'Organization');
    expect(publisher?.name).toBe(PUBLISHER_NAME);
    expect(publisher?.url).toBe(PUBLISHER_URL);
    expect(publisher?.name).not.toBe('Decarboxulator');

    const directory = graph.find(item => item['@type'] === 'ItemList');
    const entries = directory?.itemListElement as Array<{position: number; name: string; url: string}>;
    expect(entries).toHaveLength(TOOLS.length);
    expect(entries).toEqual(TOOLS.map((tool, index) => ({
      '@type': 'ListItem', position: index + 1, name: tool.name, url: canonical(tool.path),
    })));

    for (const tool of TOOLS) {
      const graph = graphFor(tool);
      const app = graph.find(item => item['@type'] === 'WebApplication');
      expect(app?.mainEntityOfPage).toEqual({'@id': canonical(tool.path) + '#webpage'});
    }
  });
});
