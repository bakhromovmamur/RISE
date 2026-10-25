import { beginPrivateRequest } from "../pwa/requestHold";
import { emptyRecords, parseCursor, parseHead, validateRows, type SyncHead, type PageCursor, type SyncOperation, keyOf } from "../contracts/sync";
import { canonical, hydrate, personalTables, type Records } from "../contracts/personalRecords";
import type { State } from "../model";
import type { AccountSession } from "../contracts/auth";
import { getAccountSession } from "../auth/client";
import * as v from "../data/validation";
import { exact } from "../contracts/personalCommands";
import type { AccountReceipt } from "../contracts/accountCommands";
import type { ImportProposal } from "./importModel";
import { importPages } from "./importModel";
import type { ImportSummary as Provenance } from "../data/migration";

export class SyncError extends Error{constructor(readonly code:string,readonly status=0,readonly retryAfter=0){super(code);}}
export type Identity=NonNullable<AccountSession["account"]>;
async function accountState(records:Records,count:number,signal?:AbortSignal):Promise<State>{
  if(signal?.aborted)throw new SyncError("cancelled");
  if(count<2000||typeof Worker==="undefined")return hydrate(records);
  return new Promise((resolve,reject)=>{
    const job=new Worker(new URL("./hydrate.worker.ts",import.meta.url),{type:"module"});
    const finish=(state?:State)=>{signal?.removeEventListener("abort",abort);job.terminate();if(state)resolve(state);else reject(new SyncError(signal?.aborted?"cancelled":"invalid_response"));};
    const abort=()=>finish();signal?.addEventListener("abort",abort,{once:true});
    job.onmessage=(event:MessageEvent<{ok:boolean;state?:State}>)=>finish(event.data.ok?event.data.state:undefined);job.onerror=()=>finish();job.postMessage(records);
  });
}
export class SyncClient{
  constructor(readonly owner:string,private readonly identity:()=>AccountSession|null){}
  async api(path:string,body?:object,signal?:AbortSignal):Promise<unknown>{
    if(signal?.aborted)throw new SyncError("cancelled");
    const finish = beginPrivateRequest();
    if (!finish) throw new SyncError("unavailable");
    try { return await this.send(path, body, signal); } finally { finish(); }
  }
  private async send(path:string,body?:object,signal?:AbortSignal):Promise<unknown>{
    const session=this.identity();if(!session)throw new SyncError("unavailable");if(!session.account||session.account.id!==this.owner)throw new SyncError("sign_in_required",401);
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);const abort=()=>controller.abort();signal?.addEventListener("abort",abort,{once:true});
    try{
      const response=await fetch(`/api/v1/sync/${path}`,{method:body?"POST":"GET",credentials:"same-origin",cache:"no-store",signal:controller.signal,headers:body?{"Content-Type":"application/json","X-Rise-CSRF":session.csrfToken}:{},...(body?{body:JSON.stringify(body)}:{})});
      if(!response.headers.get("content-type")?.includes("application/json"))throw new SyncError("unavailable");
      const value:unknown=await response.json();if(!response.ok){const row=v.object(value,"error"),error=v.object(row.error,"error"),retry=Number(response.headers.get("Retry-After"));throw new SyncError(typeof error.code==="string"?error.code:"unavailable",response.status,Number.isSafeInteger(retry)&&retry>0&&retry<=86400?retry:0);}return value;
    }catch(error){if(error instanceof SyncError)throw error;throw new SyncError("unavailable");}
    finally{clearTimeout(timer);signal?.removeEventListener("abort",abort);}
  }
  async head(signal?:AbortSignal):Promise<SyncHead>{const value=parseHead(await this.api("head",undefined,signal));if(value.accountId!==this.owner)throw new SyncError("account_changed",409);return value;}
  async pull(signal?:AbortSignal){
    for(let attempt=0;attempt<3;attempt++){
      const head=await this.head(signal);if(!head.initialized)return{head,state:null,records:null};
      const records=emptyRecords();let cursor:PageCursor|null={table:0,offset:0},count=0;
      try{
        while(cursor){
          const current:PageCursor=cursor,value=v.object(await this.api("pull",{accountId:this.owner,revision:head.revision,cursor:current},signal),"page");
          exact({accountId:v.string(36),initialized:v.bool,revision:v.number(0,Number.MAX_SAFE_INTEGER,true),xp:v.number(0,Number.MAX_SAFE_INTEGER,true),table:v.string(80),rows:v.validateJson,next:v.nullable(v.validateJson)})(value,"page");
          if(value.accountId!==this.owner||value.revision!==head.revision||value.table!==personalTables[current.table].name)throw new SyncError("invalid_response");
          validateRows(String(value.table),value.rows);count+=value.rows.length;if(count>250000)throw new SyncError("record_limit");records[String(value.table)].push(...value.rows);
          cursor=value.next===null?null:parseCursor(value.next);
          if(!cursor&&current.table!==personalTables.length-1)throw new SyncError("invalid_cursor");
          if(cursor&&(cursor.table!==current.table&&cursor.table!==current.table+1||cursor.table===current.table&&cursor.offset!==current.offset+value.rows.length||cursor.table===current.table&&value.rows.length===0||cursor.table!==current.table&&cursor.offset!==0))throw new SyncError("invalid_cursor");
        }
        const state=await accountState(records,count,signal);return{head,state,records};
      }catch(error){if(!(error instanceof SyncError)||error.code!=="cursor_stale"||attempt===2)throw error;}
    }
    throw new SyncError("cursor_stale",409);
  }
  async push(operations:SyncOperation[],signal?:AbortSignal){
    const result=v.object(await this.api("commands",{accountId:this.owner,operations},signal),"receipts");
    exact({accountId:v.string(36),revision:v.number(1,Number.MAX_SAFE_INTEGER,true),receipts:v.array(v.validateJson,100)})(result,"receipts");
    if(result.accountId!==this.owner||!Array.isArray(result.receipts)||result.receipts.length!==operations.length)throw new SyncError("invalid_response");
    const receipts=result.receipts.map((item,i)=>{const row=v.object(item,"receipt");exact({operationId:v.string(36),operationRevision:v.number(1,Number.MAX_SAFE_INTEGER,true),xp:v.number(0,Number.MAX_SAFE_INTEGER,true),replayed:v.bool})(row,"receipt");if(row.operationId!==operations[i].operationId||(!operations[i].expected&&row.operationRevision!==operations[i].baseRevision+1)||Number(row.operationRevision)>Number(result.revision))throw new SyncError("invalid_receipt");return{operationId:String(row.operationId),operationRevision:Number(row.operationRevision),xp:Number(row.xp),replayed:row.replayed===true};});
    return{revision:Number(result.revision),receipts};
  }
  async changes(records:Records,since:number,signal?:AbortSignal){
    const head=await this.head(signal),next=structuredClone(records);let offset:number|null=0,count=0;
    while(offset!==null){const result=v.object(await this.api("changes",{accountId:this.owner,since,revision:head.revision,offset},signal),"changes");
      exact({accountId:v.string(36),revision:v.number(1,Number.MAX_SAFE_INTEGER,true),entries:v.array(v.validateJson,200),next:v.nullable(v.number(0,250000,true))})(result,"changes");
      if(result.accountId!==this.owner||result.revision!==head.revision||!Array.isArray(result.entries))throw new SyncError("invalid_response");
      for(const item of result.entries){const entry=v.object(item,"change");exact({table:v.string(80),key:v.string(512),revision:v.number(since+1,head.revision,true),row:v.nullable(v.validateJson)})(entry,"change");const table=String(entry.table);if(!personalTables.some(t=>t.name===table))throw new SyncError("invalid_response");if(entry.row!==null){validateRows(table,[entry.row]);if(keyOf(table,v.object(entry.row,"row"))!==entry.key)throw new SyncError("invalid_response");}
        next[table]=next[table].filter(row=>keyOf(table,row)!==entry.key);if(entry.row!==null)next[table].push(v.object(entry.row,"row"));}
      count+=result.entries.length;if(count>250000||result.next!==null&&(result.next!==offset+result.entries.length||!result.entries.length))throw new SyncError("invalid_cursor");offset=result.next===null?null:Number(result.next);
    }
    // Match canonical SQL ordering before hydration (positions are not arrival order).
    for(const t of personalTables)next[t.name].sort((a,b)=>{for(const k of t.order??t.keys){if(a[k]===b[k])continue;return typeof a[k]==="number"&&typeof b[k]==="number"?Number(a[k])-Number(b[k]):String(a[k]).localeCompare(String(b[k]));}return 0;});
    return{head,state:await accountState(next,Object.values(next).reduce((n,r)=>n+r.length,0),signal),records:next};
  }
  async review(operation:SyncOperation,revision:number,signal?:AbortSignal){
    const value=v.object(await this.api("review",{accountId:this.owner,revision,operation},signal),"review");
    exact({accountId:v.string(36),revision:v.number(1,Number.MAX_SAFE_INTEGER,true),operationId:v.string(36),canReapply:v.bool,reason:v.oneOf("unknown","committed","reused","invalid","unavailable")})(value,"review");
    if(value.accountId!==this.owner||value.operationId!==operation.operationId||value.revision!==revision)throw new SyncError("invalid_response");
    return{canReapply:value.canReapply===true,reason:String(value.reason)};
  }
  async stage(proposal:ImportProposal,provenance:Provenance["provenance"],baseRevision:number,importId:string,signal?:AbortSignal){
    const pages=importPages(proposal.entries);await this.api("imports",{accountId:this.owner,importId,baseRevision,sourceHash:proposal.sourceHash,provenance,pages:pages.length,consent:true},signal);
    for(let page=0;page<pages.length;page++)await this.api("imports/page",{accountId:this.owner,importId,page,entries:pages[page]},signal);
    const value=v.object(await this.api("imports/preview",{accountId:this.owner,importId},signal),"preview");
    exact({accountId:v.string(36),importId:v.string(36),revision:v.number(0,Number.MAX_SAFE_INTEGER,true),added:v.number(0,250000,true),kept:v.number(0,250000,true),xpAdded:v.number(0,5000000,true)})(value,"preview");
    if(value.accountId!==this.owner||value.importId!==importId||value.revision!==baseRevision)throw new SyncError("invalid_preview");
    return{importId,revision:baseRevision,sourceHash:proposal.sourceHash,added:Number(value.added),kept:Number(value.kept),xpAdded:Number(value.xpAdded)};
  }
  async commit(preview:{importId:string;revision:number;sourceHash:string},signal?:AbortSignal):Promise<AccountReceipt>{
    const value=v.object(await this.api("imports/commit",{accountId:this.owner,importId:preview.importId,baseRevision:preview.revision,sourceHash:preview.sourceHash,keepExisting:true},signal),"import-result");
    exact({operationId:v.string(36),operationRevision:v.number(1,Number.MAX_SAFE_INTEGER,true),xp:v.number(0,Number.MAX_SAFE_INTEGER,true),replayed:v.bool})(value,"result");
    if(value.operationId!==preview.importId||value.operationRevision!==preview.revision+1)throw new SyncError("invalid_receipt");
    return{operationId:String(value.operationId),operationRevision:Number(value.operationRevision),xp:Number(value.xp),replayed:value.replayed===true};
  }
  async cancel(importId:string){await this.api("imports/cancel",{accountId:this.owner,importId});}
}
export async function refreshIdentity(signal?:AbortSignal){return getAccountSession(signal);}
export const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
