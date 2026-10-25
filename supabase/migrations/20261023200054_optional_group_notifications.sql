-- GROUP-04: optional generic group notices, separate from device push consent.
alter table rise.group_preferences add column notifications boolean not null default false;
create table rise.notification_jobs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 source_actor_id uuid not null references auth.users(id) on delete cascade,
 group_id uuid not null references rise.groups(id) on delete cascade,
 member_id uuid not null,source_member_id uuid not null,
 task_id uuid,post_id uuid,source_revision integer not null check(source_revision>0),
 operation_id uuid not null,installation_id uuid not null,installation_version integer not null check(installation_version>0),
 fire_at timestamptz not null,expires_at timestamptz not null,
 status text not null default 'queued' check(status in ('queued','leased','accepted','canceled','expired','failed','retired')),
 presentation_canceled boolean not null default false,attempts integer not null default 0 check(attempts between 0 and 5),
 lease_token uuid,lease_until timestamptz,next_attempt_at timestamptz not null default clock_timestamp(),completed_at timestamptz,
 foreign key(user_id,installation_id) references rise.push_subscriptions(user_id,id) on delete cascade,
 foreign key(group_id,member_id) references rise.memberships(group_id,id) on delete cascade,
 foreign key(group_id,source_member_id) references rise.memberships(group_id,id) on delete cascade,
 foreign key(group_id,task_id) references rise.family_tasks(group_id,id) on delete cascade,
 foreign key(group_id,post_id) references rise.squad_posts(group_id,id) on delete cascade,
 unique(source_actor_id,operation_id,installation_id),
 check(num_nonnulls(task_id,post_id)=1),check(user_id<>source_actor_id),
 check(fire_at=date_trunc('milliseconds',fire_at) and expires_at=fire_at+interval '2 minutes'),
 check((status='leased' and lease_token is not null and lease_until is not null) or (status<>'leased' and lease_token is null and lease_until is null))
);
create index notification_jobs_due on rise.notification_jobs(next_attempt_at,id) where status in ('queued','leased');
create index notification_jobs_expiry on rise.notification_jobs(expires_at,id);
create index notification_jobs_owner on rise.notification_jobs(user_id,fire_at,id);
create index notification_jobs_source_actor on rise.notification_jobs(source_actor_id,fire_at,operation_id);
create index notification_jobs_group on rise.notification_jobs(group_id,id);
create index notification_jobs_member on rise.notification_jobs(group_id,member_id);
create index notification_jobs_source_member on rise.notification_jobs(group_id,source_member_id);
create index notification_jobs_task on rise.notification_jobs(group_id,task_id);
create index notification_jobs_post on rise.notification_jobs(group_id,post_id);
create index notification_jobs_installation on rise.notification_jobs(user_id,installation_id);
create table rise_private.group_notification_limits (
 singleton boolean primary key default true check(singleton),
 per_recipient_hour integer not null default 30 check(per_recipient_hour between 1 and 1000),
 per_actor_hour integer not null default 100 check(per_actor_hour between 1 and 5000),
 per_operation integer not null default 500 check(per_operation between 1 and 2500),
 retained_per_recipient integer not null default 1000 check(retained_per_recipient between 1 and 100000),
 retained_per_group integer not null default 10000 check(retained_per_group between 1 and 100000),
 retained_global integer not null default 100000 check(retained_global between 1 and 1000000)
);
insert into rise_private.group_notification_limits default values;
alter table rise.notification_jobs enable row level security;
alter table rise.notification_jobs force row level security;
alter table rise_private.group_notification_limits enable row level security;
alter table rise_private.group_notification_limits force row level security;
revoke all on rise.notification_jobs,rise_private.group_notification_limits from public,anon,authenticated,service_role,rise_bff,rise_worker,rise_lifecycle;
grant select,insert,update,delete on rise.notification_jobs to rise_group_guard;
grant select on rise_private.group_notification_limits to rise_group_guard;
create policy notification_guard on rise.notification_jobs for all to rise_group_guard using(true) with check(true);
create policy notification_limits_guard on rise_private.group_notification_limits for select to rise_group_guard using(true);
grant select(id,user_id,group_id,installation_id,installation_version,fire_at,expires_at,status,presentation_canceled,attempts,lease_token,lease_until,next_attempt_at,completed_at) on rise.notification_jobs to rise_worker;
grant update(status,attempts,lease_token,lease_until,next_attempt_at,completed_at),delete on rise.notification_jobs to rise_worker;
create policy notification_worker_read on rise.notification_jobs for select to rise_worker using(true);
create policy notification_worker_update on rise.notification_jobs for update to rise_worker using(true) with check(true);
create policy notification_worker_cleanup on rise.notification_jobs for delete to rise_worker using(expires_at<now()-interval '1 day');
-- The shared guard receives subscription authority only, never its encrypted
-- endpoint, language choice, private journey or managed-provider credentials.
grant select(id,user_id,installation_hash,provider_session_id,enabled,version) on rise.push_subscriptions to rise_group_guard;
create policy subscriptions_group_notice on rise.push_subscriptions for select to rise_group_guard using(true);

