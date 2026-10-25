import {Confirm,Pending} from './GroupStatus';
export {Confirm,Pending} from './GroupStatus';
import {useEffect,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {ChevronRight,Home,LockKeyhole,Plus,Settings2,Users} from 'lucide-react';
import {useApp} from '../context';
import {Button,GroupRow,SectionTitle,Toggle} from '../components';
import {LifeIntro,PrivacyNote} from '../LifeUI';
import {parseGroupOperation,type AccountGroup,type GroupCommand,type GroupKind,type GroupPreview} from '../contracts/groups';
import {AccountError} from '../auth/client';
import {useGroups} from './GroupProvider';
import {groupText,groupError,type GroupTextKey} from './text';
import {sharedText} from './sharedText';
import {squadText} from './squadText';
import {emptyInvitations} from './invitations';
import {GroupReauthentication} from './GroupReauthentication';
import {GroupExport} from './GroupExport';
import {formatDisplayDate,type Language} from '../i18n';
const noSubscribe=()=>()=>{},zero=()=>0;

const isOwner=(group:AccountGroup)=>group.members.some(m=>m.self&&m.role==='owner');
const nameValid=(value:string)=>!!value.trim()&&value.length<=80&&![...value].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127);
function useCopy(){return groupText(useApp().state.life.language);}
function Avatar({name}:{name:string}){return <span className="member-avatar" aria-hidden="true">{name.trim().slice(0,1).toUpperCase()}</span>;}
function Gate(){const t=useCopy(),{open}=useApp();return <div className="life-screen server-groups"><LifeIntro title={t('title')} text={t('gate')}/><Button className="wide" onClick={()=>open({type:'account'})}>{t('account')}</Button><PrivacyNote>{t('privacy')}</PrivacyNote><p className="fine-print">{t('retained')}</p></div>;}
export function Missing(){const t=useCopy(),{open}=useApp(),{session}=useGroups();return <div className="life-screen server-groups"><p role="status">{t('unavailable')}</p><Pending/><Button variant="secondary" onClick={()=>void session?.refresh()}>{t('refresh')}</Button><Button onClick={()=>open({type:'groups'})}>{t('people')}</Button></div>;}
export function GroupBoundary({id,children}:{id:string;children:(group:AccountGroup)=>ReactNode}){
 const {session,view}=useGroups(),t=useCopy();if(!session)return <Gate/>;
 const group=view.groups.find(g=>g.id===id);if(!view.loaded&&!view.readError)return <p className="life-screen" role="status">{t('loading')}</p>;
 if(!group)return <Missing/>;return children(group);
}
export function useDraft<T>(key:string,initial:()=>T,parse:(value:unknown)=>T){
 const {state,dispatch,storage,workspace}=useApp(),owner=workspace?.scope;
 let value=initial();try{if(state.life.drafts[key]!==undefined)value=parse(state.life.drafts[key]);}catch{/* Preserve an unknown draft until the user edits it. */}
 const set=(next:T)=>{dispatch({kind:'draft.save',key,value:next});};
 const clear=async(expected:T)=>{if(workspace?.scope!==owner)return false;if(JSON.stringify(storage.getSnapshot().state.life.drafts[key])!==JSON.stringify(expected))return true;dispatch({kind:'draft.clear',key});return await storage.whenSaved()&&workspace?.scope===owner;};
 return [value,set,clear] as const;
}
function record(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('draft');return value as Record<string,unknown>;}
type CreateDraft={name:string;nickname:string;timezone:string};
function parseCreateDraft(value:unknown):CreateDraft{const d=record(value);if(Object.keys(d).length!==3||typeof d.name!=='string'||d.name.length>80||typeof d.nickname!=='string'||d.nickname.length>80||typeof d.timezone!=='string'||d.timezone.length>100)throw new Error('draft');return {name:d.name,nickname:d.nickname,timezone:d.timezone};}

