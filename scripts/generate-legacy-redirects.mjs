import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../dist/client/',import.meta.url));
const redirects=JSON.parse(readFileSync(new URL('./legacy-redirects.json',import.meta.url),'utf8'));
const base='/' + (process.env.VITE_BASE_PATH || '/').split('/').filter(Boolean).join('/') + '/';
const publicBase=base==='//' ? '/' : base;
const site=(process.env.VITE_SITE_URL || 'https://thelabcorner.github.io/decarboxulator/').replace(/\/?$/,'/');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// A dependency-free, responsive migration fallback: the browser normally redirects
// before painting, but users without working navigation still see a real V4 surface.
const style=`<style>
:root{color-scheme:light;--bg:#fafafa;--surface:#fff;--inset:#f8f8f9;--text:#18181b;--heading:#09090b;--muted:#52525b;--subtle:#71717a;--line:#e4e4e7;--soft:#eeeef0;--lime:#aaff00;--accent-ink:#304a00}
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--bg);color:var(--text)}
body{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;min-height:100svh;display:grid;place-items:center;padding:20px 16px;-webkit-font-smoothing:antialiased}
.migration{width:min(100%,500px);border:1px solid var(--line);border-radius:9px;background:var(--surface);overflow:hidden;box-shadow:0 15px 44px #09090b0b}
.topbar{display:flex;align-items:center;gap:11px;min-height:65px;padding:12px 24px;border-bottom:1px solid var(--soft)}
.brand-icon{width:36px;height:36px;border-radius:7px;background:#111113;display:grid;place-items:center;flex-shrink:0}
.brand-icon svg{width:32px;height:32px}.brand{display:flex;flex-direction:column;gap:2px;min-width:0}
.brand strong{font-size:14px;font-weight:700;letter-spacing:-.3px;color:var(--heading)}
.brand small{font-size:11px;font-weight:520;color:var(--subtle)}
.version{margin-left:auto;border:1px solid var(--line);border-radius:5px;padding:5px 8px;color:var(--muted);font-size:11px;font-weight:700;white-space:nowrap}
.content{padding:34px 28px 28px}.eyebrow{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:740;letter-spacing:.07em;text-transform:uppercase;color:var(--accent-ink)}
.signal{width:7px;height:7px;border-radius:50%;background:#77ad1a;box-shadow:0 0 0 3px #aaff0028}
h1{font-size:clamp(25px,6vw,31px);font-weight:740;line-height:1.18;letter-spacing:-1px;color:var(--heading);margin:17px 0 12px}
p{font-size:14px;line-height:1.65;color:var(--muted);margin:0 0 24px}
.destination{padding:12px 14px;margin-bottom:15px;border:1px solid var(--line);border-radius:6px;background:var(--inset);display:flex;justify-content:space-between;align-items:center;gap:14px}
.destination span{display:block;color:var(--subtle);font-size:11px;margin-bottom:5px}
.destination strong{font-size:14px;font-weight:650;overflow-wrap:anywhere}
.destination svg{width:17px;height:17px;color:var(--subtle);flex-shrink:0}
.cta{display:flex;align-items:center;justify-content:space-between;gap:10px;border-radius:6px;background:var(--lime);color:#111113;text-decoration:none;padding:13px 15px;font-size:14px;font-weight:740;min-height:46px}
.cta:hover{background:#baff33}.cta svg{width:17px;height:17px}
.note{display:flex;align-items:flex-start;gap:9px;margin-top:19px;padding-top:16px;border-top:1px solid var(--soft);color:var(--subtle);font-size:12px;line-height:1.55}
.note svg{width:15px;height:15px;flex-shrink:0;margin-top:1px}
.footer{padding:16px 28px;background:var(--inset);border-top:1px solid var(--soft);display:flex;flex-wrap:wrap;gap:8px 17px;align-items:center;font-size:12px;color:var(--muted)}
.footer a{color:var(--text);text-decoration:none}.footer a:hover{text-decoration:underline}
a:focus-visible{outline:3px solid #6a9b13;outline-offset:3px}
@media(prefers-color-scheme:dark){:root{color-scheme:dark;--bg:#0e0e10;--surface:#151517;--inset:#111113;--text:#e5e5e7;--heading:#fafafa;--muted:#a1a1aa;--subtle:#a1a1aa;--line:#2b2b2f;--soft:#252529;--accent-ink:#c1ec73}}
@media(max-width:420px){body{padding:14px}.topbar{padding:12px 18px}.content{padding:27px 20px 23px}.footer{padding:14px 20px}h1{letter-spacing:-.7px}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation:none!important;transition:none!important}}
</style>`;
// Exact Activation Delta brand geometry from src/components/ActivationDeltaMark.tsx.
const icon='<svg viewBox="0 0 100 100" fill="none" aria-hidden="true" focusable="false">'+
  '<path d="M43 17 13 75h61L43 17Z" stroke="#aaff00" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>'+
  '<path d="M43 58h17" stroke="#aaff00" stroke-width="8" stroke-linecap="round"/>'+
  '<path d="m67 36 14-15m0 0 8-8m-8 8-6-8" stroke="#f5f7f6" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'+
  '<circle cx="81" cy="21" r="4.5" fill="#f5f7f6"/><circle cx="90" cy="12" r="5.5" fill="#f5f7f6"/><circle cx="74" cy="12" r="3.5" fill="#f5f7f6"/></svg>';
