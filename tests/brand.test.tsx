import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DcxrMark } from '../src/components/DcxrMark';

const asset = (name: string) =>
  readFileSync(new URL('../public/' + name, import.meta.url), 'utf8');
const pngDimensions = (name: string) => {
  const buffer = readFileSync(new URL('../public/' + name, import.meta.url));
  expect(buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
};
const pathGeometry = (svg: string) =>
  [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map(match => match[1]);

describe('Designer-authored Decarboxulator v4 identity', () => {
  it('preserves both uploaded vectors and switches application branding by theme', () => {
    const light = asset('brand/SVG/dcxr-light.svg');
    const dark = asset('brand/SVG/dcxr-dark.svg');
    expect(light).toContain('viewBox="0 0 652.24 652.24"');
    expect(dark).toContain('viewBox="0 0 652.24 652.24"');
    expect(light).toContain('fill: #af0');
    expect(dark).toContain('fill: #af0');
    expect(light).toContain('<rect class="cls-1"');
    expect(dark).toContain('<rect class="cls-3"');
    expect(pathGeometry(light)).toEqual(pathGeometry(dark));
    expect(pathGeometry(light)).toHaveLength(6);

    const rendered = renderToStaticMarkup(<DcxrMark />);
    expect(rendered).toContain('brand/SVG/dcxr-light.svg');
    expect(rendered).toContain('brand/SVG/dcxr-dark.svg');
    const css = asset('../src/index.css');
    expect(css).toContain(':root.dark .dcxr-mark-light { display: none !important; }');
    expect(css).toContain(':root.dark .dcxr-mark-dark { display: block !important; }');
    const ogSource = asset('og-card.svg');
    // Editable OG composition reuses the original path shapes, not a re-trace.
    for (const path of pathGeometry(dark)) expect(ogSource).toContain(path);
    const ogGenerator = readFileSync(new URL('../scripts/render-assets.mjs', import.meta.url), 'utf8');
    expect(ogGenerator).toContain("brand/SVG/dcxr-dark.svg");
  });

  it('regenerates browser, touch, and PWA icons from the authored source', () => {
    const light = asset('brand/SVG/dcxr-light.svg');
    const dark = asset('brand/SVG/dcxr-dark.svg');
    expect(asset('favicon-light.svg')).toBe(light);
    expect(asset('favicon-dark.svg')).toBe(dark);
    expect(asset('favicon.svg')).toBe(dark);
    const maskable = asset('icon-maskable.svg');
    expect(maskable).toContain('scale(0.7)');
    expect(maskable).toContain('fill="#212121"');
    for (const path of pathGeometry(dark)) expect(maskable).toContain(path);
    for (const [name, size] of [
      ['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512],
      ['icon-maskable-512.png', 512], ['icon-light-512.png', 512],
    ] as const) expect(pngDimensions(name)).toEqual([size, size]);
    const ico = readFileSync(new URL('../public/favicon.ico', import.meta.url));
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(3);
    expect([ico[6], ico[22], ico[38]]).toEqual([16, 32, 48]);
  });

  it('declares new light/dark favicons, iOS touch artwork, and versioned PWA assets', () => {
    const root = readFileSync(new URL('../src/routes/__root.tsx', import.meta.url), 'utf8');
    const manifest = JSON.parse(asset('site.webmanifest'));
    expect(root).toContain('favicon-light.svg?v=dcxr-v4-1');
    expect(root).toContain('favicon-dark.svg?v=dcxr-v4-1');
    expect(root).toContain('favicon.ico?v=dcxr-v4-1');
    expect(root).toContain('apple-touch-icon.png?v=dcxr-v4-1');
    expect(root).toContain('site.webmanifest?v=dcxr-v4-1');
    expect(manifest.icons).toContainEqual(expect.objectContaining({
      src: 'icon-maskable-512.png?v=dcxr-v4-1', purpose: 'maskable',
    }));
    expect(manifest.icons.filter((icon: {purpose: string}) => icon.purpose === 'any')).toHaveLength(2);
    expect(root).toContain("name: 'theme-color', content: '#aaff00'");
    expect(manifest.theme_color).toBe('#aaff00');
    expect(manifest.background_color).toBe('#fafafa');
  });
});
