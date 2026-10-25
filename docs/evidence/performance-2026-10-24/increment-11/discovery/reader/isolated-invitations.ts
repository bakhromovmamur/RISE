import {AccountError} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/auth/client';
import type {AccountGroup,GroupInvitation} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/contracts/groups';
import type {GroupSession,GroupState} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/groups/session';
import type {GroupClient} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/groups/client';

export interface InvitationView {rows:GroupInvitation[];revision:number|null;next:string|null;previous:boolean;loaded:boolean;loading:boolean;error:string|null}
export const emptyInvitations:InvitationView={rows:[],revision:null,next:null,previous:false,loaded:false,loading:false,error:null};
type Entry={view:InvitationView;cursor:string|null;history:(string|null)[];abort:AbortController;failedGroups?:GroupState['groups']};
/** Owner metadata stays in memory. Only one bounded page is displayed; older
 * page navigation retains opaque cursors, not all invitations or any token. */
export class GroupInvitations {
 private entries=new Map<string,Entry>();private listeners=new Set<()=>void>();private version=0;private closed=false;private unsubscribe:()=>void;
 constructor(readonly owner:string,private groups:Pick<GroupSession,'getSnapshot'|'subscribe'|'refresh'>,private client:Pick<GroupClient,'invitations'>,private isCurrent:()=>boolean){this.unsubscribe=groups.subscribe(this.observe);}
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
 getVersion=()=>this.version;
 private current(){return !this.closed&&this.isCurrent();}
 private group(id:string){return this.current()&&this.groups.getSnapshot().loaded?this.groups.getSnapshot().groups.find(group=>group.id===id&&group.members.some(member=>member.self&&member.role==='owner')):undefined;}
 private emit(){this.version++;if(!this.closed)this.listeners.forEach(listener=>listener());}
 private initial(group:AccountGroup):InvitationView{return {rows:group.invitations,revision:group.revision,next:group.invitationNext??null,previous:false,loaded:true,loading:false,error:null};}
 private observe=()=>{
  // A fresh authorized head may retry an unavailable read; busy/receipt updates cannot.
  const head=this.groups.getSnapshot();
  let changed=false;for(const[id,entry]of this.entries){const group=this.group(id);if(!group||group.revision!==entry.view.revision||entry.view.error==='unavailable'&&!head.readError&&entry.failedGroups!==head.groups){entry.abort.abort();this.entries.delete(id);changed=true;}}
  if(changed)this.emit();
 };
 get=(id:string):InvitationView=>{const group=this.group(id);const entry=this.entries.get(id);return group?entry?.view.revision===group.revision?entry.view:this.initial(group):emptyInvitations;};
 async load(id:string,direction:'next'|'previous'|'first'='first'){
  const group=this.group(id);if(!group)return false;const revision=group.revision;
  const candidate=this.entries.get(id),prior=candidate?.view.revision===group.revision?candidate:undefined,view=this.get(id);if(view.loading)return false;
  if(direction==='next'&&(!view.loaded||!view.next)||direction==='previous'&&(!view.loaded||!prior?.history.length))return false;
  const history=direction==='next'?[...(prior?.history??[]),prior?.cursor??null]:direction==='previous'?prior!.history.slice(0,-1):[];
  const cursor=direction==='next'?view.next:direction==='previous'?prior!.history.at(-1)??null:null;
  candidate?.abort.abort();const entry:Entry={cursor,history,abort:new AbortController(),view:{...view,loading:true,error:null}};
  this.entries.set(id,entry);this.emit();
  const matches=()=>this.current()&&this.entries.get(id)===entry&&this.group(id)?.revision===revision;
  try{
   const page=await this.client.invitations({groupId:id,revision,...(cursor?{cursor}:{})},entry.abort.signal);
   if(!matches())return false;
   if(page.accountId!==this.owner||page.groupId!==id||page.revision!==revision||cursor!==null&&(page.next===cursor||page.rows.some(row=>row.id===cursor)))throw new AccountError('unavailable');
   entry.view={rows:page.rows,revision:page.revision,next:page.next,previous:history.length>0,loaded:true,loading:false,error:null};this.emit();return true;
  }catch(error){if(!matches())return false;const code=error instanceof AccountError?error.code:'unavailable';entry.failedGroups=this.groups.getSnapshot().groups;entry.view={...emptyInvitations,revision,error:code};this.emit();
   if(['group_changed','group_unavailable','sign_in_required','account_changed'].includes(code))await this.groups.refresh();return false;}
 }
 close(){this.closed=true;this.unsubscribe();for(const entry of this.entries.values())entry.abort.abort();this.entries.clear();this.listeners.clear();}
}
