import {addDays,scheduled,versionAt,type State} from './model';
import {dateInZone,wallTimeInstant} from './domain/zonedTime';
import {quietAt} from './push/policy';
import {PLAN_HORIZON} from './contracts/pushPlan';
export interface HabitAlert {key:string;date:string;habitId:string;at:number;expiresAt:number}
export const habitEventKey=(date:string,id:string)=>`rise:${date}:habit:${id}`;
/** Reuses dated domain versions/snapshots. Never materializes or edits history.
 * The local pipeline retains its existing two-minute expiry until live delivery
 * acceptance; late foreground timers must not replay an old nudge. */
export function buildHabitSchedule(s:State,now=Date.now()):HabitAlert[]{
 if(s.mode==='demo'||!s.prefs.reminders)return [];
 const events:HabitAlert[]=[],start=dateInZone(now,s.timezone);
 for(let i=0;i<=7;i++){
  const date=addDays(start,i);
  for(const habit of s.habits){
   if(habit.archivedAt&&date>=habit.archivedAt)continue;
   const rows=s.days[date],row=rows?.find(o=>o.habitId===habit.id);
   if(rows?!row||!!row.check:!scheduled(habit,date))continue;
   const at=wallTimeInstant(date,versionAt(habit,date).reminder,s.timezone);
   if(at===null||at<=now||at+1000>=now+PLAN_HORIZON||quietAt(at,s.timezone,s.prefs.quietStart,s.prefs.quietEnd))continue;
   events.push({key:habitEventKey(date,habit.id),date,habitId:habit.id,at,expiresAt:Math.min(at+120000,now+PLAN_HORIZON)});
  }
 }
 return events.sort((a,b)=>a.at-b.at||a.key.localeCompare(b.key));
}
export function habitReminderCopy(language:State['life']['language']){
 return {title:'RISE',body:language==='ru'?'Время для небольшого шага. Откройте RISE, когда будет удобно.':language==='uz'?'Kichik qadam uchun vaqt. Qulay paytda RISE’ni oching.':'Room for one small step. Open RISE when it suits you.'};
}
