import type {AccountCommand} from '../contracts/accountCommands';
import type {State} from '../model';
import {priorityKey,type Priority} from '../developmentModel';

export type SharedPriority=Extract<Priority,{kind:'task'}>&{groupId:string};
export const isSharedPriority=(p:Priority):p is SharedPriority=>p.kind==='task'&&typeof p.groupId==='string';
/** Opaque references only. This function grants no access to the shared record. */
export function requestedSharedPriorities(command:AccountCommand):SharedPriority[]{
 const rows=command.kind==='priorities.set'?command.priorities:command.kind==='priority.pin'&&command.selected?[command.priority]:[];
 return rows.filter(isSharedPriority);
}
export function newSharedPriorities(state:State,command:AccountCommand):SharedPriority[]{
 if(command.kind!=='priorities.set'&&command.kind!=='priority.pin')return[];
 const previous=new Set((state.dailyPriorities[command.date]??[]).map(priorityKey));
 return requestedSharedPriorities(command).filter(p=>!previous.has(priorityKey(p)));
}
