import type { State } from "../model";
import type { AccountCommand } from "../contracts/accountCommands";
import type { CommandContext } from "../contracts/personalCommands";
import { canonical, project, type Row } from "../contracts/personalRecords";
import { applyDomainCommand } from "../domain/commands";
import { addDays, localDate } from "../model";

/** Known account fields only; device calculation keys/sample days/simulated references stay local. */
export function projectForSync(state:State){
  const clean=structuredClone(state);
  clean.prayers.days=Object.fromEntries(Object.entries(clean.prayers.days).filter(([,day])=>!day.sample).map(([date,day])=>{delete day.calculationKey;return[date,day];}));
  clean.dailyPriorities=Object.fromEntries(Object.entries(clean.dailyPriorities).map(([date,rows])=>[date,rows.filter(row=>row.kind!=="task"||row.groupId!==undefined)]));
  if(clean.prayers.work&&!clean.prayers.days[clean.prayers.work.date])clean.prayers.work=null;
  return project(clean,localDate(state.timezone));
}
/** Semantic read set: compare only the records this intent depends on, never the whole profile. */
export function intentView(state:State,command:AccountCommand,context:CommandContext):string{
  const records=projectForSync(state),parts:unknown[]=[state.timezone],c=command;
  // Existing immutable priority fingerprints predate the optional shared fields.
  const take=(table:string,match:(r:Row)=>boolean=()=>true)=>parts.push([table,records[table].filter(match).map(row=>{
    if(table!=="daily_priorities"||row.kind==="task")return row;
    const {group_id:_,task_id:__,task_date:___,...legacy}=row;return legacy;
  })]);
  const habit=(id:string)=>{take("habits",r=>r.id===id);take("habit_versions",r=>r.habit_id===id);};
  const goal=(id:string)=>{take("goals",r=>r.id===id);take("goal_milestones",r=>r.goal_id===id);take("goal_habits",r=>r.goal_id===id);};
  const reward=(id:string)=>{take("personal_rewards",r=>r.id===id);const r=state.personalRewards.find(r=>r.id===id);if(r?.condition.kind==="goal")goal(r.condition.goalId);else if(r?.condition.kind==="weekly"){const week=r.condition.week;take("habit_occurrences",r=>String(r.date)>=week&&String(r.date)<=addDays(week,6));}};
  if("habitId" in c){habit(c.habitId);if("date"in c)take("habit_occurrences",r=>r.habit_id===c.habitId&&r.date===c.date);}
  if("goalId"in c)goal(c.goalId);
  if("rewardId"in c)reward(c.rewardId);
  if(c.kind==="habit.save"){habit(c.draft.id??c.newId);}
  if(c.kind==="goal.save"){goal(c.draft.id??c.newId);for(const id of c.draft.habitIds)habit(id);}
  if(c.kind==="reward.save"){reward(c.draft.id??c.newId);if(c.draft.condition.kind==="goal")goal(c.draft.condition.goalId);}
  if(c.kind==="prayer.record"){take("prayer_days",r=>r.date===c.date);take("prayer_windows",r=>r.date===c.date&&r.prayer===c.prayer);take("prayer_records",r=>r.date===c.date&&r.prayer===c.prayer);take("prayer_pauses");}
  if(c.kind==="prayer.pause"||c.kind==="prayer.resume"){take("prayer_pauses");take("prayer_days",r=>r.date===c.date);take("prayer_windows",r=>r.date===c.date);take("prayer_records",r=>r.date===c.date);}
  if(c.kind==="prayer.coverage"){take("prayer_days",r=>r.date===c.date);take("prayer_windows",r=>r.date===c.date);take("prayer_settings");}
  if(c.kind==="prayer.preferences")take("prayer_settings");
  if(c.kind==="prayer.reminder")take("prayer_reminders",r=>r.prayer===c.prayer);
  if(c.kind==="fajr.plan")take("fajr_plans",r=>r.date===c.date);
  if(c.kind==="fajr.acknowledge")take("fajr_acknowledgments",r=>r.date===c.date);
  if(c.kind.startsWith("work.")&&"date"in c&&"prayer"in c){take("saved_work_breaks");take("prayer_windows",r=>r.date===c.date&&r.prayer===c.prayer);}
  if(c.kind==="reflection.save")take("reflections",r=>r.date===c.date);
  if(c.kind.startsWith("priorit")&&"date"in c){take("daily_priorities",r=>r.date===c.date);take("habits");take("goals");take("goal_milestones");}
  if(c.kind==="collection.claim"||c.kind==="collection.equip"){take("cosmetic_claims");parts.push(state.equipped);}
  if(c.kind==="preferences.set")parts.push(Object.fromEntries(Object.keys(c.changes).map(k=>[k,state.prefs[k as keyof State["prefs"]]])));
  if(c.kind==="profile.name")parts.push(state.name);
  if(c.kind==="language.set")parts.push(state.life.language);
  if(c.kind.startsWith("onboarding.")){parts.push(state.onboarded);take("habits");}
  if(c.kind==="calendar.refresh"){take("habits");take("habit_versions");parts.push(context.date);}
  return canonical(parts);
}
/** Missing/archived parents and retired milestones cannot be revived by a stale intent. */
export function blockedIntent(state:State,c:AccountCommand):boolean{
  const habitId="habitId"in c?c.habitId:c.kind==="habit.save"?c.draft.id:undefined;
  if(habitId){const h=state.habits.find(h=>h.id===habitId);if(!h||h.archivedAt&&c.kind!=="habit.archive")return true;}
  const goalId="goalId"in c?c.goalId:c.kind==="goal.save"?c.draft.id:undefined;
  if(goalId){const g=state.goals.find(g=>g.id===goalId);if(!g||g.status==="archived"&&c.kind!=="goal.status")return true;if(c.kind==="goal.milestone"&&!g.milestones.some(m=>m.id===c.milestoneId))return true;}
  const rewardId="rewardId"in c?c.rewardId:c.kind==="reward.save"?c.draft.id:undefined;
  if(rewardId){const r=state.personalRewards.find(r=>r.id===rewardId);if(!r||r.archivedOn&&c.kind!=="reward.archive")return true;}
  if(c.kind==="prayer.record"&&!state.prayers.days[c.date])return true;
  return false;
}
export function convergedIntent(state:State,c:AccountCommand,expected:string,context:CommandContext,matches:(actual:string)=>boolean=(actual)=>actual===expected):boolean{
  if(c.kind!=="habit.check"&&c.kind!=="habit.correct")return false;
  const occurrence=state.days[c.date]?.find(h=>h.habitId===c.habitId);if(!occurrence||(occurrence.check??null)!==c.check)return false;
  // Only the check bit may differ; target/schedule/history conditions must still match.
  const before=structuredClone(state),row=before.days[c.date].find(h=>h.habitId===c.habitId)!;
  for(const check of [undefined,"full","tiny"] as const){if(check)row.check=check;else delete row.check;if(matches(intentView(before,c,context)))return true;}
  return false;
}
export function applySyncIntent(state:State,c:AccountCommand,context:CommandContext,sharedPriorities?:ReadonlySet<string>):State{
  if(c.kind==="account.initialize")throw new Error("initialize_required");
  if(c.kind==="account.timezone")return{...state,timezone:c.timezone};
  if(c.kind==="prayer.coverage"){
    const day=structuredClone(c.day);for(const id of Object.keys(day.entries) as (keyof typeof day.entries)[]){const prior=state.prayers.days[c.date]?.entries[id];if(prior?.check)day.entries[id]=structuredClone(prior);}
    return{...state,prayers:{...state.prayers,preferences:c.preferences,days:{...state.prayers.days,[c.date]:day}}};
  }
  return applyDomainCommand(state,c,context,{sharedPriorities});
}

