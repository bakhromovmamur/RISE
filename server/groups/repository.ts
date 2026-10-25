import {createHash,createHmac,hkdfSync,randomUUID} from 'node:crypto';
import type pg from 'pg';
import {parseGroupOperation,parseGroupPreviewRequest,type AccountGroup,type GroupKind,type GroupPreview,type GroupReceipt,type GroupOperation} from '../../src/contracts/groups.ts';
import {StoredDataError} from '../../src/data/validation.ts';
import {AuthError} from '../auth/sessions.ts';
import type {ServerConfig} from '../config.ts';
import {canonical} from '../personal/records.ts';
import {lock} from '../personal/repository.ts';
import {exact} from '../../src/contracts/personalCommands.ts';
import * as validation from '../../src/data/validation.ts';
import {uuid} from '../../src/contracts/accountCommands.ts';
import {isSharedCommand} from '../../src/contracts/sharedContent.ts';
import {isSquadCommand} from '../../src/contracts/squads.ts';
import {GROUP_INVITATION_PAGE_SIZE} from '../../src/contracts/groupInvitations.ts';

type Outcome<T>={value:T}|{failure:AuthError};
export function groupOutcome<T>(result:Outcome<T>):T {if('failure' in result)throw result.failure;return result.value;}
const errors:Record<string,number>={sign_in_required:401,group_unavailable:404,group_changed:409,group_archived:409,owner_required:403,recent_auth_required:403,
 ownership_resolution_required:409,member_unavailable:404,invitation_unavailable:404,invitation_limit:409,already_member:409,group_limit:409,revision_limit:409,invalid_input:422,
 shared_unavailable:404,shared_archived:409,shared_limit:409,occurrence_unavailable:409,
 squad_unavailable:404,squad_changed:409,squad_preview_expired:409,squad_preview_limit:409,squad_limit:409,author_required:403};
export function groupError(error:unknown):AuthError|null {
 if(error instanceof AuthError)return error;
 if(error instanceof StoredDataError)return new AuthError(422,'invalid_input');
 if(error&&typeof error==='object'&&'code' in error&&'message' in error){
  if(error.code==='P0001'&&typeof error.message==='string'&&Object.hasOwn(errors,error.message))return new AuthError(errors[error.message],error.message);
  if(error.code==='23505')return new AuthError(409,'operation_reused');
  if(['23514','23502','22P02','22007','22008'].includes(String(error.code)))return new AuthError(422,'invalid_input');
 }
 return null;
}
/** Roll back the action, but retain a charged invalid-invitation attempt. */
export async function groupAction<T>(c:pg.PoolClient,run:()=>Promise<T>):Promise<Outcome<T>>{
 await c.query('savepoint group_action');
 try{const value=await run();await c.query('release savepoint group_action');return {value};}
 catch(error){await c.query('rollback to savepoint group_action');await c.query('release savepoint group_action');const failure=groupError(error);if(!failure)throw error;return {failure};}
}
const digest=(value:string)=>createHash('sha256').update(value).digest();
/** Stable only for the same installation, key, actor and operation. No token is
 * stored in receipts. After key rotation, old shared links keep their hash/expiry;
 * a create retry cannot substitute a different token for the original link. */
