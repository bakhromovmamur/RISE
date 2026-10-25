import type {State} from '../model';
import {parsePushPlan,parsePushPlanReceipt,parsePushPlanView,type PushPlanInput,type PushPlanView} from '../contracts/pushPlan';
import {pushObject} from '../contracts/push';
import type {PushControl} from './store';
import {buildWebPushEvents} from './plan';
import {buildPrayerSchedule,deliveryPreferences} from '../prayerSchedule';
import {quietAt,pushEventKey} from './policy';
import {AccountError} from '../auth/client';

export interface RenewalRecord {
 enabled:boolean;allowDuringQuiet:boolean;
 pending?:{input:PushPlanInput;signature:string};
 confirmed?:{generation:number;signature:string;renewAt:number;subscriptionVersion:number};
}
export function validRenewal(v:unknown):v is RenewalRecord{
 if(!pushObject(v)||typeof v.enabled!=='boolean'||typeof v.allowDuringQuiet!=='boolean')return false;
 const hash=(s:unknown)=>typeof s==='string'&&/^[a-f0-9-]{36}$/.test(s);
 if(v.pending!==undefined){if(!pushObject(v.pending)||!hash(v.pending.signature))return false;try{parsePushPlan(v.pending.input);}catch{return false;}}
 const c=v.confirmed;if(c!==undefined&&(!pushObject(c)||!hash(c.signature)||!Number.isSafeInteger(c.generation)||Number(c.generation)<1||!Number.isSafeInteger(c.subscriptionVersion)||Number(c.subscriptionVersion)<1||typeof c.renewAt!=='number'||!Number.isFinite(c.renewAt)))return false;
 return true;
}
export interface PlanSource {owner:string;revision:number;state:State;ready:boolean}
export interface RenewalPort {
 source():PlanSource|null;now():number;online():boolean;permission():boolean;
 control():Promise<PushControl>;write(expected:number,changes:Partial<Omit<PushControl,'revision'>>):Promise<PushControl>;
 read():Promise<unknown>;post(input:PushPlanInput):Promise<unknown>;cancel():Promise<void>;
}
export type PlanStatus='planMissing'|'planSync'|'planOffline'|'planError'|'planOther'|'planExpired'|'planEmpty'|'planStaged'|'planScheduled'|'planQuiet'|'planClock'|'planBlocked';
export interface RenewalView {status:PlanStatus;busy:boolean;view:PushPlanView|null;wake:string|null;backup:string|null;wakeQuiet:boolean;allowDuringQuiet:boolean}
const initial=():RenewalView=>({status:'planMissing',busy:false,view:null,wake:null,backup:null,wakeQuiet:false,allowDuringQuiet:false});
async function signature(s:State,allow:boolean){return pushEventKey(JSON.stringify([s.mode,s.timezone,s.habits,s.days,s.prefs.reminders,s.prayers,s.life.setup,s.life.calculation,s.life.reminderRules,s.life.pauses,s.life.delivery,s.life.backupEnabled,s.prefs.quietStart,s.prefs.quietEnd,allow]));}
/** One owner/installation at a time. Network calls never hold the control lock;
 * durable CAS and current-source assertions fence late replies and other tabs. */
