import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../dist/client/',import.meta.url));
const redirects=JSON.parse(readFileSync(new URL('./legacy-redirects.json',import.meta.url),'utf8'));
const base='/' + (process.env.VITE_BASE_PATH || '/').split('/').filter(Boolean).join('/') + '/';
const publicBase=base==='//' ? '/' : base;
const site=(process.env.VITE_SITE_URL || 'https://thelabcorner.github.io/decarboxulator/').replace(/\/?$/,'/');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const style=`<style>
:root{color-scheme:dark;--bg:#09090b;--panel:#111113;--border:#27272a;--ink:#fafafa;--muted:#a1a1aa;--lime:#aaff00}
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--bg);color:var(--ink)}
body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;min-height:100dvh;display:grid;place-items:center;padding:20px}
main{width:min(100%,480px);background:var(--panel);border:1px solid var(--border);border-radius:14px;overflow:hidden;box-shadow:0 20px 64px #0003}
header{display:flex;align-items:center;gap:11px;padding:16px 22px;border-bottom:1px solid var(--border);font-size:13px;font-weight:750}
.logo{display:grid;place-items:center;width:31px;height:31px;border:1px solid #aaff0050;background:#aaff0012;border-radius:8px;color:var(--lime);font-size:21px;line-height:1}
.tag{margin-left:auto;border:1px solid #aaff0030;border-radius:5px;padding:5px 7px;color:var(--lime);font-size:10px;letter-spacing:.8px}
section{padding:28px 24px 24px}.eyebrow{font-size:10px;color:var(--lime);font-weight:800;letter-spacing:1.4px;text-transform:uppercase}
h1{font-size:25px;font-weight:760;line-height:1.22;letter-spacing:-.9px;margin:12px 0 10px}
p{font-size:13px;line-height:1.6;color:var(--muted);margin:0 0 25px}
.cta{display:flex;align-items:center;justify-content:space-between;gap:10px;border-radius:8px;background:var(--lime);color:#09090b;text-decoration:none;padding:12px 14px;font-size:13px;font-weight:750}
.cta:focus-visible,footer a:focus-visible{outline:2px solid var(--lime);outline-offset:3px}
footer{padding:14px 24px;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:8px 14px;color:var(--muted);font-size:11px}
footer a{color:inherit;text-decoration:none}footer a:hover{text-decoration:underline}
@media(prefers-color-scheme:light){:root{color-scheme:light;--bg:#f4f4f5;--panel:#fff;--border:#e4e4e7;--ink:#18181b;--muted:#52525b}.logo{background:#18181b}.tag{color:#465c00}}
@media(max-width:390px){body{padding:12px}header,footer{padding-left:18px;padding-right:18px}section{padding:24px 18px}h1{font-size:23px}}
</style>`;
const shell=(title,detail,destination,action='Open the updated calculator')=>
  '<main><header><span class="logo" aria-hidden="true">Δ</span><span>Decarboxulator</span><span class="tag">V4 / CURRENT</span></header>'+
  '<section><span class="eyebrow">Calculator migration</span><h1>'+esc(title)+'</h1><p>'+esc(detail)+'</p>'+
  '<a class="cta" href="'+esc(destination)+'"><span>'+esc(action)+'</span><span aria-hidden="true">↗</span></a></section>'+
  '<footer><span>Jackson Cummings</span><a href="https://thedabcorner.site">TheDabCorner</a>'+
  '<a href="https://github.com/thelabcorner/decarboxulator">GitHub source</a></footer></main>';

if(!existsSync(join(root,'index.html')))throw new Error('Build prerendered pages before generating redirects');
const targetExists=target=>existsSync(target==='/'?join(root,'index.html'):join(root,target.slice(1),'index.html'));
for(const {legacy,target,reverseHash} of redirects){
  if(!/^pages\/[a-z0-9/.-]+\.html$/.test(legacy)||legacy.includes('..'))throw new Error('Unsafe legacy path: '+legacy);
  if(!/^\/(?:[a-z0-9-]+\/)*$/.test(target))throw new Error('Unsafe target: '+target);
  if(!targetExists(target))throw new Error('Redirect target is not prerendered: '+target);
  const destination=publicBase+target.replace(/^\//,'');
  const canonical=new URL(target.replace(/^\//,''),site).toString();
  const reverse=reverseHash?publicBase+'tools/thc-to-thca/':null;
  const markup=[
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="robots" content="noindex,follow">',
    '<meta name="theme-color" content="#aaff00">',
    '<title>Calculator moved | Decarboxulator V4</title>',
    '<link rel="canonical" href="'+esc(canonical)+'">',
    style,
    // Keep hash-aware navigation in the browser. URL fragments never reach HTTP servers.
    '<script>(()=>{const path='+JSON.stringify(destination)+';const reverse='+JSON.stringify(reverse)+';'+
    'const url=new URL(location.href);const to=reverse&&/^#(?:backward|reverse)$/i.test(url.hash)?reverse:path;'+
    'location.replace(to+url.search)})()</script>',
    '<meta http-equiv="refresh" content="0;url='+esc(destination)+'">',
    '</head><body>',
    shell('Your calculator has a new home.',
      'You followed a historical Decarboxulator link. Opening the corresponding V4 tool with a redesigned scientific workspace.',
      destination),
    '</body></html>',
  ].join('\n');
  const variants=[legacy];
  if(!legacy.endsWith('/index.html'))variants.push(legacy.replace(/\.html$/,'/index.html'));
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
    publicBase+'tools/decarb-tracker/','Open the progress tracker'),
  '<p hidden>The old experimental time predictor was not a working calculator.</p>',
  '<p hidden><a href="'+esc(publicBase+'learn/decarboxylation-math/')+'">Read about reaction rate and measurement limits</a></p>',
  '</body></html>',
].join('\n');
for(const path of ['pages/time-predictor.html','pages/time-predictor/index.html']){
  const full=join(root,path);mkdirSync(dirname(full),{recursive:true});writeFileSync(full,retired+'\n');
}
console.log('Generated '+redirects.length+' historical calculator redirects, '+redirects.filter(x=>!x.legacy.endsWith('/index.html')).length+
  ' directory aliases, and two retired predictor notices.');
