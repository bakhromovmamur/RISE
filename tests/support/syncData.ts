import { createEmptyState } from "../../src/data/initialState.ts";
import { applyDomainCommand } from "../../src/domain/commands.ts";
import { addDays, emptyDraft, localDate } from "../../src/model.ts";
import { makePrayerState, PRAYERS, saveTimetable, type PrayerDay } from "../../src/prayerModel.ts";

export function syncGuest(date=localDate("UTC")){
  const first=addDays(date,-2),prayerStart=addDays(date,-1),now=Date.parse(`${first}T12:00:00Z`),context={date:first,now,timezone:"UTC"};
  let state=createEmptyState();state.timezone="UTC";state.demoDate=date;state.onboarded=true;state.name="Synthetic device profile";state.prayers=makePrayerState("fresh",prayerStart,"UTC");
  state=applyDomainCommand(state,{kind:"habit.save",newId:"authored-reading",draft:{...emptyDraft(),name:"Synthetic reading",days:[0,1,2,3,4,5,6]}},context);
  state=applyDomainCommand(state,{kind:"habit.check",habitId:"authored-reading",date:first,check:"full"},context);
  state=applyDomainCommand(state,{kind:"goal.save",newId:"authored-goal",draft:{title:"Synthetic authored goal",reason:"Private motivation",targetDate:"",habitIds:["authored-reading"],milestones:[{id:"authored-step",title:"Synthetic first step"}]}},context);
  state=applyDomainCommand(state,{kind:"reward.save",newId:"authored-reward",draft:{name:"Synthetic reward",condition:{kind:"goal",goalId:"authored-goal"}}},context);
  state.reflections[first]={manageable:"Synthetic private reflection",smaller:"Synthetic smaller step"};
  const windows=[["00:00","00:10","02:00"],["02:00","02:10","04:00"],["04:00","04:10","06:00"],["06:00","06:10","08:00"],["08:00","08:10","10:00"]];
  const day:PrayerDay={source:"Synthetic real manual date",sample:false,timezone:"UTC",entries:Object.fromEntries(PRAYERS.map(({id},i)=>[id,{begins:windows[i][0],target:windows[i][1],ends:windows[i][2]}])) as PrayerDay["entries"]};
  state=saveTimetable(state,prayerStart,day);state=saveTimetable(state,date,day);
  state.prayers.days[prayerStart].entries.fajr.check="on_time";state.prayers.days[prayerStart].entries.fajr.performedAt="00:15";
  state.prayers.prepared[addDays(date,1)]={...state.prayers.fajr,enabled:true,backupEnabled:false};
  state.life.pauses=[{id:"authored-pause",from:`${prayerStart}:1`,through:`${prayerStart}:2`}];
  state.life.drafts["reflection:new"]={manageable:"Synthetic unfinished draft",smaller:"A small draft"};
  state.life.calculation={latitude:41.3111,longitude:69.2797,timezone:"UTC",label:"Synthetic private location",method:"Karachi",madhab:"Hanafi",highLatitude:"MiddleOfTheNight"};
  state.prayers.days[prayerStart].calculationKey=JSON.stringify(state.life.calculation);
  return state;
}
