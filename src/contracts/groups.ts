import * as v from '../data/validation';
import {exact} from './personalCommands';
import {uuid} from './accountCommands';
import {sharedValidators,type SharedCommand} from './sharedContent';
import {squadValidators,type SquadCommand} from './squads';
import {GROUP_INVITATION_PAGE_SIZE,groupInvitationCheck} from './groupInvitations';

export type GroupKind = 'family'|'squad';
export type GroupCommand = SharedCommand | SquadCommand
 | {kind:'group.create';groupId:string;groupKind:GroupKind;name:string;timezone:string;nickname:string}
 | {kind:'group.rename';groupId:string;name:string}
 | {kind:'group.archive'|'group.restore'|'group.leave'|'group.delete'|'group.invite';groupId:string}
 | {kind:'group.transfer'|'group.remove';groupId:string;memberId:string}
 | {kind:'group.revoke';groupId:string;invitationId:string}
 | {kind:'group.preferences';groupId:string;muted:boolean;quietStart:string;quietEnd:string;notifications?:boolean}
 | {kind:'group.accept';token:string;nickname:string};
export interface GroupOperation {accountId:string;operationId:string;issuedAt:number;expectedRevision:number;command:GroupCommand}
export interface GroupReceipt {operationId:string;groupId:string;revision:number;invitation?:{id:string;expiresAt:string;link:string}}
export interface GroupMember {id:string;name:string;role:'owner'|'member';self:boolean}
export interface GroupInvitation {id:string;expiresAt:string;revoked:boolean;consumed:boolean}
export interface AccountGroup {
 id:string;kind:GroupKind;name:string;timezone:string;revision:number;archived:boolean;
 members:GroupMember[];preferences:{muted:boolean;quietStart:string;quietEnd:string;notifications?:boolean};invitations:GroupInvitation[];invitationNext?:string|null;
}
export interface GroupPreview {id:string;name:string;kind:GroupKind;timezone:string;expiresAt:string}
export type PendingGroupIntent={type:'command';operation:GroupOperation}|{type:'join';accountId:string;operationId:string;groupId:string};
const identifier:v.Check=(x,p)=>{if(!uuid(x))throw new v.StoredDataError(p);};
export const groupLabelCheck:v.Check=(x,p)=>{v.string(80)(x,p);if(typeof x!=='string'||!x.trim()||[...x].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127))throw new v.StoredDataError(p);};
export const invitationToken:v.Check=v.string(64,/^[a-zA-Z0-9_-]{43}$/);
const validators:Record<GroupCommand['kind'],Record<string,v.Check>>={
 ...sharedValidators,
 ...squadValidators,
 'group.create':{groupId:identifier,groupKind:v.oneOf('family','squad'),name:groupLabelCheck,timezone:v.zone,nickname:groupLabelCheck},
 'group.rename':{groupId:identifier,name:groupLabelCheck},
 'group.archive':{groupId:identifier},'group.restore':{groupId:identifier},'group.leave':{groupId:identifier},'group.delete':{groupId:identifier},'group.invite':{groupId:identifier},
 'group.transfer':{groupId:identifier,memberId:identifier},'group.remove':{groupId:identifier,memberId:identifier},
 'group.revoke':{groupId:identifier,invitationId:identifier},
 'group.preferences':{groupId:identifier,muted:v.bool,quietStart:v.clock,quietEnd:v.clock,notifications:v.optional(v.bool)},
 'group.accept':{token:invitationToken,nickname:groupLabelCheck},
};
export function parseGroupOperation(value:unknown):GroupOperation {
 v.validateJson(value);
 exact({accountId:identifier,operationId:identifier,issuedAt:v.number(0,8640000000000000,true),expectedRevision:v.number(0,2147483646,true),command:v.validateJson})(value,'group-operation');
 const row=v.object(value,'group-operation'),command=v.object(row.command,'group-command');
 if(typeof command.kind!=='string'||!Object.hasOwn(validators,command.kind))throw new v.StoredDataError('group-command.kind');
 exact({kind:v.oneOf(command.kind),...validators[command.kind as GroupCommand['kind']]})(command,'group-command');
 if((command.kind==='group.create'||command.kind==='group.accept')&&row.expectedRevision!==0)throw new v.StoredDataError('group-operation.expectedRevision');
 // All fields and discriminants are checked above; never accept owner/role/private-profile fields.
 return {accountId:String(row.accountId),operationId:String(row.operationId),issuedAt:Number(row.issuedAt),expectedRevision:Number(row.expectedRevision),command:command as unknown as GroupCommand};
}
export function parseGroupPreviewRequest(value:unknown):{accountId:string;token:string}{
 exact({accountId:identifier,token:invitationToken})(value,'group-preview');
 const row=v.object(value,'group-preview');return {accountId:String(row.accountId),token:String(row.token)};
}
const revision=v.number(1,2147483647,true);
export const groupMemberCheck=exact({id:identifier,name:groupLabelCheck,role:v.oneOf('owner','member'),self:v.bool});
const group=exact({id:identifier,kind:v.oneOf('family','squad'),name:groupLabelCheck,timezone:v.zone,revision,archived:v.bool,
 members:v.array(groupMemberCheck,500),preferences:exact({muted:v.bool,quietStart:v.clock,quietEnd:v.clock,notifications:v.optional(v.bool)}),invitations:v.array(groupInvitationCheck,GROUP_INVITATION_PAGE_SIZE),invitationNext:v.optional(v.nullable(identifier))});
