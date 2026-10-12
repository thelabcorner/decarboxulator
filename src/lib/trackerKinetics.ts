/**
 * Empirical apparent-conversion kinetics, not direct chemical assays.
 * No temperature/Arrhenius claims are inferred from sparse mass measurements.
 * Time is anchored to the session start and normalized during fitting.
 */
export type KineticKind='first-order'|'stretched'|'induction'|'induction-stretched';
export type KineticReading={timestamp:number;completion:number;temperatureC?:number};
export type KineticCurvePoint={hours:number;estimate:number;lower:number|null;upper:number|null};
export type KineticResult={
  status:'insufficient'|'unidentifiable'|'fitted';reason:string;warnings:string[];
  count:number;used:number;excluded:number;model:KineticKind|null;
  kPerHour:number|null;shape:number|null;inductionHours:number|null;
  rSquared:number|null;rmsePercent:number|null;aicc:number|null;
  holdoutRmsePercent:number|null;
  elapsedHours:number;forecast90Hours:number|null;forecast95Hours:number|null;
  /** One standard deviation from independent start/current balance rounding. */
  balanceNoisePp:number|null;
  forecast90Range:[number,number]|null;forecast95Range:[number,number]|null;
  curve:KineticCurvePoint[];
};
type Pair={u:number;y:number};
type Fit={kind:KineticKind;logK:number;shape:number;lag:number;rss:number;aicc:number};
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
export const kineticPredict=(u:number,logK:number,shape:number,lag:number)=>
  100*-Math.expm1(-Math.pow(Math.exp(logK)*Math.max(0,u-lag),shape));
function error(data:Pair[],l:number,s:number,g:number,weight?:number[]){
  let sum=0;
  for(let i=0;i<data.length;i++){
    const d=kineticPredict(data[i].u,l,s,g)-data[i].y;
    sum+=(weight?.[i]??1)*d*d;
  }
  return sum;
}
function fitRate(data:Pair[],s:number,g:number,w?:number[],fast=false){
  let a=Math.log(.005),b=Math.log(1000),c=b-(b-a)*.61803398875,d=a+(b-a)*.61803398875;
  let ec=error(data,c,s,g,w),ed=error(data,d,s,g,w);
  for(let n=0;n<(fast?22:34);n++){
    if(ec<ed){b=d;d=c;ed=ec;c=b-(b-a)*.61803398875;ec=error(data,c,s,g,w);}
    else{a=c;c=d;ec=ed;d=a+(b-a)*.61803398875;ed=error(data,d,s,g,w);}
  }
  return ec<ed?{logK:c,rss:ec}:{logK:d,rss:ed};
}
function optimize(data:Pair[],kind:KineticKind,w?:number[],fast=false):Fit{
  const shapeGrid=kind.includes('stretched')
    ? fast?[.65,1,1.5,2.5]:[.5,.65,.8,1,1.25,1.6,2,2.7,3.6] : [1];
  const lagGrid=kind.startsWith('induction')
    ? fast?[0,.15,.3,.5]:[0,.06,.12,.18,.24,.3,.36,.44,.53,.6] : [0];
  let best:Fit={kind,logK:0,shape:1,lag:0,rss:Infinity,aicc:Infinity};
  function consider(shape:number,lag:number) {
    if(shape<.5||shape>4||lag<0||lag>.6)return false;
    const r=fitRate(data,shape,lag,w,fast);
    if(r.rss+1e-8>=best.rss)return false;
    best={...best,...r,shape,lag};
    return true;
  }
  for(const s of shapeGrid)for(const g of lagGrid)consider(s,g);
  let ds=.24,dl=.05;
  for(let i=0;i<(fast?9:18);i++){
    let changed=false;
    if(kind.includes('stretched')){
      changed=consider(best.shape+ds,best.lag)||changed;
      changed=consider(best.shape-ds,best.lag)||changed;
    }
    if(kind.startsWith('induction')){
      changed=consider(best.shape,best.lag+dl)||changed;
      changed=consider(best.shape,best.lag-dl)||changed;
    }
    if(!changed){ds*=.55;dl*=.55;}
  }
  const p=kind==='first-order'?1:kind==='induction-stretched'?3:2;
  const rss=error(data,best.logK,best.shape,best.lag);
  const n=data.length;
  // Gaussian AICc with fitted noise variance; computed on unweighted residuals.
  const np=p+1;
  const aicc=n>np+1?n*Math.log(Math.max(rss/n,1e-12))+2*np+
    2*np*(np+1)/(n-np-1):Infinity;
  return {...best,rss,aicc};
}
function fit(data:Pair[],kinds:KineticKind[],fast=false):Fit{
  let best:Fit|null=null;
  for(const kind of kinds){
    let current=optimize(data,kind,undefined,fast);
    // Huber IRLS: suppress isolated weighing anomalies without deleting them.
    for(let j=0;j<2;j++){
      const diffs=data.map(p=>Math.abs(p.y-kineticPredict(p.u,current.logK,current.shape,current.lag)));
      const sorted=[...diffs].sort((a,b)=>a-b);
      const scale=Math.max(.2,1.4826*sorted[Math.floor(sorted.length/2)]);
      current=optimize(data,kind,diffs.map(d=>Math.min(1,1.345*scale/Math.max(d,1e-9))),fast);
    }
    if(best===null||current.aicc<best.aicc)best=current;
  }
  return best!;
}
function targetTime(percent:number,fit:Fit,span:number):number|null{
  const h=(fit.lag+Math.pow(-Math.log1p(-percent/100),1/fit.shape)/Math.exp(fit.logK))*span;
  return Number.isFinite(h)&&h>=0&&h<=24*365?h:null;
}
function quantile(values:number[],p:number):number|null{
  if(values.length===0)return null;
  values.sort((a,b)=>a-b);
  const x=(values.length-1)*p,i=Math.floor(x);
  return values[i]+(values[Math.min(i+1,values.length-1)]-values[i])*(x-i);
}
function unfit(status:'insufficient'|'unidentifiable',reason:string,count:number,elapsedHours:number,warnings:string[],excluded:number):KineticResult {
  return {status,reason,warnings,count,used:count-excluded,excluded,model:null,kPerHour:null,
    shape:null,inductionHours:null,rSquared:null,rmsePercent:null,aicc:null,
    holdoutRmsePercent:null,elapsedHours,
    forecast90Hours:null,forecast95Hours:null,balanceNoisePp:null,
    forecast90Range:null,forecast95Range:null,curve:[]};
}
/**
 * Robust nonlinear fits with small-sample AICc model selection and deterministic
 * conditional wild-residual bootstrap. No false pointwise chemical confidence.
 */
