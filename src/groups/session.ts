import {AccountError} from '../auth/client';
import type {WorkspaceSession} from '../sync/workspace';
import {parseGroupOperation,parsePendingGroupIntent,type AccountGroup,type GroupCommand,type GroupOperation,type GroupPreview,type GroupReceipt,type PendingGroupIntent} from '../contracts/groups';
import {GroupClient} from './client';
import {GROUP_INTENT_KEY,completedGroupDraft} from './intent';

type Workspace=Pick<WorkspaceSession,'scope'|'getAccountIdentity'|'getSnapshot'|'dispatch'|'whenSaved'|'subscribe'>;
type Client=Pick<GroupClient,'read'|'preview'|'apply'|'receipt'>;
export interface GroupState {
 groups:AccountGroup[];loaded:boolean;busy:boolean;error:string|null;readError:string|null;
 pending:PendingGroupIntent|null;invalidPending:boolean;receipt:GroupReceipt|null;
}
const intentId=(intent:PendingGroupIntent)=>intent.type==='command'?intent.operation.operationId:intent.operationId;
/** Server content and invitation secrets remain in memory. Only immutable,
 * non-secret intent is saved through the selected account's existing store. */
export class GroupSession {
 private view:GroupState={groups:[],loaded:false,busy:false,error:null,readError:null,pending:null,invalidPending:false,receipt:null};
 private listeners=new Set<()=>void>();private abort=new AbortController();private closed=false;private readVersion=0;
 private unsubscribe:()=>void;private joining:GroupOperation|null=null;
 constructor(readonly owner:string,private workspace:Workspace,private client:Client=new GroupClient(owner,workspace.getAccountIdentity)){
  this.unsubscribe=workspace.subscribe(this.observe);this.observe();
 }
 getSnapshot=()=>this.view;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
 private current(){if(this.closed||this.workspace.scope!==this.owner||this.workspace.getAccountIdentity()?.account?.id!==this.owner)throw new AccountError('account_changed');}
 private update(value:Partial<GroupState>){if(this.closed)return;this.view={...this.view,...value};this.listeners.forEach(listener=>listener());}
 private observe=()=>{
  try{this.current();}catch{this.joining=null;this.update({groups:[],loaded:false,pending:null,invalidPending:false,receipt:null,error:'account_changed'});return;}
  const raw=this.workspace.getSnapshot().state.life.drafts[GROUP_INTENT_KEY];let pending:PendingGroupIntent|null=null,invalidPending=false;
  if(raw!==undefined)try{pending=parsePendingGroupIntent(raw,this.owner);}catch{invalidPending=true;}
  if(JSON.stringify(pending)!==JSON.stringify(this.view.pending)||invalidPending!==this.view.invalidPending)this.update({pending,invalidPending});
 };
 private async failed(error:unknown){if(this.closed)return;try{this.current();}catch{return;}this.update({error:error instanceof AccountError?error.code:'unavailable'});if(error instanceof AccountError&&['group_changed','group_unavailable','member_unavailable','owner_required','already_member','squad_changed','squad_unavailable'].includes(error.code))await this.refresh();}
 async refresh(){const version=++this.readVersion;try{this.current();const groups=await this.client.read(this.abort.signal);this.current();if(version!==this.readVersion)return false;this.update({groups,loaded:true,readError:null});return true;}catch(error){if(version===this.readVersion)this.update({groups:[],loaded:false,readError:error instanceof AccountError?error.code:'unavailable'});return false;}}
 async preview(token:string):Promise<GroupPreview>{this.current();const result=await this.client.preview(token,this.abort.signal);this.current();return result;}
 private async save(intent:PendingGroupIntent){
  this.current();if(this.view.pending||this.view.invalidPending)throw new AccountError('group_pending');
  const valid=parsePendingGroupIntent(intent,this.owner);
  if(!this.workspace.dispatch({kind:'draft.save',key:GROUP_INTENT_KEY,value:valid})||!await this.workspace.whenSaved())throw new AccountError('storage');
  this.current();if(this.view.pending===null||intentId(this.view.pending)!==intentId(valid))throw new AccountError('group_pending');
 }
 private async clear(id:string|null){
  this.current();this.observe();
  if(id!==null&&(!this.view.pending||intentId(this.view.pending)!==id))throw new AccountError('group_pending');
  if(!this.workspace.dispatch({kind:'draft.clear',key:GROUP_INTENT_KEY})||!await this.workspace.whenSaved())throw new AccountError('storage');
  this.current();this.observe();if(this.view.pending||this.view.invalidPending)throw new AccountError('storage');
 }
 private async finish(receipt:GroupReceipt){
  this.current();this.update({receipt});
  try{const key=completedGroupDraft(this.workspace.getSnapshot().state,this.view.pending);if(key){if(!this.workspace.dispatch({kind:'draft.clear',key})||!await this.workspace.whenSaved())throw new AccountError('storage');this.current();}await this.clear(receipt.operationId);}catch{this.update({error:'cleanup_pending'});await this.refresh();return null;}
  this.joining=null;this.update({error:null});await this.refresh();this.current();return receipt;
 }
 async execute(command:Exclude<GroupCommand,{kind:'group.accept'}>,expectedRevision:number){
  if(this.view.busy)return null;this.update({busy:true,error:null,receipt:null});
  try{this.current();const operation=parseGroupOperation({accountId:this.owner,operationId:crypto.randomUUID(),issuedAt:Date.now(),expectedRevision,command});await this.save({type:'command',operation});return await this.finish(await this.client.apply(operation,this.abort.signal));}
  catch(error){await this.failed(error);return null;}finally{this.update({busy:false});}
 }
 async join(preview:GroupPreview,token:string,nickname:string){
  if(this.view.busy)return null;this.update({busy:true,error:null,receipt:null});
  try{this.current();const operation=parseGroupOperation({accountId:this.owner,operationId:crypto.randomUUID(),issuedAt:Date.now(),expectedRevision:0,command:{kind:'group.accept',token,nickname}});
   this.joining=operation;await this.save({type:'join',accountId:this.owner,operationId:operation.operationId,groupId:preview.id});
   const receipt=await this.client.apply(operation,this.abort.signal);if(receipt.groupId!==preview.id)throw new AccountError('unavailable');return await this.finish(receipt);
  }catch(error){await this.failed(error);return null;}finally{this.update({busy:false});}
 }
 async retry(){
  if(this.view.busy)return null;this.update({busy:true,error:null});
  try{this.current();this.observe();const pending=this.view.pending;if(!pending)throw new AccountError('invalid_pending');
   if(!await this.workspace.whenSaved())throw new AccountError('storage');this.current();
   if(!this.view.pending||intentId(this.view.pending)!==intentId(pending))throw new AccountError('group_pending');
   if(pending.type==='command')return await this.finish(await this.client.apply(pending.operation,this.abort.signal));
   if(this.joining?.operationId===pending.operationId)return await this.finish(await this.client.apply(this.joining,this.abort.signal));
   const receipt=await this.client.receipt(pending.operationId,this.abort.signal);this.current();
   if(!receipt)throw new AccountError('invitation_reopen');if(receipt.groupId!==pending.groupId)throw new AccountError('unavailable');return await this.finish(receipt);
  }catch(error){await this.failed(error);return null;}finally{this.update({busy:false});}
 }
 /** Explicit local abandonment never reverses an action already accepted by
  * the server, nor resubmits it with a different operation ID. */
 async discard(){
  if(this.view.busy)return false;this.update({busy:true,error:null});
  try{this.current();this.observe();const id=this.view.pending?intentId(this.view.pending):null;await this.clear(id);this.joining=null;this.update({receipt:null});await this.refresh();return true;}
  catch(error){await this.failed(error);return false;}finally{this.update({busy:false});}
 }
 close(){this.closed=true;this.abort.abort();this.unsubscribe();this.joining=null;this.listeners.clear();this.view={...this.view,groups:[],pending:null,receipt:null};}
}
