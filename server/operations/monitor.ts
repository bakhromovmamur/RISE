import type { RequestSummary } from './requests.ts';
export interface QueueSummary {
  sampledAt:string;pending:number;due:number;oldestDueSeconds:number;staleLeases:number;expiredPending:number;
  failed24h:number;retired24h:number;senderReady:boolean;deletionOverdue:number;deletionRetrying:number;
}
const object=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('invalid_operations_sample');return value as Record<string,unknown>;};
function count(value:unknown){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw new Error('invalid_operations_count');return value;}
function stamp(value:unknown){if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw new Error('invalid_operations_time');return new Date(value).toISOString();}
function release(value:unknown){if(typeof value!=='string'||! /^[a-zA-Z0-9._-]{1,80}$/.test(value))throw new Error('invalid_operations_release');return value;}
export function queueSummary(value:unknown):QueueSummary{
  const v=object(value);if(typeof v.senderReady!=='boolean')throw new Error('invalid_operations_sample');
  return {sampledAt:stamp(v.sampledAt),senderReady:v.senderReady,pending:count(v.pending),due:count(v.due),oldestDueSeconds:count(v.oldestDueSeconds),staleLeases:count(v.staleLeases),expiredPending:count(v.expiredPending),failed24h:count(v.failed24h),retired24h:count(v.retired24h),deletionOverdue:count(v.deletionOverdue),deletionRetrying:count(v.deletionRetrying)};
}
export function requestSummary(value:unknown):RequestSummary{
  const v=object(value);if(v.windowSeconds!==300)throw new Error('invalid_operations_window');
  return {sampledAt:stamp(v.sampledAt),release:release(v.release),webRelease:release(v.webRelease),windowSeconds:300,requests:count(v.requests),serverErrors:count(v.serverErrors),syncFailures:count(v.syncFailures),syncConflicts:count(v.syncConflicts),rateLimited:count(v.rateLimited),slowRequests:count(v.slowRequests)};
}
export const alertCodes=['health_unavailable','database_unavailable','diagnostics_stale','sender_unavailable','queue_backlog','queue_stale_lease','queue_expired','delivery_failed','deletion_overdue','deletion_retrying','server_errors','sync_failures','sync_conflicts','auth_throttled','slow_requests','backup_stale','maintenance_stale','test_alert'] as const;
export type AlertCode=typeof alertCodes[number];
export interface Observation {healthy:boolean;requests:RequestSummary|null;queue:QueueSummary|null;backup?:BackupSummary|null}
export interface BackupSummary {checkedAt:number;latestBackupAt:number|null;purgeFailed:boolean}
export function backupSummary(value:unknown):BackupSummary{
 const v=object(value),purge=object(v.purge);if(v.version!==1)throw new Error('invalid_backup_status');
 return {checkedAt:count(v.checkedAt),latestBackupAt:v.latestBackupAt===null?null:count(v.latestBackupAt),purgeFailed:count(purge.failed)>0};
}
export function evaluate(observation:Observation,now:number):AlertCode[]{
  const alerts:AlertCode[]=[],{requests:r,queue:q}=observation;
  const fresh=(value:string)=>now-Date.parse(value)>=-5000&&now-Date.parse(value)<=20000;
  if(observation.backup!==undefined){
    const b=observation.backup;
    if(!b||b.latestBackupAt===null||now-b.latestBackupAt<0||now-b.latestBackupAt>=86400000)alerts.push('backup_stale');
    if(!b||now-b.checkedAt<0||now-b.checkedAt>120000||b.purgeFailed)alerts.push('maintenance_stale');
  }
  if(!observation.healthy)alerts.push('health_unavailable');
  if(!q||!fresh(q.sampledAt))alerts.push('database_unavailable');
  else{
    if(q.pending&&!q.senderReady)alerts.push('sender_unavailable');
    if(q.oldestDueSeconds>=30)alerts.push('queue_backlog');
    if(q.staleLeases)alerts.push('queue_stale_lease');
    if(q.expiredPending)alerts.push('queue_expired');
    if(q.failed24h)alerts.push('delivery_failed');
    if(q.deletionOverdue)alerts.push('deletion_overdue');
    if(q.deletionRetrying)alerts.push('deletion_retrying');
  }
  if(!r||!fresh(r.sampledAt))alerts.push('diagnostics_stale');
  else{
    if(r.serverErrors>=3)alerts.push('server_errors');
    if(r.syncFailures)alerts.push('sync_failures');
    if(r.syncConflicts>=5)alerts.push('sync_conflicts');
    if(r.rateLimited>=10)alerts.push('auth_throttled');
    if(r.slowRequests>=5)alerts.push('slow_requests');
  }
  return alerts;
}
export interface AlertEvent{at:string;code:AlertCode;state:'raised'|'resolved'}
export interface AlertJournal {version:1;checkedAt:string;active:AlertCode[];events:AlertEvent[]}
const code=(value:unknown):AlertCode=>{if(!alertCodes.includes(value as AlertCode))throw new Error('invalid_alert_code');return value as AlertCode;};
/** Rebuild unknown persisted input from an allowlist; never forward arbitrary JSON. */
export function readJournal(value:unknown):AlertJournal{
  const v=object(value);if(v.version!==1||!Array.isArray(v.active)||v.active.length>alertCodes.length||!Array.isArray(v.events)||v.events.length>200)throw new Error('invalid_alert_journal');
  return {version:1,checkedAt:stamp(v.checkedAt),active:[...new Set(v.active.map(code))],events:v.events.map(item=>{const e=object(item);if(e.state!=='raised'&&e.state!=='resolved')throw new Error('invalid_alert_state');return {at:stamp(e.at),code:code(e.code),state:e.state};})};
}
export function transition(previous:AlertJournal|null,active:AlertCode[],now:number):AlertJournal{
  if(previous&&Date.parse(previous.checkedAt)>now)throw new Error('operations_clock_moved_back');
  const at=new Date(now).toISOString(),before=previous?.active??[];
  const events=(previous?.events??[]).filter(e=>Date.parse(e.at)<=now&&Date.parse(e.at)>now-7*86400000);
  for(const c of alertCodes){if(active.includes(c)&&!before.includes(c))events.push({at,code:c,state:'raised'});if(!active.includes(c)&&before.includes(c))events.push({at,code:c,state:'resolved'});}
  return {version:1,checkedAt:at,active:[...new Set(active)],events:events.slice(-200)};
}
