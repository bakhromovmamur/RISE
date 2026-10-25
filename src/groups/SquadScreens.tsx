import {useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {ArrowRight,Check,CheckCheck,ChevronLeft,ChevronRight,Heart,LockKeyhole,Pencil,Share2,Sprout,Trash2} from 'lucide-react';
import {useApp} from '../context';
import {Button,GroupRow,SectionTitle,Toggle} from '../components';
import {LifeIntro,PrivacyNote,useText} from '../LifeUI';
import {addDays,today,weekStart} from '../model';
import {canonical} from '../contracts/personalRecords';
import type {AccountGroup} from '../contracts/groups';
import type {SquadCommand,SquadPost,SquadPreview,SquadSnapshot} from '../contracts/squads';
import {AccountError} from '../auth/client';
import {useGroups} from './GroupProvider';
import {Confirm,GroupBoundary,Pending,useDraft} from './GroupScreens';
import {emptySquad,type SquadSelection} from './squads';
import {squadDraft,type SquadDraft} from './squadDrafts';
import {squadText,squadError} from './squadText';
import {groupText,groupError} from './text';

const noSubscribe=()=>()=>{},zero=()=>0;
const useCopy=()=>squadText(useApp().state.life.language);
function useFeed(query:SquadSelection){
 const {squads,view}=useGroups(),encoded=JSON.stringify(query),stable=useMemo(()=>query,[encoded]);
 const version=useSyncExternalStore(squads?.subscribe??noSubscribe,squads?.getVersion??zero),group=view.groups.find(g=>g.id===query.groupId),result=squads?.get(stable)??emptySquad;
 useEffect(()=>{if(squads&&view.loaded&&group&&!result.loaded&&!result.loading&&!result.error)void squads.load(stable);},[squads,stable,group?.revision,view.loaded,version,result.loaded,result.loading,result.error]);
 return {...result,load:(more=false)=>squads?.load(stable,more)};
}
const ready=(result:ReturnType<typeof useFeed>)=>result.loaded&&!result.loading&&!result.error&&!result.next;
function ReadStatus({result}:{result:ReturnType<typeof useFeed>}){
 const t=useCopy();return <>{(!result.loaded&&!result.error||result.loading)&&<p role="status" className="fine-print">{t('loading')}</p>}{result.error&&<div role="alert"><p className="field-error">{t('readFailed')}</p><Button variant="secondary" onClick={()=>void result.load()}>{t('retry')}</Button></div>}{result.loaded&&result.next&&!result.loading&&<Button variant="ghost" onClick={()=>void result.load(true)}>{t('more')}</Button>}</>;
}
function useWrite(){
 const {session,view}=useGroups(),{workspace}=useApp(),alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const locked=view.busy||!!view.pending||view.invalidPending;
 return {locked,write:async(command:SquadCommand,revision:number)=>{if(!session||locked)return null;const receipt=await session.execute(command,revision);return alive.current&&workspace?.scope===session.owner?receipt:null;}};
}
function SnapshotCard({snapshot,group,post}:{snapshot:SquadSnapshot;group:AccountGroup;post?:SquadPost}){
 const t=useCopy(),tr=useText(),{open,toast}=useApp(),{write,locked}=useWrite(),[removing,setRemoving]=useState(false);
 const member=post?group.members.find(m=>m.id===post.authorMemberId):group.members.find(m=>m.self),name=member?.name??t('former'),owner=group.members.some(m=>m.self&&m.role==='owner');
 return <article className="squad-update">
  <header><span className="member-avatar" aria-hidden="true">{name.trim().slice(0,1).toUpperCase()}</span><span><strong>{name}</strong><small>{tr.week(snapshot.week)} · {t('weekly')}</small></span>{post&&member?.self&&<button className="icon-button" aria-label={t('editIcon')} onClick={event=>{event.currentTarget.focus();open({type:'squadCompose',groupId:group.id,date:snapshot.week});}}><Pencil size={17}/></button>}</header>
  <div className="shared-summary">{snapshot.habits!==undefined&&<span><Sprout size={16}/>{t('habitCount',[snapshot.habits])}</span>}{snapshot.milestones?.map((title,i)=><span key={i}><CheckCheck size={16}/>{title}</span>)}{snapshot.prayers!==undefined&&<span><Check size={16}/>{t('prayerCount',[snapshot.prayers])}</span>}</div>
  {snapshot.note&&<p>{snapshot.note}</p>}
  {post&&<footer><button aria-pressed={post.reactions.mine} disabled={locked||group.archived&&!post.reactions.mine} onClick={()=>void write({kind:'squad.react',groupId:group.id,postId:post.id,encourage:!post.reactions.mine},group.revision)}><Heart size={16}/>{t('cheer')}{post.reactions.count>0&&<span>{post.reactions.count}</span>}</button>{owner&&<button className="text-button danger-text" aria-label={`${t('remove')} · ${name}`} disabled={locked} onClick={()=>setRemoving(true)}><Trash2 size={16}/>{t('remove')}</button>}</footer>}
  {post&&removing&&<Confirm title={t('remove')} help={t('removeHelp')} busy={locked} onCancel={()=>setRemoving(false)} onConfirm={()=>void write({kind:'squad.remove',groupId:group.id,postId:post.id},group.revision).then(receipt=>{if(receipt)toast(t('removed'));})}/>}
 </article>;
}
export function ServerSquadFeed({group}:{group:AccountGroup}){
 const t=useCopy(),tr=useText(),{state,open}=useApp(),{locked}=useWrite(),current=weekStart(today(state)),[week,setWeek]=useState(current);
 const posts=useFeed({groupId:group.id,week}),self=group.members.find(m=>m.self)!,own=useFeed({groupId:group.id,week,authorMemberId:self.id}),existing=own.rows[0];
 return <div className="server-squad"><div className="shared-week family-date"><button className="icon-button" aria-label={t('previous')} onClick={()=>setWeek(addDays(week,-7))}><ChevronLeft size={19}/></button><div><strong>{tr.week(week)}</strong><span>{t('calendar')}</span></div><button className="icon-button" aria-label={t('next')} disabled={week>=current} onClick={()=>setWeek(addDays(week,7))}><ChevronRight size={19}/></button></div>
  <div className="squad-invitation"><Sprout size={23}/><h2>{t('prompt')}</h2><p>{t('intro')}</p><Button variant="secondary" disabled={locked||!ready(own)||group.archived&&!existing} onClick={event=>{event.currentTarget.focus();open({type:'squadCompose',groupId:group.id,date:week});}}>{t(existing?'edit':'share')}<ArrowRight size={17}/></Button></div>
  {own.error&&<ReadStatus result={own}/>}<PrivacyNote>{t('privacy')}</PrivacyNote>
  {posts.rows.map(post=><SnapshotCard key={post.id} group={group} snapshot={post.snapshot} post={post}/>)}<ReadStatus result={posts}/>
  {posts.loaded&&!posts.loading&&!posts.error&&!posts.rows.length&&<p className="section-description">{t('empty')}</p>}
 </div>;
}
export function ServerSquadCompose({groupId,week}:{groupId:string;week?:string}){
 const {state}=useApp(),selected=week??weekStart(today(state));return <GroupBoundary id={groupId}>{group=><LoadedCompose key={`${groupId}:${selected}`} group={group} week={selected}/>}</GroupBoundary>;
}
function LoadedCompose({group,week}:{group:AccountGroup;week:string}){
 const self=group.members.find(m=>m.self)!,result=useFeed({groupId:group.id,week,authorMemberId:self.id}),initial=useRef<SquadDraft|null>(null),post=result.rows[0];
 if(!initial.current&&ready(result))initial.current={postId:post?.id??crypto.randomUUID(),postRevision:post?.revision??0,groupRevision:group.revision,note:post?.snapshot.note??'',choices:{habits:post?.snapshot.habits!==undefined,milestones:post?.snapshot.milestones!==undefined,prayers:post?.snapshot.prayers!==undefined}};
 return <>{!ready(result)&&<ReadStatus result={result}/>}<div hidden={!ready(result)}>{initial.current&&<Compose group={group} week={week} post={post} initial={initial.current} loaded={ready(result)}/>}</div></>;
}
function Compose({group,week,post,initial,loaded}:{group:AccountGroup;week:string;post?:SquadPost;initial:SquadDraft;loaded:boolean}){
 const t=useCopy(),tr=useText(),{state,workspace,storage,toast,back}=useApp(),{client,session,view}=useGroups(),{write,locked}=useWrite(),g=groupText(state.life.language);
 const key=`server-squad:${group.id}:${week}`,[draft,setDraft,clear]=useDraft(key,()=>initial,squadDraft),[snapshot,setSnapshot]=useState<SquadPreview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[withdrawing,setWithdrawing]=useState(false);
 const alive=useRef(true),epoch=useRef(0),controller=useRef<AbortController|null>(null),previewHeading=useRef<HTMLHeadingElement>(null),previewButton=useRef<HTMLDivElement>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;epoch.current++;controller.current?.abort();};},[]);
 useEffect(()=>{if(!snapshot)return;if(draft.preview?.id!==snapshot.previewId||draft.preview.hash!==snapshot.hash){setSnapshot(null);return;}previewHeading.current?.focus({preventScroll:true});},[snapshot,draft.preview?.id,draft.preview?.hash]);
 const current=()=>alive.current&&!!session&&workspace?.scope===session.owner&&workspace.getAccountIdentity()?.account?.id===session.owner;
 const change=(next:SquadDraft)=>{epoch.current++;controller.current?.abort();const clean={...next};delete clean.preview;setDraft(clean);setSnapshot(null);setError(null);};
 const changed=draft.groupRevision!==group.revision||post?.id!==draft.postId&&!!post||draft.postRevision!==(post?.revision??0);
 const disabled=locked||busy||!loaded,hasContent=!!draft.note.trim()||Object.values(draft.choices).some(Boolean);
 const preview=async()=>{
  if(!client||!workspace||disabled||changed||group.archived)return;
  const sent=structuredClone(draft),version=++epoch.current,abort=new AbortController();controller.current?.abort();controller.current=abort;setBusy(true);setError(null);
  const matches=()=>{if(!current()||epoch.current!==version)return false;try{return canonical(squadDraft(storage.getSnapshot().state.life.drafts[key]))===canonical(sent);}catch{return false;}};
  try{
   setDraft(sent);if(!await storage.whenSaved())throw new AccountError('squad_source_changed');
   await workspace.syncNow();if(!matches())return;
   const source=workspace.sharedPreviewSource();if(!source||source.owner!==session?.owner)throw new AccountError('squad_source_changed');
   const result=await client.squadPreview({groupId:group.id,postId:sent.postId,groupRevision:sent.groupRevision,postRevision:sent.postRevision,personalRevision:source.revision,week,note:sent.note,choices:sent.choices},abort.signal);
   if(!matches())return;if(session.getSnapshot().groups.find(g=>g.id===group.id)?.revision!==result.groupRevision)throw new AccountError('group_changed');
   const reviewed={...sent,preview:{id:result.previewId,hash:result.hash}};setDraft(reviewed);
   if(!await storage.whenSaved())throw new AccountError('squad_source_changed');
   if(current()&&epoch.current===version&&canonical(storage.getSnapshot().state.life.drafts[key])===canonical(reviewed))setSnapshot(result);
  }catch(cause){if(current()&&epoch.current===version){const code=cause instanceof AccountError?cause.code:'unavailable';setError(code);if(['group_changed','group_unavailable','squad_changed','squad_unavailable'].includes(code))await session?.refresh();}}
  finally{if(current()&&epoch.current===version)setBusy(false);}
 };
 const publish=async()=>{if(!snapshot||disabled||changed||draft.preview?.id!==snapshot.previewId||draft.preview.hash!==snapshot.hash)return;const receipt=await write({kind:'squad.publish',groupId:group.id,postId:snapshot.postId,previewId:snapshot.previewId,hash:snapshot.hash},snapshot.groupRevision);if(receipt){toast(t('published'));back();}};
 const review=()=>change(post?{postId:post.id,postRevision:post.revision,groupRevision:group.revision,note:draft.note,choices:draft.choices}:{postId:crypto.randomUUID(),postRevision:0,groupRevision:group.revision,note:draft.note,choices:{habits:false,milestones:false,prayers:false}});
 return <div className="life-screen server-groups server-squad"><Pending/><LifeIntro title={t('compose')} text={`${group.name} · ${tr.week(week)}`}/>
  {changed&&<section className="shared-review"><p role="status">{t(post||draft.postRevision===0?'changed':'unavailable')}</p>{post&&<><h2>{t('current')}</h2><SnapshotCard snapshot={post.snapshot} group={group}/></>}<Button variant="secondary" disabled={disabled} onClick={review}>{t(post?'reviewed':'newUpdate')}</Button></section>}
  {group.archived&&<p role="status" className="fine-print">{g('archivedHelp')}</p>}
  {snapshot?<><h2 ref={previewHeading} tabIndex={-1}>{t('previewTitle')}</h2><SnapshotCard snapshot={snapshot.snapshot} group={group}/><PrivacyNote>{t('fixed')}</PrivacyNote><PrivacyNote>{t('textHelp')}</PrivacyNote>
   <Button className="wide" disabled={disabled||changed||group.archived||draft.preview?.id!==snapshot.previewId||draft.preview.hash!==snapshot.hash||view.error==='squad_preview_expired'} onClick={()=>void publish()}><Share2 size={17}/>{t('publish')}</Button>
   <Button variant="ghost" className="wide" disabled={disabled} onClick={()=>{change(draft);setTimeout(()=>previewButton.current?.querySelector('button')?.focus(),0);}}>{t('editAgain')}</Button>
  </>:<><label className="field">{t('reflection')}<textarea rows={5} value={draft.note} disabled={disabled||group.archived} placeholder={t('placeholder')} onChange={e=>{if([...e.target.value].length<=600)change({...draft,note:e.target.value});}}/></label>
   <PrivacyNote>{t('textHelp')}</PrivacyNote><SectionTitle title={t('choose')}/><div className="group">
    <GroupRow icon={<Sprout size={19}/>} title={t('habits')} detail={t('habitHelp')} end={<Toggle label={t('habitToggle')} checked={draft.choices.habits} disabled={disabled||group.archived} onChange={()=>change({...draft,choices:{...draft.choices,habits:!draft.choices.habits}})}/>}/>
    <GroupRow icon={<CheckCheck size={19}/>} title={t('milestones')} detail={t('milestoneHelp')} end={<Toggle label={t('milestoneToggle')} checked={draft.choices.milestones} disabled={disabled||group.archived} onChange={()=>change({...draft,choices:{...draft.choices,milestones:!draft.choices.milestones}})}/>}/>
    <GroupRow icon={<LockKeyhole size={19}/>} title={t('prayers')} detail={t('prayerHelp')} end={<Toggle label={t('prayerToggle')} checked={draft.choices.prayers} disabled={disabled||group.archived} onChange={()=>change({...draft,choices:{...draft.choices,prayers:!draft.choices.prayers}})}/>}/>
   </div><PrivacyNote>{t('privacy')}</PrivacyNote><div ref={previewButton}><Button className="wide" disabled={disabled||changed||group.archived||!hasContent} onClick={()=>void preview()}>{t(busy?'working':'preview')}<ArrowRight size={18}/></Button></div>
  </>}
  {error&&<p role="alert" className="field-error">{squadError(error)?t(squadError(error)!):error==='group_changed'?t('changed'):error==='invalid_input'?t('invalid'):error==='rate_limited'?g(groupError(error)):t('failed')}</p>}
  {post&&<button className="text-button danger-text" disabled={disabled} onClick={()=>setWithdrawing(true)}>{t('withdraw')}</button>}
  {post&&withdrawing&&<Confirm title={t('withdraw')} help={t('withdrawHelp')} busy={disabled} onCancel={()=>setWithdrawing(false)} onConfirm={()=>void write({kind:'squad.withdraw',groupId:group.id,postId:post.id},group.revision).then(async receipt=>{if(receipt&&current()){await clear(draft);if(current()){toast(t('withdrawn'));back();}}})}/>}
 </div>;
}
