import { describe, expect, it } from 'vitest';
import { FAQ, GUIDE, HOME, SITE_URL, TOOLS, canonical, ogImagePath, pageHead, searchTitle } from '../src/lib/site';

type Entity = {
  '@type': string;
  '@id'?: string;
  url?: string;
  mainEntity?: { '@id': string };
  citation?: string[];
  isAccessibleForFree?: boolean;
  offers?: { price: string };
};

function metadata(page: { path: string; title: string; description: string }) {
  const head = pageHead(page);
  const graph = JSON.parse(head.scripts[0].children)['@graph'] as Entity[];
  return { head, graph, webpage: graph.find(entity => entity['@type'] === 'WebPage')! };
}

describe('prerendered SEO contract', () => {
  const pages = [HOME, ...TOOLS, GUIDE];

  it('publishes one consistent, unique, branded title across search and social metadata', () => {
    const routes = [HOME, ...TOOLS, FAQ, GUIDE];
    const seen = new Set<string>();
    for (const page of routes) {
      const fullTitle = searchTitle(page);
      const { head, webpage } = metadata(page);
      const title = head.meta.find(tag => 'title' in tag);
      const ogTitle = head.meta.find(tag => 'property' in tag && tag.property === 'og:title');
      const twitterTitle = head.meta.find(tag => 'name' in tag && tag.name === 'twitter:title');
      expect(fullTitle, page.path).toBe(`${page.title} | Decarboxulator™`);
      expect(fullTitle.length, page.path).toBeLessThanOrEqual(60);
      expect(seen.has(fullTitle), page.path).toBe(false);
      seen.add(fullTitle);
      expect(title?.title).toBe(fullTitle);
      expect(ogTitle?.content).toBe(fullTitle);
      expect(twitterTitle?.content).toBe(fullTitle);
      expect((webpage as Entity & { name?: string }).name).toBe(fullTitle);
    }
  });

  it('provides ten distinct stable canonicals and route OG images', () => {
    expect(pages).toHaveLength(10);
    expect(new Set(pages.map(page => canonical(page.path))).size).toBe(10);
    expect(new Set(pages.map(page => ogImagePath(page.path))).size).toBe(10);
    for (const page of pages) {
      const { head } = metadata(page);
      expect(head.links).toEqual([{ rel: 'canonical', href: canonical(page.path) }]);
      const meta = head.meta as Array<Record<string, string>>;
      expect(meta.find(tag => tag.name === 'description')?.content).toBe(page.description);
      expect(meta.find(tag => tag.property === 'og:url')?.content).toBe(canonical(page.path));
      expect(meta.find(tag => tag.name === 'twitter:card')?.content).toBe('summary_large_image');
    }
  });

  it('uses a technically accurate primary entity for each calculator', () => {
    for (const page of [HOME, ...TOOLS]) {
      const { graph, webpage } = metadata(page);
      const calculator = graph.find(entity => entity['@type'] === 'WebApplication');
      expect(calculator?.url).toBe(canonical(page.path));
      expect(calculator?.isAccessibleForFree).toBe(true);
      expect(calculator?.offers?.price).toBe('0');
      expect(webpage.mainEntity?.['@id']).toBe(calculator?.['@id']);
      expect(graph.some(entity => entity['@type'] === 'TechArticle')).toBe(false);
    }
  });

  it('describes the scientific reference as an article rather than another calculator', () => {
    const { graph, webpage } = metadata(GUIDE);
    const article = graph.find(entity => entity['@type'] === 'TechArticle');
    expect(article?.['@id']).toBe(canonical(GUIDE.path) + '#reference');
    expect(webpage.mainEntity?.['@id']).toBe(article?.['@id']);
    expect(graph.some(entity => entity['@type'] === 'WebApplication')).toBe(false);
    expect(article?.citation).toEqual(expect.arrayContaining([
      'https://pubchem.ncbi.nlm.nih.gov/compound/98523',
      'https://pubchem.ncbi.nlm.nih.gov/compound/16078',
      'https://pubchem.ncbi.nlm.nih.gov/compound/280',
      'https://pubmed.ncbi.nlm.nih.gov/28861498/',
      'https://pubmed.ncbi.nlm.nih.gov/15734104/',
    ]));
  });

  it('keeps both direction entries separate while sharing the underlying calculator', () => {
    const forward = TOOLS.find(tool => tool.id === 'conversion')!;
    const inverse = TOOLS.find(tool => tool.id === 'reverse-conversion')!;
    expect(canonical(forward.path)).not.toBe(canonical(inverse.path));
    expect(forward.description).toMatch(/theoretical/i);
    expect(inverse.description).toMatch(/inverse/i);
    expect(canonical(forward.path)).toContain(SITE_URL);
    expect(canonical(inverse.path)).toContain(SITE_URL);
  });
});