export class PlanRenewal {
 private value=initial();private listeners=new Set<()=>void>();private running=false;private recheck=false;private closed=false;private retryAt=0;
 constructor(private port:RenewalPort){}
 getSnapshot=()=>this.value;
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>this.listeners.delete(fn);};
 private set(part:Partial<RenewalView>){if(this.closed)return;this.value={...this.value,...part};this.listeners.forEach(fn=>fn());}
 close(){this.closed=true;this.listeners.clear();}
 private sourceCurrent(source:PlanSource){const next=this.port.source();return !this.closed&&next?.owner===source.owner&&next.ready&&next.revision===source.revision&&next.state===source.state;}
 async refresh(choice?:{allowDuringQuiet:boolean},force=false){
  if(this.closed)return;
  if(this.running){this.recheck=true;return;}
  const source=this.port.source();if(!source){this.set(initial());return;}
  if(!source.ready){this.set({status:'planSync',view:null});return;}
  if(!this.port.online()){this.set({status:'planOffline',view:null});return;}
  if(!choice&&!force&&this.port.now()<this.retryAt)return;
  this.running=true;this.set({busy:true});let attemptRevision:number|null=null;
  try{
   await this.port.cancel();
   let control=await this.port.control();attemptRevision=control.revision;
   if(!this.sourceCurrent(source))return;
   if(control.owner!==source.owner||!control.enabled||control.pending||control.cancelRequest?.pending||!control.installation||!this.port.permission()){this.set({status:'planMissing',view:null});return;}
   let view=parsePushPlanView(await this.port.read());
   if(view.accountId!==source.owner||!this.sourceCurrent(source))return;
   if(Math.abs(Date.parse(view.serverNow)-this.port.now())>120000){this.set({status:'planClock',view});return;}
   if(view.receiver?.installation!==control.installation||view.receiver.version!==control.generation){this.set({status:'planMissing',view});return;}
   if(choice){
    control=await this.port.write(control.revision,{renewal:{enabled:true,allowDuringQuiet:choice.allowDuringQuiet}});attemptRevision=control.revision;
   }
   // Background consent is independent of the existing foreground/native switch.
   // Only the projection receives this enable bit; no profile preference is changed.
   const scheduleState={...source.state,life:{...source.state.life,delivery:{...deliveryPreferences(source.state),enabled:true}}};
   const renewal=control.renewal;
   if(!choice&&renewal?.enabled&&view.plan&&view.plan.primaryInstallation!==control.installation){
    await this.port.write(control.revision,{renewal:{...renewal,enabled:false,pending:undefined}});
    this.set({status:'planOther',view});return;
   }
   const allow=renewal?.allowDuringQuiet??false,sig=await signature(source.state,allow),now=this.port.now();
   const due=!!renewal?.enabled&&(!!choice||!!renewal.pending||!renewal.confirmed||renewal.confirmed.signature!==sig||renewal.confirmed.subscriptionVersion!==control.generation||renewal.confirmed.renewAt<=now||control.planBlocked||!!control.blockedEvents?.length||view.plan?.generation!==renewal.confirmed.generation);
   if(due){
    let pending=renewal.pending;
    // A rejected or superseded intent gets a NEW id; never mutate an existing request.
    if(!pending||pending.signature!==sig||pending.input.sourceRevision!==source.revision){
     const events=(await buildWebPushEvents(scheduleState,now,true)).filter(e=>Date.parse(e.at)>now+30000);
     pending={signature:sig,input:{accountId:source.owner,requestId:crypto.randomUUID(),expectedGeneration:view.plan?.generation??0,sourceRevision:source.revision,takeover:!!choice,allowDuringQuiet:allow,timezone:source.state.timezone,events}};
     if(!this.sourceCurrent(source))return;
     control=await this.port.write(control.revision,{renewal:{...renewal,pending}});attemptRevision=control.revision;
    }
    if(!this.sourceCurrent(source))return;
    const receipt=parsePushPlanReceipt(await this.port.post(pending.input));
    // Receipt may be a replay of an old generation. Only current server state is readiness.
    view=parsePushPlanView(await this.port.read());
    if(!this.sourceCurrent(source)||view.accountId!==source.owner)return;
    if(view.plan?.generation!==receipt.generation||view.plan.primaryInstallation!==control.installation||receipt.primaryInstallation!==control.installation)throw new AccountError('account_changed');
    control=await this.port.write(control.revision,{renewal:{enabled:true,allowDuringQuiet:allow,confirmed:{generation:receipt.generation,signature:sig,renewAt:Math.min(now+12*3600000,view.receiver?.queuedThrough?Math.max(now+60000,Date.parse(view.receiver.queuedThrough)-60000):now+12*3600000),subscriptionVersion:control.generation}},planBlocked:false,blockedEvents:[],planGeneration:view.dispatchEnabled?receipt.generation:undefined});
   }
   const schedule=buildPrayerSchedule(scheduleState,now),wake=schedule.find(e=>e.kind==='wake'),backup=schedule.find(e=>e.kind==='backup'&&e.date===wake?.date);
   const wakeQuiet=!!wake&&!view.plan?.allowDuringQuiet&&quietAt(wake.at,source.state.timezone,source.state.prefs.quietStart,source.state.prefs.quietEnd);
   const key=wake?await pushEventKey(wake.key):null,backupKey=backup?await pushEventKey(backup.key):null;
   const received=view.receiver?.events??[];
   const status:PlanStatus=control.planBlocked||control.blockedEvents?.length?'planBlocked':view.receiver?.failed?'planError':!view.plan?'planMissing':!view.receiver?.queuedThrough?(view.plan.coverageExpired&&view.plan.queuedThrough?'planExpired':wakeQuiet?'planQuiet':'planEmpty'):Date.parse(view.receiver.queuedThrough)<=now?'planExpired':wakeQuiet?'planQuiet':view.dispatchEnabled?'planScheduled':'planStaged';
   if(this.sourceCurrent(source))this.set({status,view,allowDuringQuiet:control.renewal?.allowDuringQuiet??false,wake:received.find(e=>e.key===key)?.at??null,backup:received.find(e=>e.key===backupKey)?.at??null,wakeQuiet});
   this.retryAt=0;
  }catch(error){
   if(this.sourceCurrent(source)){
    this.set({status:'planError',view:null});this.retryAt=this.port.now()+Math.max(30000,error instanceof AccountError?error.retryAfter*1000:0);
    if(error instanceof AccountError&&['account_changed','invalid_input'].includes(error.code)){
     const c=await this.port.control().catch(()=>null);
     if(c?.owner===source.owner&&c.revision===attemptRevision&&c.renewal)await this.port.write(c.revision,{renewal:{...c.renewal,enabled:false,pending:undefined},planGeneration:undefined}).catch(()=>{});
    }
   }
  }finally{
   this.running=false;
   if(!this.sourceCurrent(source)){this.set({...initial(),status:this.port.source()?'planSync':'planMissing'});this.recheck=true;}else this.set({busy:false});
   // Coalesce updates that arrived during the request. Re-read current owner,
   // durable state and consent; never replay a stale explicit takeover choice.
   if(this.recheck){this.recheck=false;queueMicrotask(()=>{void this.refresh();});}
  }
 }
}
