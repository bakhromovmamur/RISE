import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {useGroups} from './GroupProvider';
import {emptyContent,type ContentQuery, type SharedContent} from './content';
import {sharedTaskOccurs,type SharedTask,type SharedOccurrence} from '../contracts/sharedContent';
import {isSharedPriority,type SharedPriority} from '../domain/priorityReferences';
import {localDate} from '../model';
import type {Priority} from '../developmentModel';

const noSubscribe=()=>()=>{},zero=()=>0;
async function ensure(content:SharedContent,query:ContentQuery,all:boolean,active:()=>boolean){
 let view=content.get(query);if(view.loading||view.error)return;
 if(!view.loaded&&!await content.load(query))return;
 view=content.get(query);
 while(all&&active()&&view.next&&!view.loading&&!view.error){if(!await content.load(query,true))return;view=content.get(query);}
}
export function useCollection(query:ContentQuery|null,all=true){
 const {content,view:groups}=useGroups(),encoded=JSON.stringify(query);
 const stable=useMemo(()=>query,[encoded]); // Query fields, rather than render identity, own the subscription.
 const version=useSyncExternalStore(content?.subscribe??noSubscribe,content?.getVersion??zero);
 const group=groups.groups.find(g=>g.id===stable?.groupId),result=stable&&content?content.get(stable):emptyContent;
 useEffect(()=>{let active=true;if(content&&stable&&group&&groups.loaded)void ensure(content,stable,all,()=>active);return()=>{active=false;};},[content,stable,group?.revision,groups.loaded,all,version]);
 const load=async(more=false)=>{if(!stable||!content)return false;const ok=await content.load(stable,more);if(ok&&all)await ensure(content,stable,true,()=>true);return ok;};
 return{...result,load};
}
/** Today and the picker share one in-memory view. Each family supplies its own
 * civil day; selected references keep their original occurrence dates. */
export function useSharedFamily(priorities:Priority[]=[]){
 const {content,view}=useGroups(),version=useSyncExternalStore(content?.subscribe??noSubscribe,content?.getVersion??zero);
 const references=priorities.filter(isSharedPriority),queries:ContentQuery[]=[];
 for(const group of view.groups.filter(g=>g.kind==='family')){
  const dates=new Set(references.filter(p=>p.groupId===group.id).map(p=>p.date));if(!group.archived)dates.add(localDate(group.timezone));
  if(dates.size){queries.push({groupId:group.id,collection:'tasks'});for(const date of dates)queries.push({groupId:group.id,collection:'occurrences',date});}
 }
 const encoded=JSON.stringify(queries),revisions=view.groups.map(g=>`${g.id}:${g.revision}`).join('/');
 useEffect(()=>{let active=true;if(content&&view.loaded)for(const q of queries)void ensure(content,q,true,()=>active);return()=>{active=false;};},[content,encoded,revisions,view.loaded,version]);
 const task=(p:SharedPriority)=>content?.get({groupId:p.groupId,collection:'tasks'}).rows.find((r):r is SharedTask=>'weekdays'in r&&r.id===p.taskId);
 const occurrence=(p:SharedPriority)=>content?.get({groupId:p.groupId,collection:'occurrences',date:p.date}).rows.find((r):r is SharedOccurrence=>'taskId'in r&&r.taskId===p.taskId&&r.date===p.date);
 const ready=(p:SharedPriority)=>!!content&&[{groupId:p.groupId,collection:'tasks' as const},{groupId:p.groupId,collection:'occurrences' as const,date:p.date}].every(q=>{const s=content.get(q);return s.loaded&&!s.loading&&!s.error&&!s.next;});
 const choices=view.groups.filter(g=>g.kind==='family'&&!g.archived).flatMap(group=>{
  const date=localDate(group.timezone),rows=content?.get({groupId:group.id,collection:'tasks'}).rows??[];
  return rows.filter((r):r is SharedTask=>'weekdays'in r&&sharedTaskOccurs(r,date)).map(task=>({group,task,priority:{kind:'task' as const,groupId:group.id,taskId:task.id,date}}));
 });
 const states=queries.map(q=>content?.get(q)??emptyContent);
 return{choices,task,occurrence,ready,loading:!view.loaded||states.some(s=>s.loading||!!s.next||!s.loaded&&!s.error),error:states.some(s=>s.error)||!!view.readError,
  retry:()=>{if(content)for(const q of queries)void content.load(q).then(ok=>{if(ok)void ensure(content,q,true,()=>true);});},allows:(p:SharedPriority)=>content?.allowsPriority(p)??false};
}
