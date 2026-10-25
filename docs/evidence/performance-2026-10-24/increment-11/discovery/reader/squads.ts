import {AccountError} from '../auth/client';
import {parseSquadQuery,type SquadQuery,type SquadPage} from '../contracts/squads';
import type {GroupSession,GroupState} from './session';
import type {GroupClient} from './client';

export type SquadSelection=Omit<SquadQuery,'cursor'|'revision'>;
export interface SquadView {rows:SquadPage['rows'];revision:number|null;next:string|null;loaded:boolean;loading:boolean;error:string|null}
export const emptySquad:SquadView={rows:[],revision:null,next:null,loaded:false,loading:false,error:null};
type Entry={query:SquadSelection;view:SquadView;abort:AbortController;failedGroups?:GroupState['groups']};
const key=(q:SquadSelection)=>JSON.stringify([q.groupId,q.week,q.authorMemberId??null]);
/** Published snapshots are memory-only and tied to current group membership.
 * Each continuation asserts the same revision, including reaction changes. */
export class SquadContent {
 private entries=new Map<string,Entry>();private listeners=new Set<()=>void>();private closed=false;private unsubscribe:()=>void;private version=0;
 constructor(readonly owner:string,private groups:Pick<GroupSession,'getSnapshot'|'subscribe'|'refresh'>,private client:Pick<GroupClient,'squad'>,private isCurrent:()=>boolean){this.unsubscribe=groups.subscribe(this.observe);}
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
 getVersion=()=>this.version;
 private current(){return !this.closed&&this.isCurrent();}
 private group(id:string){return this.current()&&this.groups.getSnapshot().loaded?this.groups.getSnapshot().groups.find(g=>g.id===id&&g.kind==='squad'):undefined;}
 private emit(){this.version++;if(!this.closed)this.listeners.forEach(listener=>listener());}
 private observe=()=>{
  // A fresh authorized head may retry an unavailable read; busy/receipt updates cannot.
  const head=this.groups.getSnapshot();
  let changed=false;for(const[id,entry]of this.entries){const group=this.group(entry.query.groupId);if(!group||entry.view.revision!==group.revision||entry.view.error==='unavailable'&&!head.readError&&entry.failedGroups!==head.groups){entry.abort.abort();this.entries.delete(id);changed=true;}}
  if(changed)this.emit();
 };
 get=(query:SquadSelection):SquadView=>this.current()?this.entries.get(key(query))?.view??emptySquad:emptySquad;
 async load(value:SquadSelection,append=false){
  const query=parseSquadQuery(value),id=key(query),group=this.group(query.groupId);if(!group)return false;
  const prior=this.entries.get(id);if(append&&(!prior?.view.loaded||prior.view.loading||!prior.view.next||prior.view.revision!==group.revision))return false;
  prior?.abort.abort();const entry:Entry={query,abort:new AbortController(),view:{...(append?prior!.view:emptySquad),revision:group.revision,loading:true,error:null}};
  this.entries.set(id,entry);this.emit();
  const matches=()=>this.current()&&this.entries.get(id)===entry&&this.group(query.groupId)?.revision===entry.view.revision;
  try{
   const page=await this.client.squad({...query,revision:group.revision,...(append?{cursor:prior!.view.next!}:{})},entry.abort.signal);
   if(!matches())return false;
   if(page.accountId!==this.owner||page.groupId!==query.groupId||page.week!==query.week||page.revision!==group.revision||query.authorMemberId!==undefined&&page.rows.some(row=>row.authorMemberId!==query.authorMemberId))throw new AccountError('unavailable');
   const rows=append?[...prior!.view.rows,...page.rows]:page.rows;
   if(new Set(rows.map(row=>row.id)).size!==rows.length||append&&page.next===prior!.view.next)throw new AccountError('unavailable');
   entry.view={rows,revision:page.revision,next:page.next,loaded:true,loading:false,error:null};this.emit();return true;
  }catch(error){if(!matches())return false;const code=error instanceof AccountError?error.code:'unavailable';entry.failedGroups=this.groups.getSnapshot().groups;entry.view={...emptySquad,revision:group.revision,error:code};this.emit();
   if(['group_changed','group_unavailable','sign_in_required','account_changed'].includes(code))await this.groups.refresh();return false;}
 }
 close(){this.closed=true;this.unsubscribe();for(const entry of this.entries.values())entry.abort.abort();this.entries.clear();this.listeners.clear();}
}