const arrow='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
const info='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></svg>';
const toolNames={
  '/':'Calculator studio','/tools/thca-to-thc/':'THCa to THC','/tools/thc-to-thca/':'THC to THCa',
  '/tools/batch-yield/':'Batch yield','/tools/thca-percentage/':'THCa from mass loss',
  '/tools/edible-dosage/':'Edible dosage','/tools/max-pressure/':'Vessel pressure',
  '/tools/decarb-tracker/':'Decarboxylation tracker',
  '/tools/cartridge-formulation/':'Cartridge formulation',
  '/learn/decarboxylation-math/':'Decarboxylation science',
};
const shell=(title,detail,destination,action='Open the updated calculator',label='Calculator studio')=>
  '<main class="migration"><div class="topbar"><span class="brand-icon">'+icon+'</span>'+
  '<div class="brand"><strong>Decarboxulator</strong><small>Scientific calculation studio</small></div>'+
  '<span class="version">V4 · CURRENT</span></div>'+
  '<section class="content" aria-labelledby="migration-title">'+
  '<div class="eyebrow"><span class="signal" aria-hidden="true"></span>Link updated</div>'+
  '<h1 id="migration-title">'+esc(title)+'</h1><p>'+esc(detail)+'</p>'+
  '<div class="destination"><div><span>Opening in Decarboxulator V4</span><strong>'+esc(label)+'</strong></div>'+arrow+'</div>'+
  '<a class="cta" href="'+esc(destination)+'"><span>'+esc(action)+'</span>'+arrow+'</a>'+
  '<div class="note">'+info+'<span>This historic address is preserved for bookmarks and search results. If navigation does not complete automatically, use the button above.</span></div>'+
  '</section><footer class="footer"><span>By Jackson Cummings</span>'+
  '<a href="https://thedabcorner.site/">TheDabCorner</a>'+
  '<a href="https://github.com/thelabcorner/decarboxulator">GitHub source</a>'+
  '</footer></main>';


if(!existsSync(join(root,'index.html')))throw new Error('Build prerendered pages before generating redirects');
const targetExists=target=>existsSync(target==='/'?join(root,'index.html'):join(root,target.slice(1),'index.html'));
for(const {legacy,target,reverseHash} of redirects){
  if(!/^(?:index-old|pages\/[a-z0-9/.-]+)\.html$/.test(legacy)||legacy.includes('..'))throw new Error('Unsafe legacy path: '+legacy);
  if(!/^\/(?:[a-z0-9-]+\/)*$/.test(target))throw new Error('Unsafe target: '+target);
  if(!targetExists(target))throw new Error('Redirect target is not prerendered: '+target);
  const destination=publicBase+target.replace(/^\//,'');
  const canonical=new URL(target.replace(/^\//,''),site).toString();
  const reverse=reverseHash?publicBase+'tools/thc-to-thca/':null;
  const markup=[
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    // Do not put noindex on moving URLs. The instant meta refresh and matching
    // canonical signal consolidation; noindex is a competing exclusion signal.
    '<meta name="theme-color" content="#aaff00">',
    '<title>'+esc(toolNames[target]||'Calculator')+' moved | Decarboxulator V4</title>',
    '<meta name="description" content="This historic Decarboxulator calculator URL has moved to the corresponding V4 scientific calculation tool.">',
    '<link rel="canonical" href="'+esc(canonical)+'">',
    style,
    // Keep hash-aware navigation in the browser. URL fragments never reach HTTP servers.
    '<script>(()=>{const path='+JSON.stringify(destination)+';const reverse='+JSON.stringify(reverse)+';'+
    'const url=new URL(location.href);const to=reverse&&/^#(?:backward|reverse)$/i.test(url.hash)?reverse:path;'+
    'location.replace(to+url.search)})()</script>',
    '<meta http-equiv="refresh" content="0;url='+esc(destination)+'">',
    '</head><body>',
    shell('Upgrading your experience.',
      'You are being taken to the latest Decarboxulator V4 experience, with an updated scientific workspace and the calculator you came for.',
      destination,'Continue to '+(toolNames[target]||'calculator'),toolNames[target]||'Calculator'),
    '</body></html>',
  ].join('\n');
  const variants=[legacy];
  // Only calculator paths had legacy extensionless URLs. index-old.html did not.
  if(legacy.startsWith('pages/')&&!legacy.endsWith('/index.html'))variants.push(legacy.replace(/\.html$/,'/index.html'));
  for(const path of variants){const full=join(root,path);mkdirSync(dirname(full),{recursive:true});writeFileSync(full,markup+'\n');}
}
// The retired V1 time predictor was not functional. Do not map it to a different model.
const retired=[
  '<!doctype html><html lang="en"><head><meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1">',
  '<meta name="robots" content="noindex,follow">',
  '<title>Time predictor retired | Decarboxulator</title>',style,
  '</head><body>',
  shell('The time predictor was retired.',
    'The historical time predictor was not a working calculator. No processing time can be inferred from its former inputs. The V4 tracker records actual measured weight change.',
    publicBase+'tools/decarb-tracker/','Open the progress tracker','Decarboxylation tracker'),
  '<p hidden>The old experimental time predictor was not a working calculator.</p>',
  '<p hidden><a href="'+esc(publicBase+'learn/decarboxylation-math/')+'">Read about reaction rate and measurement limits</a></p>',
  '</body></html>',
].join('\n');
for(const path of ['pages/time-predictor.html','pages/time-predictor/index.html']){
  const full=join(root,path);mkdirSync(dirname(full),{recursive:true});writeFileSync(full,retired+'\n');
}
console.log('Generated '+redirects.length+' historical page redirects, '+redirects.filter(x=>x.legacy.startsWith('pages/')&&!x.legacy.endsWith('/index.html')).length+
  ' directory aliases, and two retired predictor notices.');