export function ServerGroupsHub({initialKind='family'}:{initialKind?:GroupKind}){
 const {session,view,token}=useGroups(),t=useCopy(),{open}=useApp(),[kind,setKind]=useState(initialKind);
 useEffect(()=>{if(session)void session.refresh();},[session]);
 if(!session)return <Gate/>;
 const groups=view.groups.filter(g=>g.kind===kind&&!g.archived),archived=view.groups.filter(g=>g.kind===kind&&g.archived);
 return <div className="life-screen server-groups"><LifeIntro title={t('title')} text={t('intro')}/>
  {token&&<Button variant="secondary" className="wide" onClick={()=>open({type:'groupJoin'})}>{t('joinTitle')}</Button>}<Pending/>
  <div className="segmented life-segments"><button aria-pressed={kind==='family'} className={kind==='family'?'selected':''} onClick={()=>setKind('family')}><Home size={17}/>{t('family')}</button><button aria-pressed={kind==='squad'} className={kind==='squad'?'selected':''} onClick={()=>setKind('squad')}><Users size={17}/>{t('squad')}</button></div>
  {!view.loaded&&<p role="status" className="fine-print">{t(view.readError?'readFailed':'loading')}</p>}
  {groups.map(g=><button className="people-group" key={g.id} onClick={()=>open({type:'group',id:g.id})}><span className="people-group-title">{g.kind==='family'?<Home size={23}/>:<Users size={23}/>}<strong>{g.name}</strong><ChevronRight size={19}/></span><span className="people-group-members"><span className="avatar-stack">{g.members.slice(0,4).map(m=><Avatar key={m.id} name={m.name}/>)}</span><small>{t('members')} · {g.members.length}</small></span></button>)}
  {view.loaded&&!groups.length&&<div className="people-empty">{kind==='family'?<Home size={35}/>:<Users size={35}/>}<h2>{t('empty')}</h2><p>{t('emptyHelp')}</p></div>}
  <Button variant="secondary" className="wide" disabled={!view.loaded||view.busy||!!view.pending||view.invalidPending} onClick={()=>open({type:'groupCreate',id:kind})}><Plus size={18}/>{t(kind==='family'?'createFamily':'createSquad')}</Button>
  <Button variant="ghost" className="wide" disabled={view.busy} onClick={()=>void session.refresh()}>{t('refresh')}</Button><PrivacyNote>{t('privacy')}</PrivacyNote>
  {archived.length>0&&<details className="done-group"><summary>{t('archived')} · {archived.length}</summary>{archived.map(g=><GroupRow key={g.id} title={g.name} onClick={()=>open({type:'group',id:g.id})}/>)}</details>}
 </div>;
}
export function ServerGroupCreate({kind='family'}:{kind?:string}){const {session}=useGroups();return session?<CreateForm kind={kind==='squad'?'squad':'family'}/>:<Gate/>;}
function CreateForm({kind}:{kind:GroupKind}){
 const {session,view}=useGroups(),t=useCopy(),{state,open,back,toast}=useApp();
 const [draft,setDraft,clear]=useDraft(`server-group-create:${kind}`,()=>({name:'',nickname:'',timezone:state.timezone}),parseCreateDraft),[error,setError]=useState(false);
 const locked=view.busy||!!view.pending||view.invalidPending;
 return <div className="life-screen server-groups"><LifeIntro title={t(kind==='family'?'createFamily':'createSquad')} text={t('intro')}/><Pending/><form onSubmit={e=>{e.preventDefault();if(!session||locked)return;const command={kind:'group.create' as const,groupId:crypto.randomUUID(),groupKind:kind,name:draft.name.trim(),nickname:draft.nickname.trim(),timezone:draft.timezone.trim()};try{parseGroupOperation({accountId:session.owner,operationId:crypto.randomUUID(),issuedAt:Date.now(),expectedRevision:0,command});}catch{setError(true);return;}setError(false);void session.execute(command,0).then(async receipt=>{if(!receipt||!await clear(draft))return;toast(t('saved'));back();open({type:'group',id:receipt.groupId});});}}>
  <label className="field">{t('name')}<input required maxLength={80} value={draft.name} disabled={locked} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
  <label className="field">{t('nickname')}<input required maxLength={80} value={draft.nickname} disabled={locked} aria-describedby="group-nickname-help" onChange={e=>setDraft({...draft,nickname:e.target.value})}/></label><p id="group-nickname-help" className="fine-print">{t('nicknameHelp')}</p>
  <label className="field">{t('timezone')}<input required maxLength={100} value={draft.timezone} disabled={locked} aria-describedby="group-zone-help" onChange={e=>setDraft({...draft,timezone:e.target.value})}/></label><p id="group-zone-help" className="fine-print">{t('zoneHelp')}</p>
  {error&&<p className="field-error" role="alert">{t('invalid')}</p>}<PrivacyNote>{t('privacy')}</PrivacyNote><Button type="submit" className="wide" disabled={locked||!draft.name.trim()||!draft.nickname.trim()}>{t(view.busy?'working':'create')}</Button>
 </form></div>;
}
export function ServerGroupDetail({id,renderFamily,renderSquad}:{id:string;renderFamily?:(group:AccountGroup)=>ReactNode;renderSquad?:(group:AccountGroup)=>ReactNode}){return <GroupBoundary id={id}>{group=><Detail group={group} renderFamily={renderFamily} renderSquad={renderSquad}/>}</GroupBoundary>;}
function Detail({group,renderFamily,renderSquad}:{group:AccountGroup;renderFamily?:(group:AccountGroup)=>ReactNode;renderSquad?:(group:AccountGroup)=>ReactNode}){
 const t=useCopy(),{open}=useApp();return <div className="life-screen server-groups"><Pending/><div className="group-page-heading"><div><h1>{group.name}</h1><p><LockKeyhole size={13}/>{t('members')} · {group.members.length} · {group.timezone}</p></div><button className="icon-button" aria-label={t('settings')} onClick={()=>open({type:'groupSettings',id:group.id})}><Settings2 size={21}/></button></div>
 <div className="group-member-strip">{group.members.map(m=><span key={m.id}><Avatar name={m.name}/><small>{m.name}{m.self?` · ${t('you')}`:''}</small></span>)}{isOwner(group)&&!group.archived&&<button aria-label={t('invite')} onClick={()=>open({type:'invite',id:group.id})}><span className="member-avatar add-member"><Plus size={18}/></span><small>{t('invite')}</small></button>}</div>
 {group.archived&&<p className="fine-print" role="status">{t('archivedHelp')}</p>}{group.kind==='family'&&renderFamily?renderFamily(group):group.kind==='squad'&&renderSquad?renderSquad(group):<><SectionTitle title={t('members')}/><div className="group">{group.members.map(m=><GroupRow key={m.id} title={m.name} detail={`${t(m.role)}${m.self?` · ${t('you')}`:''}`}/>)}</div></>}<PrivacyNote>{t('privacy')}</PrivacyNote></div>;
}
type SettingsDraft={muted:boolean;quietStart:string;quietEnd:string;revision:number;notifications?:boolean};
type NameDraft={name:string;revision:number};
function parseNameDraft(value:unknown):NameDraft{const d=record(value);if(Object.keys(d).length!==2||typeof d.name!=='string'||d.name.length>80||!Number.isSafeInteger(d.revision)||Number(d.revision)<1)throw new Error('draft');return {name:d.name,revision:Number(d.revision)};}
function parseSettingsDraft(value:unknown):SettingsDraft{const d=record(value),hasConsent=Object.hasOwn(d,'notifications');if(Object.keys(d).length!==(hasConsent?5:4)||hasConsent&&typeof d.notifications!=='boolean'||typeof d.muted!=='boolean'||typeof d.quietStart!=='string'||!/^\d{2}:\d{2}$/.test(d.quietStart)||typeof d.quietEnd!=='string'||!/^\d{2}:\d{2}$/.test(d.quietEnd)||!Number.isSafeInteger(d.revision)||Number(d.revision)<1)throw new Error('draft');return {muted:d.muted,quietStart:d.quietStart,quietEnd:d.quietEnd,revision:Number(d.revision),...(hasConsent?{notifications:d.notifications as boolean}:{})};}
export function ServerGroupSettings({id}:{id:string}){return <GroupBoundary id={id}>{group=><Settings key={group.id} group={group}/>}</GroupBoundary>;}
function Settings({group}:{group:AccountGroup}){
 const t=useCopy(),{session,view}=useGroups(),{open,toast}=useApp(),owner=isOwner(group);
 const [draft,setDraft,clear]=useDraft(`server-group-preferences:${group.id}`,()=>({...group.preferences,notifications:group.preferences.notifications??false,revision:group.revision}),parseSettingsDraft);
 const [name,setName,clearName]=useDraft(`server-group-name:${group.id}`,()=>({name:group.name,revision:group.revision}),parseNameDraft);
 const [confirm,setConfirm]=useState<{command:Exclude<GroupCommand,{kind:'group.accept'}>;revision:number;title:string;help:GroupTextKey}|null>(null),[member,setMember]=useState(''),[error,setError]=useState(false);
 const locked=view.busy||!!view.pending||view.invalidPending;
 const notifications=draft.notifications??group.preferences.notifications??false;
 const action=(command:Exclude<GroupCommand,{kind:'group.accept'}>,title:GroupTextKey,help:GroupTextKey)=>setConfirm({command,revision:group.revision,title:t(title)+('memberId' in command?`: ${group.members.find(m=>m.id===command.memberId)?.name??''}`:''),help});
 const save=async(command:Exclude<GroupCommand,{kind:'group.accept'}>)=>{if(!session)return;const receipt=await session.execute(command,draft.revision);if(receipt&&await clear(draft))toast(t('saved'));};
 return <div className="life-screen server-groups"><LifeIntro title={group.name} text={t('settings')}/><Pending/>
  {confirm&&<Confirm title={confirm.title} help={t(confirm.help)} busy={locked} onCancel={()=>setConfirm(null)} onConfirm={()=>void session?.execute(confirm.command,confirm.revision).then(receipt=>{if(!receipt)return;setConfirm(null);toast(t('saved'));if(confirm.command.kind==='group.delete'||confirm.command.kind==='group.leave')open({type:'groups'});})}/>}
  {owner&&!group.archived&&<form onSubmit={e=>{e.preventDefault();if(!nameValid(name.name)){setError(true);return;}setError(false);void session?.execute({kind:'group.rename',groupId:group.id,name:name.name.trim()},name.revision).then(async receipt=>{if(receipt&&await clearName(name))toast(t('saved'));});}}><label className="field">{t('name')}<input required maxLength={80} value={name.name} disabled={locked} onChange={e=>setName({...name,name:e.target.value})}/></label>{error&&<p role="alert" className="field-error">{t('invalid')}</p>}<Button type="submit" variant="secondary" disabled={locked||name.name===group.name}>{t('save')}</Button></form>}
  <SectionTitle title={t('members')}/><div className="group">{group.members.map(m=><GroupRow key={m.id} title={m.name} detail={`${t(m.role)}${m.self?` · ${t('you')}`:''}`} end={owner&&!group.archived&&!m.self?<button className="text-button" disabled={locked} aria-label={`${t('remove')}: ${m.name}`} onClick={()=>action({kind:'group.remove',groupId:group.id,memberId:m.id},'remove','removeHelp')}>{t('remove')}</button>:null}/>)}</div>
  {(name.revision!==group.revision||draft.revision!==group.revision)&&<section><p className="fine-print">{t('reviewLatest')}</p><Button variant="secondary" disabled={locked} onClick={()=>{setName({...name,revision:group.revision});setDraft({...draft,revision:group.revision});}}>{t('useLatest')}</Button></section>}
  <SectionTitle title={t('quiet')}/><form onSubmit={e=>{e.preventDefault();void save({kind:'group.preferences',groupId:group.id,muted:draft.muted,quietStart:draft.quietStart,quietEnd:draft.quietEnd,notifications});}}><GroupRow title={t('notifications')} end={<Toggle disabled={locked} label={t('notifications')} checked={notifications} onChange={()=>{if(!locked)setDraft({...draft,notifications:!notifications});}}/>}/><p className="fine-print">{t('notificationsHelp')}</p><div className="group-row"><span className="row-copy"><strong>{t('muted')}</strong></span><Toggle disabled={locked} label={t('muted')} checked={draft.muted} onChange={()=>{if(!locked)setDraft({...draft,notifications,muted:!draft.muted});}}/></div><div className="form-row"><label className="field">{t('start')}<input type="time" required disabled={locked} value={draft.quietStart} onChange={e=>setDraft({...draft,notifications,quietStart:e.target.value})}/></label><label className="field">{t('end')}<input type="time" required disabled={locked} value={draft.quietEnd} onChange={e=>setDraft({...draft,notifications,quietEnd:e.target.value})}/></label></div><p className="fine-print">{t('preferencesHelp')} {group.timezone}</p><Button variant="secondary" type="submit" disabled={locked}>{t('preferences')}</Button></form>
  <p className="fine-print">{t('notificationDeviceHelp')}</p><Button variant="secondary" className="wide" disabled={locked} onClick={()=>open({type:'backgroundNotifications'})}>{t('notificationDevice')}</Button>
  <GroupExport group={group} blocked={locked}/>
  {owner&&<><PrivacyNote>{t('ownerHelp')}</PrivacyNote>{!group.archived&&<><label className="field">{t('newOwner')}<select value={member} disabled={locked} onChange={e=>setMember(e.target.value)}><option value="">{t('newOwner')}</option>{group.members.filter(m=>!m.self).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><Button variant="secondary" disabled={locked||!group.members.some(m=>m.id===member&&!m.self)} onClick={()=>action({kind:'group.transfer',groupId:group.id,memberId:member},'transfer','transferHelp')}>{t('transfer')}</Button></>}
   <Button variant="secondary" className="wide" disabled={locked} onClick={()=>group.archived?void session?.execute({kind:'group.restore',groupId:group.id},group.revision).then(receipt=>{if(receipt)toast(t('saved'));}):action({kind:'group.archive',groupId:group.id},'archive','archiveHelp')}>{t(group.archived?'restore':'archive')}</Button><Button variant="ghost" className="wide" disabled={locked} onClick={()=>action({kind:'group.delete',groupId:group.id},'delete','deleteHelp')}>{t('delete')}</Button></>}
  {!owner&&<Button variant="ghost" className="wide" disabled={locked} onClick={()=>action({kind:'group.leave',groupId:group.id},'leave','leaveHelp')}>{t('leave')}</Button>}
 </div>;
}
function expiry(value:string,group:Pick<AccountGroup,'timezone'>,language:Language){return formatDisplayDate(new Date(value),language,{dateStyle:'medium',timeStyle:'short',timeZone:group.timezone});}
export function ServerGroupInvite({id}:{id:string}){return <GroupBoundary id={id}>{group=><Invite key={group.id} group={group}/>}</GroupBoundary>;}
function Invite({group}:{group:AccountGroup}){
 const t=useCopy(),{session,view,invitations}=useGroups(),{state,toast}=useApp(),[copyError,setCopyError]=useState(false),[revoke,setRevoke]=useState<{id:string;revision:number}|null>(null),heading=useRef<HTMLHeadingElement>(null);
 useSyncExternalStore(invitations?.subscribe??noSubscribe,invitations?.getVersion??zero);
 const page=invitations?.get(group.id)??emptyInvitations;
 const navigate=async(direction:'next'|'previous'|'first')=>{if(await invitations?.load(group.id,direction))heading.current?.focus();};
 const link=view.receipt?.groupId===group.id?view.receipt.invitation:null,active=link&&page.loaded&&!page.loading&&!page.error&&page.rows.some(i=>i.id===link.id&&!i.revoked&&!i.consumed&&Date.parse(i.expiresAt)>Date.now());
 const locked=view.busy||!!view.pending||view.invalidPending||group.archived;
 return <div className="life-screen server-groups"><LifeIntro title={t('invite')} text={group.name}/><Pending/>{!isOwner(group)?<p className="fine-print">{t('ownership')}</p>:<><p className="fine-print">{t('linkHelp')}</p>
  <Button className="wide" disabled={locked} onClick={()=>void session?.execute({kind:'group.invite',groupId:group.id},group.revision)}>{t('makeLink')}</Button>
  {active&&<div className="group-invitation"><p className="fine-print">{t('expires')} · {expiry(link.expiresAt,group,state.life.language)}</p><Button variant="secondary" onClick={()=>{setCopyError(false);void (navigator.clipboard?navigator.clipboard.writeText(link.link):Promise.reject()).then(()=>toast(t('copied'))).catch(()=>setCopyError(true));}}>{t('copy')}</Button>{!!navigator.share&&<Button variant="secondary" onClick={()=>{void navigator.share({title:group.name,url:link.link}).catch(error=>{if(!(error instanceof DOMException&&error.name==='AbortError'))setCopyError(true);});}}>{t('share')}</Button>}</div>}
  {copyError&&<p className="field-error" role="alert">{t('copyFailed')}</p>}
  <div className="section-title"><h2 ref={heading} tabIndex={-1}>{t('invitations')}</h2></div>{page.loading&&<p role="status" className="fine-print">{t('invitationsLoading')}</p>}{page.error&&<><p role="alert" className="field-error">{t('invitationsFailed')}</p><Button variant="secondary" disabled={view.busy} onClick={()=>void navigate('first')}>{t('invitationsReload')}</Button></>}{page.rows.map(i=><div className="group-row" key={i.id}><span className="row-copy"><strong>{t(i.revoked?'revoked':i.consumed?'used':'expires')}</strong><small>{expiry(i.expiresAt,group,state.life.language)}</small></span>{!i.revoked&&!i.consumed&&Date.parse(i.expiresAt)>Date.now()&&<button className="text-button" disabled={locked||page.loading||!page.loaded} onClick={()=>setRevoke({id:i.id,revision:page.revision??group.revision})}>{t('revoke')}</button>}</div>)}
  {(page.previous||page.next)&&<div><Button variant="secondary" className="wide" disabled={view.busy||page.loading||!!revoke||!page.previous} onClick={()=>void navigate('previous')}>{t('invitationsPrevious')}</Button><Button variant="secondary" className="wide" disabled={view.busy||page.loading||!!revoke||!page.next} onClick={()=>void navigate('next')}>{t('invitationsOlder')}</Button></div>}
  {revoke&&<Confirm title={t('revoke')} help={t('revokeHelp')} busy={locked} onCancel={()=>setRevoke(null)} onConfirm={()=>void session?.execute({kind:'group.revoke',groupId:group.id,invitationId:revoke.id},revoke.revision).then(receipt=>{if(receipt)setRevoke(null);})}/>}
 </>}<PrivacyNote>{t('privacy')}</PrivacyNote></div>;
}
export function ServerGroupJoin(){const {session}=useGroups();return session?<Join/>:<Gate/>;}
function Join(){
 const {session,view,token,clearInvitation}=useGroups(),t=useCopy(),{state,open,back,toast}=useApp();
 const [preview,setPreview]=useState<GroupPreview|null>(null),[error,setError]=useState<string|null>(null),[name,setName]=useState(''),[consent,setConsent]=useState(false),[checking,setChecking]=useState(false);
 useEffect(()=>{let active=true;setPreview(null);setConsent(false);if(!session||!token||token==='invalid'){setError('invitation_unavailable');return;}setChecking(true);void session.preview(token).then(result=>{if(active){setPreview(result);setError(null);}},failure=>{if(active)setError(failure instanceof AccountError?failure.code:'unavailable');}).finally(()=>{if(active)setChecking(false);});return()=>{active=false;};},[session,token]);
 const locked=view.busy||!!view.pending||view.invalidPending;
 return <div className="life-screen server-groups"><LifeIntro title={t('joinTitle')} text={preview?.name??t('intro')}/><Pending/>{checking&&<p role="status" className="fine-print">{t('loading')}</p>}{error&&<p role="alert" className="field-error">{t(groupError(error))}</p>}
  {preview&&<form onSubmit={e=>{e.preventDefault();if(!session||!token||!consent||!nameValid(name)||locked)return;void session.join(preview,token,name.trim()).then(receipt=>{if(!receipt)return;clearInvitation();toast(t('joined'));back();open({type:'group',id:receipt.groupId});});}}><p className="fine-print">{t(preview.kind)} · {preview.timezone}<br/>{t('expires')} · {expiry(preview.expiresAt,preview,state.life.language)}</p><label className="field">{t('nickname')}<input required maxLength={80} value={name} disabled={locked} onChange={e=>setName(e.target.value)}/></label><p className="fine-print">{t('nicknameHelp')}</p><PrivacyNote>{t('privacy')}</PrivacyNote><label className="checkbox-label"><input type="checkbox" checked={consent} disabled={locked} onChange={e=>setConsent(e.target.checked)}/><span>{t('joinConsent')}</span></label><Button className="wide" type="submit" disabled={locked||!consent||!nameValid(name)}>{t('join')}</Button></form>}
  <Button className="wide" variant="ghost" disabled={view.busy} onClick={()=>{clearInvitation();back();}}>{t('dismiss')}</Button>
 </div>;
}
