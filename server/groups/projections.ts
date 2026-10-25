/** Known shared fields only. Both paged screens and portable archives use these
 * projections under the caller's existing membership RLS. */
const base="'id',r.id,'groupId',r.group_id,'revision',r.revision";
export const sharedProjection={
 tasks:`${base},'title',r.title,'notes',r.notes,'assignee',r.assigned_member_id,'date',to_char(r.date,'YYYY-MM-DD'),'time',r.time,'weekdays',r.weekdays,'archived',r.archived`,
 lists:`${base},'name',r.name,'archived',r.archived`,
 items:`${base},'listId',r.list_id,'text',r.text,'quantity',r.quantity,'checked',r.checked,'position',r.position`,
 occurrences:`'groupId',r.group_id,'taskId',r.task_id,'date',to_char(r.date,'YYYY-MM-DD'),'completed',r.completed,'byMemberId',r.completed_by,'at',case when r.completed_at is null then null else to_char(r.completed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,'revision',r.revision,
  'snapshot',jsonb_build_object('title',r.title,'notes',r.notes,'assignee',r.assigned_member_id,'time',r.time,'timezone',r.timezone,'taskRevision',r.task_revision)`,
};
// The supplied parameter is SQL owned by this module's callers, never user text.
export function squadProjection(actorParameter:string){return `
 'id',p.id,'groupId',p.group_id,'authorMemberId',p.author_member_id,'revision',p.revision,
 'publishedAt',to_char(p.published_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
 'updatedAt',to_char(p.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'snapshot',p.snapshot,
 'reactions',jsonb_build_object('count',(select count(*) from rise.squad_reactions r where r.group_id=g.id and r.post_id=p.id),
  'mine',exists(select 1 from rise.squad_reactions r join rise.memberships m on m.group_id=r.group_id and m.id=r.member_id
   where r.group_id=g.id and r.post_id=p.id and m.user_id=${actorParameter}))`;}