grant select(user_id,id,group_id,revision,kind,created_at) on rise.group_receipts to rise_group_guard;
create policy receipt_group_notice on rise.group_receipts for select to rise_group_guard using(user_id=(select rise_private.group_actor()) and (select rise_private.active_session()));
grant rise_group_guard to postgres;
create function rise_private.group_notice_quiet(zone text,start_time text,end_time text,at_time timestamptz) returns boolean
language sql stable security invoker set search_path='' as $$
 select case when start_time=end_time then false when start_time<end_time then minute>=start_time and minute<end_time
 else minute>=start_time or minute<end_time end from (select to_char(at_time at time zone zone,'HH24:MI') as minute) x;
$$;

-- The accepted content and receipt exist in this same actor/group transaction.
-- Omitted legacy consent is preserved. Capacity suppresses optional notices;
-- it never rolls back an otherwise accepted family task or squad publication.
create function rise_private.group_notification_effect(operation uuid,source uuid,consent boolean) returns integer
language plpgsql security definer set search_path='' as $$
declare actor uuid:=rise_private.group_actor();r rise.group_receipts;g rise.groups;sender uuid;assignee uuid;task uuid;post uuid;
 limits rise_private.group_notification_limits;candidate record;total bigint;group_total bigint;inserted integer:=0;at_time timestamptz:=date_trunc('milliseconds',clock_timestamp());
