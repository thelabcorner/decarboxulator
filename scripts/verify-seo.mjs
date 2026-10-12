import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../dist/client/', import.meta.url));
const origin = (process.env.VITE_SITE_URL || 'https://dcxr.thedabcorner.site/').replace(/\/?$/, '/');
const required = [
  '', 'tools/thca-to-thc/', 'tools/thc-to-thca/', 'tools/batch-yield/', 'tools/thca-percentage/',
  'tools/edible-dosage/', 'tools/max-pressure/', 'tools/decarb-tracker/',
  'tools/cartridge-formulation/', 'learn/decarboxylation-math/', 'faq/',
];
function assert(condition, message) { if (!condition) throw new Error(message); }
function collect(directory, items = []) {
  for(const entry of readdirSync(directory,{withFileTypes:true})) {
    if(entry.isDirectory() && !(directory===root && entry.name==='pages')) collect(join(directory,entry.name),items);
    else if(entry.name==='index.html') items.push(join(directory,entry.name));
  }
  return items;
}
function structuredData(html) {
  const scripts = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  assert(scripts.length > 0,'No JSON-LD application metadata');
  return scripts.flatMap(match=>{
    const parsed=JSON.parse(match[1]);
    return parsed['@graph'] || [parsed];
  });
}
assert(existsSync(join(root,'index.html')), 'Prerendered site index missing');
const files=collect(root).sort();
const seenTitles=new Set(),seenDescriptions=new Set(),seenUrls=new Set();
const seenImages=new Set();
for(const file of files) {
  const rel=relative(root,file).split(sep).join('/');
  const route=rel.replace(/index\.html$/,'');
  const expected=new URL(route,origin).toString();
  const html=readFileSync(file,'utf8');
  const title=html.match(/<title>([^<]+)<\/title>/)?.[1];
  const description=html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/)?.[1];
  const canonicals=[...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/g)].map(item=>item[1]);
  assert(title?.length>=15,`${route || '/'}: missing meaningful title`);
  assert(description?.length>=80 && description.length<=250,`${route || '/'}: missing or abnormal meta description`);
  assert(!seenTitles.has(title),`${route || '/'}: repeated title`);
  assert(!seenDescriptions.has(description),`${route || '/'}: repeated description`);
  seenTitles.add(title);seenDescriptions.add(description);
  assert(canonicals.length===1 && canonicals[0]===expected,`${route || '/'}: incorrect canonical`);
  assert(!seenUrls.has(expected),`${route || '/'}: duplicate canonical URL`);
  seenUrls.add(expected);
  assert(/<meta[^>]+name="viewport"/.test(html),`${route || '/'}: missing responsive viewport`);
  assert(/<meta[^>]+name="robots"[^>]+content="index, follow/.test(html),`${route || '/'}: unexpected crawler policy`);
  assert(html.includes('name="google-site-verification" content="zehT3yCzGEa80mOM6j42f99nbI5144vL1prN8kHSaJc"'),
    `${route || '/'}: historical Search Console verification token missing`);
  assert(/property="og:image"/.test(html) && /property="og:image:alt"/.test(html),`${route || '/'}: OG metadata missing`);
  assert(html.includes('name="twitter:img:src"'),`${route || '/'}: Snapchat/Twitter preview fallback missing`);
  assert(html.includes('property="og:image:secure_url"'),`${route || '/'}: HTTPS preview metadata missing`);
  assert(html.includes('https://thedabcorner.site'),`${route || '/'}: creator link missing`);
  assert(html.includes('https://github.com/thelabcorner/decarboxulator'),`${route || '/'}: source link missing`);
  assert(/name="twitter:card"/.test(html),`${route || '/'}: social metadata missing`);
  const slug=route.split('/').filter(Boolean).join('-');
  const imageName=slug ? 'og/'+slug+'.png' : 'og-image.png';
  const imageUrl=new URL(imageName,origin).toString();
  assert(html.includes(`property="og:image" content="${imageUrl}"`),`${route || '/'}: incorrect route OG image`);
  assert(html.includes(`name="twitter:image" content="${imageUrl}"`),`${route || '/'}: incorrect route Twitter image`);
  const imageFile=join(root,imageName);
  assert(existsSync(imageFile),`${route || '/'}: missing route OG PNG ${imageName}`);
  const png=readFileSync(imageFile);
  assert(png.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')) &&
    png.readUInt32BE(16)===1200 && png.readUInt32BE(20)===630,
    `${route || '/'}: OG image is not 1200x630 PNG`);
  const imageHash=createHash('sha256').update(png).digest('hex');
  assert(!seenImages.has(imageHash),`${route || '/'}: duplicate OG image pixels`);
  assert(png.length < 2_000_000,`${route || '/'}: OG PNG exceeds 2 MB mobile preview budget`);
  seenImages.add(imageHash);
  assert((html.match(/<h1\b/g)||[]).length===1,`${route || '/'}: must have exactly one server-rendered H1`);
  assert(html.includes('/tools/thca-to-thc'),`${route || '/'}: navigation lacks core calculator route`);
  assert(html.includes('/tools/thc-to-thca'),`${route || '/'}: navigation lacks reverse calculator route`);
  const graph=structuredData(html);
  const isGuide=route==='learn/decarboxylation-math/';
  const isFaq=route==='faq/';
  for(const type of ['Organization','Person','WebSite','WebPage']) {
    assert(graph.some(entry=>entry['@type']===type),`${route || '/'}: missing ${type} schema`);
  }
  const webpage=graph.find(entry=>entry['@type']==='WebPage');
  const entityType=isGuide?'TechArticle':isFaq?'FAQPage':'WebApplication';
  const entity=graph.find(entry=>entry['@type']===entityType);
  assert(webpage?.url===expected,`${route || '/'}: WebPage JSON-LD URL mismatch`);
  assert(entity?.['@id']===`${expected}${isGuide?'#reference':isFaq?'#faq':'#calculator'}`,
    `${route || '/'}: wrong primary schema entity`);
  assert(webpage.mainEntity?.['@id']===entity['@id'],
    `${route || '/'}: WebPage mainEntity does not resolve to its content`);
  assert(entity.mainEntityOfPage?.['@id']===`${expected}#webpage` || !isGuide,
    `${route}: article is not connected to its canonical WebPage`);
  if(isGuide) {
    assert(!graph.some(item=>item['@type']==='WebApplication'),
      'The scientific reference must not pretend to be a calculator');
    const researchSources=[
      'https://pubchem.ncbi.nlm.nih.gov/compound/98523',
      'https://pubchem.ncbi.nlm.nih.gov/compound/16078',
      'https://pubchem.ncbi.nlm.nih.gov/compound/280',
      'https://pubmed.ncbi.nlm.nih.gov/28861498/',
      'https://pubmed.ncbi.nlm.nih.gov/15734104/',
    ];
    for(const source of researchSources) {
      assert(entity.citation?.includes(source),`Missing reference citation: ${source}`);
      assert(html.includes(`href="${source}"`),`Citation is not visibly linked in prerendered page: ${source}`);
    }
  } else if(isFaq) {
    assert(Array.isArray(entity.mainEntity) && entity.mainEntity.length >= 20,
      'FAQ requires real structured questions, not a calculator entity');
    assert(!graph.some(item=>item['@type']==='WebApplication'),
      'FAQ route must not be misrepresented as a calculator');
  } else {
    assert(entity.offers?.price==='0' && entity.isAccessibleForFree===true,
      `${route || '/'}: incorrect free calculator metadata`);
  }
  if(route) assert(graph.some(entry=>entry['@type']==='BreadcrumbList'),`${route}: missing breadcrumb schema`);
  if(route.startsWith('tools/')) {
    const appWorkbench=route==='tools/decarb-tracker/' && /class="[^"]*tracker-workbench/.test(html)
      && html.includes('tracker-panel-live') && html.includes('Apparent conversion');
    const calculatorWorkbench=/class="[^"]*calculator-studio/.test(html)
      && html.includes('calculator-app-tabs') && html.includes('Live model output');
    const pressureWorkbench=route==='tools/max-pressure/' &&
      /class="[^"]*pressure-workbench/.test(html) &&
      html.includes('pressure-map-grid') && html.includes('Pressure landscape') &&
      html.includes('Model parameters') && html.includes('MODELED GAUGE PRESSURE') &&
      html.includes('id="pressure-temp"') && html.includes('id="pressure-vol"') &&
      html.includes('id="pressure-thca"');
    assert(/class="[^"]*calculator-grid/.test(html) || appWorkbench || calculatorWorkbench || pressureWorkbench,
      `${route}: primary calculator absent from prerendered HTML`);
  }
  const expectedToolQuestion = {
    'tools/max-pressure/': 'Does the pressure result include solvent or terpene vapor?',
    'tools/decarb-tracker/': 'What does the apparent completion percentage measure?',
    'tools/cartridge-formulation/': 'Is target fill the starting mixture or the finished cartridge mass?',
  }[route];
  if (expectedToolQuestion) {
    assert(html.includes(expectedToolQuestion), `${route}: missing visible tool-specific reference questions`);
  }
  if(route==='tools/thc-to-thca/') {
    assert(/<h1[^>]*>[^<]*THC to THCa/.test(html), 'Reverse entry needs its own server-rendered heading');
    assert(html.includes('Target THC mass'), 'Reverse entry must SSR the inverse calculator mode');
  }
  console.log('PASS',route || '/');
}
for(const route of required) assert(seenUrls.has(new URL(route,origin).toString()),`Required route not prerendered: ${route || '/'}`);
for(const asset of ['robots.txt','sitemap.xml','favicon.svg','og-image.png','site.webmanifest','apple-touch-icon.png']) {
  assert(existsSync(join(root,asset)),`Missing critical asset ${asset}`);
}
const sitemap=readFileSync(join(root,'sitemap.xml'),'utf8');
const sitemapUrls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]);
assert(sitemapUrls.length===files.length,`Sitemap count ${sitemapUrls.length} mismatches ${files.length} prerendered pages`);
for(const url of seenUrls) assert(sitemap.includes(`<loc>${url}</loc>`),`Sitemap missing ${url}`);
assert(readFileSync(join(root,'robots.txt'),'utf8').includes(`Sitemap: ${origin}sitemap.xml`),'Robots sitemap mismatch');
const oldSitemap=join(root,'resources','assets','sitemap.xml');
assert(existsSync(oldSitemap),'V3 submitted sitemap endpoint is missing');
assert(readFileSync(oldSitemap,'utf8')===sitemap,'V3 sitemap endpoint must use current canonical URLs, not stale V3 URLs');
const redirects = JSON.parse(readFileSync(new URL('./legacy-redirects.json', import.meta.url), 'utf8'));
// Independently pinned against V3's published HTML inventory. Checking only
// manifest entries would silently allow a future edit to delete a ranked URL.
const requiredLegacyTargets = {
  'index-old.html': '/',
  'pages/v2/index.html': '/',
  'pages/v2/thca-thc-calculator.html': '/tools/thca-to-thc/',
  'pages/v2/thca-content-analyzer.html': '/tools/thca-percentage/',
  'pages/v2/thca-decarb-tracker.html': '/tools/decarb-tracker/',
  'pages/v2/edible-calculator.html': '/tools/edible-dosage/',
  'pages/v2/max-pressure.html': '/tools/max-pressure/',
  'pages/v2/isolate-calculator.html': '/tools/cartridge-formulation/',
  'pages/v2/decarboxylation-faq.html': '/learn/decarboxylation-math/',
  'pages/dcx-yield.html': '/tools/batch-yield/',
  'pages/input-finder.html': '/tools/thc-to-thca/',
  'pages/rosin-thca-finder.html': '/tools/thca-percentage/',
  'pages/iso-calc.html': '/tools/cartridge-formulation/',
  'pages/max-pressure.html': '/tools/max-pressure/',
  'pages/progress-tracker.html': '/tools/decarb-tracker/',
};
for (const [legacy, target] of Object.entries(requiredLegacyTargets)) {
  assert(redirects.some(entry => entry.legacy === legacy && entry.target === target),
    `V3 SEO regression: missing or remapped historical URL ${legacy} => ${target}`);
}
assert(redirects.find(entry => entry.legacy === 'pages/v2/thca-thc-calculator.html')?.reverseHash === true,
  'V3 reverse hash direction must survive the migration');
