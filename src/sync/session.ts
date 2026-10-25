import type { SetStateAction } from "react";
import type { State } from "../model";
import { localDate } from "../model";
import type { DomainCommand } from "../contracts/commands";
import { parseCommand } from "../contracts/commands";
import type { CommandContext } from "../contracts/personalCommands";
import type { SessionView } from "../data/deviceSession";
import type { JourneySession } from "../data/journeySession";
import { DeviceStorageError } from "../data/indexedDb";
import { applyDomainCommand } from "../domain/commands";
import { parseStoredState } from "../data/storedState";
import { personalProjection, syncOperations, withDeviceState, recoveryDeviceState } from "./operations";
import { accountPending, recoveryPending, recoveryOperations, type AccountCache, type AccountStore, type PendingBatch } from "./store";
import { applySyncIntent, intentView } from "./policy";
import { digest } from "../data/migration";
import type { SyncOperation } from "../contracts/sync";
import { SyncClient, SyncError, same } from "./client";
import {groupIntentPending} from "../groups/intent";
import {requestedSharedPriorities,newSharedPriorities,type SharedPriority} from '../domain/priorityReferences';
import {priorityKey} from '../developmentModel';

export type SyncPhase="saving-device"|"saved-device"|"syncing"|"synced"|"offline"|"attention"|"sign-in";
export interface SyncStatus{phase:SyncPhase;pending:number;persistent:boolean;error:string|null}
export class AccountJourney implements JourneySession{
  private view:SessionView;private status:SyncStatus;private listeners=new Set<()=>void>();
  private writes:{state:State;batch:PendingBatch|null}[]=[];private writing:Promise<void>|null=null;private sending:Promise<void>|null=null;
  private cacheAccess:Promise<void>=Promise.resolve();
  private closed=false;private held:string|null=null;private abort=new AbortController();
  private recovering=false;
  private failures=0;private retryAt=0;
  private channel:BroadcastChannel|null=null;private timer:ReturnType<typeof setInterval>;
  constructor(private store:AccountStore,private cache:AccountCache,readonly client:SyncClient,readonly persistent:boolean,verified=true,private sharedPriorityAllowed:(priority:SharedPriority)=>boolean=()=>false){
    this.view={state:cache.state,status:"saved",error:null};this.status={phase:!verified?"offline":recoveryPending(cache)?"attention":cache.queue.length?"saved-device":"synced",pending:accountPending(cache),persistent,error:null};
    if(typeof BroadcastChannel!=="undefined"){this.channel=new BroadcastChannel(`rise-account-${cache.owner}`);this.channel.onmessage=()=>{void this.refresh();};}
    window.addEventListener("online",this.onOnline);window.addEventListener("focus",this.onOnline);window.addEventListener("offline",this.onOffline);window.addEventListener("beforeunload",this.onUnload);
    this.timer=setInterval(()=>{if(!document.hidden)void this.sync();},15000);
  }
  get owner(){return this.cache.owner;}
  get revision(){return this.cache.revision;}
  cacheSnapshot(){return structuredClone(this.cache);}
  get summary(){return{importedAt:new Date().toISOString(),sourceSchema:4,habits:this.cache.state.habits.length,habitChecks:0,prayerChecks:0,sampleDays:0,fixtureSignatures:false,provenance:"new" as const,cloudEligible:false as const};}
  get archives(){return[];}
  getSnapshot=()=>this.view;
  getSyncSnapshot=()=>this.status;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
  private emit(){if(!this.closed)this.listeners.forEach(listener=>listener());}
  /** Own-session cache work shares one lane; foreign writers still face the store's strict CAS. */
  private accessCache<T>(work:()=>Promise<T>):Promise<T>{const result=this.cacheAccess.then(work);this.cacheAccess=result.then(()=>{},()=>{});return result;}
  private phase(phase:SyncPhase,error:string|null=null){if(phase==="synced"&&accountPending(this.cache)){phase=recoveryPending(this.cache)?"attention":"saved-device";if(recoveryPending(this.cache))error="recovery_required";}this.status={phase,error,persistent:this.persistent,pending:accountPending(this.cache)+this.writes.filter(w=>w.batch).length};this.emit();}
  private onOnline=()=>{if(!document.hidden){if(this.status.phase==="offline")this.retryAt=0;void this.sync();}};
  private onOffline=()=>this.phase("offline");
  private onUnload=(event:BeforeUnloadEvent)=>{if(this.writes.length||!this.persistent&&(accountPending(this.cache)||groupIntentPending(this.view.state))){event.preventDefault();event.returnValue="";}};
  private accept(state:State,command:DomainCommand|null,captured?:CommandContext){
    if(this.closed||this.held||this.recovering||recoveryPending(this.cache)||this.view.error)return null;
    try{
      const next=parseStoredState(JSON.stringify(state));if(same(next,this.view.state))return this.view.state;
      const now=Date.now(),before=this.view.state,context=captured??{now,date:localDate(before.timezone,new Date(now)),timezone:before.timezone};
      const last=this.writes.flatMap(w=>w.batch?[w.batch]:[]).at(-1)??this.cache.queue.at(-1),base=last?last.operations.at(-1)!.baseRevision+1:this.cache.revision;
      const operations=command?syncOperations(before,next,command,context,base):[];
      for(const[i,operation]of operations.entries()){operation.observedRevision=this.cache.revision;const predecessor=i?operations[i-1].operationId:last?.operations.at(-1)?.operationId;if(predecessor)operation.predecessor=predecessor;}
      this.writes.push({state:next,batch:operations.length?{id:crypto.randomUUID(),operations}:null});
      this.view={state:next,status:"saving",error:null};if(!["attention","offline","sign-in"].includes(this.status.phase))this.phase("saved-device");else this.phase(this.status.phase,this.status.error);void this.flushLocal();return next;
    }catch{this.view={...this.view,status:"attention",error:"invalid-edit"};this.phase("attention","invalid_edit");return null;}
  }
  dispatch=(value:DomainCommand):State|null=>{
    if(this.closed||this.held||this.recovering||recoveryPending(this.cache)||this.view.error)return null;
    try{const command=parseCommand(value),now=Date.now(),state=this.view.state,context={now,date:localDate(state.timezone,new Date(now)),timezone:state.timezone};
      const sharedPriorities=new Set(requestedSharedPriorities(command).filter(this.sharedPriorityAllowed).map(priorityKey));
      // A shared view can disappear between selection and save. This expected
      // reference refusal must not poison the account's storage/sync session.
      if(newSharedPriorities(state,command).some(p=>!sharedPriorities.has(priorityKey(p))))return null;
      const next=applyDomainCommand(state,command,context,{sharedPriorities});return this.accept(next,command,context);}
    catch{this.view={...this.view,status:"attention",error:"invalid-edit"};this.phase("attention","invalid_edit");return null;}
  };
  setState=(action:SetStateAction<State>)=>{
    if(this.closed||this.held||this.view.error)return;
    try{const next=typeof action==="function"?action(structuredClone(this.view.state)):action;
      if(!same(personalProjection(next),personalProjection(this.view.state)))throw new Error("personal_setter");
      this.accept(next,null);
    }catch{this.view={...this.view,status:"attention",error:"invalid-edit"};this.phase("attention","invalid_edit");}
  };
  private flushLocal():Promise<void>{
    if(this.writing)return this.writing;
    this.writing=(async()=>{
      while(this.writes.length&&!this.view.error&&!this.closed){
        const edit=this.writes[0];
        try{if(edit.batch)for(const operation of edit.batch.operations)if(operation.expected!==undefined&&!operation.expected.startsWith("sha256:"))operation.expected=`sha256:${await digest(operation.expected)}`;
          await this.accessCache(async()=>{if(this.closed)return;
            this.cache=await this.store.change(this.cache.version,current=>({...current,state:edit.batch||same(personalProjection(current.state),personalProjection(edit.state))?edit.state:withDeviceState(current.state,edit.state),queue:edit.batch?[...current.queue,edit.batch]:current.queue}));this.writes.shift();this.channel?.postMessage({changed:true});});}
        catch(error){this.view={...this.view,status:"attention",error:error instanceof DeviceStorageError&&error.code==="conflict"?"conflict":"save"};this.phase("attention","storage");return;}
      }
      if(!this.view.error&&!this.writes.length&&!this.closed){this.view={state:this.cache.state,status:"saved",error:null};const phase=this.cache.queue.length&&!["attention","offline","sign-in","syncing"].includes(this.status.phase)?"saved-device":this.status.phase;this.phase(phase,this.status.error);}
    })().finally(()=>{this.writing=null;if(this.cache.queue.length&&!this.sending&&!this.closed&&!this.view.error)void this.sync();});
    return this.writing;
  }
  whenSaved=async()=>{await this.flushLocal();if(this.view.error||this.writes.length)return false;if(this.persistent){void this.sync();return true;}await this.sync();return !accountPending(this.cache)&&this.status.phase==="synced";};
  async sync(){
    if(this.sending)return this.sending;if(this.closed||this.view.error||this.held||this.recovering||Date.now()<this.retryAt)return;
    this.sending=(async()=>{
      await this.flushLocal();if(this.closed||this.view.error)return;
      if(!navigator.onLine){this.phase("offline");return;}
      this.phase("syncing");
      try{
        await this.accessCache(async()=>{if(this.closed||this.writes.length)return;const fresh=await this.store.read();if(this.closed||this.writes.length)return;
          if(fresh.version!==this.cache.version){this.cache=fresh;this.view={state:fresh.state,status:"saved",error:null};this.emit();}});let pushed=false;
        while(this.cache.queue.length&&!this.closed){
          pushed=true;const batch=this.cache.queue[0],result=await this.client.push(batch.operations,this.abort.signal);await this.flushLocal();if(this.closed||this.view.error)return;
          await this.accessCache(async()=>{if(this.closed)return;
            if(this.cache.queue.some(q=>q.id===batch.id)){
              if(this.cache.queue[0].id!==batch.id)throw new SyncError("revision_conflict",409);
              this.cache=await this.store.change(this.cache.version,current=>{const next={...current,revision:result.receipts.at(-1)!.operationRevision,queue:current.queue.slice(1)};delete next.records;return next;});
            }});
          this.channel?.postMessage({changed:true});
        }
        if(this.closed)return;await this.flushLocal();if(this.cache.queue.length||this.writes.length)return;
        const head=await this.client.head(this.abort.signal);if(this.closed)return;
        if(pushed||!this.cache.records||head.revision!==this.cache.revision){
          let pulled;
          if(!pushed&&this.cache.records){try{pulled=await this.client.changes(this.cache.records,this.cache.revision,this.abort.signal);}catch(error){if(!(error instanceof SyncError)||!["rebase_required","cursor_stale"].includes(error.code))throw error;pulled=await this.client.pull(this.abort.signal);}}
          else pulled=await this.client.pull(this.abort.signal);if(this.closed||!pulled.state)return;await this.flushLocal();if(this.cache.queue.length||this.writes.length)return;
          await this.accessCache(async()=>{if(this.closed||this.cache.queue.length||this.writes.length)return;
            if(this.cache.state.life.calculation&&this.cache.state.timezone!==pulled.state!.timezone)throw new SyncError("timezone_conflict",409);
            this.cache=await this.store.change(this.cache.version,current=>({...current,revision:pulled.head.revision,state:withDeviceState(pulled.state!,current.state),...(pulled.records?{records:pulled.records}:{})}));});
        }
        if(!this.writes.length&&!this.closed){this.failures=0;this.retryAt=0;this.view={state:this.cache.state,status:"saved",error:null};this.phase(recoveryPending(this.cache)?"attention":this.cache.queue.length?"saved-device":"synced",recoveryPending(this.cache)?"recovery_required":null);}
      }catch(error){if(!this.closed){const fault=error instanceof SyncError?error:new SyncError("unavailable"),blocked=[401,409,422].includes(fault.status);this.retryAt=blocked?Infinity:Date.now()+Math.max(fault.retryAfter*1000,Math.min(300000,5000*2**Math.min(this.failures++,6))*(1+Math.random()*.2));this.phase(fault.status===401?"sign-in":fault.status===409||fault.status===422?"attention":"offline",fault.code);}}
    })().finally(()=>{this.sending=null;if(this.cache.queue.length&&!this.writing&&!this.closed&&!this.view.error&&!this.status.error&&navigator.onLine)void this.sync();});return this.sending;
  }
  /** Explicit recovery starts only after a full authorized snapshot; source intent is retained atomically. */
  async beginRecovery(){
    if(this.recovering||this.held)throw new SyncError("busy");
    this.recovering=true;try{
      await this.sending;await this.flushLocal();if(this.view.error||this.writes.length)throw new SyncError("storage");
      const fresh=await this.store.read();if(recoveryPending(fresh)&&!fresh.queue.length)return;
      if(!fresh.queue.length)return;
      const pulled=await this.client.pull(this.abort.signal);if(this.closed||!pulled.state)throw new SyncError("cancelled");
      this.cache=await this.store.change(fresh.version,current=>({...current,revision:pulled.head.revision,state:recoveryDeviceState(pulled.state!,current.state),records:pulled.records!,queue:[],recovery:recoveryPending(current)?{...current.recovery!,queue:[...recoveryOperations(current).slice(0,current.recovery!.index),...current.queue.flatMap(q=>q.operations),...recoveryOperations(current).slice(current.recovery!.index)].map(op=>({id:op.operationId,operations:[op]}))}:{state:current.state,queue:current.queue,index:0,decisions:[]}}));
      this.view={state:this.cache.state,status:"saved",error:null};this.retryAt=0;this.phase("attention","recovery_required");this.channel?.postMessage({changed:true});
    }finally{this.recovering=false;}
  }
  async recoveryPreview(){
    await this.sending;await this.flushLocal();const fresh=await this.store.read();if(this.view.error||this.writes.length||fresh.queue.length)throw new SyncError("pending_changes");
    const operation=recoveryOperations(fresh)[fresh.recovery?.index??0];if(!operation)return null;
    const pulled=await this.client.pull(this.abort.signal);if(this.closed||!pulled.state)throw new SyncError("cancelled");
    const permission=await this.client.review(operation,pulled.head.revision,this.abort.signal);
    return{version:fresh.version,index:fresh.recovery!.index,operation,state:pulled.state,revision:pulled.head.revision,records:pulled.records!,...permission};
  }
  async resolveRecovery(preview:NonNullable<Awaited<ReturnType<AccountJourney["recoveryPreview"]>>>,choice:"account"|"local"){
    if(this.recovering||this.held)throw new SyncError("busy");this.recovering=true;
    try{
      if(this.closed||this.writes.length||this.view.error)throw new SyncError("storage");
      const fresh=await this.store.read();if(fresh.version!==preview.version||fresh.recovery?.index!==preview.index||fresh.queue.length)throw new SyncError("review_stale",409);
      const permission=await this.client.review(preview.operation,preview.revision,this.abort.signal);
      if(choice==="local"&&!permission.canReapply)throw new SyncError("entity_unavailable",409);
      let state=withDeviceState(preview.state,fresh.state),batch:PendingBatch|null=null;
      if(choice==="local"){
        const original=preview.operation.command,command=original.kind==="habit.check"?{...original,kind:"habit.correct" as const}:original;
        const now=Date.now(),context={now,date:localDate(state.timezone,new Date(now)),timezone:state.timezone};
        const operation:SyncOperation={protocolVersion:1,operationId:crypto.randomUUID(),baseRevision:preview.revision,command,context,expected:`sha256:${await digest(intentView(state,command,context))}`,observedRevision:preview.revision};
        // The current authorized review above approved this exact original
        // intent. Commit still rechecks membership after any intervening removal.
        state=applySyncIntent(state,command,context,new Set(requestedSharedPriorities(command).map(priorityKey)));batch={id:crypto.randomUUID(),operations:[operation]};
      }
      if(this.closed)throw new SyncError("cancelled");
      this.cache=await this.store.change(fresh.version,current=>({...current,revision:preview.revision,state,records:preview.records,queue:batch?[batch]:[],recovery:{...current.recovery!,index:preview.index+1,decisions:[...current.recovery!.decisions,choice]}}));
      this.view={state:this.cache.state,status:"saved",error:null};this.retryAt=0;this.phase(recoveryPending(this.cache)?"attention":"saved-device",recoveryPending(this.cache)?"recovery_required":null);this.channel?.postMessage({changed:true});
    }finally{this.recovering=false;}
    await this.sync();
  }
  async refresh(){if(this.closed||this.writing||this.writes.length||this.view.error||this.sending||this.recovering)return;try{await this.accessCache(async()=>{if(this.closed||this.writes.length||this.sending||this.recovering)return;const fresh=await this.store.read();if(this.closed||this.writes.length||this.sending||this.recovering)return;if(fresh.version>this.cache.version){this.cache=fresh;this.view={state:fresh.state,status:"saved",error:null};this.phase(fresh.queue.length?"saved-device":"synced");}});void this.sync();}catch{this.phase("attention","storage");}}
  retry=async()=>{if(this.view.error==="invalid-edit")return;this.retryAt=0;this.failures=0;this.view={...this.view,error:null,status:"saving"};await this.flushLocal();await this.sync();};
  async holdForUpdate(token:string){if(this.held&&this.held!==token)return false;if(!this.persistent&&groupIntentPending(this.view.state)||!await this.whenSaved())return false;this.held=token;return true;}
  releaseUpdate(token:string){if(this.held===token)this.held=null;}
  original=async()=>this.pendingExport();
  pendingExport=()=>JSON.stringify({format:"rise.account-recovery",version:1,owner:this.owner,revision:this.cache.revision,state:this.view.state,queue:this.cache.queue,recovery:this.cache.recovery,unsaved:this.writes});
  async snapshot(){await this.flushLocal();if(this.writes.length||this.view.error)throw new DeviceStorageError("unavailable");return{state:this.cache.state,archives:[],revision:this.cache.version};}
  restorePoint=async()=>null;
  async restore(){throw new DeviceStorageError("unavailable");}
  async reloadSaved(){await this.writing;this.cache=await this.store.read();this.writes=[];this.view={state:this.cache.state,status:"saved",error:null};this.phase(this.cache.queue.length?"saved-device":"synced");}
  clear=async()=>false;
  async settled(){await this.writing;}
  close(){this.closed=true;this.abort.abort();this.channel?.close();clearInterval(this.timer);this.store.close();window.removeEventListener("online",this.onOnline);window.removeEventListener("focus",this.onOnline);window.removeEventListener("offline",this.onOffline);window.removeEventListener("beforeunload",this.onUnload);}
}
