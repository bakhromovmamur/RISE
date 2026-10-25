import {accountApi} from '../auth/client';
import type {AccountSession} from '../contracts/auth';
import {parseGroups,parseGroupPreview,parseGroupReceipt,type GroupOperation,type AccountGroup} from '../contracts/groups';
import {AccountError} from '../auth/client';
import {parseSharedPage,parseSharedQuery,type SharedQuery} from '../contracts/sharedContent';
import {parseSquadPage,parseSquadQuery,parseSquadPreviewRequest,parseSquadPreview,type SquadQuery,type SquadPreviewRequest} from '../contracts/squads';
import {parseGroupInvitationPage,parseGroupInvitationQuery,type GroupInvitationQuery} from '../contracts/groupInvitations';
import {runGroupArchive} from './archiveWorker';
export class GroupClient {
 constructor(readonly owner:string,private identity:()=>AccountSession|null,private origin=location.origin){}
 private current(){const session=this.identity();if(session?.account?.id!==this.owner)throw new AccountError('account_changed');return session;}
 async archive(group:AccountGroup,signal:AbortSignal){
  const identity=this.current(),member=group.members.find(m=>m.self);if(!member)throw new AccountError('group_unavailable');
  const raw=await runGroupArchive({accountId:this.owner,groupId:group.id,revision:group.revision,memberId:member.id,csrf:identity.csrfToken},signal);this.current();return raw;
 }
 async read(signal?:AbortSignal){this.current();const result=parseGroups(await accountApi('groups',{signal}));this.current();if(result.accountId!==this.owner)throw new AccountError('account_changed');return result.groups;}
 async invitations(value:GroupInvitationQuery,signal?:AbortSignal){
  this.current();const query=parseGroupInvitationQuery(value),{groupId,...parameters}=query;
  const search=new URLSearchParams(Object.entries(parameters).map<[string,string]>(([key,value])=>[key,String(value)]));
  const page=parseGroupInvitationPage(await accountApi(`groups/${groupId}/invitations?${search}`,{signal}));this.current();
  if(page.accountId!==this.owner||page.groupId!==groupId||query.revision!==undefined&&page.revision!==query.revision)throw new AccountError('unavailable');return page;
 }
 async content(value:SharedQuery,signal?:AbortSignal){
  this.current();const query=parseSharedQuery(value),{groupId,...parameters}=query;
  const search=new URLSearchParams(Object.entries(parameters).map<[string,string]>(([key,value])=>[key,String(value)]));
  const page=parseSharedPage(await accountApi(`groups/${groupId}/content?${search}`,{signal}));this.current();
  if(page.accountId!==this.owner||page.groupId!==groupId||page.collection!==query.collection||query.revision!==undefined&&page.revision!==query.revision
   ||page.rows.some(row=>query.parentId!==undefined&&('listId'in row?row.listId:'taskId'in row?row.taskId:null)!==query.parentId||query.date!==undefined&&('date'in row?row.date:null)!==query.date))throw new AccountError('unavailable');
  return page;
 }
 async preview(token:string,signal?:AbortSignal){const session=this.current();const result=parseGroupPreview(await accountApi('groups/invitations/preview',{body:{accountId:this.owner,token},csrf:session.csrfToken,signal}));this.current();return result;}
 async squad(value:SquadQuery,signal?:AbortSignal){
  this.current();const query=parseSquadQuery(value),{groupId,...parameters}=query;
  const search=new URLSearchParams(Object.entries(parameters).map<[string,string]>(([key,value])=>[key,String(value)]));
  const page=parseSquadPage(await accountApi(`squads/${groupId}?${search}`,{signal}));this.current();
  if(page.accountId!==this.owner||page.groupId!==groupId||page.week!==query.week||query.revision!==undefined&&page.revision!==query.revision
   ||query.authorMemberId!==undefined&&page.rows.some(row=>row.authorMemberId!==query.authorMemberId))throw new AccountError('unavailable');
  return page;
 }
 async squadPreview(value:Omit<SquadPreviewRequest,'accountId'>,signal?:AbortSignal){
  const session=this.current(),input=parseSquadPreviewRequest({...value,accountId:this.owner});
  const result=parseSquadPreview(await accountApi('squads/preview',{body:input,csrf:session.csrfToken,signal}));this.current();
  if(result.accountId!==this.owner||result.groupId!==input.groupId||result.postId!==input.postId||result.groupRevision!==input.groupRevision||result.postRevision!==input.postRevision||result.sourceRevision!==input.personalRevision
   ||result.snapshot.week!==input.week||result.snapshot.note!==input.note.trim()||(['habits','milestones','prayers'] as const).some(key=>input.choices[key]!==(result.snapshot[key]!==undefined)))throw new AccountError('unavailable');
  return result;
 }
 async apply(operation:GroupOperation,signal?:AbortSignal){const session=this.current();if(operation.accountId!==this.owner)throw new AccountError('account_changed');const result=parseGroupReceipt(await accountApi('groups/commands',{body:operation,csrf:session.csrfToken,signal}),this.origin);this.current();if(result.operationId!==operation.operationId||'groupId' in operation.command&&result.groupId!==operation.command.groupId)throw new AccountError('unavailable');return result;}
 async receipt(operationId:string,signal?:AbortSignal){const session=this.current();const value=await accountApi('groups/receipt',{body:{accountId:this.owner,operationId},csrf:session.csrfToken,signal});this.current();
  if(value===null)return null;const result=parseGroupReceipt(value,this.origin);if(result.operationId!==operationId||result.invitation)throw new AccountError('unavailable');return result;
 }
}