export function groupInvitationToken(config:Pick<ServerConfig,'sessionKey'|'installationId'>,actor:string,operationId:string,groupId:string){
 const key=Buffer.from(hkdfSync('sha256',config.sessionKey,config.installationId,'rise-group-invitation-v1',32));
 return createHmac('sha256',key).update(`${actor}:${groupId}:${operationId}`).digest('base64url');
}
interface ReceiptRow {request_hash:Buffer;group_id:string;revision:number;kind:GroupOperation['command']['kind'];invitation_id:string|null;invitation_expires_at:Date|null}
async function receipt(c:pg.PoolClient,config:ServerConfig,actor:string,operation:GroupOperation,row:ReceiptRow):Promise<GroupReceipt>{
 const terminal=row.kind==='group.delete'||row.kind==='group.leave';
 if(!terminal&&!(await c.query('select rise_private.group_access($1,$2) as allowed',[row.group_id,row.kind==='group.invite'])).rows[0].allowed)throw new AuthError(404,'group_unavailable');
 const result:GroupReceipt={operationId:operation.operationId,groupId:row.group_id,revision:row.revision};
 if(row.kind==='group.invite'){
  if(!row.invitation_id||!row.invitation_expires_at)throw new Error('invalid_group_receipt');
  const token=groupInvitationToken(config,actor,operation.operationId,row.group_id);
  // After key rotation/expiry/revocation, a replay must not mint a replacement.
  const current=(await c.query('select id from rise_private.preview_group_invite($1)',[digest(token)])).rows[0];
  if(!current||current.id!==row.group_id)throw new AuthError(404,'invitation_unavailable');
  result.invitation={id:row.invitation_id,expiresAt:row.invitation_expires_at.toISOString(),link:`${config.origin}/#invite=${token}`};
 }
 return result;
}
export async function applyGroup(c:pg.PoolClient,config:ServerConfig,actor:string,value:unknown):Promise<Outcome<GroupReceipt>>{
 let op:GroupOperation;try{op=parseGroupOperation(value);}catch(error){const failure=groupError(error);if(failure)return {failure};throw error;}
 if(op.accountId!==actor)return {failure:new AuthError(403,'account_mismatch')};
 await lock(c,actor);
 const requestHash=digest(canonical(op));
 const prior=(await c.query<ReceiptRow>('select request_hash,group_id,revision,kind,invitation_id,invitation_expires_at from rise.group_receipts where user_id=$1 and id=$2',[actor,op.operationId])).rows[0];
 if(prior){
  if(!prior.request_hash.equals(requestHash))return {failure:new AuthError(409,'operation_reused')};
  return groupAction(c,()=>receipt(c,config,actor,op,prior));
 }
 const now=Number((await c.query('select floor(extract(epoch from now())*1000)::bigint as time')).rows[0].time);
 // A pruned operation cannot be silently recreated, including create/delete.
 if(op.issuedAt<now-7*86400000||op.issuedAt>now+300000)return {failure:new AuthError(409,'operation_expired')};
 const command=op.command,bucket=command.kind==='group.create'?'create':command.kind==='group.invite'?'invite':command.kind==='group.accept'?'lookup':'change';
 if(!(await c.query('select rise_private.group_rate($1) as allowed',[bucket])).rows[0].allowed)return {failure:new AuthError(429,'rate_limited',bucket==='create'?86400:3600)};
 return groupAction(c,async()=>{
  let groupId='groupId' in command?command.groupId:'',revision=0,invitationId:string|null=null,expires:Date|null=null;
  if(command.kind==='group.create'){
   revision=(await c.query('select rise_private.create_group($1,$2,$3,$4,$5,$6) as revision',[command.groupId,randomUUID(),command.groupKind,command.name,command.timezone,command.nickname])).rows[0].revision;
  }else if(command.kind==='group.accept'){
   const accepted=(await c.query<{group_id:string;revision:number}>('select * from rise_private.accept_group_invite($1,$2,$3)',[digest(command.token),randomUUID(),command.nickname])).rows[0];
   groupId=accepted.group_id;revision=accepted.revision;
  }else if(command.kind==='group.invite'){
   const token=groupInvitationToken(config,actor,op.operationId,groupId);
   const created=(await c.query<{revision:number;expires_at:Date}>('select * from rise_private.create_group_invite($1,$2,$3,$4)',[groupId,op.expectedRevision,op.operationId,digest(token)])).rows[0];
   revision=created.revision;invitationId=op.operationId;expires=created.expires_at;
  }else if(isSharedCommand(command)){
   revision=(await c.query('select rise_private.change_shared_content($1,$2,$3::jsonb) as revision',[groupId,op.expectedRevision,JSON.stringify(command)])).rows[0].revision;
  }else if(isSquadCommand(command)){
   revision=(await c.query('select rise_private.change_squad($1,$2,$3::jsonb) as revision',[groupId,op.expectedRevision,JSON.stringify(command)])).rows[0].revision;
  }else{
   const value='name' in command?command.name:'memberId' in command?command.memberId:'invitationId' in command?command.invitationId:null;
   revision=(await c.query('select rise_private.change_group($1,$2,$3,$4,$5,$6,$7) as revision',[groupId,op.expectedRevision,command.kind.slice(6),value,
    command.kind==='group.preferences'?command.muted:null,command.kind==='group.preferences'?command.quietStart:null,command.kind==='group.preferences'?command.quietEnd:null])).rows[0].revision;
  }
  const row:ReceiptRow={request_hash:requestHash,group_id:groupId,revision,kind:command.kind,invitation_id:invitationId,invitation_expires_at:expires};
  await c.query('insert into rise.group_receipts(user_id,id,request_hash,group_id,revision,kind,invitation_id,invitation_expires_at) values($1,$2,$3,$4,$5,$6,$7,$8)',[actor,op.operationId,requestHash,groupId,revision,command.kind,invitationId,expires]);
  if(command.kind==='task.create'||command.kind==='task.edit'||command.kind==='squad.publish'||command.kind==='group.preferences'&&command.notifications!==undefined){
   await c.query('select rise_private.group_notification_effect($1,$2,$3)',[op.operationId,'taskId' in command?command.taskId:'postId' in command?command.postId:null,command.kind==='group.preferences'?command.notifications:null]);
  }
  await c.query("delete from rise.group_receipts where user_id=$1 and id in(select id from rise.group_receipts where user_id=$1 and created_at<now()-interval '90 days' order by created_at,id limit 200)",[actor]);
  return receipt(c,config,actor,op,row);
 });
}
export async function previewGroup(c:pg.PoolClient,actor:string,value:unknown):Promise<Outcome<GroupPreview>>{
 let request;try{request=parseGroupPreviewRequest(value);}catch(error){const failure=groupError(error);if(failure)return {failure};throw error;}
 if(request.accountId!==actor)return {failure:new AuthError(403,'account_mismatch')};
 if(!(await c.query("select rise_private.group_rate('lookup') as allowed")).rows[0].allowed)return {failure:new AuthError(429,'rate_limited',3600)};
 const result=(await c.query<{id:string;name:string;kind:GroupKind;timezone:string;expires_at:Date}>('select * from rise_private.preview_group_invite($1)',[digest(request.token)])).rows[0];
 if(!result)return {failure:new AuthError(404,'invitation_unavailable')};
 return {value:{id:result.id,name:result.name,kind:result.kind,timezone:result.timezone,expiresAt:result.expires_at.toISOString()}};
}
/** Recovery after reload can acknowledge a join without storing its secret. */
export async function readGroupReceipt(c:pg.PoolClient,actor:string,value:unknown):Promise<GroupReceipt|null>{
 try{exact({accountId:validation.string(36),operationId:validation.string(36)})(value,'receipt');}catch{throw new AuthError(422,'invalid_input');}
 const input=validation.object(value,'receipt');if(!uuid(input.accountId)||!uuid(input.operationId))throw new AuthError(422,'invalid_input');
 if(input.accountId!==actor)throw new AuthError(403,'account_mismatch');
 const row=(await c.query<ReceiptRow>('select request_hash,group_id,revision,kind,invitation_id,invitation_expires_at from rise.group_receipts where user_id=$1 and id=$2',[actor,input.operationId])).rows[0];
 if(!row)return null;
 if(!['group.leave','group.delete'].includes(row.kind)&&!(await c.query('select rise_private.group_access($1) as allowed',[row.group_id])).rows[0].allowed)throw new AuthError(404,'group_unavailable');
 return {operationId:input.operationId,groupId:row.group_id,revision:row.revision};
}
/** One statement snapshot prevents a mixed membership/ownership view. Field
 * projections include only shared nicknames and the caller's own preferences. */
