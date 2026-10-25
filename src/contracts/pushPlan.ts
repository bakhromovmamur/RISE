import { pushObject, pushOnly, pushUUID } from './push';
export const PLAN_HORIZON = 7 * 86400000;
export interface PlanEvent { kind?:"habit"; key: string; at: string; expiresAt: string }
export interface PushPlanInput { accountId: string; requestId: string; expectedGeneration: number; sourceRevision: number; takeover: boolean; allowDuringQuiet?: boolean; timezone: string; events: PlanEvent[] }
/** No free text, coordinates, calculation keys or domain payloads cross this seam. */
export function parsePushPlan(value: unknown): PushPlanInput {
  if (!pushObject(value) || !pushOnly(value,['accountId','requestId','expectedGeneration','sourceRevision','takeover','timezone','events','allowDuringQuiet']) || !pushUUID(value.accountId) || !pushUUID(value.requestId) || (value.allowDuringQuiet!==undefined&&typeof value.allowDuringQuiet!=='boolean') || typeof value.takeover !== 'boolean' || typeof value.timezone !== 'string' || value.timezone.length > 80 || !Array.isArray(value.events) || value.events.length > 84) throw new Error('invalid_plan');
  for (const key of ['expectedGeneration','sourceRevision']) if (!Number.isSafeInteger(value[key]) || Number(value[key]) < 0 || Number(value[key]) >= 2147483647) throw new Error('invalid_plan');
  try { new Intl.DateTimeFormat('en',{timeZone:value.timezone}); } catch { throw new Error('invalid_plan'); }
  const keys = new Set<string>(); let previous = 0;
  const events = value.events.map((event: unknown) => {
    if (!pushObject(event) || !pushOnly(event,['key','at','expiresAt','kind']) || (event.kind!==undefined&&event.kind!=='habit') || !pushUUID(event.key) || typeof event.at !== 'string' || typeof event.expiresAt !== 'string') throw new Error('invalid_plan');
    const at=Date.parse(event.at), end=Date.parse(event.expiresAt);
    if (!Number.isFinite(at) || !Number.isFinite(end) || new Date(at).toISOString() !== event.at || new Date(end).toISOString() !== event.expiresAt || at < previous || end <= at || end-at>120000 || keys.has(event.key)) throw new Error('invalid_plan');
    previous=at;keys.add(event.key);return {key:event.key,at:event.at,expiresAt:event.expiresAt,...(event.kind==="habit"?{kind:"habit" as const}:{})};
  });
  return {accountId:value.accountId,requestId:value.requestId,expectedGeneration:Number(value.expectedGeneration),sourceRevision:Number(value.sourceRevision),takeover:value.takeover,timezone:value.timezone,events,...(value.allowDuringQuiet!==undefined?{allowDuringQuiet:value.allowDuringQuiet}:{})};
}
export function validatePlanWindow(events:PlanEvent[],now:number) {
  if (events.some(e=>Date.parse(e.at)<=now || Date.parse(e.expiresAt)>now+PLAN_HORIZON)) throw new Error('invalid_plan_window');
  // Bound bursts even when callers supply distinct opaque event identities.
  for (let i=0;i<events.length;i++) if(events.filter(e=>Math.abs(Date.parse(e.at)-Date.parse(events[i].at))<3600000).length>12) throw new Error('invalid_plan_rate');
}

export interface PushPlanView {
 accountId:string; serverNow:string; dispatchEnabled:boolean;
 plan:null|{primaryInstallation:string;generation:number;sourceRevision:number;timezone:string;queuedThrough:string|null;suppressed:number;allowDuringQuiet:boolean;coverageExpired:boolean;counts:{status:string;count:number}[]};
 receiver:null|{installation:string;version:number;queuedThrough:string|null;nextAt:string|null;failed:number;events:PlanEvent[]};
}
const natural=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0&&Number(v)<2147483647;
const instant=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(Date.parse(v)).toISOString()===v;
export function parsePushPlanView(v:unknown):PushPlanView{
 if(!pushObject(v)||!pushOnly(v,['accountId','serverNow','dispatchEnabled','plan','receiver'])||!pushUUID(v.accountId)||!instant(v.serverNow)||typeof v.dispatchEnabled!=='boolean')throw new Error('invalid_plan_view');
 const p=v.plan,r=v.receiver;
 if(p!==null){
  if(!pushObject(p)||!pushOnly(p,['primaryInstallation','generation','sourceRevision','timezone','queuedThrough','suppressed','allowDuringQuiet','coverageExpired','counts'])||!pushUUID(p.primaryInstallation)||!natural(p.generation)||p.generation===0||!natural(p.sourceRevision)||typeof p.timezone!=='string'||p.timezone.length>80||!(p.queuedThrough===null||instant(p.queuedThrough))||!natural(p.suppressed)||typeof p.allowDuringQuiet!=='boolean'||typeof p.coverageExpired!=='boolean'||!Array.isArray(p.counts)||p.counts.length>8||p.counts.some(c=>!pushObject(c)||!pushOnly(c,['status','count'])||!['queued','leased','accepted','failed','retired','canceled','expired'].includes(String(c.status))||!natural(c.count)))throw new Error('invalid_plan_view');
  try{new Intl.DateTimeFormat('en',{timeZone:p.timezone});}catch{throw new Error('invalid_plan_view');}
 }
 if(r!==null){
  if(!pushObject(r)||!pushOnly(r,['installation','version','queuedThrough','nextAt','failed','events'])||!pushUUID(r.installation)||!natural(r.version)||r.version===0||!natural(r.failed)||!(r.queuedThrough===null||instant(r.queuedThrough))||!(r.nextAt===null||instant(r.nextAt)))throw new Error('invalid_plan_view');
  parsePushPlan({accountId:v.accountId,requestId:r.installation,expectedGeneration:0,sourceRevision:0,takeover:false,timezone:'UTC',events:r.events});
 }
 return v as unknown as PushPlanView;
}
export function parsePushPlanReceipt(v:unknown){
 if(!pushObject(v)||!pushOnly(v,['generation','primaryInstallation','queuedThrough','jobs','suppressed','dispatchEnabled'])||!natural(v.generation)||v.generation===0||!pushUUID(v.primaryInstallation)||!(v.queuedThrough===null||instant(v.queuedThrough))||!natural(v.jobs)||!natural(v.suppressed)||typeof v.dispatchEnabled!=='boolean')throw new Error('invalid_plan_receipt');
 return {generation:Number(v.generation),primaryInstallation:v.primaryInstallation};
}
