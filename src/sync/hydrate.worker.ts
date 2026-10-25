import { hydrate, type Records } from "../contracts/personalRecords";
self.onmessage=(event:MessageEvent<Records>)=>{try{self.postMessage({ok:true,state:hydrate(event.data)});}catch{self.postMessage({ok:false});}};
