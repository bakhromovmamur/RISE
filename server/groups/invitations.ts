import type pg from 'pg';
import {AuthError} from '../auth/sessions.ts';
import {StoredDataError} from '../../src/data/validation.ts';
import {GROUP_INVITATION_PAGE_SIZE,parseGroupInvitationQuery,type GroupInvitationPage} from '../../src/contracts/groupInvitations.ts';
import type {GroupInvitation} from '../../src/contracts/groups.ts';

/** The current owner, revision, anchor and bounded page share one statement
 * snapshot. A UUID cursor reads the stored timestamp, preserving microseconds. */
export async function readGroupInvitations(c:pg.PoolClient,actor:string,value:unknown):Promise<GroupInvitationPage>{
 let query;try{query=parseGroupInvitationQuery(value);}catch(error){if(error instanceof StoredDataError)throw new AuthError(422,'invalid_input');throw error;}
 const row=(await c.query<{revision:number;anchor:boolean;rows:GroupInvitation[]}>(`with permitted as (
  select id,revision from rise.groups where id=$1 and rise_private.group_access(id,true)
 ), anchor as (
  select id,expires_at from rise.group_invitations where group_id=$1 and id=$2
 ), page as (
  select i.id,i.expires_at,i.revoked_at,i.consumed_at from rise.group_invitations i
  where i.group_id=$1 and exists(select 1 from permitted)
  and ($2::uuid is null or (i.expires_at,i.id)<(select expires_at,id from anchor))
  order by i.expires_at desc,i.id desc limit $3
 ) select permitted.revision,($2::uuid is null or exists(select 1 from anchor)) as anchor,
 (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'expiresAt',to_char(p.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
 'revoked',p.revoked_at is not null,'consumed',p.consumed_at is not null) order by p.expires_at desc,p.id desc),'[]'::jsonb) from page p) as rows from permitted`,[query.groupId,query.cursor??null,GROUP_INVITATION_PAGE_SIZE+1])).rows[0];
 if(!row)throw new AuthError(404,'group_unavailable');
 if(!row.anchor||query.revision!==undefined&&row.revision!==query.revision)throw new AuthError(409,'group_changed');
 const rows=row.rows.slice(0,GROUP_INVITATION_PAGE_SIZE);
 return {accountId:actor,groupId:query.groupId,revision:row.revision,rows,next:row.rows.length>GROUP_INVITATION_PAGE_SIZE?rows.at(-1)!.id:null};
}