begin
 if not rise_private.active_session() then raise exception using errcode='P0001',message='sign_in_required';end if;
 perform pg_advisory_xact_lock(hashtextextended('rise-personal:'||actor::text,0));
 select user_id,id,group_id,revision,kind,created_at into r.user_id,r.id,r.group_id,r.revision,r.kind,r.created_at from rise.group_receipts where user_id=actor and id=operation and created_at=now();
 if not found then raise exception using errcode='P0001',message='invalid_input';end if;
 select * into g from rise.groups where id=r.group_id for update;
 if not found or not rise_private.group_access(g.id) then raise exception using errcode='P0001',message='group_unavailable';end if;
 if g.revision<>r.revision then raise exception using errcode='P0001',message='group_changed';end if;
 if r.kind='group.preferences' then
  if source is not null then raise exception using errcode='P0001',message='invalid_input';end if;
  if consent is not null then update rise.group_preferences set notifications=consent where group_id=g.id and user_id=actor;end if;
  return 0;
 end if;
 if g.archived then raise exception using errcode='P0001',message='group_archived';end if;
 if consent is not null or source is null then raise exception using errcode='P0001',message='invalid_input';end if;
 if r.kind in ('task.create','task.edit') and g.kind='family' then
  select id,assigned_member_id into task,assignee from rise.family_tasks where group_id=g.id and id=source and revision=r.revision and not archived;
  if not found then raise exception using errcode='P0001',message='shared_unavailable';end if;
  if assignee is null then return 0;end if;
 elsif r.kind='squad.publish' and g.kind='squad' then
  select id into post from rise.squad_posts where group_id=g.id and id=source and author_id=actor and revision=r.revision and status='published';
  if not found then raise exception using errcode='P0001',message='squad_unavailable';end if;
 else raise exception using errcode='P0001',message='invalid_input';end if;
 select id into strict sender from rise.memberships where group_id=g.id and user_id=actor and status='active';
 -- No recipient actor lock is acquired while holding a group. Only enqueuers
 -- share this short capacity lock; dispatch and cleanup never acquire it.
 perform pg_advisory_xact_lock(hashtextextended('rise-group-notice-capacity',0));
 select * into strict limits from rise_private.group_notification_limits;
 if (select count(distinct operation_id) from rise.notification_jobs where source_actor_id=actor and fire_at>at_time-interval '1 hour')>=limits.per_actor_hour then return 0;end if;
 select count(*) into total from rise.notification_jobs;
 select count(*) into group_total from rise.notification_jobs where group_id=g.id;
 for candidate in select m.id as member_id,m.user_id,s.id as installation_id,s.version from rise.memberships m
 join rise.group_preferences p on p.group_id=m.group_id and p.user_id=m.user_id
 join rise.push_subscriptions s on s.user_id=m.user_id
 where m.group_id=g.id and m.status='active' and m.user_id<>actor and (task is null or m.id=assignee)
 and p.notifications and not p.muted and not rise_private.group_notice_quiet(g.timezone,p.quiet_start,p.quiet_end,at_time) and s.enabled
 order by m.id,s.id loop
  exit when inserted>=limits.per_operation or total>=limits.retained_global or group_total>=limits.retained_per_group;
  if (select count(*) from rise.notification_jobs where user_id=candidate.user_id and fire_at>at_time-interval '1 hour')>=limits.per_recipient_hour
  or (select count(*) from rise.notification_jobs where user_id=candidate.user_id)>=limits.retained_per_recipient then continue;end if;
  insert into rise.notification_jobs(user_id,source_actor_id,group_id,member_id,source_member_id,task_id,post_id,source_revision,operation_id,installation_id,installation_version,fire_at,expires_at)
   values(candidate.user_id,actor,g.id,candidate.member_id,sender,task,post,r.revision,operation,candidate.installation_id,candidate.version,at_time,at_time+interval '2 minutes')
   on conflict(source_actor_id,operation_id,installation_id) do nothing;
  if found then inserted:=inserted+1;total:=total+1;group_total:=group_total+1;end if;
 end loop;
 return inserted;
end;$$;