export function parseGroups(value:unknown):{accountId:string;groups:AccountGroup[]}{
 exact({accountId:identifier,groups:v.array(group,500)})(value,'groups');
 const row=value as {accountId:string;groups:AccountGroup[]};
 if(new Set(row.groups.map(g=>g.id)).size!==row.groups.length||row.groups.some(g=>g.members.filter(m=>m.role==='owner').length!==1||g.members.filter(m=>m.self).length!==1||new Set(g.members.map(m=>m.id)).size!==g.members.length))throw new v.StoredDataError('groups.members');
 if(row.groups.some(g=>new Set(g.invitations.map(i=>i.id)).size!==g.invitations.length||g.invitationNext!=null&&(g.invitations.length!==GROUP_INVITATION_PAGE_SIZE||g.invitationNext!==g.invitations.at(-1)?.id)||!g.members.some(m=>m.self&&m.role==='owner')&&(g.invitations.length>0||g.invitationNext!=null)))throw new v.StoredDataError('groups.invitations');
 return row;
}
export function parseGroupPreview(value:unknown):GroupPreview{
 exact({id:identifier,name:groupLabelCheck,kind:v.oneOf('family','squad'),timezone:v.zone,expiresAt:v.instant})(value,'group-preview');return value as GroupPreview;
}
export function parseGroupReceipt(value:unknown,origin:string):GroupReceipt{
 exact({operationId:identifier,groupId:identifier,revision,invitation:v.optional(exact({id:identifier,expiresAt:v.instant,link:v.string(400)}))})(value,'group-receipt');
 const result=value as GroupReceipt;
 if(result.invitation){const url=new URL(result.invitation.link);if(url.origin!==origin||url.pathname!=='/'||url.search||!/^#invite=[\w-]{43}$/.test(url.hash))throw new v.StoredDataError('group-receipt.invitation');}
 return result;
}
export function parsePendingGroupIntent(value:unknown,owner:string):PendingGroupIntent{
 const row=v.object(value,'pending-group');
 if(row.type==='command'){
  exact({type:v.oneOf('command'),operation:v.validateJson})(value,'pending-group');const operation=parseGroupOperation(row.operation);
  if(operation.accountId!==owner||operation.command.kind==='group.accept')throw new v.StoredDataError('pending-group');
  return {type:'command',operation};
 }
 exact({type:v.oneOf('join'),accountId:identifier,operationId:identifier,groupId:identifier})(value,'pending-group');
 if(row.accountId!==owner)throw new v.StoredDataError('pending-group.owner');return row as unknown as PendingGroupIntent;
}
