import { useEffect, useMemo, useRef, useState } from 'react';
import { fitTrackerKinetics, type KineticResult } from './trackerKinetics';
import type { TrackerPoint } from './trackerAnalytics';
import type { TrackerReading } from './workspacePayload';

interface Job{
  readings:{timestamp:number;completion:number;temperatureC?:number}[];
  startedAt:number;
  options:{readabilityG?:number;expectedLossG?:number};
}
/** Off-main-thread nonlinear fitting: new readings invalidate old worker replies.
 * The initial SSR pass never constructs Worker (browser-only effect).
 */
export function useTrackerKinetics(points:TrackerPoint[],startedAt:number,
  readabilityG:number|undefined,expectedLossG:number|undefined,
  rawReadings:TrackerReading[]=[],initialMassG?:number):KineticResult|null{
  const job=useMemo<Job|null>(()=>startedAt>0?{
    readings:expectedLossG&&initialMassG!==undefined
      ?rawReadings.map(p=>({timestamp:p.timestamp,
        completion:100*(initialMassG-p.weightG)/expectedLossG,
        temperatureC:p.temperatureC}))
      :points.map(p=>({timestamp:p.timestamp,completion:p.snapshot.completion,
        temperatureC:p.temperatureC})),
    startedAt,options:{readabilityG,expectedLossG},
  }:null,[points,startedAt,readabilityG,expectedLossG,rawReadings,initialMassG]);
  const [done,setDone]=useState<{job:Job;result:KineticResult}|null>(null);
  const workerRef=useRef<Worker|null>(null);
  const generation=useRef(0);
  useEffect(()=>{
    if(!job)return;
    const revision=++generation.current;
    let active=true;
    let delayed:ReturnType<typeof setTimeout>|null=null;
    const fallback=()=>{
      delayed=setTimeout(()=>{
        if(!active||revision!==generation.current)return;
        try{setDone({job,result:fitTrackerKinetics(job.readings,job.startedAt,job.options)});}
        catch{ /* No invented forecast on failed model fitting. */ }
      },0);
    };
    try {
      if(typeof Worker==='undefined'){fallback();}
      else{
        if(!workerRef.current){
          workerRef.current=new Worker(new URL('../workers/trackerKinetics.worker.ts',import.meta.url),
            {type:'module',name:'tracker-kinetic-fit'});
        }
        const worker=workerRef.current;
        worker.onmessage=(event:MessageEvent<{id:number;result?:KineticResult;error?:string}>)=>{
          if(!active||event.data.id!==revision||generation.current!==revision)return;
          if(event.data.result)setDone({job,result:event.data.result});
          else fallback();
        };
        worker.onerror=()=>{
          if(!active||generation.current!==revision)return;
          worker.terminate();
          workerRef.current=null;
          fallback();
        };
        worker.postMessage({id:revision,...job});
      }
    }catch{
      workerRef.current?.terminate();workerRef.current=null;fallback();
    }
    return ()=>{active=false;if(delayed!==null)clearTimeout(delayed);};
  },[job]);
  useEffect(()=>()=>{workerRef.current?.terminate();workerRef.current=null;},[]);
  return job&&done?.job===job?done.result:null;
}
