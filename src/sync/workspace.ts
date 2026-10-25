import {affectsPush,canceledEventKeys} from "../push/policy";
import {blockPushPlan,flushPushCancellation} from "../push/client";
import type { DeviceSession } from "../data/deviceSession";
import type { JourneySession } from "../data/journeySession";
import type { AccountSession } from "../contracts/auth";
import { getAccountSession } from "../auth/client";
import { accountPending, isDeletedAccount, accountDeviceGeneration } from "./store";
import { AccountJourney, type SyncStatus } from "./session";
import { accountStore, cachedAccount, forgetAccount, rememberedOwner, setRememberedOwner, type AccountCache } from "./store";
import { SyncClient, SyncError } from "./client";
import { localDate } from "../model";
import type { State } from "../model";
import { importedPrayerSetup } from "./operations";
import { clearAccountAlerts } from "../prayerDelivery";
import { clearOwnerPush,reconcilePushSession,disablePush } from "../push/client";
import { pushControl } from "../push/store";
import {groupIntentPending} from "../groups/intent";
import type {SharedPriority} from '../domain/priorityReferences';
const workspacePending=(cache:AccountCache|null|undefined)=>accountPending(cache)+groupIntentPending(cache?.state);
const sessionChoice=(value?:boolean)=>{try{if(value!==undefined){if(value)sessionStorage.setItem("rise.account-view","1");else sessionStorage.removeItem("rise.account-view");}return sessionStorage.getItem("rise.account-view")==="1";}catch{return false;}};

