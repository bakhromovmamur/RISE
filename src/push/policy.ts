import type {AccountCommand} from '../contracts/accountCommands';
import type {DomainCommand} from '../contracts/commands';
import {timeInZone} from '../domain/zonedTime';
export async function pushEventKey(key:string){
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key)));
 bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
 const h=Array.from(bytes.slice(0,16),b=>b.toString(16).padStart(2,'0')).join('');
 return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
export function quietAt(at:number,timezone:string,start:string,end:string){
 const clock=timeInZone(at,timezone);return start===end?false:start<end?clock>=start&&clock<end:clock>=start||clock<end;
}
export function affectsPush(command:{kind:string;changes?:unknown}){
 if(command.kind==='preferences.set'){const c=command.changes as Record<string,unknown>|undefined;return !!c&&['quietStart','quietEnd','reminders'].some(k=>k in c);}
 return command.kind.startsWith('prayer.')&&command.kind!=='prayer.location-reviewed'||['habit.save','habit.archive','habit.check','habit.correct','timer.complete','onboarding.finish','fajr.plan','fajr.acknowledge','account.timezone','delivery.preferences'].includes(command.kind);
}
/** null means invalidate all coverage; [] means no scheduling side effect. */
export async function canceledEventKeys(command:DomainCommand|AccountCommand):Promise<string[]|null>{
 if(!affectsPush(command))return [];
 if(command.kind==='habit.check'||command.kind==='habit.correct'||command.kind==='timer.complete')return [await pushEventKey(`rise:${command.date}:habit:${command.habitId}`)];
 if(command.kind==='fajr.acknowledge'||command.kind==='fajr.plan')return Promise.all(['wake','backup'].map(k=>pushEventKey(`rise:${command.date}:fajr:${k}`)));
 if(command.kind==='prayer.record')return Promise.all(['prepare','due','wake','backup'].map(k=>pushEventKey(`rise:${command.date}:${command.prayer}:${k}`)));
 if((command.kind==='prayer.timetable'||command.kind==='prayer.coverage')&&command.date)return Promise.all(['fajr','dhuhr','asr','maghrib','isha'].flatMap(p=>['prepare','due','wake','backup'].map(k=>pushEventKey(`rise:${command.date}:${p}:${k}`))));
 return null;
}
/** Re-submitting a fresh revision cannot revive a recorded/paused/acknowledged event. */
export async function suppressedEventKeys(state:import('../model').State){
 const keys:string[]=[];
 for(const [date,day]of Object.entries(state.prayers.days))for(const prayer of ['fajr','dhuhr','asr','maghrib','isha'] as const)if(day.entries[prayer].check||isPrayerExcluded(state,date,prayer))for(const kind of ['prepare','due','wake','backup'])keys.push(`rise:${date}:${prayer}:${kind}`);
 for(const date of state.life.delivery?.acknowledgedFajr??[])for(const kind of ['wake','backup'])keys.push(`rise:${date}:fajr:${kind}`);
 return new Set(await Promise.all(keys.map(pushEventKey)));
}
import {isPrayerExcluded} from '../lifeModel';
