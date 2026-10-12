import satori from 'satori';
import { getOgPages } from './og-registry.mjs';
import { createElement as h } from 'react';
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { generateBrandIcons } from './generate-brand-icons.mjs';

const PAGES = getOgPages();
const INTER_REGULAR = readFileSync(new URL('./fonts/Inter-Regular.ttf', import.meta.url));
const INTER_BOLD = readFileSync(new URL('./fonts/Inter-Bold.ttf', import.meta.url));
const W = 1200;
const H = 630;
// Designer-supplied DCXR dark artwork for route-specific OG cards.
const BRAND_SVG = readFileSync(new URL('../public/brand/SVG/dcxr-dark.svg', import.meta.url), 'utf8');
const BRAND_DATA_URI = 'data:image/svg+xml;base64,' + Buffer.from(BRAND_SVG).toString('base64');

const C = Object.freeze({
  base: '#111113', panel: '#171719', inset: '#202023',
  line: '#303034', weakLine: '#242427',
  text: '#f5f5f5', muted: '#a1a1aa', subtle: '#777781',
  accent: '#aaff00', accentText: '#192700',
});

const div = (style, ...children) => h('div', {style: {display: 'flex', ...style}}, ...children);
const txt = (value, style = {}) => div({fontFamily: 'Inter', ...style}, value);

const bordered = (style = {}) => ({
  backgroundColor: C.panel,
  borderWidth: 1, borderStyle: 'solid', borderColor: C.line, ...style,
});

function filename(path) {
  return path === '/' ? 'og-image.png' : 'og/' + path.split('/').filter(Boolean).join('-') + '.png';
}

function railButton(active) {
  return div({
    height: 31, width: 31, borderRadius: 6, justifyContent: 'center', alignItems: 'center',
    backgroundColor: active ? '#aaff00' : C.inset,
    borderWidth: 1, borderStyle: 'solid', borderColor: active ? C.accent : C.line,
  }, div({
    height: active ? 13 : 12, width: active ? 13 : 12, borderRadius: 3,
    borderWidth: 2, borderStyle: 'solid', borderColor: active ? C.accentText : C.muted,
  }));
}

function previewPanel(label, value) {
  return div({...bordered({backgroundColor: C.inset, borderRadius: 6}),
    minHeight: 73, flexDirection: 'column', padding: '13px 14px', gap: 7},
  txt(label, {color: C.muted, fontSize: 12, fontWeight: 600, letterSpacing: '.8px'}),
  txt(value, {color: C.text, fontSize: 19, fontWeight: 620, lineHeight: 1.15}));
}

/**
 * The OG composition is deliberately an application workbench instead of
 * promotional art: dense navigation rail, precise type, semantic result
 * inspector, solid zinc, and the identical #aaff00 studio accent.
 */
