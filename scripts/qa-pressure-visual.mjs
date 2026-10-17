import { webkit } from '@playwright/test';
import { startQASnapshot } from './qa-snapshot-server.mjs';
const s=await startQASnapshot({snapshotName:'qa-pressure-visual-'+process.pid});
try{
 const b=await webkit.launch({headless:true});
 try{
  for(const width of [320,390,1440]){
   const p=await b.newPage({viewport:{width,height:844},colorScheme:'dark'});
   for(const [route,file] of [['/tools/pressure-tracker/','tracker'],['/tools/max-pressure/','vessel'],['/tools/thc-to-thca/','inverse']]){
    await p.goto(s.base+route,{waitUntil:'networkidle'});
    await p.waitForTimeout(160);
    await p.evaluate(()=>{
      const e=document.querySelector('.content-main .scroll-view__viewport') || document.querySelector('.content-main');
      if(e)e.scrollTop=0;
      window.scrollTo(0,0);
    });
    await p.screenshot({path:'artifacts/visual-'+file+'-'+width+'.png',fullPage:false});
   }
   await p.close();
  }
 }finally{await b.close();}
 console.log('Visual captures: 9');
}finally{await s.close();}
