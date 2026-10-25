import {AccountError} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/auth/client';
import {parseSharedQuery,sharedTaskOccurs,type SharedQuery,type SharedPage,type SharedTask} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/contracts/sharedContent';
import type {SharedPriority} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/domain/priorityReferences';
import type {GroupSession,GroupState} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/groups/session';
import type {GroupClient} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/groups/client';

export type ContentQuery=Omit<SharedQuery,'cursor'|'revision'>;
export interface ContentView {rows:SharedPage['rows'];revision:number|null;next:string|null;loaded:boolean;loading:boolean;error:string|null}
export const emptyContent:ContentView={rows:[],revision:null,next:null,loaded:false,loading:false,error:null};
type Entry={query:ContentQuery;view:ContentView;abort:AbortController;failedGroups?:GroupState['groups']};
const key=(q:ContentQuery)=>JSON.stringify([q.groupId,q.collection,q.parentId??null,q.date??null]);
const rowKey=(r:SharedPage['rows'][number])=>'id'in r?r.id:`${r.taskId}/${r.date}`;
/** Shared text stays in memory. Each page is tied to a verified owner and one
 * group revision; membership refresh invalidates both content and fresh pins. */
export class SharedContent {
 private entries=new Map<string,Entry>();private listeners=new Set<()=>void>();private closed=false;private unsubscribe:()=>void;private version=0;
 constructor(readonly owner:string,private groups:Pick<GroupSession,'getSnapshot'|'subscribe'|'refresh'>,private client:Pick<GroupClient,'content'>,private isCurrent:()=>boolean){this.unsubscribe=groups.subscribe(this.observe);}
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
 getVersion=()=>this.version;
 private current(){return !this.closed&&this.isCurrent();}
 private group(id:string){return this.current()&&this.groups.getSnapshot().loaded?this.groups.getSnapshot().groups.find(g=>g.id===id&&g.kind==='family'):undefined;}
 private emit(){this.version++;if(!this.closed)this.listeners.forEach(listener=>listener());}
 private observe=()=>{
  // A fresh authorized head may retry an unavailable read; busy/receipt updates cannot.
  const head=this.groups.getSnapshot();
  let changed=false;
  for(const[id,entry]of this.entries){const group=this.group(entry.query.groupId);if(!group||entry.view.revision!==group.revision||entry.view.error==='unavailable'&&!head.readError&&entry.failedGroups!==head.groups){entry.abort.abort();this.entries.delete(id);changed=true;}}
  if(changed)this.emit();
 };
 get=(query:ContentQuery):ContentView=>this.current()?this.entries.get(key(query))?.view??emptyContent:emptyContent;
 /** Fetch exactly one bounded page. More is explicit, and never mixes heads. */
 async load(value:ContentQuery,append=false){
  const query=parseSharedQuery(value),id=key(query),group=this.group(query.groupId);if(!group)return false;
  const prior=this.entries.get(id);
  if(append&&(!prior?.view.loaded||prior.view.loading||!prior.view.next||prior.view.revision!==group.revision))return false;
  prior?.abort.abort();const entry:Entry={query,abort:new AbortController(),view:{...(append?prior!.view:emptyContent),revision:group.revision,loading:true,error:null}};
  this.entries.set(id,entry);this.emit();
  const matches=()=>this.current()&&this.entries.get(id)===entry&&this.group(query.groupId)?.revision===entry.view.revision;
  try{
   const page=await this.client.content({...query,revision:group.revision,...(append?{cursor:prior!.view.next!}:{})},entry.abort.signal);
   if(!matches())return false;
   if(page.accountId!==this.owner||page.groupId!==query.groupId||page.collection!==query.collection||page.revision!==group.revision)throw new AccountError('unavailable');
   const rows=append?[...prior!.view.rows,...page.rows]:page.rows;
   if(new Set(rows.map(rowKey)).size!==rows.length||append&&page.next===prior!.view.next)throw new AccountError('unavailable');
   entry.view={rows,revision:page.revision,next:page.next,loaded:true,loading:false,error:null};this.emit();return true;
  }catch(error){
   if(!matches())return false;
   const code=error instanceof AccountError?error.code:'unavailable';entry.failedGroups=this.groups.getSnapshot().groups;entry.view={...emptyContent,revision:group.revision,error:code};this.emit();
   if(['group_changed','group_unavailable','sign_in_required','account_changed'].includes(code))await this.groups.refresh();return false;
  }
 }
 allowsPriority=(priority:SharedPriority)=>{
  const group=this.group(priority.groupId),view=this.get({groupId:priority.groupId,collection:'tasks'});
  if(!group||group.archived||!view.loaded||view.loading||view.error||view.revision!==group.revision)return false;
  const task=view.rows.find((row):row is SharedTask=>'id'in row&&'weekdays'in row&&row.id===priority.taskId);
  return !!task&&sharedTaskOccurs(task,priority.date);
 };
 close(){this.closed=true;this.unsubscribe();for(const entry of this.entries.values())entry.abort.abort();this.entries.clear();this.listeners.clear();}
}
