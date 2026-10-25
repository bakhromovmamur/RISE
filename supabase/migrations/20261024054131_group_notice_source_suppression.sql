-- Restored membership/job rows never override either party's retained account
-- suppression. The existing guard may read only ledger owner IDs, not private
-- deletion/session metadata. Both dispatch and receive use this capability.
grant rise_group_guard to postgres;
create or replace function rise_private.group_notice_allowed(candidate uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select (select rise_private.active_session()) and exists(select 1 from rise.notification_jobs j
 join rise.groups g on g.id=j.group_id
 join rise.memberships recipient on recipient.group_id=j.group_id and recipient.id=j.member_id and recipient.user_id=j.user_id and recipient.status='active'
 join rise.memberships author on author.group_id=j.group_id and author.id=j.source_member_id and author.user_id=j.source_actor_id and author.status='active'
 join rise.group_preferences p on p.group_id=j.group_id and p.user_id=j.user_id
 join rise.push_subscriptions s on s.id=j.installation_id and s.user_id=j.user_id
 where j.id=candidate and j.user_id=(select rise_private.group_actor()) and not g.archived and not j.presentation_canceled
 and not exists(select 1 from rise_private.deletion_ledger d where d.user_id in(j.user_id,j.source_actor_id))
 and p.notifications and not p.muted and not rise_private.group_notice_quiet(g.timezone,p.quiet_start,p.quiet_end,clock_timestamp())
 and s.enabled and s.version=j.installation_version and s.provider_session_id=(current_setting('request.jwt.claims',true)::jsonb->>'session_id')::uuid
 and j.fire_at<=clock_timestamp() and j.expires_at>clock_timestamp()
 and ((j.task_id is not null and exists(select 1 from rise.family_tasks t where t.group_id=j.group_id and t.id=j.task_id and t.revision=j.source_revision and t.assigned_member_id=j.member_id and not t.archived))
 or (j.post_id is not null and exists(select 1 from rise.squad_posts p where p.group_id=j.group_id and p.id=j.post_id and p.revision=j.source_revision and p.status='published' and p.author_id=j.source_actor_id))));
$$;
revoke rise_group_guard from postgres;
