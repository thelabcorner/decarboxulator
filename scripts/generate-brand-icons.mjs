import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

// The designer-supplied SVGs are the canonical geometry. Never approximate or
// trace them for application icons; raster derivatives are built from the originals.
const asset = path => new URL('../public/' + path, import.meta.url);
const light = readFileSync(asset('brand/SVG/dcxr-light.svg'), 'utf8');
const dark = readFileSync(asset('brand/SVG/dcxr-dark.svg'), 'utf8');
const viewBox = '0 0 652.24 652.24';
const contents = svg => svg.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/)?.[1];
if (!contents(light) || !contents(dark)) throw new Error('Invalid designer-supplied DCXR SVG source');
if (!light.includes('fill: #af0') || !dark.includes('fill: #af0')) {
  throw new Error('Missing Decarboxulator #aaff00 brand pigment in source vectors');
}
if (!light.includes('<rect class="cls-1"') || !dark.includes('<rect class="cls-3"')) {
  throw new Error('The expected light/dark vector background structure changed');
}
const svg = inner => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + viewBox + '">' + inner + '</svg>';
// A full-bleed background is required for iOS home screen treatment; the
// platform applies its own rounded-rectangle mask.
const opaqueDark = dark.replace(/<rect class="cls-3"[^>]*\/>/,
  '<rect width="652.24" height="652.24" fill="#212121"/>');
const maskable = svg(
  '<rect width="652.24" height="652.24" fill="#212121"/>' +
  '<g transform="translate(97.836 97.836) scale(0.7)">' +
  contents(dark).replace(/[ \t]*<rect class="cls-3"[^>]*\/>[ \t]*\r?\n/, '') + '</g>',
);
function raster(source, size) {
  return new Resvg(source, {fitTo: {mode: 'width', value: size}}).render().asPng();
}
function faviconIco(source) {
  const sizes = [16, 32, 48];
  const images = sizes.map(size => raster(source, size));
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let start = header.length;
  images.forEach((data, index) => {
    const off = 6 + index * 16;
    header.writeUInt8(sizes[index], off);
    header.writeUInt8(sizes[index], off + 1);
    header.writeUInt16LE(1, off + 4);
    header.writeUInt16LE(32, off + 6);
    header.writeUInt32LE(data.length, off + 8);
    header.writeUInt32LE(start, off + 12);
    start += data.length;
  });
  return Buffer.concat([header, ...images]);
}
export function generateBrandIcons() {
  writeFileSync(asset('favicon.svg'), dark);
  writeFileSync(asset('favicon-dark.svg'), dark);
  // Preserve the old light favicon URL, but serve the same dark artwork.
  writeFileSync(asset('favicon-light.svg'), dark);
  writeFileSync(asset('favicon.ico'), faviconIco(opaqueDark));
  writeFileSync(asset('icon-maskable.svg'), maskable);
  for (const size of [180, 192, 512]) {
    const name = size === 180 ? 'apple-touch-icon.png' : 'icon-' + size + '.png';
    writeFileSync(asset(name), raster(opaqueDark, size));
  }
  writeFileSync(asset('icon-maskable-512.png'), raster(maskable, 512));
  // Retain the legacy filename as an identical dark-mode asset alias.
  writeFileSync(asset('icon-light-512.png'), raster(opaqueDark, 512));
  const ogPath = asset('og-card.svg');
  const oldOg = readFileSync(ogPath, 'utf8');
  const framedMark = '<svg x="58" y="54" width="43" height="43" viewBox="' + viewBox + '">' + contents(dark) + '</svg>';
  const result = oldOg.replace(/<svg x="58" y="54"[\s\S]*?<\/svg>/, framedMark);
  if (result === oldOg && !oldOg.includes(framedMark)) {
    throw new Error('Static OG symbol anchor missing; cannot update without overwriting other art');
  }
  writeFileSync(ogPath, result);
  console.log('DCXR dark source vector -> theme-independent favicons, touch icon and PWA icons');
}