-- Current session, membership, opt-in, source and installation authority. This
-- boolean capability cannot return any shared text or private journey fields.
create function rise_private.group_notice_allowed(candidate uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select (select rise_private.active_session()) and exists(select 1 from rise.notification_jobs j
 join rise.groups g on g.id=j.group_id
 join rise.memberships recipient on recipient.group_id=j.group_id and recipient.id=j.member_id and recipient.user_id=j.user_id and recipient.status='active'
 join rise.memberships author on author.group_id=j.group_id and author.id=j.source_member_id and author.user_id=j.source_actor_id and author.status='active'
 join rise.group_preferences p on p.group_id=j.group_id and p.user_id=j.user_id
 join rise.push_subscriptions s on s.id=j.installation_id and s.user_id=j.user_id
 where j.id=candidate and j.user_id=(select rise_private.group_actor()) and not g.archived and not j.presentation_canceled
 and p.notifications and not p.muted and not rise_private.group_notice_quiet(g.timezone,p.quiet_start,p.quiet_end,clock_timestamp())
 and s.enabled and s.version=j.installation_version and s.provider_session_id=(current_setting('request.jwt.claims',true)::jsonb->>'session_id')::uuid
 and j.fire_at<=clock_timestamp() and j.expires_at>clock_timestamp()
 and ((j.task_id is not null and exists(select 1 from rise.family_tasks t where t.group_id=j.group_id and t.id=j.task_id and t.revision=j.source_revision and t.assigned_member_id=j.member_id and not t.archived))
 or (j.post_id is not null and exists(select 1 from rise.squad_posts p where p.group_id=j.group_id and p.id=j.post_id and p.revision=j.source_revision and p.status='published' and p.author_id=j.source_actor_id))));
$$;

-- Worker holds the recipient actor lock before calling. Group precedes the job
-- lock, matching every shared mutation. Locks survive until provider submission
-- and its acceptance status commit in the surrounding worker transaction.
create function rise_private.lock_group_notice(candidate uuid,recipient uuid,token uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare target uuid;j rise.notification_jobs;s rise.push_subscriptions;
begin
 if candidate is null or recipient is null or token is null then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended('rise-personal:'||recipient::text,0));
 select group_id into target from rise.notification_jobs where id=candidate and user_id=recipient;
 if not found then return false;end if;
 perform 1 from rise.groups where id=target for update;
 select * into j from rise.notification_jobs where id=candidate and user_id=recipient and status='leased' and lease_token=token and lease_until>clock_timestamp() for update;
 if not found then return false;end if;
 select id,user_id,provider_session_id into s.id,s.user_id,s.provider_session_id from rise.push_subscriptions where id=j.installation_id and user_id=j.user_id;
 if not found then return false;end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',s.user_id,'session_id',s.provider_session_id)::text,true);
 return rise_private.group_notice_allowed(candidate);
end;$$;

create function rise_private.receive_group_notice(candidate uuid,installation uuid,generation integer,at_time timestamptz,expiry timestamptz,installation_digest bytea) returns boolean
language sql stable security definer set search_path='' as $$
 select rise_private.group_notice_allowed(candidate) and exists(select 1 from rise.notification_jobs j
 join rise.push_subscriptions s on s.user_id=j.user_id and s.id=j.installation_id
 where j.id=candidate and j.user_id=(select rise_private.group_actor()) and j.installation_id=installation and j.installation_version=generation
 and j.fire_at=at_time and j.expires_at=expiry and j.status in ('leased','accepted') and s.installation_hash=installation_digest);
$$;

-- A provider acceptance remains an acceptance. Later changes revoke permission
-- to present it, while queued/leased work is canceled in the mutation transaction.
create function rise_private.cancel_group_notices() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='groups' then
  update rise.notification_jobs set presentation_canceled=true,status=case when status='accepted' then status else 'canceled' end,lease_token=null,lease_until=null,completed_at=coalesce(completed_at,clock_timestamp())
   where group_id=new.id and not presentation_canceled and status in ('queued','leased','accepted');
 elsif tg_table_name='memberships' then
  update rise.notification_jobs set presentation_canceled=true,status=case when status='accepted' then status else 'canceled' end,lease_token=null,lease_until=null,completed_at=coalesce(completed_at,clock_timestamp())
   where group_id=old.group_id and (member_id=old.id or source_member_id=old.id) and not presentation_canceled and status in ('queued','leased','accepted');
 elsif tg_table_name='group_preferences' then
  update rise.notification_jobs set presentation_canceled=true,status=case when status='accepted' then status else 'canceled' end,lease_token=null,lease_until=null,completed_at=coalesce(completed_at,clock_timestamp())
   where group_id=old.group_id and user_id=old.user_id and not presentation_canceled and status in ('queued','leased','accepted');
 elsif tg_table_name='family_tasks' then
  update rise.notification_jobs set presentation_canceled=true,status=case when status='accepted' then status else 'canceled' end,lease_token=null,lease_until=null,completed_at=coalesce(completed_at,clock_timestamp())
   where group_id=old.group_id and task_id=old.id and not presentation_canceled and status in ('queued','leased','accepted');
 elsif tg_table_name='squad_posts' then
  update rise.notification_jobs set presentation_canceled=true,status=case when status='accepted' then status else 'canceled' end,lease_token=null,lease_until=null,completed_at=coalesce(completed_at,clock_timestamp())
   where group_id=old.group_id and post_id=old.id and not presentation_canceled and status in ('queued','leased','accepted');
 elsif tg_table_name='push_subscriptions' then
  update rise.notification_jobs set presentation_canceled=true,status=case when status='accepted' then status else 'canceled' end,lease_token=null,lease_until=null,completed_at=coalesce(completed_at,clock_timestamp())
   where user_id=old.user_id and installation_id=old.id and not presentation_canceled and status in ('queued','leased','accepted');
 end if;
 return null;
end;$$;
create trigger group_notices_archive after update of archived on rise.groups for each row when(new.archived and not old.archived) execute function rise_private.cancel_group_notices();
create trigger group_notices_membership after update of status,user_id on rise.memberships for each row when((old.status,old.user_id) is distinct from (new.status,new.user_id)) execute function rise_private.cancel_group_notices();
create trigger group_notices_preferences after update of muted,quiet_start,quiet_end,notifications on rise.group_preferences for each row when((old.muted,old.quiet_start,old.quiet_end,old.notifications) is distinct from (new.muted,new.quiet_start,new.quiet_end,new.notifications)) execute function rise_private.cancel_group_notices();
create trigger group_notices_task after update of revision,archived on rise.family_tasks for each row when((old.revision,old.archived) is distinct from (new.revision,new.archived)) execute function rise_private.cancel_group_notices();
create trigger group_notices_post after update of revision,status on rise.squad_posts for each row when((old.revision,old.status) is distinct from (new.revision,new.status)) execute function rise_private.cancel_group_notices();
create trigger group_notices_subscription after update of enabled,version on rise.push_subscriptions for each row when((old.enabled,old.version) is distinct from (new.enabled,new.version)) execute function rise_private.cancel_group_notices();

-- Called only by the two existing authorized lifecycle functions after their
-- actor and sorted group locks. There is no independent browser cleanup API.
create function rise_private.erase_group_notifications(subject uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not (subject=rise_private.group_actor() and rise_private.active_session())
 and not exists(select 1 from rise_private.deletion_ledger where user_id=subject) then raise exception using errcode='42501',message='suppression_required';end if;
 delete from rise.notification_jobs where user_id=subject or source_actor_id=subject;
end;$$;

create or replace function rise_private.prepare_group_deletion() returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=rise_private.group_actor();g rise.groups;
begin
 if not rise_private.active_session() then raise exception using errcode='P0001',message='sign_in_required';end if;
 perform pg_advisory_xact_lock(hashtextextended('rise-personal:'||actor::text,0));
 for g in select gr.* from rise.groups gr where exists(select 1 from rise.memberships m where m.group_id=gr.id and m.user_id=actor)
 or exists(select 1 from rise.squad_posts p where p.group_id=gr.id and p.author_id=actor)
 or exists(select 1 from rise.squad_reactions r where r.group_id=gr.id and r.user_id=actor)
 or exists(select 1 from rise_private.squad_previews p where p.group_id=gr.id and p.user_id=actor) or exists(select 1 from rise.notification_jobs j where j.group_id=gr.id and (j.user_id=actor or j.source_actor_id=actor)) order by gr.id for update loop
  if g.owner_id=actor then raise exception using errcode='P0001',message='ownership_resolution_required';end if;
 end loop;
 perform rise_private.erase_group_notifications(actor);
 update rise.group_invitations set revoked_at=coalesce(revoked_at,now()) where created_by=actor and consumed_at is null;
 delete from rise.group_preferences where user_id=actor;
 update rise.groups set revision=revision+1,updated_at=now() where id in(select group_id from rise.memberships where user_id=actor and status='active'
 union select group_id from rise.squad_posts where author_id=actor union select group_id from rise.squad_reactions where user_id=actor);
 delete from rise_private.squad_previews where user_id=actor;
 delete from rise.squad_reactions where user_id=actor;
 delete from rise.squad_posts where author_id=actor;
 update rise.memberships set user_id=null,display_name=null,status='deleted',departed_at=now() where user_id=actor;
end;$$;

create or replace function rise_private.group_deletion_ready() returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from rise.groups where owner_id=(select rise_private.group_actor())) and not exists(select 1 from rise.memberships where user_id=(select rise_private.group_actor()))
 and not exists(select 1 from rise.squad_posts where author_id=(select rise_private.group_actor())) and not exists(select 1 from rise.squad_reactions where user_id=(select rise_private.group_actor()))
 and not exists(select 1 from rise_private.squad_previews where user_id=(select rise_private.group_actor()))
 and not exists(select 1 from rise.notification_jobs where user_id=(select rise_private.group_actor()) or source_actor_id=(select rise_private.group_actor()));
$$;

create or replace function rise_private.purge_group_identity(subject uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from rise_private.deletion_ledger where user_id=subject) then raise exception using errcode='42501',message='suppression_required';end if;
 perform pg_advisory_xact_lock(hashtextextended('rise-personal:'||subject::text,0));
 perform 1 from rise.groups g where g.owner_id=subject or exists(select 1 from rise.memberships m where m.group_id=g.id and m.user_id=subject)
 or exists(select 1 from rise.squad_posts p where p.group_id=g.id and p.author_id=subject)
 or exists(select 1 from rise.squad_reactions r where r.group_id=g.id and r.user_id=subject)
 or exists(select 1 from rise_private.squad_previews p where p.group_id=g.id and p.user_id=subject) or exists(select 1 from rise.notification_jobs j where j.group_id=g.id and (j.user_id=subject or j.source_actor_id=subject)) order by g.id for update;
 perform rise_private.erase_group_notifications(subject);
 delete from rise.groups where owner_id=subject;
 delete from rise.group_preferences where user_id=subject;
 update rise.groups set revision=revision+1,updated_at=now() where id in(select group_id from rise.memberships where user_id=subject and status='active'
 union select group_id from rise.squad_posts where author_id=subject union select group_id from rise.squad_reactions where user_id=subject);
 delete from rise_private.squad_previews where user_id=subject;
 delete from rise.squad_reactions where user_id=subject;
 delete from rise.squad_posts where author_id=subject;
 update rise.memberships set user_id=null,display_name=null,status='deleted',departed_at=now() where user_id=subject;
 update rise.group_invitations set revoked_at=coalesce(revoked_at,now()),created_by=null where created_by=subject;
 update rise.group_invitations set consumed_by=null where consumed_by=subject;
end;$$;

create or replace function rise_private.deletion_integrations_ready() returns boolean language sql stable security invoker set search_path=''
begin atomic
 return to_regclass('rise.notification_jobs') is not null and to_regprocedure('rise_private.erase_group_notifications(uuid)') is not null;
end;
grant create on schema rise_private to rise_group_guard;
do $$declare f record;begin
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='rise_private'::regnamespace and proname in
 ('group_notice_quiet','group_notification_effect','group_notice_allowed','lock_group_notice','receive_group_notice','cancel_group_notices','erase_group_notifications') loop
  execute format('alter function %s owner to rise_group_guard',f.signature);
  execute format('revoke all on function %s from public,anon,authenticated,service_role,rise_bff,rise_worker,rise_lifecycle',f.signature);
 end loop;
end;$$;
revoke create on schema rise_private from rise_group_guard;
grant execute on function rise_private.group_notification_effect(uuid,uuid,boolean),rise_private.receive_group_notice(uuid,uuid,integer,timestamptz,timestamptz,bytea) to rise_bff;
grant execute on function rise_private.lock_group_notice(uuid,uuid,uuid) to rise_worker;
revoke rise_group_guard from postgres;
