import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ActivationDeltaMark } from '../src/components/ActivationDeltaMark';

const asset = (name: string) =>
  readFileSync(new URL('../public/' + name, import.meta.url), 'utf8');

const shapePaths = (svg: string) => [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)]
  .map(match => match[1]);
const atomGeometry = (svg: string) => [...svg.matchAll(
  /<circle\b[^>]*\bcx="([^"]+)"\s+cy="([^"]+)"\s+r="([^"]+)"/g,
)].map(([, x, y, radius]) => [x, y, radius]);
const pngDimensions = (name: string) => {
  const buffer = readFileSync(new URL('../public/' + name, import.meta.url));
  expect(buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
};

describe('Activation Delta identity', () => {
  it('keeps the UI mark geometrically identical to its canonical vector asset', () => {
    const rendered = renderToStaticMarkup(<ActivationDeltaMark />);
    const canonical = asset('brand/activation-delta.svg');
    expect(shapePaths(rendered)).toEqual(shapePaths(canonical));
    expect(shapePaths(rendered)).toHaveLength(3);
    expect(atomGeometry(rendered)).toEqual(atomGeometry(canonical));
    expect(atomGeometry(rendered)).toHaveLength(3);
    expect(rendered).toContain('var(--brand-mark-delta, #aaff00)');
    expect(rendered).toContain('var(--brand-mark-molecule, #f5f7f6)');
    expect(canonical).toContain('stroke="#aaff00"');
    expect(canonical).toContain('fill="#f5f7f6"');
    const ogLogo = asset('og-card.svg').match(/<svg x="58"[\s\S]*?<\/svg>/)?.[0] ?? '';
    expect(shapePaths(ogLogo)).toEqual(shapePaths(canonical));
    expect(atomGeometry(ogLogo)).toEqual(atomGeometry(canonical));
  });

  it('uses the new delta symbol for the browser and installed app', () => {
    const mark = 'M43 17 13 75h61L43 17Z';
    for (const file of ['favicon.svg', 'icon-maskable.svg']) {
      expect(asset(file)).toContain(mark);
      expect(atomGeometry(asset(file))).toHaveLength(3);
      expect(asset(file)).toContain('fill="#111113"');
    }
    for (const [file, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192],
      ['icon-512.png', 512], ['icon-maskable-512.png', 512]] as const) {
      expect(pngDimensions(file)).toEqual([size, size]);
    }
    const manifest = JSON.parse(asset('site.webmanifest'));
    expect(manifest.icons).toContainEqual(expect.objectContaining({
      src: 'icon-maskable-512.png?v=activation-delta-3', purpose: 'maskable',
    }));
    expect(manifest.icons.filter((icon: {purpose: string}) => icon.purpose === 'any')).toHaveLength(2);
  });

  it('sets the same branded browser chrome color in HTML and PWA metadata', () => {
    const route = readFileSync(new URL('../src/routes/__root.tsx', import.meta.url), 'utf8');
    const manifest = JSON.parse(asset('site.webmanifest'));
    expect(route).toContain("name: 'theme-color', content: '#aaff00'");
    expect(route).toContain('site.webmanifest?v=lime-chrome-1');
    expect(manifest.theme_color).toBe('#aaff00');
    // Keep launch/splash surfaces neutral; theme chrome is not a page background.
    expect(manifest.background_color).toBe('#fafafa');
  });
});