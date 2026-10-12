import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { APP_MAJOR_VERSION, GUIDE_PATH, NAV_ITEMS, TOOLS } from '../src/lib/site';
import { VersionBadge } from '../src/components/VersionBadge';

describe('Calculator release badges', () => {
  it('derives the suite release badge from package metadata', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(APP_MAJOR_VERSION).toBe('v' + pkg.version.split('.')[0]);
  });

  it('labels all and only calculators with the current suite release', () => {
    const versions = NAV_ITEMS.filter(item => item.version !== null);
    expect(versions).toHaveLength(TOOLS.length);
    expect(versions.map(item => item.path)).toEqual(TOOLS.map(tool => tool.path));
    expect(versions.every(item => item.version === APP_MAJOR_VERSION)).toBe(true);
    expect(NAV_ITEMS.find(item => item.path === '/')?.version).toBeNull();
    expect(NAV_ITEMS.find(item => item.path === GUIDE_PATH)?.version).toBeNull();
  });

  it('renders a quiet metadata badge with a release-specific tooltip', () => {
    const markup = renderToStaticMarkup(<VersionBadge version={APP_MAJOR_VERSION}/>);
    expect(markup).toContain('class="calculator-version-badge"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('Decarboxulator ' + APP_MAJOR_VERSION + ' release');
    expect(markup).toContain('>' + APP_MAJOR_VERSION + '</span>');
  });
});