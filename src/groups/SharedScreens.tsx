import {useCopy,useWrite,ReadStatus,collectionReady,memberName,isTask,isOccurrence,SharedTaskRow} from './SharedToday';
import {useState,type ReactNode} from 'react';
import {ArrowDown,ArrowUp,Check,CheckCheck,ChevronLeft,ChevronRight,ClipboardList,ListChecks,Pencil,Plus,Settings2,Trash2} from 'lucide-react';
import {useApp} from '../context';
import {Button,GroupRow,SectionTitle} from '../components';
import {LifeIntro,PrivacyNote,useText} from '../LifeUI';
import {addDays,localDate,today} from '../model';
import {priorityKey} from '../developmentModel';
import type {SharedPriority} from '../domain/priorityReferences';
import {parseGroupOperation,type AccountGroup} from '../contracts/groups';
import {sharedTaskOccurs,type SharedTask,type SharedList,type SharedItem,type SharedOccurrence} from '../contracts/sharedContent';
import {useGroups} from './GroupProvider';
import {GroupBoundary,Missing,Pending,useDraft} from './GroupScreens';
import {useCollection} from './sharedHooks';
import {sharedText} from './sharedText';
import {taskDraft,listDraft,itemDraft,taskCommand,type TaskDraft} from './sharedDrafts';
import {formatDisplayDate} from '../i18n';

const isList=(r:SharedTask|SharedList|SharedItem|SharedOccurrence):r is SharedList=>'name'in r;
const isItem=(r:SharedTask|SharedList|SharedItem|SharedOccurrence):r is SharedItem=>'position'in r;
function Review({old,current,disabled,onReview,children}:{old:number;current:number;disabled:boolean;onReview:()=>void;children:ReactNode}){
 const t=useCopy();if(old===current)return null;return <section className="shared-review"><p role="status">{t('changed')}</p><h2>{t('current')}</h2>{children}<Button type="button" variant="secondary" disabled={disabled} onClick={onReview}>{t('reviewed')}</Button></section>;
}
export function SharedFamilyPlan({group,initialSection='tasks'}:{group:AccountGroup;initialSection?:'tasks'|'lists'}){
 const t=useCopy(),x=useText(),{open}=useApp(),{locked}=useWrite(),[section,setSection]=useState(initialSection),[date,setDate]=useState(()=>localDate(group.timezone));
 const tasks=useCollection({groupId:group.id,collection:'tasks'}),reports=useCollection(section==='tasks'?{groupId:group.id,collection:'occurrences',date}:null),lists=useCollection(section==='lists'?{groupId:group.id,collection:'lists'}:null);
 const all=tasks.rows.filter(isTask),occurrences=reports.rows.filter(isOccurrence),visible=all.filter(task=>sharedTaskOccurs(task,date)||occurrences.some(r=>r.taskId===task.id&&r.completed));
 const ready=collectionReady(tasks)&&collectionReady(reports),blocked=locked||group.archived;
 const taskRow=(task:SharedTask)=><SharedTaskRow key={task.id} task={task} group={group} date={date} occurrence={occurrences.find(r=>r.taskId===task.id)}/>;
 return <><div className="segmented life-segments"><button aria-pressed={section==='tasks'} className={section==='tasks'?'selected':''} onClick={()=>setSection('tasks')}><CheckCheck size={17}/>{t('tasks')}</button><button aria-pressed={section==='lists'} className={section==='lists'?'selected':''} onClick={()=>setSection('lists')}><ClipboardList size={17}/>{t('lists')}</button></div>
  {section==='tasks'?<><div className="shared-week family-date"><button className="icon-button" aria-label={t('previous')} disabled={date==='0001-01-01'} onClick={()=>setDate(addDays(date,-1))}><ChevronLeft size={19}/></button><div><strong>{date===localDate(group.timezone)?t('today'):x.date(date)}</strong><span>{date===localDate(group.timezone)?x.date(date):t('plan')}</span></div><button className="icon-button" aria-label={t('next')} disabled={date==='9999-12-31'} onClick={()=>setDate(addDays(date,1))}><ChevronRight size={19}/></button></div>
   <SectionTitle title={t('sharedPlan')}><button className="text-button" disabled={blocked} onClick={event=>{event.currentTarget.focus({preventScroll:true});open({type:'taskEdit',groupId:group.id,date});}}><Plus size={16}/>{t('addTask')}</button></SectionTitle>
   <ReadStatus result={tasks}/><ReadStatus result={reports}/>{ready&&visible.filter(task=>!occurrences.some(r=>r.taskId===task.id&&r.completed)).map(taskRow)}
   {ready&&!visible.length&&<div className="people-empty"><ListChecks size={30}/><h2>{t('emptyTasks')}</h2><p>{t('emptyTasksHelp')}</p><Button variant="secondary" disabled={blocked} onClick={event=>{event.currentTarget.focus({preventScroll:true});open({type:'taskEdit',groupId:group.id,date});}}>{t('newTask')}</Button></div>}
   {ready&&visible.some(task=>occurrences.some(r=>r.taskId===task.id&&r.completed))&&<details className="done-group" open><summary>{t('doneTogether')}</summary>{visible.filter(task=>occurrences.some(r=>r.taskId===task.id&&r.completed)).map(taskRow)}</details>}
   <details className="done-group"><summary>{t('allTasks')}</summary>{all.filter(task=>!task.archived).map(task=><GroupRow key={task.id} title={task.title} detail={`${x.date(task.date)}${task.weekdays.length?` · ${t('weekly')}`:''}`} onClick={()=>open({type:'task',groupId:group.id,id:task.id,date:task.weekdays.length?date:task.date})}/>)}</details>
   {all.some(task=>task.archived)&&<details className="done-group"><summary>{t('archivedTasks')}</summary>{all.filter(task=>task.archived).map(task=><GroupRow key={task.id} title={task.title} onClick={()=>open({type:'task',groupId:group.id,id:task.id,date:task.date})}/>)}</details>}
  </>:<><SectionTitle title={t('listsTitle')}/><ReadStatus result={lists}/><div className="group">{lists.rows.filter(isList).filter(l=>!l.archived).map(list=><GroupRow key={list.id} icon={<ClipboardList size={22}/>} title={list.name} onClick={()=>open({type:'sharedList',groupId:group.id,id:list.id})}/>)}</div><p className="section-description">{t('listHelp')}</p><Button className="wide" variant="secondary" disabled={blocked} onClick={()=>open({type:'listCreate',groupId:group.id})}><Plus size={18}/>{t('createList')}</Button>{lists.rows.filter(isList).some(l=>l.archived)&&<details className="done-group"><summary>{t('archivedLists')}</summary>{lists.rows.filter(isList).filter(l=>l.archived).map(list=><GroupRow key={list.id} title={list.name} onClick={()=>open({type:'sharedList',groupId:group.id,id:list.id})}/>)}</details>}</>}
  <PrivacyNote>{t('noXP')}</PrivacyNote>
 </>;
}