function renderPage(page, number) {
  const longest = Math.max(...page.title.map(line => line.length));
  const headingSize = longest > 20 ? 52 : longest > 15 ? 59 : 68;
  const numberText = String(number).padStart(2, '0');

  return div({
    width: W, height: H, flexDirection: 'column', backgroundColor: C.base,
    color: C.text, fontFamily: 'Inter',
  },
    // Compact macOS-style top chrome, not a marketing navbar.
    div({
      height: 68, flexShrink: 0, alignItems: 'center',
      padding: '0 28px', gap: 13, backgroundColor: C.panel,
      borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: C.line,
    },
       div({width: 34, height: 34,
         justifyContent: 'center', alignItems: 'center'},
         h('img', {src: BRAND_DATA_URI, width: 34, height: 34,
           style: {width: 34, height: 34}})),
      txt('Decarboxulator', {fontSize: 20, fontWeight: 740, letterSpacing: '-.5px'}),
      div({height: 23, width: 1, backgroundColor: C.line, marginLeft: 5, marginRight: 2}),
      txt('Studio', {fontSize: 16, fontWeight: 550, color: C.muted}),
      div({flex: 1}),
      div({...bordered({borderRadius: 5, backgroundColor: C.inset}), height: 27,
        padding: '0 10px', alignItems: 'center'},
        txt('WORKSPACE', {fontSize: 11, fontWeight: 650, letterSpacing: '.8px', color: C.muted})),
      div({height: 8, width: 8, backgroundColor: C.accent, borderRadius: 10}),
    ),
    div({flex: 1, minHeight: 0, flexDirection: 'row'},
      // Persistent narrow rail, mirroring the V4 mobile app.
      div({width: 67, flexShrink: 0, alignItems: 'center', flexDirection: 'column',
        borderRightWidth: 1, borderRightStyle: 'solid', borderRightColor: C.line,
        paddingTop: 24, gap: 14, backgroundColor: '#141416'},
        railButton(true), railButton(false), railButton(false),
        div({flex: 1}),
        railButton(false),
        div({height: 19}),
      ),
      // Calculator workbench
      div({width: 768, padding: '45px 49px 28px 49px', flexDirection: 'column', minWidth: 0},
        div({gap: 12, alignItems: 'center'},
          div({width: 7, height: 7, backgroundColor: C.accent, borderRadius: 2}),
          txt(page.section, {fontSize: 13, fontWeight: 700, color: C.muted, letterSpacing: '1.25px'}),
        ),
        div({height: 24}),
        div({flexDirection: 'column', gap: 0},
          ...page.title.map(line =>
            txt(line, {fontSize: headingSize, letterSpacing: '-2.8px',
              fontWeight: 760, lineHeight: 1.10, color: C.text}))),
        div({width: 58, height: 4, borderRadius: 2, marginTop: 25, backgroundColor: C.accent}),
        txt(page.description, {fontSize: 21, lineHeight: 1.55, fontWeight: 430,
          color: C.muted, marginTop: 23, maxWidth: 625}),
        div({flex: 1}),
        div({gap: 10, alignItems: 'center'},
          div({...bordered({borderRadius: 5, backgroundColor: C.inset}),
            padding: '8px 11px', alignItems: 'center', gap: 7},
            div({width: 6, height: 6, borderRadius: 2, backgroundColor: C.accent}),
            txt('CALCULATION REFERENCE', {fontSize: 11, fontWeight: 660, letterSpacing: '.5px', color: C.muted})),
          txt(page.detail, {fontSize: 11, fontWeight: 580, letterSpacing: '.5px', color: C.subtle}),
        ),
      ),
      // Output inspector: one component, route-aware content.
      div({width: 365, padding: '28px 24px', flexDirection: 'column',
        borderLeftWidth: 1, borderLeftStyle: 'solid', borderLeftColor: C.line,
        backgroundColor: C.panel},
        div({justifyContent: 'space-between', alignItems: 'center'},
          txt('OUTPUT INSPECTOR', {fontSize: 12, fontWeight: 700,
            letterSpacing: '1.05px', color: C.muted}),
          txt(numberText, {fontSize: 12, fontWeight: 660, color: C.subtle})),
        div({height: 1, backgroundColor: C.line, marginTop: 18}),
        div({height: 30}),
        txt(page.value, {fontSize: page.value.length > 8 ? 47 : 61,
          fontWeight: 745, letterSpacing: '-2.4px', color: C.accent, lineHeight: 1.1}),
        txt(page.valueLabel, {fontSize: 12, fontWeight: 660, letterSpacing: '.8px',
          color: C.muted, marginTop: 7, lineHeight: 1.4}),
        div({height: 26}),
        div({backgroundColor: C.line, height: 6, borderRadius: 3, overflow: 'hidden'},
          div({width: 180, height: 6, borderRadius: 3, backgroundColor: C.accent})),
        div({height: 26}),
        previewPanel('INPUT', page.input),
        div({height: 8}),
        previewPanel('OUTPUT', page.output),
        div({flex: 1}),
        txt('MODEL / REFERENCE  •  ' + String(number + 1).padStart(2, '0'),
          {fontSize: 11, fontWeight: 610, color: C.subtle, letterSpacing: '.5px'}),
      ),
    ),
    div({height: 47, flexShrink: 0, alignItems: 'center', justifyContent: 'space-between',
      padding: '0 27px', backgroundColor: C.panel, borderTopWidth: 1,
      borderTopStyle: 'solid', borderTopColor: C.line},
      txt('Created by Jackson Cummings  ·  thedabcorner.site', {
        fontSize: 12, fontWeight: 620, color: C.muted}),
      txt('github.com/thelabcorner/decarboxulator  ·  ' + numberText,
        {fontSize: 11, fontWeight: 540, color: C.subtle}),
    ),
  );
}

mkdirSync(new URL('../public/og/', import.meta.url), {recursive: true});
for (const [index, page] of PAGES.entries()) {
  const svg = await satori(renderPage(page, index), {
    width: W, height: H, embedFont: true,
    fonts: [
      {name: 'Inter', data: INTER_REGULAR, weight: 400, style: 'normal'},
      {name: 'Inter', data: INTER_BOLD, weight: 700, style: 'normal'},
    ],
  });
  const path = filename(page.path);
  writeFileSync(new URL('../public/' + path, import.meta.url),
    new Resvg(svg, {fitTo: {mode: 'width', value: W}}).render().asPng());
  console.log('OG', path);
}

generateBrandIcons();
console.log('Satori: generated ' + PAGES.length + ' discovered route OG images and DCXR v4 app icons.');
