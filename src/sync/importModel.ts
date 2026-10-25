import type { State } from "../model";
import { localDate, xpTotal } from "../model";
import { createEmptyState } from "../data/initialState";
import { validateState } from "../data/storedState";
import { digest } from "../data/migration";
import { canonical, hydrate, personalTables, project, priorityRecord, type Records, type Row } from "../contracts/personalRecords";
import { emptyRecords, keyOf, parseEntries, validateRows, type ImportEntry } from "../contracts/sync";
import { uuid } from "../contracts/accountCommands";
import { PRAYERS } from "../prayerModel";
import type { Priority } from "../developmentModel";
import { manualPrayerWindow } from "../domain/zonedTime";
import {date as validDate} from '../data/validation';

export interface ImportSelection { habitIds: string[]; goals: boolean; prayers: boolean; reflections: boolean; settings: boolean }
export interface ImportSummary { habits: number; habitChecks: number; prayerChecks: number; goals: number; reflections: number; xp: number; excludedSamples: number; excludedReferences: number; from:string|null; through:string|null }
export interface ImportProposal { records: Records; entries: ImportEntry[]; sourceHash: string; summary: ImportSummary }
const sampleHabit = (h: State["habits"][number]) => ["read","walk","english"].includes(h.id) && h.created === "2026-10-12" || h.id==="build"&&["2026-10-12","2026-10-19"].includes(h.created);
export const importableHabits = (s: State) => s.habits.filter(h => !sampleHabit(h));
async function mappedId(owner: string, family: string, id: string) {
  if(uuid(id))return id;
  // Stable across retries/devices for this account, without hashing private content or coordinates.
  const text = await digest(["rise-guest-import-v1",owner,family,id]);
  return `${text.slice(0,8)}-${text.slice(8,12)}-5${text.slice(13,16)}-a${text.slice(17,20)}-${text.slice(20,32)}`;
}
export async function prepareGuestImport(input: State, owner: string, selection: ImportSelection): Promise<ImportProposal> {
  validateState(input); if (!uuid(owner)) throw new Error("invalid_import_owner");
  const allowed = new Set(importableHabits(input).map(h => h.id));
  if (selection.habitIds.some(id => !allowed.has(id))) throw new Error("sample_selection");
  const picked = new Set(selection.habitIds), state = createEmptyState(), ids = new Map<string,string>();
  const mapId = async (family: string, id: string) => { const key=`${family}:${id}`; if (!ids.has(key)) ids.set(key,await mappedId(owner,family,id)); return ids.get(key)!; };
  for (const h of input.habits) if (picked.has(h.id)) await mapId("habit",h.id);
  for (const g of input.goals) { await mapId("goal",g.id); for(const m of g.milestones)await mapId(`milestone:${g.id}`,m.id); }
  for(const r of input.personalRewards)await mapId("reward",r.id);
  const id = (family: string, value: string) => ids.get(`${family}:${value}`)!;
  state.name = input.name; state.timezone = input.timezone; state.demoDate = localDate(input.timezone); state.onboarded = input.onboarded;
  if(selection.settings){state.prefs=structuredClone(input.prefs);state.life.language=input.life.language;}
  state.habits=input.habits.filter(h=>picked.has(h.id)).map(h=>({...structuredClone(h),id:id("habit",h.id)}));
  let excludedReferences=0;
  state.days=picked.size?Object.fromEntries(Object.entries(input.days).map(([date,rows])=>[date,rows.filter(row=>picked.has(row.habitId)).map(row=>({...structuredClone(row),habitId:id("habit",row.habitId)}))])):{};
  if(selection.goals){
    state.goals=input.goals.filter(g=>!g.id.startsWith("demo-")&&!(g.createdOn==="2026-10-12"&&["book","project"].includes(g.id))).map(g=>({...structuredClone(g),id:id("goal",g.id),habitIds:g.habitIds.filter(h=>picked.has(h)).map(h=>id("habit",h)),milestones:g.milestones.map(m=>({...m,id:id(`milestone:${g.id}`,m.id)}))}));
    const goals=new Set(state.goals.map(g=>g.id));
    state.personalRewards=input.personalRewards.filter(r=>!(["coffee","next-book"].includes(r.id)&&input.habits.some(sampleHabit))&&(r.condition.kind==="weekly"||goals.has(id("goal",r.condition.goalId)))).map(r=>({...structuredClone(r),id:id("reward",r.id),condition:r.condition.kind==="goal"?{...r.condition,goalId:id("goal",r.condition.goalId)}:{...r.condition},...(r.previousAttemptId?{previousAttemptId:id("reward",r.previousAttemptId)}:{})}));
    const rewards=new Set(state.personalRewards.map(r=>r.id));state.personalRewards=state.personalRewards.map(r=>{if(r.previousAttemptId&&!rewards.has(r.previousAttemptId)){const next={...r};delete next.previousAttemptId;return next;}return r;});
    state.selectedRewardId=input.selectedRewardId&&rewards.has(id("reward",input.selectedRewardId))?id("reward",input.selectedRewardId):null;
  }
  state.dailyPriorities=Object.fromEntries(Object.entries(input.dailyPriorities).map(([date,rows])=>[date,rows.flatMap<Priority>(p=>{
    if(p.kind==="habit"&&picked.has(p.habitId))return[{kind:"habit" as const,habitId:id("habit",p.habitId)}];
    if(p.kind==="milestone"&&selection.goals&&state.goals.some(g=>g.id===id("goal",p.goalId)&&g.milestones.some(m=>m.id===id(`milestone:${p.goalId}`,p.milestoneId))))return[{kind:"milestone" as const,goalId:id("goal",p.goalId),milestoneId:id(`milestone:${p.goalId}`,p.milestoneId)}];
    excludedReferences++;return[];
  })]).filter(([,rows])=>rows.length>0));
  if(selection.reflections)state.reflections=structuredClone(input.reflections);
  state.claimed=input.claimed.filter(xp=>xp<=xpTotal(state));state.equipped=state.claimed.includes(250)?input.equipped:null;
  if(selection.prayers){
    const sampleDates=new Set(Object.entries(input.prayers.days).filter(([,day])=>day.sample).map(([date])=>date));
    state.prayers=structuredClone(input.prayers);state.prayers.days=Object.fromEntries(Object.entries(input.prayers.days).filter(([,day])=>!day.sample).map(([date,day])=>{const clean=structuredClone(day);delete clean.calculationKey;for(const{id}of PRAYERS){const entry=clean.entries[id];if(!entry.beginsAt||!entry.targetAt||!entry.endsAt){const window=manualPrayerWindow(date,entry,clean.timezone);if(!window)throw new Error("unresolved_timetable");entry.beginsAt=new Date(window.start).toISOString();entry.targetAt=new Date(window.target).toISOString();entry.endsAt=new Date(window.end).toISOString();}}return[date,clean];}));
    state.prayers.work=input.prayers.work&&state.prayers.days[input.prayers.work.date]?{...input.prayers.work,wrapUntil:null}:null;
    state.prayers.prepared=Object.fromEntries(Object.entries(input.prayers.prepared).filter(([date])=>!sampleDates.has(date)));
    state.life.pauses=await Promise.all(input.life.pauses.filter(p=>!sampleDates.has(p.from.slice(0,10))&&(!p.through||!sampleDates.has(p.through.slice(0,10)))).map(async p=>({...p,id:await mapId("pause",p.id)})));
    state.life.reminderRules=structuredClone(input.life.reminderRules);state.life.backupEnabled=input.life.backupEnabled;
    state.life.delivery={enabled:false,sound:false,acknowledgedFajr:(input.life.delivery?.acknowledgedFajr??[]).filter(date=>!sampleDates.has(date))};
  }
  // Device setup, coordinates, raw keys, drafts, timers, simulations, credentials and archives never enter this projection.
  const dates=[state.prayers.started,...Object.keys(state.days),...Object.keys(state.prayers.days),...state.habits.map(h=>h.created)].filter(Boolean).sort();
  const records=project(state,dates[0]??state.demoDate);
  validateImportRecords(records);
  const entries=personalTables.flatMap(t=>records[t.name].map(row=>({table:t.name,row})));
  const historyDates=[...Object.keys(state.days),...Object.keys(state.prayers.days),...Object.keys(state.prayers.prepared),...Object.keys(state.reflections),...state.habits.map(h=>h.created),...state.goals.map(g=>g.createdOn)].sort();
  const summary={habits:state.habits.length,habitChecks:Object.values(state.days).flat().filter(o=>o.check).length,prayerChecks:Object.values(state.prayers.days).flatMap(d=>Object.values(d.entries)).filter(e=>e.check).length,goals:state.goals.length,reflections:Object.keys(state.reflections).length,xp:xpTotal(state),excludedSamples:input.habits.filter(sampleHabit).length+Object.values(input.prayers.days).filter(d=>d.sample).length,excludedReferences,from:historyDates[0]??null,through:historyDates.at(-1)??null};
  return{records,entries,sourceHash:await digest(canonical(records)),summary};
}
export function validateImportRecords(records: Records) {
  if(Object.keys(records).length!==personalTables.length)throw new Error("invalid_import_tables");
  let count=0;
  for(const t of personalTables){validateRows(t.name,records[t.name]);count+=records[t.name].length;const keys=records[t.name].map(row=>keyOf(t.name,row));if(new Set(keys).size!==keys.length)throw new Error("duplicate_import_row");}
  if(count>250000||new TextEncoder().encode(JSON.stringify(records)).length>50*1024*1024)throw new Error("import_limit");
  const state=hydrate(records), projected=project(state,String(records.profiles[0].started_on));
  for(const t of personalTables){
    const normalize=(rows:Row[])=>rows.map(row=>canonical(t.name==='daily_priorities'?priorityRecord(row):row)).sort();
    if(canonical(normalize(records[t.name]))!==canonical(normalize(projected[t.name])))throw new Error("invalid_import_projection");
  }
  validateReferences(records);
  return state;
}
function validateReferences(records:Records,retainShared=false){
  for(const t of personalTables)for(const original of records[t.name]){const row=t.name==='daily_priorities'?priorityRecord(original):original;for(const key of t.columns)if((key==="id"||key.endsWith("_id"))&&row[key]!==null&&!uuid(row[key]))throw new Error("invalid_import_id");}
  const habits=new Set(records.habits.map(row=>row.id)),goals=new Set(records.goals.map(row=>row.id)),rewards=new Set(records.personal_rewards.map(row=>row.id));
  const milestones=new Set(records.goal_milestones.map(row=>`${row.goal_id}:${row.id}`));
  for(const row of records.daily_priorities){if(row.kind==='task'){if(!retainShared||!uuid(row.group_id)||!uuid(row.task_id))throw new Error('shared_import_reference');validDate(row.task_date,'task date');}
   else if(row.kind==="habit"?!habits.has(row.habit_id):!milestones.has(`${row.goal_id}:${row.milestone_id}`))throw new Error("invalid_import_reference");}
  for(const row of records.personal_rewards)if(row.goal_id!==null&&!goals.has(row.goal_id)||row.previous_attempt_id!==null&&!rewards.has(row.previous_attempt_id))throw new Error("invalid_import_reference");
  if(records.account_preferences[0].selected_reward_id!==null&&!rewards.has(records.account_preferences[0].selected_reward_id))throw new Error("invalid_import_reference");
}
export function recordsFromEntries(entries: ImportEntry[]): Records {
  const records=emptyRecords();for(const item of entries){const [entry]=parseEntries([item]);records[entry.table].push(entry.row);}return records;
}
/** Append independent bundles. Existing account records always win; never replace a whole account. */
export function mergeGuestImport(before: Records, incoming: Records) {
  validateImportRecords(incoming);
  if(!before.profiles?.length)return{records:incoming,added:personalTables.reduce((n,t)=>n+incoming[t.name].length,0),kept:0,xpAdded:xpTotal(hydrate(incoming))};
  const merged:Records=structuredClone(before);let added=0,kept=0;
  const oldHabit=new Set(before.habits.map(r=>r.id)),oldGoal=new Set(before.goals.map(r=>r.id)),oldReward=new Set(before.personal_rewards.map(r=>r.id)),oldPrayer=new Set(before.prayer_days.map(r=>r.date)),oldPriority=new Set(before.priority_days.map(r=>r.date));
  for(const t of personalTables){
    const existing=new Set(before[t.name].map(row=>keyOf(t.name,row)));
    for(const row of incoming[t.name]){
      const blocked=existing.has(keyOf(t.name,row))
        || ["profiles","account_preferences","prayer_settings","prayer_reminders"].includes(t.name)
        || (["habit_versions","habit_occurrences"].includes(t.name)&&oldHabit.has(row.habit_id))
        || (["goal_milestones","goal_habits"].includes(t.name)&&oldGoal.has(row.goal_id))
        || (["prayer_windows","prayer_records","saved_work_breaks"].includes(t.name)&&oldPrayer.has(row.date))
        || (t.name==="daily_priorities"&&(oldPriority.has(row.date)||row.kind==="milestone"&&!merged.goal_milestones.some(m=>m.goal_id===row.goal_id&&m.id===row.milestone_id)))
        || (t.name==="prayer_pauses"&&row.through_key===null&&before.prayer_pauses.some(p=>p.through_key===null));
      if(blocked){kept++;continue;}
      if(t.name==="saved_work_breaks"&&row.active===true&&merged.saved_work_breaks.some(r=>r.active===true)) {merged[t.name].push({...row,active:false});added++;continue;}
      merged[t.name].push(row);added++;
    }
  }
  // Appended item positions follow existing items; keys/history stay unchanged.
  for(const name of ["habits","goals","personal_rewards","prayer_pauses"]){let position=Math.max(-1,...before[name].map(r=>Number(r.position)))+1;const old=name==="habits"?oldHabit:name==="goals"?oldGoal:name==="personal_rewards"?oldReward:new Set(before[name].map(r=>r.id));for(const row of merged[name])if(!old.has(row.id))row.position=position++;}
  const positions=new Map<string,number>(),oldOccurrences=new Set(before.habit_occurrences.map(row=>keyOf("habit_occurrences",row)));
  for(const row of before.habit_occurrences)positions.set(String(row.date),Math.max(positions.get(String(row.date))??0,Number(row.position)+1));
  for(const row of merged.habit_occurrences)if(!oldOccurrences.has(keyOf("habit_occurrences",row))){const date=String(row.date),position=positions.get(date)??0;row.position=position;positions.set(date,position+1);}
  // Keep prayer tracking independent of earlier habit history, including pre-SYNC settings.
  const prayerSettings=merged.prayer_settings[0].data as Row,oldSettings=before.prayer_settings[0].data as Row,newSettings=incoming.prayer_settings[0].data as Row;
  const oldStarted=String(oldSettings.started??before.profiles[0].started_on);
  prayerSettings.started=incoming.prayer_days.length?[oldStarted,String(newSettings.started)].sort()[0]:oldStarted;
  const earliest=[String(before.profiles[0].started_on),String(incoming.profiles[0].started_on)].sort()[0];merged.profiles[0].started_on=earliest;
  // Removing a skipped milestone priority leaves the remaining slots contiguous.
  const slots=new Map<string,number>();for(const row of merged.daily_priorities){const date=String(row.date),slot=slots.get(date)??0;row.slot=slot;slots.set(date,slot+1);}
  validateReferences(merged,true);const state=hydrate(merged);return{records:merged,added,kept,xpAdded:xpTotal(state)-xpTotal(hydrate(before))};
}
export function importPages(entries: ImportEntry[]): ImportEntry[][] {
  const pages:ImportEntry[][]=[];let page:ImportEntry[]=[],bytes=0;
  for(const entry of entries){const size=new TextEncoder().encode(JSON.stringify(entry)).length+1;if(page.length&&(page.length===200||bytes+size>256*1024)){pages.push(page);page=[];bytes=0;}page.push(entry);bytes+=size;}if(page.length)pages.push(page);return pages;
}