export function ServerTaskForm({id,groupId,date}:{id?:string;groupId?:string;date?:string}){return groupId?<GroupBoundary id={groupId}>{group=><TaskForm key={`${group.id}:${id??'new'}`} group={group} id={id} date={date}/>}</GroupBoundary>:<Missing/>;}
function TaskForm({group,id,date}:{group:AccountGroup;id?:string;date?:string}){
 const t=useCopy(),{session}=useGroups(),{back,open}=useApp(),{write,locked}=useWrite(),[newId]=useState(()=>crypto.randomUUID()),[error,setError]=useState(false);
 const result=useCollection(id?{groupId:group.id,collection:'tasks'}:null),existing=result.rows.filter(isTask).find(t=>t.id===id);
 const [draft,setDraft,clear]=useDraft(`server-task:${group.id}:${id??'new'}`,():TaskDraft=>({taskId:id??newId,revision:group.revision,title:existing?.title??'',notes:existing?.notes??'',assignee:existing?.assignee??(id?'':group.members.find(m=>m.self)?.id??''),date:existing?.date??date??localDate(group.timezone),time:existing?.time??'',weekdays:existing?.weekdays??[]}),taskDraft);
 // Keep the write's owner mounted across its own revision refresh. The form
 // body still disappears immediately when current content is unavailable.
 if(id&&!existing)return <div className="life-screen server-groups"><Pending/><ReadStatus result={result}/>{collectionReady(result)&&<Missing/>}</div>;
 const unavailable=group.archived||!!existing?.archived,stale=draft.revision!==group.revision;
 const save=async()=>{if(!session||locked||unavailable||stale)return;const command=taskCommand(group.id,draft,!!existing);try{parseGroupOperation({accountId:session.owner,operationId:crypto.randomUUID(),issuedAt:Date.now(),expectedRevision:draft.revision,command});if(draft.assignee&&!group.members.some(m=>m.id===draft.assignee))throw new Error('member');}catch{setError(true);return;}setError(false);const receipt=await write(command,draft.revision);if(receipt&&await clear(draft)){back();if(!existing)open({type:'task',groupId:group.id,id:draft.taskId,date:draft.date});}};
 return <div className="life-screen server-groups"><LifeIntro title={t(existing?'editIntro':'newIntro')} text={group.name}/><Pending/>{unavailable&&<p role="status">{t('archived')}</p>}
  <Review old={draft.revision} current={group.revision} disabled={locked||unavailable} onReview={()=>setDraft({...draft,revision:group.revision})}>{existing?<><strong>{existing.title}</strong><TaskFacts task={existing} group={group} date={existing.date}/></>:<p>{group.name}</p>}</Review>
  <form onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={locked||unavailable} className="shared-fields">
   <label className="field">{t('taskName')}<input required maxLength={160} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
   <label className="field">{t('notes')}<textarea rows={3} maxLength={800} value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label>
   <label className="field">{t('assigned')}<select value={draft.assignee} onChange={e=>setDraft({...draft,assignee:e.target.value})}><option value="">{t('anyMember')}</option>{draft.assignee&&!group.members.some(m=>m.id===draft.assignee)&&<option value={draft.assignee} disabled>{t('former')}</option>}{group.members.map(m=><option key={m.id} value={m.id}>{m.self?t('you'):m.name}</option>)}</select></label>
   <div className="life-two-fields"><label className="field">{t('date')}<input type="date" min="0001-01-01" max="9999-12-31" required value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})}/></label><label className="field">{t('time')}<input type="time" value={draft.time} onChange={e=>setDraft({...draft,time:e.target.value})}/></label></div>
   <SectionTitle title={t('repeat')}/><div className="life-weekdays">{(['mon','tue','wed','thu','fri','sat','sun'] as const).map((key,i)=>{const day=(i+1)%7,chosen=draft.weekdays.includes(day);return <button type="button" key={key} aria-pressed={chosen} aria-label={t('repeatDay',[t(key)])} onClick={()=>setDraft({...draft,weekdays:chosen?draft.weekdays.filter(d=>d!==day):[...draft.weekdays,day]})}>{t(key)}</button>;})}</div><p className="fine-print">{t(draft.weekdays.length?'recurrenceHelp':'onceHelp')}</p>
   {error&&<p role="alert" className="field-error">{t('invalid')}</p>}<Button type="submit" className="wide" disabled={stale||!draft.title.trim()||!draft.date}>{t('saveTask')}</Button>
  </fieldset></form>
 </div>;
}
function TaskFacts({task,group,date,report}:{task:SharedTask;group:AccountGroup;date:string;report?:SharedOccurrence}){
 const t=useCopy(),x=useText(),fields=report?.snapshot??task;
 return <>{fields.notes&&<p className="task-detail-notes">{fields.notes}</p>}<dl className="life-facts"><div><dt>{t('assigned')}</dt><dd>{memberName(group,fields.assignee,t)}</dd></div><div><dt>{t('when')}</dt><dd>{x.date(date)}{fields.time?` · ${fields.time}`:''} · {report?.snapshot.timezone??group.timezone}</dd></div>{!report&&<div><dt>{t('repeats')}</dt><dd>{t(task.weekdays.length?'weekly':'once')}</dd></div>}</dl></>;
}
export function ServerTaskDetail({id,groupId,date}:{id:string;groupId?:string;date?:string}){return groupId?<GroupBoundary id={groupId}>{group=><TaskDetail group={group} id={id} date={date??localDate(group.timezone)}/>}</GroupBoundary>:<Missing/>;}
function TaskDetail({group,id,date}:{group:AccountGroup;id:string;date:string}){
 const t=useCopy(),x=useText(),{state,dispatch,storage,workspace,open,toast}=useApp(),{write,locked}=useWrite(),[pinBusy,setPinBusy]=useState(false),[pinError,setPinError]=useState(false);
 const tasks=useCollection({groupId:group.id,collection:'tasks'}),reports=useCollection({groupId:group.id,collection:'occurrences',parentId:id,date}),history=useCollection({groupId:group.id,collection:'occurrences',parentId:id},false);
 const task=tasks.rows.filter(isTask).find(t=>t.id===id),report=reports.rows.filter(isOccurrence)[0],done=!!report?.completed;
 const personalDate=today(state),priority:SharedPriority={kind:'task',groupId:group.id,taskId:id,date},pinned=(state.dailyPriorities[personalDate]??[]).some(p=>priorityKey(p)===priorityKey(priority));
 const pin=async()=>{if(pinBusy)return;if(!pinned&&(state.dailyPriorities[personalDate]??[]).length>=3){toast(t('replace'));open({type:'priorities',date:personalDate,groupId:group.id,id,occurrenceDate:date});return;}const owner=workspace?.scope;setPinBusy(true);setPinError(false);const next=dispatch({kind:'priority.pin',date:personalDate,priority,selected:!pinned});const saved=!!next&&await storage.whenSaved();if(workspace?.scope===owner){setPinError(!saved);if(saved)toast(t('prioritiesSaved'));setPinBusy(false);}};
 if(!task)return <div className="life-screen server-groups"><Pending/><ReadStatus result={tasks}/>{collectionReady(tasks)&&<Missing/>}</div>;
 const ready=collectionReady(tasks)&&collectionReady(reports),scheduled=sharedTaskOccurs(task,date);
 return <div className="life-screen server-groups"><Pending/><LifeIntro title={report?.snapshot.title??task.title} text={group.name}/><ReadStatus result={tasks}/><ReadStatus result={reports}/><TaskFacts task={task} group={group} date={date} report={report}/>
  {done&&<p className="life-success"><Check size={18}/>{t('completedBy',[memberName(group,report!.byMemberId,t)])} · {formatDisplayDate(new Date(report!.at!),state.life.language,{timeZone:group.timezone,year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',second:'numeric'})}</p>}
  {!done&&!scheduled&&<p className="fine-print">{t('notScheduled')}</p>}{(task.archived||group.archived)&&<p role="status" className="fine-print">{t('archived')}</p>}
  <Button className="wide" variant={done?'secondary':'primary'} disabled={locked||!ready||group.archived||!done&&!scheduled} onClick={()=>void write({kind:'task.complete',groupId:group.id,taskId:id,date,completed:!done},group.revision)}>{t(done?'undo':'markDone')}</Button>
  <Button variant="secondary" className="wide" disabled={pinBusy||!pinned&&(!ready||group.archived||!scheduled)} onClick={()=>void pin()}>{t(pinned?'unpin':'pin')}</Button>{pinError&&<p role="alert" className="field-error">{t('pinFailed')}</p>}
  <Button variant="ghost" className="wide" disabled={locked||group.archived||task.archived} onClick={()=>open({type:'taskEdit',groupId:group.id,id})}><Pencil size={17}/>{t('editTask')}</Button>
  <GroupRow icon={<ClipboardList size={20}/>} title={t('familyLists')} detail={group.name} onClick={()=>open({type:'group',id:group.id,section:'lists'})}/>
  <button className="text-button danger-text" disabled={locked||group.archived||!ready} onClick={()=>void write({kind:task.archived?'task.restore':'task.archive',groupId:group.id,taskId:id},group.revision)}>{t(task.archived?'restoreTask':'archiveTask')}</button>
  <details className="done-group"><summary>{t('history')}</summary><ReadStatus result={history}/>{history.rows.filter(isOccurrence).map(r=><GroupRow key={r.date} title={`${x.date(r.date)} · ${t(r.completed?'done':'corrected')}`} detail={r.snapshot.title} onClick={()=>open({type:'task',groupId:group.id,id,date:r.date})}/>)}</details><PrivacyNote>{t('noXP')}</PrivacyNote>
 </div>;
}

export function ServerListCreate({groupId}:{groupId:string}){return <GroupBoundary id={groupId}>{group=><ListCreateForm group={group}/>}</GroupBoundary>;}
function ListCreateForm({group}:{group:AccountGroup}){
 const t=useCopy(),{back,open}=useApp(),{write,locked}=useWrite(),[id]=useState(()=>crypto.randomUUID());
 const [draft,setDraft,clear]=useDraft(`server-list:${group.id}:new`,()=>({listId:id,revision:group.revision,name:''}),listDraft);
 return <div className="life-screen server-groups"><Pending/><LifeIntro title={t('listIntro')} text={t('listIntroHelp')}/><Review old={draft.revision} current={group.revision} disabled={locked||group.archived} onReview={()=>setDraft({...draft,revision:group.revision})}><p>{group.name}</p></Review>
  <form onSubmit={e=>{e.preventDefault();if(locked||group.archived||draft.revision!==group.revision||!draft.name.trim())return;void write({kind:'list.create',groupId:group.id,listId:draft.listId,name:draft.name.trim()},draft.revision).then(async receipt=>{if(receipt&&await clear(draft)){back();open({type:'sharedList',groupId:group.id,id:draft.listId});}});}}><label className="field">{t('listName')}<input required maxLength={80} value={draft.name} disabled={locked||group.archived} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><Button type="submit" className="wide" disabled={locked||group.archived||draft.revision!==group.revision||!draft.name.trim()}>{t('create')}</Button></form>
 </div>;
}
export function ServerListDetail({id,groupId}:{id:string;groupId?:string}){return groupId?<GroupBoundary id={groupId}>{group=><ListDetail key={id} id={id} group={group}/>}</GroupBoundary>:<Missing/>;}
function ListDetail({id,group}:{id:string;group:AccountGroup}){
 const t=useCopy(),{write,locked}=useWrite(),[renaming,setRenaming]=useState(false),[newItem,setNewItem]=useState(()=>crypto.randomUUID());
 const result=useCollection({groupId:group.id,collection:'lists'}),list=result.rows.filter(isList).find(l=>l.id===id);
 const items=useCollection({groupId:group.id,collection:'items',parentId:id}),rows=items.rows.filter(isItem);
 const [draft,setDraft,clear]=useDraft(`server-item:${group.id}:${id}`,()=>({itemId:newItem,revision:group.revision,editing:false,text:'',quantity:''}),itemDraft);
 const [name,setName,clearName]=useDraft(`server-list:${group.id}:${id}`,()=>({listId:id,revision:group.revision,name:list?.name??''}),listDraft);
 if(!list)return <div className="life-screen server-groups"><Pending/><ReadStatus result={result}/>{collectionReady(result)&&<Missing/>}</div>;
 const blocked=locked||group.archived||list.archived||!collectionReady(items),editing=rows.find(r=>r.id===draft.itemId),stale=draft.revision!==group.revision;
 const reset=async()=>{if(await clear(draft))setNewItem(crypto.randomUUID());};
 const add=async()=>{if(blocked||stale||!draft.text.trim()||draft.editing&&!editing)return;const receipt=await write({kind:draft.editing?'item.edit':'item.add',groupId:group.id,listId:list.id,itemId:draft.itemId,text:draft.text.trim(),quantity:draft.quantity.trim()},draft.revision);if(receipt)await reset();};
 const row=(item:SharedItem)=>{const index=rows.findIndex(i=>i.id===item.id);return <div className={`shopping-item ${item.checked?'checked':''}`} key={item.id}>
  <button className={`task-check ${item.checked?'checked':''}`} role="checkbox" aria-checked={item.checked} aria-label={t('check',[item.text])} disabled={blocked} onClick={()=>void write({kind:'item.check',groupId:group.id,listId:list.id,itemId:item.id,checked:!item.checked},group.revision)}>{item.checked?<Check size={18}/>:<span/>}</button><span><strong>{item.text}</strong>{item.quantity&&<small>{item.quantity}</small>}</span>
  <button className="icon-button" disabled={blocked} aria-label={t('edit',[item.text])} onClick={()=>setDraft({itemId:item.id,revision:group.revision,editing:true,text:item.text,quantity:item.quantity})}><Pencil size={16}/></button>
  <details className="item-menu"><summary aria-label={t('actions',[item.text])}><Settings2 size={16}/></summary><div>
   <button aria-label={t('up',[item.text])} disabled={blocked||index===0} onClick={()=>void write({kind:'item.move',groupId:group.id,listId:list.id,itemId:item.id,beforeId:rows[index-1].id},group.revision)}><ArrowUp size={15}/>{t('upShort')}</button>
   <button aria-label={t('down',[item.text])} disabled={blocked||index===rows.length-1} onClick={()=>void write({kind:'item.move',groupId:group.id,listId:list.id,itemId:item.id,beforeId:rows[index+2]?.id??null},group.revision)}><ArrowDown size={15}/>{t('downShort')}</button>
   <button disabled={blocked} onClick={()=>void write({kind:'item.remove',groupId:group.id,listId:list.id,itemId:item.id},group.revision)}><Trash2 size={15}/>{t('remove')}</button>
  </div></details></div>;};
 return <div className="life-screen server-groups"><Pending/><div className="group-page-heading"><div><h1>{list.name}</h1><p>{rows.filter(i=>i.checked).length}/{rows.length} {t('checked')}</p></div><button className="icon-button" disabled={blocked} aria-label={t('rename')} onClick={()=>setRenaming(!renaming)}><Pencil size={19}/></button></div><ReadStatus result={items}/>{(list.archived||group.archived)&&<p role="status">{t('archived')}</p>}
  {renaming&&<><Review old={name.revision} current={group.revision} disabled={blocked} onReview={()=>setName({...name,revision:group.revision})}><p>{list.name}</p></Review><form className="list-rename" onSubmit={e=>{e.preventDefault();if(blocked||name.revision!==group.revision||!name.name.trim())return;void write({kind:'list.rename',groupId:group.id,listId:list.id,name:name.name.trim()},name.revision).then(async receipt=>{if(receipt&&await clearName(name))setRenaming(false);});}}><label className="field">{t('listName')}<input required maxLength={80} disabled={blocked} value={name.name} onChange={e=>setName({...name,name:e.target.value})}/></label><Button type="submit" variant="secondary" disabled={blocked||name.revision!==group.revision||!name.name.trim()}>{t('saveName')}</Button></form></>}
  {!list.archived&&<><Review old={draft.revision} current={group.revision} disabled={blocked||draft.editing&&!editing} onReview={()=>setDraft({...draft,revision:group.revision})}><p>{draft.editing?(editing?`${editing.text} · ${editing.quantity}`:t('unavailable')):list.name}</p></Review><form className="list-add-form" onSubmit={e=>{e.preventDefault();void add();}}><label className="field">{t(draft.editing?'editItem':'addItem')}<input maxLength={160} required disabled={blocked} value={draft.text} onChange={e=>setDraft({...draft,text:e.target.value})}/></label><div className="list-add-bottom"><label className="field">{t('quantity')}<input maxLength={80} disabled={blocked} value={draft.quantity} onChange={e=>setDraft({...draft,quantity:e.target.value})}/></label><Button type="submit" disabled={blocked||stale||!draft.text.trim()||draft.editing&&!editing}><Plus size={18}/>{t(draft.editing?'save':'add')}</Button></div>{draft.editing&&<button type="button" className="text-button" disabled={locked} onClick={()=>void reset()}>{t('cancelEdit')}</button>}</form></>}
  <div className="shopping-list">{rows.filter(i=>!i.checked).map(row)}</div>{items.loaded&&!rows.length&&<div className="people-empty"><ClipboardList size={30}/><p>{t('emptyList')}</p></div>}{rows.some(i=>i.checked)&&<details className="done-group" open><summary>{t('gotIt')} · {rows.filter(i=>i.checked).length}</summary>{rows.filter(i=>i.checked).map(row)}</details>}
  <button className="text-button" disabled={locked||group.archived||!items.loaded} onClick={()=>void write({kind:list.archived?'list.restore':'list.archive',groupId:group.id,listId:list.id},group.revision)}>{t(list.archived?'restoreList':'archiveList')}</button>
 </div>;
}