/** Explicit keys include absent records, so deletion/recreation cannot masquerade as an unchanged value. */
export function removalKeys(c:AccountCommand):[string,string][]{
  const keys:[string,string][]=[];
  if("habitId"in c)keys.push(["habits",canonical([c.habitId])]);
  if(c.kind==="habit.save")keys.push(["habits",canonical([c.draft.id??c.newId])]);
  if("goalId"in c)keys.push(["goals",canonical([c.goalId])]);
  if(c.kind==="goal.save")keys.push(["goals",canonical([c.draft.id??c.newId])]);
  if("rewardId"in c)keys.push(["personal_rewards",canonical([c.rewardId])]);
  if(c.kind==="reward.save")keys.push(["personal_rewards",canonical([c.draft.id??c.newId])]);
  if(c.kind==="habit.check"||c.kind==="habit.correct")keys.push(["habit_occurrences",canonical([c.date,c.habitId])]);
  if(c.kind==="prayer.record")keys.push(["prayer_records",canonical([c.date,c.prayer])]);
  if(c.kind==="goal.milestone")keys.push(["goal_milestones",canonical([c.goalId,c.milestoneId])]);
  return keys;
}

/** Fresh actions on retained archived history still use the original domain rules.
 * This does not permit a stale view to bypass an archive or restore its parent. */
export function archivedTarget(state:State,c:AccountCommand):boolean{
  const habitId="habitId"in c?c.habitId:c.kind==="habit.save"?c.draft.id:undefined;
  if(habitId)return !!state.habits.find(h=>h.id===habitId)?.archivedAt;
  const goalId="goalId"in c?c.goalId:c.kind==="goal.save"?c.draft.id:undefined;
  if(goalId)return state.goals.find(g=>g.id===goalId)?.status==="archived";
  const rewardId="rewardId"in c?c.rewardId:c.kind==="reward.save"?c.draft.id:undefined;
  return !!rewardId&&!!state.personalRewards.find(r=>r.id===rewardId)?.archivedOn;
}
