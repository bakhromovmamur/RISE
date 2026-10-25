import {buildHabitSchedule} from '../habitSchedule';
import {pushEventKey,quietAt} from './policy';
import type {State} from '../model';
import {buildPrayerSchedule} from '../prayerSchedule';
import {PLAN_HORIZON,type PlanEvent} from '../contracts/pushPlan';
/** Pure projection of existing eligibility. Caller owns explicit primary-device
 * consent and must not submit until the cancellation/quiet-hours flow is wired. */
export async function buildWebPushEvents(state:State,now:number,allowDuringQuiet=false):Promise<PlanEvent[]>{
 const alerts=buildPrayerSchedule(state,now).filter(e=>e.at+1000<now+PLAN_HORIZON&&(allowDuringQuiet||!quietAt(e.at,state.timezone,state.prefs.quietStart,state.prefs.quietEnd)));
 const combined=[...alerts.map(e=>({...e,habit:false})),...buildHabitSchedule(state,now).map(e=>({...e,habit:true}))].sort((a,b)=>a.at-b.at||a.key.localeCompare(b.key));
 return Promise.all(combined.slice(0,84).map(async e=>{
  return {...(e.habit?{kind:"habit" as const}:{}),key:await pushEventKey(e.key),at:new Date(e.at).toISOString(),expiresAt:new Date(Math.min(e.expiresAt,e.at+120000,now+PLAN_HORIZON)).toISOString()};
 }));
}
