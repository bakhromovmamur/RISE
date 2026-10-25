import { prepareGuestImport } from "./importModel";
import type { ImportSelection } from "./importModel";
import type { State } from "../model";
self.onmessage=(event:MessageEvent<{state:State;owner:string;selection:ImportSelection}>)=>{void prepareGuestImport(event.data.state,event.data.owner,event.data.selection).then(result=>self.postMessage({ok:true,result})).catch(()=>self.postMessage({ok:false}));};
