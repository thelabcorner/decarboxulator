import { fitTrackerKinetics, type KineticReading } from '../lib/trackerKinetics';
type Request={id:number;readings:KineticReading[];startedAt:number;
  options:{readabilityG?:number;expectedLossG?:number;bootstrap?:number}};
self.onmessage=(event:MessageEvent<Request>)=>{
  const {id,readings,startedAt,options}=event.data;
  try {
    self.postMessage({id,result:fitTrackerKinetics(readings,startedAt,options)});
  } catch(error) {
    self.postMessage({id,error:error instanceof Error?error.message:'Kinetic fitting error'});
  }
};
