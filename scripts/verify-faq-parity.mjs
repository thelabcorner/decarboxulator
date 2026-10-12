import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Cross-check machine-readable FAQ answers with the *prerendered response*.
 * Markup must describe the same content a human can expand in the studio.
 */
const base = fileURLToPath(new URL('../dist/client/', import.meta.url));
const assert = (value, message) => { if (!value) throw new Error(message); };
const pages = [];
function walk(directory) {
  for (const item of readdirSync(directory, {withFileTypes:true})) {
    if (item.isDirectory() && !(directory === base && item.name === 'pages'))
      walk(join(directory,item.name));
    else if (item.name === 'index.html') pages.push(join(directory,item.name));
  }
}
function decode(value) {
  return value.replace(/&(?:amp|lt|gt|quot|nbsp|#x27|#39|#34);/gi, raw => ({
    '&amp;':'&', '&lt;':'<', '&gt;':'>', '&quot;':'"', '&nbsp;':' ',
    '&#x27;':"'", '&#39;':"'", '&#34;':'"',
  })[raw.toLowerCase()] ?? raw);
}
function visibleText(html) {
  return decode(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ').replace(/\s+/g,' '));
}
function graphOf(html) {
  return [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .flatMap(match => {
      const json = JSON.parse(match[1]);
      return json['@graph'] ?? [json];
    });
}

assert(existsSync(join(base,'index.html')), 'Run npm run build first');
walk(base);
let count = 0, questions = 0;
for (const path of pages) {
  const route = relative(base,path).split(sep).join('/').replace(/index\.html$/,'');
  const html = readFileSync(path,'utf8');
  const graph = graphOf(html), faq = graph.find(item => item['@type'] === 'FAQPage');
  if (!route) { assert(!faq,'Home must not claim unseen FAQ content'); continue; }
  assert(faq, route + ': missing structured questions');
  const webPage = graph.find(item => item['@type'] === 'WebPage');
  assert(webPage?.hasPart?.['@id'] === faq['@id'],route + ': FAQ disconnected from WebPage');
  assert(faq.mainEntity?.length >= 2,route + ': insufficient FAQ entries');
  if (route === 'tools/thc-to-thca/') {
    assert(faq.mainEntity.some(item => item.name.includes('needed for 1 gram of theoretical THC')),
      'Reverse planning page is missing its starting-mass question');
  }
  if (route === 'tools/thca-to-thc/') {
    assert(faq.mainEntity.some(item => item.name.includes('theoretically produce')),
      'Forward conversion page is missing its THC-yield question');
  }
  const destination = new URL(faq.url);
  const anchor = destination.hash.slice(1);
  assert(anchor && html.includes('id="' + anchor + '"'),route + ': FAQ section anchor missing');
  const text = visibleText(html);
  const seen = new Set();
  for (const entry of faq.mainEntity) {
    assert(entry['@type'] === 'Question' && entry.acceptedAnswer?.['@type'] === 'Answer',
      route + ': malformed FAQ question/answer types');
    const question = entry.name, answer = entry.acceptedAnswer?.text;
    assert(typeof question === 'string' && typeof answer === 'string',route + ': incomplete FAQ entry');
    assert(!seen.has(question),route + ': duplicate question');
    seen.add(question);
    assert(text.includes(question),route + ': question missing from HTML: ' + question);
    assert(text.includes(answer),route + ': answer missing from HTML: ' + question);
    questions++;
  }
  count++;
  console.log('PASS FAQ',route,faq.mainEntity.length);
}
assert(count === pages.length - 1,'Not all non-home routes have FAQ coverage');
console.log('Verified',questions,'FAQ question/answer pairs across',count,'prerendered pages');
