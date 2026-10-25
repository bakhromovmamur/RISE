import * as v from '../data/validation';
import {exact} from './personalCommands';
import {uuid} from './accountCommands';

export interface SharedTaskFields {title:string;notes:string;assignee:string|null;date:string;time:string|null;weekdays:number[]}
export type SharedCommand =
 | ({kind:'task.create'|'task.edit';groupId:string;taskId:string}&SharedTaskFields)
 | {kind:'task.archive'|'task.restore';groupId:string;taskId:string}
 | {kind:'task.complete';groupId:string;taskId:string;date:string;completed:boolean}
 | {kind:'list.create'|'list.rename';groupId:string;listId:string;name:string}
 | {kind:'list.archive'|'list.restore';groupId:string;listId:string}
 | {kind:'item.add'|'item.edit';groupId:string;listId:string;itemId:string;text:string;quantity:string}
 | {kind:'item.check';groupId:string;listId:string;itemId:string;checked:boolean}
 | {kind:'item.move';groupId:string;listId:string;itemId:string;beforeId:string|null}
 | {kind:'item.remove';groupId:string;listId:string;itemId:string};
export interface SharedTask extends SharedTaskFields {id:string;groupId:string;archived:boolean;revision:number}
export interface SharedList {id:string;groupId:string;name:string;archived:boolean;revision:number}
export interface SharedItem {id:string;listId:string;groupId:string;text:string;quantity:string;checked:boolean;position:number;revision:number}
export interface SharedOccurrence {
 taskId:string;groupId:string;date:string;completed:boolean;byMemberId:string|null;at:string|null;revision:number;
 snapshot:{title:string;notes:string;assignee:string|null;time:string|null;timezone:string;taskRevision:number};
}
export type SharedCollection='tasks'|'lists'|'items'|'occurrences';
export interface SharedQuery {groupId:string;collection:SharedCollection;parentId?:string;date?:string;cursor?:string;revision?:number}
export interface SharedPage {accountId:string;groupId:string;revision:number;collection:SharedCollection;rows:(SharedTask|SharedList|SharedItem|SharedOccurrence)[];next:string|null}
export const sharedId:v.Check=(x,p)=>{if(!uuid(x))throw new v.StoredDataError(p);};
const label=(max:number):v.Check=>(x,p)=>{v.string(max)(x,p);if(typeof x!=='string'||!x.trim()||[...x].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127))throw new v.StoredDataError(p);};
const weekdays:v.Check=(x,p)=>{v.array(v.number(0,6,true),7)(x,p);if(!Array.isArray(x)||new Set(x).size!==x.length)throw new v.StoredDataError(p);};
const notes:v.Check=(x,p)=>{v.string(800)(x,p);if(typeof x!=='string'||[...x].some(c=>(c.charCodeAt(0)<32&&!['\n','\t'].includes(c))||c.charCodeAt(0)===127))throw new v.StoredDataError(p);};
const civilDate:v.Check=(x,p)=>{v.date(x,p);if(typeof x==='string'&&x.startsWith('0000-'))throw new v.StoredDataError(p);};
const taskFields={title:label(160),notes,assignee:v.nullable(sharedId),date:civilDate,time:v.nullable(v.clock),weekdays};
const taskRef={groupId:sharedId,taskId:sharedId},listRef={groupId:sharedId,listId:sharedId},itemRef={...listRef,itemId:sharedId};
export const sharedValidators:Record<SharedCommand['kind'],Record<string,v.Check>>={
 'task.create':{...taskRef,...taskFields},'task.edit':{...taskRef,...taskFields},
 'task.archive':taskRef,'task.restore':taskRef,'task.complete':{...taskRef,date:civilDate,completed:v.bool},
 'list.create':{...listRef,name:label(80)},'list.rename':{...listRef,name:label(80)},'list.archive':listRef,'list.restore':listRef,
 'item.add':{...itemRef,text:label(160),quantity:v.string(80)},'item.edit':{...itemRef,text:label(160),quantity:v.string(80)},
 'item.check':{...itemRef,checked:v.bool},'item.move':{...itemRef,beforeId:v.nullable(sharedId)},'item.remove':itemRef,
};
export const isSharedCommand=(command:{kind:string}):command is SharedCommand=>Object.hasOwn(sharedValidators,command.kind);
export function parseSharedQuery(value:unknown):SharedQuery {
 v.validateJson(value);
 exact({groupId:sharedId,collection:v.oneOf('tasks','lists','items','occurrences'),parentId:v.optional(sharedId),date:v.optional(civilDate),cursor:v.optional(v.string(80)),revision:v.optional(v.number(1,2147483647,true))})(value,'shared-query');
 const q=value as SharedQuery;
 if(q.collection==='items'&&!q.parentId||q.collection!=='items'&&q.collection!=='occurrences'&&q.parentId!==undefined||q.collection!=='occurrences'&&q.date!==undefined
  ||q.collection==='occurrences'&&!q.parentId&&!q.date||q.cursor!==undefined&&q.revision===undefined)throw new v.StoredDataError('shared-query');
 if(q.cursor!==undefined){
  if(q.collection==='occurrences'){
   const [day,id,...extra]=q.cursor.split('/');civilDate(day,'cursor.date');sharedId(id,'cursor.id');if(extra.length)throw new v.StoredDataError('cursor');
  }else if(q.collection==='items'){if(!/^[1-9]\d{0,6}$/.test(q.cursor))throw new v.StoredDataError('cursor');}
  else sharedId(q.cursor,'cursor.id');
 }
 return q;
}
const revision=v.number(1,2147483647,true),base={id:sharedId,groupId:sharedId,revision};
export const sharedRowChecks:Record<SharedCollection,v.Check>={
 tasks:exact({...base,...taskFields,archived:v.bool}),lists:exact({...base,name:label(80),archived:v.bool}),
 items:exact({...base,listId:sharedId,text:label(160),quantity:v.string(80),checked:v.bool,position:v.number(1,1000000,true)}),
 occurrences:exact({taskId:sharedId,groupId:sharedId,date:civilDate,completed:v.bool,byMemberId:v.nullable(sharedId),at:v.nullable(v.instant),revision,
  snapshot:exact({title:label(160),notes,assignee:v.nullable(sharedId),time:v.nullable(v.clock),timezone:v.zone,taskRevision:revision})}),
};
export function parseSharedPage(value:unknown):SharedPage {
 v.validateJson(value);const row=v.object(value,'shared-page');if(typeof row.collection!=='string'||!Object.hasOwn(sharedRowChecks,row.collection))throw new v.StoredDataError('shared-page.collection');
 exact({accountId:sharedId,groupId:sharedId,revision,collection:v.oneOf(row.collection),rows:v.array(sharedRowChecks[row.collection as SharedCollection],50),next:v.nullable(v.string(80))})(value,'shared-page');
 const page=value as SharedPage;
 const ids=page.rows.map(r=>'id' in r?r.id:`${r.taskId}/${r.date}`);
 if(new Set(ids).size!==ids.length||page.rows.some(r=>r.groupId!==page.groupId||r.revision>page.revision||'completed' in r&&(r.completed!==(r.byMemberId!==null&&r.at!==null)||!r.completed&&(r.byMemberId!==null||r.at!==null))))throw new v.StoredDataError('shared-page.rows');
 if(page.next!==null){const last=page.rows.at(-1),cursor=last?('position' in last?String(last.position):'id' in last?last.id:`${last.date}/${last.taskId}`):null;
  if(page.rows.length!==50||page.next!==cursor)throw new v.StoredDataError('shared-page.next');}
 return page;
}
/** A civil recurrence belongs to the group's timezone, independent of the viewer's device. */
export function sharedTaskOccurs(task:SharedTask,date:string){return !task.archived&&(task.weekdays.length?date>=task.date&&task.weekdays.includes(new Date(`${date}T12:00:00Z`).getUTCDay()):date===task.date);}