const mount = '/' + (process.env.VITE_BASE_PATH || '/').split('/').filter(Boolean).join('/') + '/';
const publicMount = mount === '//' ? '/' : mount;
const historicalPaths = new Set();
const historicalAliases = new Set();
for (const {legacy, target, reverseHash} of redirects) {
  assert(!historicalPaths.has(legacy), `Duplicate legacy redirect: ${legacy}`);
  historicalPaths.add(legacy);
  assert(/^(?:index-old|pages\/[a-z0-9/.-]+)\.html$/.test(legacy) && !legacy.includes('..'),
    `Unsafe historical redirect path: ${legacy}`);
  const filename = join(root, legacy);
  assert(existsSync(filename), `Historical URL missing from output: ${legacy}`);
  const redirect = readFileSync(filename, 'utf8');
  const to = publicMount + target.slice(1);
  const canonical = new URL(target.slice(1), origin).toString();
  assert(redirect.includes(`<link rel="canonical" href="${canonical}">`), `${legacy}: incorrect target canonical`);
  assert(redirect.includes(`content="0;url=${to}"`), `${legacy}: missing zero-second HTML redirect`);
  assert(redirect.includes('location.replace('), `${legacy}: missing history-replacing JavaScript redirect`);
  assert(!/name="robots"[^>]+noindex/i.test(redirect), `${legacy}: noindex competes with migration redirect signal`);
  if(reverseHash) assert(redirect.includes('tools/thc-to-thca/'), `${legacy}: reverse hash mapping missing`);
  assert(!seenUrls.has(new URL(legacy,origin).toString()), `${legacy}: historical route included in canonical sitemap`);
  if (legacy.startsWith('pages/') && !legacy.endsWith('/index.html')) {
    const alias = legacy.replace(/\.html$/, '/index.html');
    assert(!historicalAliases.has(alias), `Duplicate extensionless redirect: ${alias}`);
    historicalAliases.add(alias);
    const aliasMarkup = readFileSync(join(root,alias),'utf8');
    assert(aliasMarkup === redirect, `${alias}: extensionless link does not redirect identically to .html`);
    assert(!seenUrls.has(new URL(alias.replace(/index\.html$/, ''),origin).toString()),
      `${alias}: extensionless redirect included in canonical sitemap`);
  }
}
for (const path of ['pages/time-predictor.html','pages/time-predictor/index.html']) {
  const notice = readFileSync(join(root,path),'utf8');
  assert(notice.includes('name="robots" content="noindex,follow"') &&
    notice.includes('not a working calculator') && notice.includes('tools/decarb-tracker/'),
    `${path}: retired predictor needs a truthful, unindexed explanation`);
  assert(!sitemap.includes(path), `${path}: retired tool must not be in sitemap`);
}
const historicalEquivalents = {
  'pages/input-finder.html':'/tools/thc-to-thca/',
  'pages/rosin-thca-finder.html':'/tools/thca-percentage/',
};
for (const [legacy,target] of Object.entries(historicalEquivalents))
  assert(redirects.some(entry => entry.legacy===legacy && entry.target===target),
    `Missing verified V1 tool continuity: ${legacy}`);
assert(redirects.some(entry=>entry.legacy==='index-old.html' && entry.target==='/'),
  'The original pre-V3 landing page must continue to redirect to V4');
console.log(`Legacy redirects validated: ${redirects.length} source URLs, ${historicalAliases.size} extensionless aliases and 2 retired-tool notices.`);
console.log(`SEO validated: ${files.length} prerendered, canonicalized pages including all ${required.length} required routes.`);
