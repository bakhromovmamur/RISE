import { contentHash, createBackup, type BackupEnvelope } from "../data/backup";
import { exact } from "../contracts/personalCommands";
import { uuid } from "../contracts/accountCommands";
import { personalTables, hydrate, priorityRecord, type Records } from "../contracts/personalRecords";
import { keyOf, validateRows } from "../contracts/sync";
import { xpTotal } from "../model";
import * as v from "../data/validation";

interface AccountExportFile {
  format:"rise.account-export"; version:1; schemaVersion:4; exportedAt:string; accountId:string; email:string|null;
  revision:number; xp:number; records:Records; shared:{available:false;items:[]}; checksum:{algorithm:"SHA-256";value:string};
}
export interface AccountExport extends AccountExportFile { backup:BackupEnvelope }
/** Full known-field SQL projections, including retired milestones and inactive notes.
 * No redundant State payload: large histories use the existing 50 MiB limit. */
export async function createAccountExport(accountId:string,revision:number,records:Records,email:string|null=null):Promise<string>{
  const payload={format:"rise.account-export",version:1,schemaVersion:4,exportedAt:new Date().toISOString(),accountId,email,revision,xp:xpTotal(hydrate(records)),records,shared:{available:false,items:[]}} as const;
  const raw=JSON.stringify({...payload,checksum:{algorithm:"SHA-256",value:await contentHash(payload)}});v.parseJson(raw);return raw;
}
export async function parseAccountExport(raw:string):Promise<AccountExport>{
  const row=v.object(v.parseJson(raw),"account-export");
  exact({format:v.oneOf("rise.account-export"),version:v.oneOf(1),schemaVersion:v.oneOf(4),exportedAt:v.instant,accountId:v.string(36),email:v.nullable(v.string(254,/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/)),revision:v.number(1,Number.MAX_SAFE_INTEGER,true),xp:v.number(0,Number.MAX_SAFE_INTEGER,true),records:v.validateJson,shared:exact({available:v.oneOf(false),items:v.array(v.validateJson,0)}),checksum:exact({algorithm:v.oneOf("SHA-256"),value:v.string(64,/^[a-f0-9]{64}$/)})})(row,"account-export");
  if(!uuid(row.accountId))throw new v.StoredDataError("account-export");
  const {checksum,...payload}=row;
  if(await contentHash(payload)!==v.object(checksum,"checksum").value)throw new v.StoredDataError("checksum mismatch");
  const records=v.object(row.records,"account-records") as Records;
  if(Object.keys(records).length!==personalTables.length)throw new v.StoredDataError("account tables");
  const keys=new Map<string,Set<string>>();
  for(const table of personalTables){
    validateRows(table.name,records[table.name]);const seen=new Set<string>();
    for(const record of records[table.name]){const key=keyOf(table.name,record);if(seen.has(key))throw new v.StoredDataError("duplicate account record");seen.add(key);
      for(const column of table.keys){const value=record[column];if(column==="date"||column==="effective")v.date(value,column);else if(column==="prayer")v.oneOf("fajr","dhuhr","asr","maghrib","isha")(value,column);else if(column==="slot"||column==="xp")v.number(0,Number.MAX_SAFE_INTEGER,true)(value,column);else if(!uuid(value))throw new v.StoredDataError(column);}
      if(Object.hasOwn(record,"position"))v.number(0,Number.MAX_SAFE_INTEGER,true)(record.position,"position");
    }keys.set(table.name,seen);
  }
  const ref=(table:string,...key:unknown[])=>{if(!keys.get(table)!.has(JSON.stringify(key)))throw new v.StoredDataError("account reference");};
  for(const r of records.habit_versions)ref("habits",r.habit_id);
  for(const r of records.habit_occurrences){ref("habits",r.habit_id);ref("habit_days",r.date);}
  for(const r of records.goal_habits){ref("goals",r.goal_id);ref("habits",r.habit_id);}
  for(const r of records.goal_milestones){v.bool(r.retired,"retired");const data=v.object(r.data,"milestone");v.string(160)(data.title,"title");v.optional(v.date)(data.completedOn,"completion");ref("goals",r.goal_id);}
  for(const r of records.personal_rewards){v.oneOf("goal","weekly")(r.condition_kind,"condition");if(r.condition_kind==="goal"){ref("goals",r.goal_id);if(r.week!==null||r.target!==null)throw new v.StoredDataError("reward condition");}else{v.date(r.week,"week");v.number(1)(r.target,"target");if(r.goal_id!==null)throw new v.StoredDataError("reward condition");}if(r.previous_attempt_id!==null){if(r.previous_attempt_id===r.id)throw new v.StoredDataError("reward cycle");ref("personal_rewards",r.previous_attempt_id);}}
  for(const r of records.account_preferences)if(r.selected_reward_id!==null)ref("personal_rewards",r.selected_reward_id);
  for(const original of records.daily_priorities){const r=priorityRecord(original);v.number(0,2,true)(r.slot,"slot");ref("priority_days",r.date);
    if(r.kind==='task'){if(!uuid(r.group_id)||!uuid(r.task_id)||r.habit_id!==null||r.goal_id!==null||r.milestone_id!==null)throw new v.StoredDataError('priority');v.date(r.task_date,'task date');}
    else{if(r.group_id!==null||r.task_id!==null||r.task_date!==null)throw new v.StoredDataError('priority');if(r.kind==="habit"){ref("habits",r.habit_id);if(r.goal_id!==null||r.milestone_id!==null)throw new v.StoredDataError("priority");}else if(r.kind==="milestone"){ref("goal_milestones",r.goal_id,r.milestone_id);if(r.habit_id!==null)throw new v.StoredDataError("priority");}else throw new v.StoredDataError("priority");}}
  for(const r of records.prayer_windows)ref("prayer_days",r.date);
  for(const r of records.prayer_records)ref("prayer_windows",r.date,r.prayer);
  for(const r of records.saved_work_breaks){v.bool(r.active,"active");const data=v.object(r.data,"work");v.oneOf("save","away","returned")(data.stage,"stage");v.string(5000)(data.note,"note");v.bool(data.wrapUsed,"wrap");ref("prayer_windows",r.date,r.prayer);}
  if(records.saved_work_breaks.filter(r=>r.active).length>1)throw new v.StoredDataError("active work");
  const state=hydrate(records);if(xpTotal(state)!==row.xp)throw new v.StoredDataError("account XP");
  // DATA-02 restores the current personal projection. Full relational history
  // remains in the original file; it never restores account identity/membership.
  const portable=JSON.parse(await createBackup({state,archives:[],revision:Number(row.revision)})) as BackupEnvelope;
  const {checksum:_,...portablePayload}=portable;portablePayload.exportedAt=String(row.exportedAt);
  const backup={...portablePayload,checksum:{algorithm:"SHA-256" as const,value:await contentHash(portablePayload)}};
  return {...row,backup} as unknown as AccountExport;
}
