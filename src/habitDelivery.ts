import {buildHabitSchedule,habitReminderCopy,type HabitAlert} from './habitSchedule';
import {pushEventKey} from './push/policy';
import {claimReminder} from './push/ledger';
import {showBrowserNotification} from './prayerDelivery';
import {pushControl} from './push/store';
import type {State} from './model';
/** Recheck the current durable profile and consent across asynchronous work. */
export async function deliverHabitAlert(event:HabitAlert,scope:string,source:()=>State|null){
 const eligible=()=>{const s=source();return !!s&&typeof Notification!=='undefined'&&Notification.permission==='granted'&&Date.now()>=event.at&&Date.now()<event.expiresAt&&buildHabitSchedule(s,event.at-1).some(e=>e.key===event.key&&e.at===event.at);};
 if(!eligible()||(await pushControl()).habitForeground!==scope)return false;
 const key=await pushEventKey(event.key);
 if(!eligible()||!await claimReminder(scope,key,event.at,event.expiresAt,eligible))return false;
 if((await pushControl()).habitForeground!==scope||!eligible())return false;
 const copy=habitReminderCopy(source()!.life.language);
 // Generic copy, no authored text, no completion actions, OS controls sound.
 return showBrowserNotification(copy.title,copy.body,`rise-reminder:${scope}:${key}:${event.at}`,{pushReminder:true,scope},true,eligible);
}
