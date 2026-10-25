import { intentView, applySyncIntent, projectForSync } from "./policy";
import type { State } from "../model";
import type { DomainCommand } from "../contracts/commands";
import type { CommandContext } from "../contracts/personalCommands";
import { parseSyncOperation, type SyncOperation } from "../contracts/sync";
import { parseAccountOperation, type AccountCommand } from "../contracts/accountCommands";
import { canonical } from "../contracts/personalRecords";
import { localDate } from "../model";
import { PRAYERS, type PrayerDay } from "../prayerModel";
import {priorityKey} from '../developmentModel';
import {isSharedPriority} from '../domain/priorityReferences';
export function cleanDay(day:PrayerDay):PrayerDay{
  const entries=Object.fromEntries(PRAYERS.map(({id})=>{const p=day.entries[id];return[id,{begins:p.begins,target:p.target,ends:p.ends,...(p.beginsAt?{beginsAt:p.beginsAt}:{}),...(p.targetAt?{targetAt:p.targetAt}:{}),...(p.endsAt?{endsAt:p.endsAt}:{})}];}));
  // Every prayer is present and the public contract validates the constructed day below.
  return{source:day.source,sample:false,timezone:day.timezone,...(day.sunrise?{sunrise:day.sunrise}:{}),entries:entries as PrayerDay["entries"]};
}
/** Compare account fields without device-only previews, calculation keys or shared simulations. */
export function personalProjection(state:State){
  return projectForSync(state);
}
/** After consent to a prayer import, retain this device's calculation setup locally. */
export function importedPrayerSetup(remote:State,guest:State):State{
  if(remote.timezone!==guest.timezone)return remote;
  const next=structuredClone(remote);next.life.setup=structuredClone(guest.life.setup);
  if(guest.life.calculation?.timezone===remote.timezone)next.life.calculation=structuredClone(guest.life.calculation);
  if(guest.life.deviceTimezone)next.life.deviceTimezone=structuredClone(guest.life.deviceTimezone);
  for(const[date,day]of Object.entries(next.prayers.days)){const source=guest.prayers.days[date];if(source?.calculationKey&&canonical(cleanDay(source))===canonical(cleanDay(day)))day.calculationKey=source.calculationKey;}
  return next;
}
export function syncOperations(before:State,after:State,command:DomainCommand,context:CommandContext,baseRevision:number):SyncOperation[]{
  // A device observation/current-date refresh with no personal delta must not
  // advance the account revision and invalidate another device's next action.
  if(command.kind==="calendar.refresh"&&canonical(personalProjection(before))===canonical(personalProjection(after)))return[];
  const commands:{command:AccountCommand;context:CommandContext}[]=[];
  const current={...context,date:localDate(after.timezone,new Date(context.now)),timezone:after.timezone};
  if(before.timezone!==after.timezone)commands.push({command:{kind:"account.timezone",timezone:after.timezone},context});
  let normal:unknown=command;
  if(command.kind==="timer.complete")normal={kind:command.date===context.date?"habit.check":"habit.correct",habitId:command.habitId,date:command.date,check:"full"};
  if(command.kind==="calendar.refresh")normal={kind:"calendar.refresh"};
  if(command.kind==="priorities.set")normal={...command,priorities:command.priorities.filter(p=>p.kind!=="task"||isSharedPriority(p))};
  const skip=command.kind==="prayer.timetable"||command.kind==="prayer.calculated-setup"||command.kind.startsWith("work.")&&"date"in command&&!after.prayers.days[command.date];
  if(command.kind==="priority.pin"&&command.priority.kind==="task"&&!isSharedPriority(command.priority))normal={kind:"priorities.set",date:command.date,priorities:(after.dailyPriorities[command.date]??[]).filter(p=>p.kind!=="task"||isSharedPriority(p))};
  if(!skip){try{const parsed=parseAccountOperation({protocolVersion:1,operationId:crypto.randomUUID(),baseRevision:0,command:normal});commands.push({command:parsed.command,context:current});}catch(error){if(!new Set(["habit.draft","draft.save","draft.clear","timer.start","timer.pause","timer.resume","timer.end","prayer.sample-setup","prayer.location-reviewed","fajr.alarm","delivery.preferences","readiness.preview","work.wrap"]).has(command.kind))throw error;}}
  if(command.kind==="prayer.calculated-setup")commands.push({command:{kind:"calendar.refresh"},context:current});
  for(const[date,day]of Object.entries(after.prayers.days)){
    if(day.sample||!PRAYERS.every(({id})=>day.entries[id].beginsAt&&day.entries[id].targetAt&&day.entries[id].endsAt))continue;
    const prior=before.prayers.days[date];
    if(!prior||canonical(cleanDay(prior))!==canonical(cleanDay(day)))commands.push({command:{kind:"prayer.coverage",date,day:cleanDay(day),preferences:after.prayers.preferences},context:current});
  }
  if(commands.length>100)throw new Error("sync_batch_limit");
  let observed=before;
  const acceptedShared=new Set(Object.values(after.dailyPriorities).flat().filter(isSharedPriority).map(priorityKey));
  return commands.map((item,i)=>{const expected=intentView(observed,item.command,item.context);if(i<commands.length-1)observed=applySyncIntent(observed,item.command,item.context,acceptedShared);return parseSyncOperation({protocolVersion:1,operationId:crypto.randomUUID(),baseRevision:baseRevision+i,...item,expected});});
}
/** Reapply only device-owned fields after an authorized remote read. Never copy guest data. */
export function withDeviceState(remote:State,local:State):State{
  const next=structuredClone(remote);next.timer=local.timer;next.draft=local.draft;
  next.life={...next.life,drafts:local.life.drafts,setup:local.life.setup,...(local.life.calculation?{calculation:local.life.calculation}:{}),...(local.life.deviceTimezone?{deviceTimezone:local.life.deviceTimezone}:{}),alarm:local.life.alarm,readiness:local.life.readiness,groups:local.life.groups,tasks:local.life.tasks,lists:local.life.lists,updates:local.life.updates,
    delivery:{enabled:local.life.delivery?.enabled??false,sound:local.life.delivery?.sound??false,acknowledgedFajr:remote.life.delivery?.acknowledgedFajr??[]}};
  if(!next.prayers.work&&local.prayers.work&&!remote.prayers.days[local.prayers.work.date])next.prayers.work=local.prayers.work;
  if(next.prayers.work&&local.prayers.work?.date===next.prayers.work.date&&local.prayers.work.prayer===next.prayers.work.prayer)next.prayers.work={...next.prayers.work,wrapUntil:local.prayers.work.wrapUntil};
  for(const[date,day]of Object.entries(next.prayers.days)){const prior=local.prayers.days[date];if(prior?.calculationKey&&canonical(cleanDay(prior))===canonical(cleanDay(day)))day.calculationKey=prior.calculationKey;}
  for(const[date,rows]of Object.entries(local.dailyPriorities)){const tasks=rows.filter(p=>p.kind==="task"&&!isSharedPriority(p));if(tasks.length)next.dailyPriorities[date]=[...(next.dailyPriorities[date]??[]),...tasks].slice(0,3);}
  return next;
}

/** A reviewed account timezone change cannot reactivate an old device calculation.
 * The complete original setup remains in AccountRecovery.state for private export. */
export function recoveryDeviceState(remote:State,local:State):State{
  const next=withDeviceState(remote,local);
  if(next.life.calculation&&next.life.calculation.timezone!==remote.timezone){delete next.life.calculation;next.life.setup={...next.life.setup,configured:false};}
  return next;
}