export async function readGroups(c:pg.PoolClient,actor:string):Promise<{accountId:string;groups:AccountGroup[]}>{
 const result=await c.query<{group:AccountGroup}>(`select jsonb_build_object('id',g.id,'kind',g.kind,'name',g.name,'timezone',g.timezone,'revision',g.revision,'archived',g.archived,
 'members',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',m.display_name,'role',case when m.user_id=g.owner_id then 'owner' else 'member' end,'self',m.user_id=$1) order by m.joined_at,m.id),'[]'::jsonb) from rise.memberships m where m.group_id=g.id),
 'preferences',(select jsonb_build_object('muted',p.muted,'quietStart',p.quiet_start,'quietEnd',p.quiet_end,'notifications',p.notifications) from rise.group_preferences p where p.group_id=g.id and p.user_id=$1),
 'invitations',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'expiresAt',to_char(i.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'revoked',i.revoked_at is not null,'consumed',i.consumed_at is not null) order by i.expires_at desc,i.id desc),'[]'::jsonb) from (select id,expires_at,revoked_at,consumed_at from rise.group_invitations where group_id=g.id order by expires_at desc,id desc limit $2) i)) as "group"
 from rise.groups g where g.id in(select group_id from rise.memberships where user_id=$1 and status='active') order by g.created_at,g.id`,[actor,GROUP_INVITATION_PAGE_SIZE+1]);
 return {accountId:actor,groups:result.rows.map(({group})=>({...group,invitations:group.invitations.slice(0,GROUP_INVITATION_PAGE_SIZE),invitationNext:group.invitations.length>GROUP_INVITATION_PAGE_SIZE?group.invitations[GROUP_INVITATION_PAGE_SIZE-1].id:null}))};
}
