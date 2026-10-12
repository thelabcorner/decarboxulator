/**
 * Idempotent Cloudflare DNS and redirect setup for the GitHub Pages migration.
 * Usage: CLOUDFLARE_API_TOKEN=... node scripts/setup-domain.mjs --apply
 * Requires Zone DNS Edit + Dynamic URL Redirects Write scoped to thedabcorner.site.
 * Never changes unrelated DNS entries or rules.
 */
const DOMAIN='thedabcorner.site';
const PRIMARY='dcxr.'+DOMAIN;
const ALIAS='decarboxulator.'+DOMAIN;
const TARGET='thelabcorner.github.io';
const REF='decarboxulator_alias_to_dcxr_v4';
const apply=process.argv.includes('--apply');
const verify=process.argv.includes('--verify');
const token=process.env.CLOUDFLARE_API_TOKEN;
const base='https://api.cloudflare.com/client/v4';
const exactExpression='http.host eq "'+ALIAS+'"';
const targetExpression='concat("https://'+PRIMARY+'", http.request.uri.path)';
const rule={
  ref:REF,
  description:'Canonical Decarboxulator V4 hostname: preserve path and query',
  expression:exactExpression,
  action:'redirect',
  enabled:true,
  action_parameters:{from_value:{target_url:{expression:targetExpression},status_code:301,preserve_query_string:true}},
};
async function api(path,method='GET',body,allowed=[]){
  const response=await fetch(base+path,{
    method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    ...(body?{body:JSON.stringify(body)}:{}),
    signal:AbortSignal.timeout(20000),
  });
  const payload=await response.json();
  if((!response.ok||!payload.success)&&!allowed.includes(response.status))
    throw new Error(method+' '+path+' ('+response.status+'): '+JSON.stringify(payload.errors||[]));
  return {status:response.status,...payload};
}
async function publicCheck(){
  for(const host of [PRIMARY,ALIAS]){
    const dns=await fetch('https://dns.google/resolve?name='+encodeURIComponent(host)+'&type=CNAME',{signal:AbortSignal.timeout(10000)}).then(r=>r.json());
    console.log('PUBLIC DNS',host,JSON.stringify({status:dns.Status,answer:dns.Answer?.map(x=>x.data)||[]}));
  }
  for(const url of ['https://'+PRIMARY+'/','https://'+ALIAS+'/tools/thca-to-thc/?v=1']){
    try{
      const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(12000)});
      console.log('PUBLIC HTTP',r.status,url,'Location:',r.headers.get('location')||'(none)');
    }catch(e){console.log('PUBLIC HTTP unavailable',url,String(e.message));}
  }
}
if(verify){await publicCheck();process.exit(0);}
if(!token){
  console.error('Set CLOUDFLARE_API_TOKEN with Zone DNS Edit, Zone Read, and Dynamic URL Redirects Write for '+DOMAIN+'.');
  console.error('The default Wrangler OAuth token cannot edit DNS or redirect rules.');
  process.exit(2);
}
const zones=await api('/zones?name='+encodeURIComponent(DOMAIN));
const zone=zones.result?.find(z=>z.name===DOMAIN&&z.status==='active');
if(!zone)throw new Error('Cloudflare zone is not active: '+DOMAIN);
const zid=zone.id;
const desired=[
  {type:'CNAME',name:PRIMARY,content:TARGET,proxied:false,ttl:1},
  {type:'CNAME',name:ALIAS,content:TARGET,proxied:true,ttl:1},
];
const actual=[];
for(const entry of desired){
  const query=new URLSearchParams({name:entry.name,per_page:'100'});
  const records=(await api('/zones/'+zid+'/dns_records?'+query)).result||[];
  if(records.length>1||records.some(x=>x.type!==entry.type||x.content.replace(/\.$/,'')!==entry.content))
    throw new Error('Existing '+entry.name+' DNS is incompatible; refusing to overwrite it: '+JSON.stringify(records.map(r=>({type:r.type,content:r.content,proxied:r.proxied}))));
  if(!records.length){
    console.log((apply?'CREATE':'WOULD CREATE'),entry.name,'CNAME',entry.content,entry.proxied?'proxied':'DNS-only');
    if(apply)await api('/zones/'+zid+'/dns_records','POST',entry);
  }else if(records[0].proxied!==entry.proxied){
    console.log((apply?'UPDATE':'WOULD UPDATE'),entry.name,'proxied:',entry.proxied);
    if(apply)await api('/zones/'+zid+'/dns_records/'+records[0].id,'PATCH',{proxied:entry.proxied});
  }else console.log('UNCHANGED',entry.name);
  actual.push(entry.name);
}
const phase='http_request_dynamic_redirect';
const entrypoint=await api('/zones/'+zid+'/rulesets/phases/'+phase+'/entrypoint','GET',undefined,[404]);
if(entrypoint.status===404){
  console.log((apply?'CREATE':'WOULD CREATE'),'Cloudflare single-redirect ruleset');
  if(apply)await api('/zones/'+zid+'/rulesets','POST',{name:'Decarboxulator canonical hostname redirects',kind:'zone',phase,rules:[rule]});
}else{
  const rules=entrypoint.result?.rules||[];
  const found=rules.find(r=>r.ref===REF||r.expression===exactExpression);
  if(found){
    const params=found.action_parameters?.from_value;
    if(found.action!=='redirect'||params?.target_url?.expression!==targetExpression||
       params?.status_code!==301||params?.preserve_query_string!==true||found.enabled===false)
      throw new Error('Existing Decarboxulator redirect rule has different behavior: inspect before changing it');
    console.log('UNCHANGED alias 301 redirect');
  }else{
    console.log((apply?'ADD':'WOULD ADD'),'alias 301 redirect, preserving path and query');
    if(apply)await api('/zones/'+zid+'/rulesets/'+entrypoint.result.id+'/rules','POST',rule);
  }
}
if(apply){
  console.log('Cloudflare DNS and 301 rule configured. GitHub Pages custom-domain activation is the remaining step.');
  await publicCheck();
}else console.log('DRY RUN: add --apply to commit these DNS and redirect changes.');
