import { personalTables } from "../contracts/personalRecords";
import type { State } from "../model";
import { parseStoredState } from "../data/storedState";
import { DeviceStorageError } from "../data/indexedDb";
import { uuid } from "../contracts/accountCommands";
import { parseSyncOperation, type SyncOperation, validateRows } from "../contracts/sync";
import { exact } from "../contracts/personalCommands";
import * as v from "../data/validation";

export interface PendingBatch { id:string; operations:SyncOperation[] }
export interface AccountRecovery { state:State; queue:PendingBatch[]; index:number; decisions:("account"|"local")[] }
export const recoveryOperations=(cache:AccountCache)=>cache.recovery?.queue.flatMap(q=>q.operations)??[];
export const recoveryPending=(cache:AccountCache)=>Math.max(0,recoveryOperations(cache).length-(cache.recovery?.index??0));
export const accountPending=(cache:AccountCache|null|undefined)=>cache?cache.queue.length+recoveryPending(cache):0;
export interface AccountCache { format:1|2; owner:string; version:number; revision:number; state:State; queue:PendingBatch[]; recovery?:AccountRecovery; records?:import("../contracts/personalRecords").Records }
export interface AccountStore { readonly deviceGeneration?:string|null; read():Promise<AccountCache>; change(expected:number,update:(current:AccountCache)=>AccountCache):Promise<AccountCache>; close():void }
function parsed(value:unknown,owner:string):AccountCache{
  v.validateJson(value);const row=v.object(value,"account-cache");
  exact({format:v.oneOf(1,2),owner:v.string(36),version:v.number(0,Number.MAX_SAFE_INTEGER,true),revision:v.number(1,Number.MAX_SAFE_INTEGER,true),state:v.validateJson,queue:v.array(v.validateJson,10000),recovery:v.optional(v.validateJson),records:v.optional(v.validateJson)})(row,"account-cache");
  if(row.owner!==owner||!uuid(owner)||!Array.isArray(row.queue))throw new DeviceStorageError("invalid-data");
  const queue=row.queue.map(item=>{const batch=v.object(item,"queue");exact({id:v.string(36),operations:v.array(v.validateJson,100)})(batch,"queue");if(!uuid(batch.id)||!Array.isArray(batch.operations)||!batch.operations.length)throw new DeviceStorageError("invalid-data");return{id:batch.id,operations:batch.operations.map(parseSyncOperation)};});
  if(new Set(queue.map(q=>q.id)).size!==queue.length)throw new DeviceStorageError("invalid-data");
  let recovery:AccountRecovery|undefined;
  if(row.recovery!==undefined){const saved=v.object(row.recovery,"recovery");exact({state:v.validateJson,queue:v.array(v.validateJson,10000),index:v.number(0,1000000,true),decisions:v.array(v.oneOf("account","local"),1000000)})(saved,"recovery");
    const source=parsed({format:1,owner,version:0,revision:row.revision,state:saved.state,queue:saved.queue},owner),index=Number(saved.index),decisions=saved.decisions as ("account"|"local")[];
    if(index>source.queue.reduce((n,q)=>n+q.operations.length,0)||decisions.length!==index)throw new DeviceStorageError("invalid-data");
    recovery={state:source.state,queue:source.queue,index,decisions};}
  let records:AccountCache["records"];
  if(row.records!==undefined){records=v.object(row.records,"records") as AccountCache["records"];if(Object.keys(records!).length!==personalTables.length||personalTables.some(t=>!Object.hasOwn(records!,t.name)))throw new DeviceStorageError("invalid-data");for(const[table,rows]of Object.entries(records!))validateRows(table,rows);}
  return{format:2,...(recovery?{recovery}:{}),...(records?{records}:{}),owner,version:Number(row.version),revision:Number(row.revision),state:parseStoredState(JSON.stringify(row.state)),queue};
}
const request=<T>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new DeviceStorageError("unavailable"));});
const complete=(tx:IDBTransaction)=>{const promise=new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(new DeviceStorageError("unavailable"));tx.onerror=()=>{};});void promise.catch(()=>{});return promise;};
const deletedOwners=new Set<string>();
export async function accountDeviceGeneration(owner:string):Promise<string|null>{
  if(typeof indexedDB==="undefined")return null;const db=await open();try{const tx=db.transaction("preferences","readonly"),done=complete(tx),value=await request(tx.objectStore("preferences").get(`cleared:${owner}`));await done;return typeof value==="string"?value:null;}finally{db.close();}
}
export async function isDeletedAccount(owner:string){
  if(deletedOwners.has(owner))return true;
  if(typeof indexedDB==="undefined")return false;
  const db=await open();try{const tx=db.transaction("preferences","readonly"),done=complete(tx),deleted=await request(tx.objectStore("preferences").get(`deleted:${owner}`));await done;if(deleted===true)deletedOwners.add(owner);return deleted===true;}finally{db.close();}
}
async function open(){
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open("rise-accounts",1);let blocked=false;r.onupgradeneeded=()=>{r.result.createObjectStore("accounts");r.result.createObjectStore("preferences");};r.onerror=()=>reject(new DeviceStorageError("unavailable"));r.onblocked=()=>{blocked=true;reject(new DeviceStorageError("unavailable"));};r.onsuccess=()=>{if(blocked)r.result.close();else resolve(r.result);};});db.onversionchange=()=>db.close();return db;
}
export async function rememberedOwner():Promise<string|null>{const db=await open();try{const tx=db.transaction("preferences","readonly"),done=complete(tx),value:unknown=await request(tx.objectStore("preferences").get("active"));await done;return uuid(value)?value:null;}finally{db.close();}}
export async function cachedAccount(owner:string):Promise<AccountCache|null>{if(!uuid(owner)||await isDeletedAccount(owner))return null;const db=await open();try{const tx=db.transaction("accounts","readonly"),done=complete(tx),value:unknown=await request(tx.objectStore("accounts").get(owner));await done;return value===undefined?null:parsed(value,owner);}finally{db.close();}}
export async function forgetAccount(owner:string,deleted=false,expectedVersion?:number|null,expectedGeneration?:string|null){
  if(!uuid(owner))throw new DeviceStorageError("invalid-data");if(deleted)deletedOwners.add(owner);
  const db=await open();try{const tx=db.transaction(["accounts","preferences"],"readwrite",{durability:"strict"}),done=complete(tx);
    try{const store=tx.objectStore("accounts");if(expectedVersion!==undefined){const current:unknown=await request(store.get(owner));if((current===undefined?null:parsed(current,owner).version)!==expectedVersion)throw new DeviceStorageError("conflict");}
      const currentGeneration=await request(tx.objectStore("preferences").get(`cleared:${owner}`))??null;
      if(expectedGeneration!==undefined&&currentGeneration!==expectedGeneration)throw new DeviceStorageError("conflict");
      const nextGeneration=crypto.randomUUID();store.delete(owner);tx.objectStore("preferences").put(nextGeneration,`cleared:${owner}`);if(deleted)tx.objectStore("preferences").put(true,`deleted:${owner}`);
      const active:unknown=await request(tx.objectStore("preferences").get("active"));if(active===owner)tx.objectStore("preferences").delete("active");await done;return nextGeneration;
    }catch(error){try{tx.abort();}catch{}await done.catch(()=>{});throw error;}
  }finally{db.close();}
}
export async function setRememberedOwner(owner:string|null){const db=await open();try{const tx=db.transaction("preferences","readwrite",{durability:"strict"}),done=complete(tx);if(owner)tx.objectStore("preferences").put(owner,"active");else tx.objectStore("preferences").delete("active");await done;}finally{db.close();}}
export async function accountStore(initial:AccountCache,persistent:boolean,expectedGeneration?:string|null):Promise<AccountStore>{
  if(await isDeletedAccount(initial.owner))throw new DeviceStorageError("invalid-data");
  let memory=parsed(initial,initial.owner);
  const initialGeneration=await accountDeviceGeneration(initial.owner);
  if(expectedGeneration!==undefined&&expectedGeneration!==initialGeneration)throw new DeviceStorageError("conflict");
  if(!persistent)return{deviceGeneration:initialGeneration,read:async()=>{if(deletedOwners.has(memory.owner)||await accountDeviceGeneration(memory.owner)!==initialGeneration)throw new DeviceStorageError("invalid-data");return structuredClone(memory);},change:async(expected,update)=>{if(deletedOwners.has(memory.owner)||await accountDeviceGeneration(memory.owner)!==initialGeneration)throw new DeviceStorageError("invalid-data");if(memory.version!==expected)throw new DeviceStorageError("conflict");const next=parsed(update(structuredClone(memory)),memory.owner);memory={...next,version:memory.version+1};return structuredClone(memory);},close(){}};
  const db=await open();
  const tx=db.transaction(["accounts","preferences"],"readwrite",{durability:"strict"}),done=complete(tx);
  if(await request(tx.objectStore("preferences").get(`deleted:${initial.owner}`))===true){tx.abort();await done.catch(()=>{});db.close();throw new DeviceStorageError("invalid-data");}
  const currentGeneration=await request(tx.objectStore("preferences").get(`cleared:${initial.owner}`))??null;
  if(currentGeneration!==initialGeneration){tx.abort();await done.catch(()=>{});db.close();throw new DeviceStorageError("conflict");}
  const existing:unknown=await request(tx.objectStore("accounts").get(initial.owner));if(existing===undefined)tx.objectStore("accounts").add(memory,initial.owner);else memory=parsed(existing,initial.owner);
  tx.objectStore("preferences").put(initial.owner,"active");await done;
  return{
    deviceGeneration:initialGeneration,
    async read(){const tx=db.transaction(["accounts","preferences"],"readonly"),done=complete(tx),value:unknown=await request(tx.objectStore("accounts").get(initial.owner)),epoch=await request(tx.objectStore("preferences").get(`cleared:${initial.owner}`))??null;await done;if(epoch!==initialGeneration)throw new DeviceStorageError("invalid-data");return parsed(value,initial.owner);},
    async change(expected,update){const tx=db.transaction(["accounts","preferences"],"readwrite",{durability:"strict"}),done=complete(tx);
      try{if(await request(tx.objectStore("preferences").get(`deleted:${initial.owner}`))===true||(await request(tx.objectStore("preferences").get(`cleared:${initial.owner}`))??null)!==initialGeneration)throw new DeviceStorageError("invalid-data");const store=tx.objectStore("accounts"),current=parsed(await request(store.get(initial.owner)),initial.owner);if(current.version!==expected)throw new DeviceStorageError("conflict");const next=parsed({...update(structuredClone(current)),version:current.version+1},initial.owner);store.put(next,initial.owner);await done;return next;}
      catch(error){try{tx.abort();}catch{}await done.catch(()=>{});throw error;}
    },close(){db.close();},
  };
}