export class WorkspaceSession implements JourneySession{
  private active:JourneySession;private account:AccountJourney|null=null;private identity:AccountSession|null=null;
  private listeners=new Set<()=>void>();private unsub:()=>void;private currentStatus:SyncStatus={phase:"saved-device",pending:0,persistent:true,error:null};
  private status:SyncStatus&{scope:string}={...this.currentStatus,scope:"guest"};private generation=0;private authGeneration=0;
  private identityRefresh:Promise<AccountSession|null>|null=null;
  private memory=new Map<string,AccountCache>();private inactive:AccountCache|null=null;private discardVersion:number|null=null;private departureVersion:number|null=null;private closed=false;
  private accountGeneration:string|null=null;private cleanupError:string|null=null;
  private memoryGenerations=new Map<string,string|null>();
  private sharedPriorities:{owner:string;allows:(priority:SharedPriority)=>boolean}|null=null;
  private channel:BroadcastChannel|null=null;private timer:ReturnType<typeof setInterval>;
  constructor(readonly guest:DeviceSession){
    this.active=guest;this.unsub=guest.subscribe(this.changed);
    if(typeof BroadcastChannel!=="undefined"){this.channel=new BroadcastChannel("rise-account-session");this.channel.onmessage=()=>{void this.refreshIdentity().catch(()=>{});};}
    window.addEventListener("focus",this.onFocus);window.addEventListener("online",this.onFocus);document.addEventListener("visibilitychange",this.onFocus);
    this.timer=setInterval(this.onFocus,15000);void this.start();
  }
  get scope(){return this.account?.owner??"guest";}
  get summary(){return this.active.summary;}
  get archives(){return this.active.archives;}
  private pushInvalidations=0;
  pushPlanSource=()=>{
    if(!this.account||this.scope!==this.identity?.account?.id)return null;
    const snapshot=this.account.getSnapshot(),sync=this.account.getSyncSnapshot();
    return {owner:this.scope,revision:this.account.revision,state:snapshot.state,ready:!this.pushInvalidations&&snapshot.status==="saved"&&sync.phase==="synced"&&sync.pending===0};
  };
  getAccountIdentity=()=>this.identity;
  /** A sharing preview reads only a fully acknowledged selected account. The
   * server derives its payload; no private records leave through this seam. */
  sharedPreviewSource=()=>{
    if(!this.account||this.scope!==this.identity?.account?.id)return null;
    const snapshot=this.account.getSnapshot(),sync=this.account.getSyncSnapshot();
    return snapshot.status==='saved'&&!snapshot.error&&sync.phase==='synced'&&sync.pending===0?{owner:this.scope,revision:this.account.revision}:null;
  };
  /** Current authorized shared views remain in memory, never in the personal
   * cache. Scope checks fence both old providers and late unregister callbacks. */
  registerSharedPriorities(owner:string,allows:(priority:SharedPriority)=>boolean){
    const source={owner,allows};if(this.scope===owner&&this.identity?.account?.id===owner)this.sharedPriorities=source;
    return()=>{if(this.sharedPriorities===source)this.sharedPriorities=null;};
  }
  getSyncSnapshot=()=>this.status;
  accountStatus=()=>this.account?this.account.getSyncSnapshot():null;
  getSnapshot=()=>this.active.getSnapshot();
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
  private changed=()=>{if(this.closed)return;this.currentStatus=this.account?.getSyncSnapshot()??{phase:"saved-device",pending:this.inactive?.owner===this.identity?.account?.id?workspacePending(this.inactive):0,persistent:this.identity?.account?.remembered??true,error:null};const groupPending=this.account?groupIntentPending(this.account.getSnapshot().state):0;this.status={...this.currentStatus,pending:this.currentStatus.pending+groupPending,...(groupPending&&this.currentStatus.phase==="synced"?{phase:"saved-device" as const,error:"group_pending"}:{}),scope:this.scope};this.listeners.forEach(listener=>listener());};
  private onFocus=()=>{if(!document.hidden&&navigator.onLine)void this.refreshIdentity().catch(()=>{});};
  private async start(){
    try{const identity=await this.refreshIdentity();if(identity?.account?.remembered){const owner=await rememberedOwner();if(owner===identity.account.id&&await cachedAccount(owner))await this.useAccount();}else if(identity?.account&&sessionChoice())await this.useAccount();}
    catch{try{const owner=await rememberedOwner();if(owner){const epoch=await accountDeviceGeneration(owner),cache=await cachedAccount(owner);if(cache)await this.activate(cache,true,this.generation,true,epoch);}}catch{/* Guest data remains available if optional account storage is unavailable. */}}
  }
  refreshIdentity(signal?:AbortSignal):Promise<AccountSession|null>{
    const pending=this.readIdentity(signal);this.identityRefresh=pending;
    // Keep the latest outcome until replacement/sign-out, including a settled
    // failure: an older response must not fall back to a stale/null identity.
    return pending;
  }
  private async readIdentity(signal?:AbortSignal):Promise<AccountSession|null>{
    const version=++this.authGeneration;
    try{const next=await getAccountSession(signal);if(this.closed||signal?.aborted)return null;
      // Account and the background resume/timer can refresh together. A caller
      // superseded by a newer read must await that result, not an old/null view.
      if(version!==this.authGeneration)return this.identityRefresh??this.identity;
      if(next.reason==="deleted"&&next.deletion)await this.deletedAccount(next.deletion.accountId,false).catch(()=>{this.cleanupError=next.deletion!.accountId;});
      const owners=new Set([...this.memory.keys(),this.account?.owner,this.inactive?.owner].filter((owner):owner is string=>!!owner));
      for(const owner of owners)if(await isDeletedAccount(owner))await this.deletedAccount(owner,false).catch(()=>{this.cleanupError=owner;});
      for(const [owner,epoch]of this.memoryGenerations)if(await accountDeviceGeneration(owner)!==epoch)this.dropAccountView(owner);
      if(this.account&&await accountDeviceGeneration(this.account.owner)!==this.accountGeneration)this.dropAccountView(this.account.owner);
      if(this.closed||signal?.aborted)return null;
      if(version!==this.authGeneration)return this.identityRefresh??this.identity;
      const previous=this.identity?.account?.id;this.identity=next;
      void reconcilePushSession(next,()=>this.identity).catch(()=>{});
      if(this.account&&next.account?.id!==this.account.owner){
        ++this.generation;sessionChoice(false);const owner=this.account.owner,pending=this.account.getSyncSnapshot().pending;await this.detach(false);await setRememberedOwner(null);
        const latest=this.memory.get(owner)??await cachedAccount(owner);
        if(!next.reason&&previous&&!pending&&!workspacePending(latest)){await forgetAccount(owner);this.memory.delete(owner);}
      }
      if(!this.account&&next.account){const cached=this.memory.get(next.account.id)??await cachedAccount(next.account.id),active=await rememberedOwner();if(version===this.authGeneration&&this.identity?.account?.id===next.account.id){this.inactive=cached;if(active&&active!==next.account.id)await setRememberedOwner(null);}}
      if(!next.account&&version===this.authGeneration){sessionChoice(false);this.inactive=null;if(await rememberedOwner())await setRememberedOwner(null);}
      this.changed();return next;
    }catch(error){if(signal?.aborted)throw error;this.changed();throw error;}
  }
  client(){const owner=this.identity?.account?.id;if(!owner)throw new SyncError("sign_in_required",401);return new SyncClient(owner,()=>this.identity);}
  async useAccount(consentedPrayerSource?:State){
    const current=this.identity?.account;if(!current)throw new SyncError("sign_in_required",401);
    const token=++this.generation,client=this.client(),epoch=await accountDeviceGeneration(current.id);let cache=this.memory.get(current.id)??await cachedAccount(current.id);
    if(!cache){const pulled=await client.pull();if(!pulled.state)throw new SyncError("initialize_required",409);cache={format:1,owner:current.id,version:0,revision:pulled.head.revision,state:consentedPrayerSource?importedPrayerSetup(pulled.state,consentedPrayerSource):pulled.state,queue:[],...(pulled.records?{records:pulled.records}:{})};}
    if(token!==this.generation||this.identity?.account?.id!==current.id)return;
    const activationEpoch=current.remembered?epoch:await forgetAccount(current.id,false,undefined,epoch);
    await this.activate(cache,current.remembered,token,false,activationEpoch);void this.account?.sync();
  }
  async startEmpty(){
    const state=this.guest.getSnapshot().state,client=this.client(),head=await client.head();
    if(head.initialized)throw new SyncError("account_not_empty",409);
    const now=Date.now();await client.push([{protocolVersion:1,operationId:crypto.randomUUID(),baseRevision:0,command:{kind:"account.initialize",name:"Friend",timezone:state.timezone,language:state.life.language},context:{now,date:localDate(state.timezone,new Date(now)),timezone:state.timezone}}]);
    await this.useAccount();
  }
  private async activate(cache:AccountCache,persistent:boolean,token=this.generation,offline=false,expectedEpoch?:string|null){
    if(token!==this.generation)return;
    await this.detach(false);if(this.closed)return;
    const store=await accountStore(cache,persistent,expectedEpoch);if(this.closed){store.close();return;}
    const loaded=await store.read();if(token!==this.generation||(this.identity?this.identity.account?.id!==cache.owner:!offline)){store.close();return;}
    this.account=new AccountJourney(store,loaded,new SyncClient(cache.owner,()=>this.identity),persistent,!offline,p=>this.scope===cache.owner&&this.identity?.account?.id===cache.owner&&this.sharedPriorities?.owner===cache.owner&&this.sharedPriorities.allows(p));this.accountGeneration=store.deviceGeneration??null;this.memory.delete(cache.owner);this.memoryGenerations.delete(cache.owner);sessionChoice(true);
    this.active=this.account;this.inactive=null;this.unsub();this.unsub=this.account.subscribe(this.changed);this.discardVersion=null;this.changed();
  }
  private async detach(clear:boolean){
    if(!this.account)return;
    const previous=this.account;this.account=null;this.unsub();this.active=this.guest;this.unsub=this.guest.subscribe(this.changed);this.changed();await previous.settled();
    this.inactive=clear?null:previous.cacheSnapshot();if(!clear&&!previous.persistent){this.memory.set(previous.owner,previous.cacheSnapshot());this.memoryGenerations.set(previous.owner,this.accountGeneration);}
    previous.close();if(clear){this.memory.delete(previous.owner);await forgetAccount(previous.owner);}
    this.changed();
  }
  async useDevice(){
    ++this.generation;if(this.account&&!this.account.persistent&&(this.account.getSyncSnapshot().pending||groupIntentPending(this.account.getSnapshot().state))&&!this.discardAllowed())throw new SyncError("pending_changes");
    await this.detach(false);sessionChoice(false);await setRememberedOwner(null);
  }
  authorizeDiscard(allowed=true){this.discardVersion=allowed?(this.account?.cacheSnapshot().version??this.inactive?.version??null):null;this.changed();}
  private discardAllowed(){const cache=this.account?.cacheSnapshot()??this.inactive;return !!cache&&this.discardVersion===cache.version;}
  async prepareSignOut(){
    if(this.account)await this.account.settled();const owner=this.identity?.account?.id;
    const cache=this.account?.cacheSnapshot()??(owner?this.memory.get(owner)??await cachedAccount(owner):null);
    if(!this.account){this.inactive=cache;this.changed();}
    if(workspacePending(cache)&&this.discardVersion!==cache?.version)throw new SyncError("pending_changes");
    this.departureVersion=cache?.version??null;return true;
  }
  async signedOut(){
    const owner=this.account?.owner??this.identity?.account?.id;++this.generation;this.authGeneration++;this.identityRefresh=null;sessionChoice(false);await this.detach(false);
    if(owner)await clearOwnerPush(owner).catch(()=>{});
    const cache=owner?this.memory.get(owner)??await cachedAccount(owner):null;
    // A different tab can save while logout is in flight. Lock newly pending
    // work for same-owner recovery instead of applying an older discard choice.
    if(owner&&(!workspacePending(cache)||cache?.version===this.departureVersion)){this.memory.delete(owner);await forgetAccount(owner);}
    this.identity=null;this.inactive=null;await setRememberedOwner(null);this.discardVersion=null;this.departureVersion=null;this.channel?.postMessage({changed:true});this.changed();
  }
  /** Permanent owner marker and cache removal share one IDB transaction. Other
   * tabs cannot write old data back after deletion; the guest DB is never opened. */
  async deletedAccount(owner:string,announce=true){
    this.dropAccountView(owner);
    if(this.identity?.account?.id===owner)this.identity=null;
    this.discardVersion=null;this.departureVersion=null;this.changed();
    const alreadyKnown=await isDeletedAccount(owner);
    await forgetAccount(owner,true);await clearOwnerPush(owner);await clearAccountAlerts(owner);this.cleanupError=null;if(announce||!alreadyKnown)this.channel?.postMessage({changed:true});this.changed();
  }
  accountCleanupError=()=>this.cleanupError;
  private dropAccountView(owner:string){
    if(this.account?.owner===owner){
      ++this.generation;const previous=this.account;this.account=null;this.unsub();previous.close();
      this.active=this.guest;this.unsub=this.guest.subscribe(this.changed);sessionChoice(false);
    }
    this.memory.delete(owner);this.memoryGenerations.delete(owner);if(this.inactive?.owner===owner)this.inactive=null;
    this.changed();
  }
  async cleanupVersion(owner:string){
    const current=await this.cleanupState(owner);return JSON.stringify([current.version,current.epoch]);
  }
  private async cleanupState(owner:string){
    if(this.identity?.account?.id!==owner)throw new SyncError("account_changed");
    await this.account?.settled();const cache=this.account?.owner===owner?this.account.cacheSnapshot():this.memory.get(owner)??await cachedAccount(owner);
    const epoch=await accountDeviceGeneration(owner);if(this.identity?.account?.id!==owner)throw new SyncError("account_changed");
    return {version:cache?.version??null,epoch,persistent:this.account?.owner===owner?this.account.persistent:this.identity?.account?.remembered};
  }
  async clearAccountDevice(owner:string,review:string){
    const current=await this.cleanupState(owner);
    if(JSON.stringify([current.version,current.epoch])!==review)throw new SyncError("account_changed");
    if((await pushControl()).owner===owner)await disablePush(()=>this.identity,owner);
    await forgetAccount(owner,false,current.persistent?current.version:undefined,current.epoch);
    this.dropAccountView(owner);this.changed();
    this.channel?.postMessage({changed:true});
    await clearOwnerPush(owner);await clearAccountAlerts(owner);
  }
  recoveryJourney=()=>this.account;
  hasAccountRecovery=()=>!!(this.account||this.inactive&&this.inactive.owner===this.identity?.account?.id);
  syncNow=async()=>{await this.refreshIdentity();await this.account?.retry();};
  pendingAccountExport=()=>{const cache=this.inactive;return this.account?.pendingExport()??(cache&&cache.owner===this.identity?.account?.id?JSON.stringify({format:"rise.account-recovery",version:1,owner:cache.owner,revision:cache.revision,state:cache.state,queue:cache.queue,...(cache.recovery?{recovery:cache.recovery}:{}),unsaved:[]}):null);};
  dispatch:JourneySession["dispatch"]=(...args)=>{
    const result=this.active.dispatch(...args),owner=this.scope;
    if(result&&owner!=="guest"&&affectsPush(args[0])){
      this.pushInvalidations++;
      void canceledEventKeys(args[0]).then(keys=>blockPushPlan(()=>this.identity,owner,keys)).then(()=>flushPushCancellation(()=>this.identity)).catch(()=>{window.dispatchEvent(new Event("rise-push-changed"));}).finally(()=>{this.pushInvalidations--;this.changed();});
    }
    return result;
  };
  setState:JourneySession["setState"]=(...args)=>this.active.setState(...args);
  whenSaved:JourneySession["whenSaved"]=(...args)=>this.active.whenSaved(...args);
  holdForUpdate:JourneySession["holdForUpdate"]=(...args)=>this.active.holdForUpdate(...args);
  releaseUpdate:JourneySession["releaseUpdate"]=(...args)=>this.active.releaseUpdate(...args);
  retry:JourneySession["retry"]=(...args)=>this.active.retry(...args);
  refresh:JourneySession["refresh"]=(...args)=>this.active.refresh(...args);
  original:JourneySession["original"]=(...args)=>this.active.original(...args);
  pendingExport:JourneySession["pendingExport"]=(...args)=>this.active.pendingExport(...args);
  snapshot:JourneySession["snapshot"]=(...args)=>this.active.snapshot(...args);
  restorePoint:JourneySession["restorePoint"]=(...args)=>this.active.restorePoint(...args);
  restore:JourneySession["restore"]=(...args)=>this.active.restore(...args);
  reloadSaved:JourneySession["reloadSaved"]=(...args)=>this.active.reloadSaved(...args);
  clear:JourneySession["clear"]=(...args)=>this.active.clear(...args);
  close(){this.closed=true;this.authGeneration++;this.identityRefresh=null;this.generation++;this.account?.close();this.guest.close();this.unsub();this.channel?.close();clearInterval(this.timer);window.removeEventListener("focus",this.onFocus);window.removeEventListener("online",this.onFocus);document.removeEventListener("visibilitychange",this.onFocus);}
}
