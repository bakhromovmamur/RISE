import { parentPort,workerData } from 'node:worker_threads';
import {load} from './compute.mjs';
const compute=await load(workerData.root);
parentPort.on('message',({id,records,context,mode})=>{
  try{const start=performance.now(),result=compute(mode==='json'?JSON.parse(records):records,context);
    const output=mode==='json'?JSON.stringify(result):result;
    parentPort.postMessage({id,output,workerMs:performance.now()-start});
  }catch(error){parentPort.postMessage({id,error:error.message});}
});
parentPort.postMessage({ready:true});
