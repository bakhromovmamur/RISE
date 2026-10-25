import * as v from '../data/validation';
import {exact} from './personalCommands';
import {sharedId} from './sharedContent';
import type {GroupInvitation} from './groups';

export const GROUP_INVITATION_PAGE_SIZE=20;
export const groupInvitationCheck=exact({id:sharedId,expiresAt:v.instant,revoked:v.bool,consumed:v.bool});
const revision=v.number(1,2147483647,true);
export interface GroupInvitationQuery {groupId:string;cursor?:string;revision?:number}
export interface GroupInvitationPage {accountId:string;groupId:string;revision:number;rows:GroupInvitation[];next:string|null}
export function parseGroupInvitationQuery(value:unknown):GroupInvitationQuery {
 v.validateJson(value);exact({groupId:sharedId,cursor:v.optional(sharedId),revision:v.optional(revision)})(value,'group-invitations');
 const query=value as GroupInvitationQuery;
 if(query.cursor!==undefined&&query.revision===undefined)throw new v.StoredDataError('group-invitations.revision');
 return query;
}
export function parseGroupInvitationPage(value:unknown):GroupInvitationPage {
 v.validateJson(value);exact({accountId:sharedId,groupId:sharedId,revision,rows:v.array(groupInvitationCheck,GROUP_INVITATION_PAGE_SIZE),next:v.nullable(sharedId)})(value,'group-invitations-page');
 const page=value as GroupInvitationPage;
 if(new Set(page.rows.map(row=>row.id)).size!==page.rows.length||page.next!==null&&(page.rows.length!==GROUP_INVITATION_PAGE_SIZE||page.next!==page.rows.at(-1)?.id))throw new v.StoredDataError('group-invitations-page.rows');
 return page;
}
