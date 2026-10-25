import {useEffect,useRef} from 'react';
import {Check,ChevronRight,Home,LockKeyhole} from 'lucide-react';
import {useApp} from '../context';
import {Button} from '../components';
import {today} from '../model';
import {priorityKey} from '../developmentModel';
import type {SharedPriority} from '../domain/priorityReferences';
import type {AccountGroup} from '../contracts/groups';
import {sharedTaskOccurs,type SharedCommand,type SharedTask,type SharedList,type SharedItem,type SharedOccurrence} from '../contracts/sharedContent';
import {useGroups} from './GroupProvider';
import {Pending} from './GroupStatus';
import {useCollection,useSharedFamily} from './sharedHooks';
import {sharedText} from './sharedText';

export const useCopy=()=>sharedText(useApp().state.life.language);
export const isTask=(r:SharedTask|SharedList|SharedItem|SharedOccurrence):r is SharedTask=>'weekdays'in r;
export const isOccurrence=(r:SharedTask|SharedList|SharedItem|SharedOccurrence):r is SharedOccurrence=>'snapshot'in r;
export function useWrite(){
 const {session,view}=useGroups(),{workspace,toast}=useApp(),t=useCopy(),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const locked=view.busy||!!view.pending||view.invalidPending;
 const write=async(command:SharedCommand,revision:number)=>{if(!session||locked)return null;const receipt=await session.execute(command,revision);if(!alive.current||workspace?.scope!==session.owner)return null;if(receipt)toast(t('saved'));return receipt;};
 return{write,locked};
}
export function ReadStatus({result}:{result:ReturnType<typeof useCollection>}){
 const t=useCopy();return <>{result.loading&&<p role="status" className="fine-print">{t('loading')}</p>}{result.error&&<div role="alert"><p className="field-error">{t('readFailed')}</p><Button variant="secondary" onClick={()=>void result.load()}>{t('retry')}</Button></div>}{result.loaded&&result.next&&!result.loading&&<Button variant="ghost" onClick={()=>void result.load(true)}>{t('more')}</Button>}</>;
}
export const collectionReady=(result:ReturnType<typeof useCollection>)=>result.loaded&&!result.loading&&!result.error&&!result.next;
export function memberName(group:AccountGroup,id:string|null,t:ReturnType<typeof sharedText>){if(!id)return t('anyone');const member=group.members.find(m=>m.id===id);return member?.self?t('you'):member?.name??t('former');}

export function SharedTaskRow({task,group,date,occurrence,priority=false}:{task:SharedTask;group:AccountGroup;date:string;occurrence?:SharedOccurrence;priority?:boolean}){
 const t=useCopy(),{open}=useApp(),{write,locked}=useWrite(),done=!!occurrence?.completed,snapshot=occurrence?.snapshot;
 const title=snapshot?.title??task.title,assignee=snapshot?snapshot.assignee:task.assignee,time=snapshot?snapshot.time:task.time;
 return <article className={`family-task ${priority?'priority-task':''} ${done?'completed':''}`}>
  <button className={`task-check ${done?'checked':''}`} role="checkbox" aria-checked={done} aria-label={t('complete',[title])} disabled={locked||group.archived||!done&&!sharedTaskOccurs(task,date)} onClick={()=>void write({kind:'task.complete',groupId:group.id,taskId:task.id,date,completed:!done},group.revision)}>{done?<Check size={19}/>:<span/>}</button>
  <button className="task-copy" onClick={()=>open({type:'task',groupId:group.id,id:task.id,date})}><strong>{title}</strong><small>{memberName(group,assignee,t)}{time?` · ${time}`:''}{done?` · ${t('done')}`:''}</small>{priority&&<small className="task-family-label"><Home size={12}/>{group.name}</small>}</button><ChevronRight size={16} className="muted"/>
 </article>;
}
export function SharedTaskPriority({priority}:{priority:SharedPriority}){
 const t=useCopy(),{view,session}=useGroups(),group=view.groups.find(g=>g.id===priority.groupId);
 const tasks=useCollection(group?{groupId:group.id,collection:'tasks'}:null),reports=useCollection(group?{groupId:group.id,collection:'occurrences',date:priority.date}:null);
 const task=tasks.rows.filter(isTask).find(t=>t.id===priority.taskId),report=reports.rows.filter(isOccurrence).find(r=>r.taskId===priority.taskId);
 const ready=collectionReady(tasks)&&collectionReady(reports);
 if(group&&task&&ready&&!group.archived&&(!task.archived||report?.completed))return <SharedTaskRow task={task} group={group} date={priority.date} occurrence={report} priority/>;
 if(!view.loaded&&!view.readError||group&&!ready&&!tasks.error&&!reports.error)return <article className="family-task"><LockKeyhole size={19}/><p role="status" className="task-copy">{t('loading')}</p></article>;
 const failed=!!(tasks.error||reports.error||view.readError);
 return <article className="family-task"><LockKeyhole size={19}/><div className="task-copy"><strong>{t('unavailable')}</strong><small>{t('unavailableHelp')}</small>{failed&&<><p role="alert" className="field-error">{t('readFailed')}</p><Button variant="ghost" onClick={()=>{if(view.readError)void session?.refresh();else{void tasks.load();void reports.load();}}}>{t('retry')}</Button></>}</div></article>;
}
export function ServerFamilyToday(){
 const t=useCopy(),{state,open}=useApp(),{session,view}=useGroups(),date=today(state),family=useSharedFamily(state.dailyPriorities[date]),pinned=new Set((state.dailyPriorities[date]??[]).map(priorityKey));
 if(!session||!view.groups.some(g=>g.kind==='family')&&!view.pending)return null;
 const choices=family.choices.filter(({group,task,priority})=>family.ready(priority)&&(!task.assignee||group.members.some(m=>m.self&&m.id===task.assignee))&&!pinned.has(priorityKey(priority))),pending=choices.filter(c=>!family.occurrence(c.priority)?.completed),done=choices.filter(c=>family.occurrence(c.priority)?.completed);
 const row=(c:typeof choices[number])=><SharedTaskRow key={priorityKey(c.priority)} task={c.task} group={c.group} date={c.priority.date} occurrence={family.occurrence(c.priority)}/>;
 return <><Pending/><details className="today-disclosure family-today server-groups"><summary><Home size={20}/><span><strong>{t('family')}</strong><small>{family.loading?t('loading'):pending.length?t('together',[pending.length]):t('emptyTasks')}</small></span><ChevronRight size={18}/></summary><div className="disclosure-content">{family.error&&<p role="alert">{t('readFailed')} <button className="text-button" onClick={family.retry}>{t('retry')}</button></p>}{pending.map(row)}{!family.loading&&!pending.length&&<p className="fine-print">{t('familyEmpty')}</p>}{done.length>0&&<details className="done-group"><summary>{t('doneTogether')} · {done.length}</summary>{done.map(row)}</details>}<button className="text-button" onClick={()=>open({type:'groups'})}>{t('tasksLists')}<ChevronRight size={15}/></button></div></details></>;
}
