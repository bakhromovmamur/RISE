import * as v from '../data/validation';
import {exact} from '../contracts/personalCommands';
import {sharedId,type SharedCommand} from '../contracts/sharedContent';
import type {State} from '../model';
import {canonical} from '../contracts/personalRecords';
export interface TaskDraft {taskId:string;revision:number;title:string;notes:string;assignee:string;date:string;time:string;weekdays:number[]}
export interface ListDraft {listId:string;revision:number;name:string}
export interface ItemDraft {itemId:string;revision:number;editing:boolean;text:string;quantity:string}
const revision=v.number(1,2147483647,true);
export function taskDraft(value:unknown):TaskDraft{exact({taskId:sharedId,revision,title:v.string(160),notes:v.string(800),assignee:v.emptyOr(sharedId),date:v.emptyOr(v.date),time:v.emptyOr(v.clock),weekdays:v.array(v.number(0,6,true),7)})(value,'task-draft');return structuredClone(value) as TaskDraft;}
export function listDraft(value:unknown):ListDraft{exact({listId:sharedId,revision,name:v.string(80)})(value,'list-draft');return structuredClone(value) as ListDraft;}
export function itemDraft(value:unknown):ItemDraft{exact({itemId:sharedId,revision,editing:v.bool,text:v.string(160),quantity:v.string(80)})(value,'item-draft');return structuredClone(value) as ItemDraft;}
export function taskCommand(groupId:string,d:TaskDraft,editing:boolean):SharedCommand{return{kind:editing?'task.edit':'task.create',groupId,taskId:d.taskId,title:d.title.trim(),notes:d.notes,assignee:d.assignee||null,date:d.date,time:d.time||null,weekdays:d.weekdays};}
export function completedSharedDraft(state:State,command:SharedCommand,revision:number):string|null{
 let key:string,expected:SharedCommand;
 try{
  if(command.kind==='task.create'||command.kind==='task.edit'){key=`server-task:${command.groupId}:${command.kind==='task.create'?'new':command.taskId}`;const d=taskDraft(state.life.drafts[key]);if(d.revision!==revision)return null;expected=taskCommand(command.groupId,d,command.kind==='task.edit');}
  else if(command.kind==='list.create'||command.kind==='list.rename'){key=`server-list:${command.groupId}:${command.kind==='list.create'?'new':command.listId}`;const d=listDraft(state.life.drafts[key]);if(d.revision!==revision)return null;expected={kind:command.kind,groupId:command.groupId,listId:d.listId,name:d.name.trim()};}
  else if(command.kind==='item.add'||command.kind==='item.edit'){key=`server-item:${command.groupId}:${command.listId}`;const d=itemDraft(state.life.drafts[key]);if(d.revision!==revision)return null;expected={kind:d.editing?'item.edit':'item.add',groupId:command.groupId,listId:command.listId,itemId:d.itemId,text:d.text.trim(),quantity:d.quantity.trim()};}
  else return null;
  return canonical(expected)===canonical(command)?key:null;
 }catch{return null;}
}