export function fitTrackerKinetics(readings:KineticReading[],startedAt:number,
  options:{bootstrap?:number;readabilityG?:number;expectedLossG?:number}={}):KineticResult{
  const count=readings.length;
  const original=readings.filter(p=>Number.isFinite(p.timestamp)&&Number.isFinite(p.completion)&&
    p.timestamp>=startedAt).sort((a,b)=>a.timestamp-b.timestamp);
  const span=original.length?(original[original.length-1].timestamp-startedAt)/3600000:0;
  const valid=original.filter(p=>p.completion>=0&&p.completion<=100);
  const excluded=original.length-valid.length;
  const warnings:string[]=[];
  const balanceNoisePp=options.readabilityG!==undefined&&options.expectedLossG!==undefined&&
    Number.isFinite(options.readabilityG)&&Number.isFinite(options.expectedLossG)&&
    options.readabilityG>0&&options.expectedLossG>0
    ?100*options.readabilityG/(Math.sqrt(6)*options.expectedLossG):null;
  if(excluded)warnings.push(String(excluded)+' observation(s) beyond the CO2-only physical range excluded from fitting (not clamped).');
  if(valid.some((p,i)=>i>0&&p.completion+.15<valid[i-1].completion))
    warnings.push('Mass rebound or apparent conversion decline: inspect balance drift and volatile loss.');
  const temperatures=valid.map(p=>p.temperatureC).filter((x):x is number=>x!==undefined&&Number.isFinite(x));
  if(temperatures.length>=2&&Math.max(...temperatures)-Math.min(...temperatures)>10)
    warnings.push('Temperature varied >10 °C: empirical time profile only; not an isothermal rate constant.');
  if(valid[0]?.completion>5&&(valid[0].timestamp-startedAt)/3600000<.05)
    warnings.push('Initial observation is already >5% apparent conversion: verify run start and zero-loss baseline.');
  if(valid.length<5)return unfit('insufficient','Record at least five valid, time-separated measurements.',count,span,warnings,excluded);
  if(span<5/60)return unfit('insufficient','A five-minute measurement window is needed.',count,span,warnings,excluded);
  const full=valid.map(p=>({u:(p.timestamp-startedAt)/3600000/span,y:p.completion}));
  // Deterministic bounded sample to prevent expensive fitting on 500 records.
  const data=full.length<=140?full:Array.from({length:140},(_,i)=>full[Math.round(i*(full.length-1)/139)]);
  const ys=data.map(p=>p.y),spread=Math.max(...ys)-Math.min(...ys);
  if(spread<Math.max(8,5*(balanceNoisePp??0))||new Set(ys.map(x=>Math.round(x*10))).size<4)
    return unfit('unidentifiable','Insufficient observed conversion change to identify kinetics.',count,span,warnings,excluded);
  const kinds:KineticKind[]=['first-order'];
  if(data.length>=8)kinds.push('stretched','induction');
  if(data.length>=12)kinds.push('induction-stretched');
  const model=fit(data,kinds);
  const mean=ys.reduce((s,x)=>s+x,0)/ys.length;
  const tss=ys.reduce((s,x)=>s+(x-mean)**2,0);
  const rSquared=tss>0?1-model.rss/tss:null,rmse=Math.sqrt(model.rss/data.length);
  // Prospective-style time-blocked holdout: fit only earlier observations,
  // then score the latest ~20% without peeking at their values during fitting.
  // This is a single within-run check, not validation on another batch.
  let holdoutRmsePercent:number|null=null;
  if(data.length>=12) {
    const trainLength=Math.max(8,Math.floor(data.length*.8));
    const train=data.slice(0,trainLength);
    const holdout=data.slice(trainLength);
    const candidates:KineticKind[]=['first-order','stretched','induction'];
    if(train.length>=12)candidates.push('induction-stretched');
    const prior=fit(train,candidates,true);
    holdoutRmsePercent=Math.sqrt(holdout.reduce((s,p)=>
      s+(kineticPredict(p.u,prior.logK,prior.shape,prior.lag)-p.y)**2,0)/holdout.length);
  }
  const quality=data.length>=7&&(rSquared??-1)>=.82&&rmse<=12&&
    (holdoutRmsePercent===null||holdoutRmsePercent<=15);
  if(!quality)warnings.push('Forecast withheld: insufficient fit quality, time-blocked holdout accuracy or measurement coverage.');
  if(valid.some(p=>p.completion>=99))
    warnings.push('100% apparent loss cannot verify full THCa conversion independently.');
  const guard=(x:number|null)=>quality&&x!==null&&x<=3*span?x:null;
  const forecast90Hours=guard(targetTime(90,model,span));
  const forecast95Hours=guard(targetTime(95,model,span));
  const bootCount=clamp(Math.floor(options.bootstrap??24),0,64);
  let seed=2166136261>>>0;
  for(const v of ys)seed=Math.imul(seed^Math.floor(v*1000),16777619)>>>0;
  const ensembles:Fit[]=[];
  if(quality&&data.length>=8){
    for(let j=0;j<bootCount;j++){
      const generated=data.map(p=>{
        seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;seed>>>=0;
        const fitted=kineticPredict(p.u,model.logK,model.shape,model.lag);
        // Even near-perfect regression cannot make a rounded balance exact.
        const residual=p.y-fitted;
        const amplitude=Math.max(Math.abs(residual),balanceNoisePp??0);
        return {u:p.u,y:clamp(fitted+(seed&1?amplitude:-amplitude),0,100)};
      });
      ensembles.push(fit(generated,[model.kind],true));
    }
  }
  const maxTime=clamp(Math.max(span*1.2,Math.min(forecast95Hours??0,span*2.2)),span,span*2.5);
  const curve=Array.from({length:110},(_,i)=>{
    const hours=maxTime*i/109,u=hours/span;
    const estimates=ensembles.map(m=>kineticPredict(u,m.logK,m.shape,m.lag));
    return {hours,estimate:kineticPredict(u,model.logK,model.shape,model.lag),
      lower:quantile([...estimates],.1),upper:quantile([...estimates],.9)};
  });
  const range=(percent:number,forecast:number|null):[number,number]|null=>{
    if(forecast===null||ensembles.length<20)return null;
    const times=ensembles.map(m=>targetTime(percent,m,span)).filter((v):v is number=>v!==null&&v<=3*span);
    if(times.length<Math.max(16,ensembles.length*.7))return null;
    const lo=quantile([...times],.1),hi=quantile([...times],.9);
    return lo===null||hi===null?null:[lo,hi];
  };
  return {status:'fitted',reason:'Empirical model of apparent CO2-equivalent loss, not laboratory assay.',
    warnings,count,used:valid.length,excluded,model:model.kind,kPerHour:Math.exp(model.logK)/span,
    shape:model.shape,inductionHours:model.lag*span,rSquared,rmsePercent:rmse,aicc:model.aicc,
    holdoutRmsePercent,
    elapsedHours:span,balanceNoisePp,forecast90Hours,forecast95Hours,
    forecast90Range:range(90,forecast90Hours),
    forecast95Range:range(95,forecast95Hours),curve};
}
