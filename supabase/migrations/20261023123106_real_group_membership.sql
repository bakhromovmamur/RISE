-- GROUP-01. No general group DML for BFF/clients. Narrow, private operations own
-- authority transitions; the role cannot read private journeys or provider tokens.
create role rise_group_guard nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
grant usage on schema rise, rise_private, auth to rise_group_guard;
grant execute on function rise_private.active_session() to rise_group_guard;
grant select(user_id,provider_session_id,authenticated_at) on rise_private.server_sessions to rise_group_guard;
create policy group_recent_session on rise_private.server_sessions for select to rise_group_guard using(user_id=(select auth.uid()));
grant select(user_id) on rise_private.deletion_ledger to rise_group_guard;
create policy group_suppressed_identity on rise_private.deletion_ledger for select to rise_group_guard using(true);

create table rise.groups (
 id uuid primary key, kind text not null check(kind in ('family','squad')),
 name text not null check(length(btrim(name)) between 1 and 80 and name !~ '[[:cntrl:]]'),
 timezone text not null check(length(timezone) between 1 and 100),
 owner_id uuid not null references auth.users(id), owner_status text not null default 'active' check(owner_status='active'),
 archived boolean not null default false, revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index groups_owner on rise.groups(owner_id,id);
create table rise.memberships (
 id uuid primary key, group_id uuid not null references rise.groups(id) on delete cascade,
 user_id uuid references auth.users(id) on delete set null,
 display_name text check(display_name is null or length(btrim(display_name)) between 1 and 80 and display_name !~ '[[:cntrl:]]'),
 status text not null default 'active' check(status in ('active','left','removed','deleted')),
 joined_at timestamptz not null default now(), departed_at timestamptz,
 unique(group_id,user_id), unique(group_id,user_id,status), unique(group_id,id),
 check((status='deleted' and user_id is null and display_name is null) or (status<>'deleted' and user_id is not null and display_name is not null))
);
create index memberships_user on rise.memberships(user_id,group_id);
-- A group cannot commit without exactly one active owner, even during deletion
-- or transfer. Role is derived from owner_id rather than duplicated on members.
alter table rise.groups add constraint active_group_owner foreign key(id,owner_id,owner_status)
 references rise.memberships(group_id,user_id,status) deferrable initially deferred;
create table rise.group_preferences (
 group_id uuid not null, user_id uuid not null references auth.users(id) on delete cascade,
 muted boolean not null default false, quiet_start text not null default '22:00' check(quiet_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 quiet_end text not null default '07:00' check(quiet_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 primary key(group_id,user_id),foreign key(group_id,user_id) references rise.memberships(group_id,user_id) on delete cascade
);
create index group_preferences_user on rise.group_preferences(user_id,group_id);
create table rise.group_invitations (
 id uuid primary key,group_id uuid not null references rise.groups(id) on delete cascade,
 created_by uuid references auth.users(id) on delete set null,token_hash bytea not null unique check(octet_length(token_hash)=32),
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '7 days',
 revoked_at timestamptz,consumed_at timestamptz,consumed_by uuid references auth.users(id) on delete set null,
 check(expires_at>created_at and expires_at<=created_at+interval '7 days'),check(consumed_by is null or consumed_at is not null)
);
create index group_invitations_group on rise.group_invitations(group_id,id);
create index group_invitations_creator on rise.group_invitations(created_by);
create index group_invitations_consumer on rise.group_invitations(consumed_by);
create index group_invitations_retention on rise.group_invitations(least(expires_at,revoked_at,consumed_at),id);
create table rise.group_receipts (
 user_id uuid not null references auth.users(id) on delete cascade,id uuid not null,request_hash bytea not null check(octet_length(request_hash)=32),
 group_id uuid not null,revision integer not null check(revision>0),kind text not null,
 invitation_id uuid,invitation_expires_at timestamptz,created_at timestamptz not null default now(),primary key(user_id,id),
 check(kind in ('group.create','group.rename','group.archive','group.restore','group.leave','group.delete','group.invite','group.transfer','group.remove','group.revoke','group.preferences','group.accept')),
 check((kind='group.invite' and invitation_id is not null and invitation_expires_at is not null) or (kind<>'group.invite' and invitation_id is null and invitation_expires_at is null))
);
create index group_receipts_retention on rise.group_receipts(user_id,created_at,id);
create table rise_private.group_limits (
 singleton boolean primary key default true check(singleton),groups_per_account integer not null default 50 check(groups_per_account between 1 and 500),
 members_per_group integer not null default 100 check(members_per_group between 2 and 500),
 creates_per_day integer not null default 10 check(creates_per_day between 1 and 100),
 invites_per_hour integer not null default 10 check(invites_per_hour between 1 and 100),
 lookups_per_hour integer not null default 60 check(lookups_per_hour between 1 and 1000),
 changes_per_hour integer not null default 200 check(changes_per_hour between 1 and 5000)
);
insert into rise_private.group_limits default values;
create table rise_private.group_attempts (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('create','invite','lookup','change')),created_at timestamptz not null default now()
);
create index group_attempts_quota on rise_private.group_attempts(user_id,kind,created_at);

create function rise_private.group_access(target uuid, owner_only boolean default false, writable boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select (select rise_private.active_session()) and exists(select 1 from rise.groups g join rise.memberships m on m.group_id=g.id
 where g.id=target and m.user_id=(select auth.uid()) and m.status='active' and (not owner_only or g.owner_id=m.user_id) and (not writable or not g.archived));
$$;
create function rise_private.group_recent_auth() returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from rise_private.server_sessions where user_id=(select auth.uid())
 and provider_session_id::text=(current_setting('request.jwt.claims',true)::jsonb->>'session_id')
 and authenticated_at>now()-interval '10 minutes' and authenticated_at<=now());
$$;

-- The identity scrub also applies to primary-purge/backup-replay FK actions.
create function rise_private.scrub_group_member() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.user_id is null then new.display_name:=null;new.status:='deleted';new.departed_at:=coalesce(new.departed_at,now());end if;
 return new;
end;$$;
create trigger scrub_group_member before update of user_id on rise.memberships for each row execute function rise_private.scrub_group_member();

do $$declare t text;begin
 foreach t in array array['groups','memberships','group_preferences','group_invitations','group_receipts'] loop
  execute format('alter table rise.%I enable row level security',t);execute format('alter table rise.%I force row level security',t);
  execute format('revoke all on rise.%I from public,anon,authenticated,service_role,rise_bff,rise_worker,rise_lifecycle',t);
 end loop;
 foreach t in array array['groups','memberships','group_preferences','group_invitations'] loop
  execute format('grant select,insert,update,delete on rise.%I to rise_group_guard',t);
  execute format('create policy group_guard on rise.%I for all to rise_group_guard using(true) with check(true)',t);
 end loop;
 foreach t in array array['group_limits','group_attempts'] loop
  execute format('alter table rise_private.%I enable row level security',t);execute format('alter table rise_private.%I force row level security',t);
  execute format('revoke all on rise_private.%I from public,anon,authenticated,service_role,rise_bff,rise_worker,rise_lifecycle',t);
  execute format('create policy group_guard on rise_private.%I for all to rise_group_guard using(true) with check(true)',t);
 end loop;
end;$$;
grant select on rise_private.group_limits to rise_group_guard;
grant select,insert,delete on rise_private.group_attempts to rise_group_guard;
grant select on rise.groups to rise_bff,authenticated;
grant select(id,group_id,user_id,display_name,status,joined_at,departed_at) on rise.memberships to rise_bff,authenticated;
grant select on rise.group_preferences to rise_bff,authenticated;
grant select(id,group_id,expires_at,revoked_at,consumed_at) on rise.group_invitations to rise_bff;
grant select,insert,delete on rise.group_receipts to rise_bff;
create policy group_read on rise.groups for select to rise_bff,authenticated using(rise_private.group_access(id));
create policy member_read on rise.memberships for select to rise_bff,authenticated using(status='active' and rise_private.group_access(group_id));
create policy preferences_read on rise.group_preferences for select to rise_bff,authenticated using(user_id=(select auth.uid()) and rise_private.group_access(group_id));
create policy invitation_read on rise.group_invitations for select to rise_bff using(rise_private.group_access(group_id,true));
create policy group_receipt_read on rise.group_receipts for select to rise_bff using(user_id=(select auth.uid()) and (select rise_private.active_session()));
create policy group_receipt_insert on rise.group_receipts for insert to rise_bff with check(user_id=(select auth.uid()) and (select rise_private.active_session()));
create policy group_receipt_prune on rise.group_receipts for delete to rise_bff using(user_id=(select auth.uid()) and (select rise_private.active_session()) and created_at<now()-interval '90 days');

-- Called before the action savepoint. Invalid/expired token attempts consume a
-- quota too; only the redacted error outcome leaves the transaction.
create function rise_private.group_rate(bucket text) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();limits rise_private.group_limits;maximum integer;duration interval;
begin
 if not rise_private.active_session() then raise exception using errcode='P0001',message='sign_in_required';end if;
 perform pg_advisory_xact_lock(hashtextextended('rise-personal:'||actor::text,0));
 select * into strict limits from rise_private.group_limits;
 case bucket when 'create' then maximum:=limits.creates_per_day;duration:=interval '1 day';
 when 'invite' then maximum:=limits.invites_per_hour;duration:=interval '1 hour';
 when 'lookup' then maximum:=limits.lookups_per_hour;duration:=interval '1 hour';
 when 'change' then maximum:=limits.changes_per_hour;duration:=interval '1 hour';
 else raise exception using errcode='P0001',message='invalid_input';end case;
 delete from rise_private.group_attempts where id in(select id from rise_private.group_attempts where user_id=actor and created_at<now()-interval '1 day' order by created_at,id limit 500);
 if (select count(*) from rise_private.group_attempts where user_id=actor and kind=bucket and created_at>now()-duration)>=maximum then return false;end if;
 insert into rise_private.group_attempts(user_id,kind) values(actor,bucket);return true;
end;$$;

create function rise_private.create_group(target uuid,member_id uuid,group_kind text,title text,zone text,nickname text) returns integer
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();maximum integer;
begin
 if not rise_private.active_session() then raise exception using errcode='P0001',message='sign_in_required';end if;
 perform pg_advisory_xact_lock(hashtextextended('rise-personal:'||actor::text,0));
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=zone) then raise exception using errcode='P0001',message='invalid_input';end if;
 select groups_per_account into maximum from rise_private.group_limits;
 if (select count(*) from rise.memberships where user_id=actor and status='active')>=maximum then raise exception using errcode='P0001',message='group_limit';end if;
 insert into rise.groups(id,kind,name,timezone,owner_id) values(target,group_kind,title,zone,actor);
 insert into rise.memberships(id,group_id,user_id,display_name) values(member_id,target,actor,nickname);
 insert into rise.group_preferences(group_id,user_id) values(target,actor);return 1;
end;$$;

create function rise_private.change_group(target uuid,expected integer,action text,value text default null,muted_value boolean default null,quiet_start_value text default null,quiet_end_value text default null) returns integer
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();g rise.groups;recipient rise.memberships;next_revision integer;
begin
 if not rise_private.active_session() then raise exception using errcode='P0001',message='sign_in_required';end if;
 perform pg_advisory_xact_lock(hashtextextended('rise-personal:'||actor::text,0));
 select * into g from rise.groups where id=target for update;
 if not found or not rise_private.group_access(target) then raise exception using errcode='P0001',message='group_unavailable';end if;
 if expected is null or g.revision<>expected then raise exception using errcode='P0001',message='group_changed';end if;
 if g.revision=2147483647 then raise exception using errcode='P0001',message='revision_limit';end if;
 if action not in ('rename','archive','restore','leave','delete','transfer','remove','revoke','preferences') or action is null then raise exception using errcode='P0001',message='invalid_input';end if;
 if action not in ('leave','preferences') and g.owner_id<>actor then raise exception using errcode='P0001',message='owner_required';end if;
 -- Leaving and changing only one's delivery preferences remain available for
 -- privacy. Shared content/administration requires owner restoration first.
 if g.archived and action not in ('restore','delete','leave','preferences') then raise exception using errcode='P0001',message='group_archived';end if;
 if action in ('transfer','delete') and not rise_private.group_recent_auth() then raise exception using errcode='P0001',message='recent_auth_required';end if;
 next_revision:=g.revision+1;
 case action
 when 'rename' then update rise.groups set name=value where id=target;
 when 'archive' then
  update rise.groups set archived=true where id=target;
  update rise.group_invitations set revoked_at=coalesce(revoked_at,now()) where group_id=target and consumed_at is null;
 when 'restore' then update rise.groups set archived=false where id=target;
 when 'leave' then
  if g.owner_id=actor then raise exception using errcode='P0001',message='ownership_resolution_required';end if;
  update rise.memberships set status='left',departed_at=now() where group_id=target and user_id=actor;
  delete from rise.group_preferences where group_id=target and user_id=actor;
 when 'delete' then delete from rise.groups where id=target;return next_revision;
 when 'transfer','remove' then
  select * into recipient from rise.memberships where group_id=target and id=value::uuid and status='active';
  if not found then raise exception using errcode='P0001',message='member_unavailable';end if;
  if recipient.user_id=actor then raise exception using errcode='P0001',message='ownership_resolution_required';end if;
  if action='transfer' then
   update rise.groups set owner_id=recipient.user_id where id=target;
   update rise.group_invitations set revoked_at=coalesce(revoked_at,now()) where group_id=target and consumed_at is null;
  else
   update rise.memberships set status='removed',departed_at=now() where id=recipient.id;
   delete from rise.group_preferences where group_id=target and user_id=recipient.user_id;
  end if;
 when 'revoke' then
  update rise.group_invitations set revoked_at=coalesce(revoked_at,now()) where id=value::uuid and group_id=target;
  if not found then raise exception using errcode='P0001',message='invitation_unavailable';end if;
 when 'preferences' then
  insert into rise.group_preferences(group_id,user_id,muted,quiet_start,quiet_end) values(target,actor,muted_value,quiet_start_value,quiet_end_value)
  on conflict(group_id,user_id) do update set muted=excluded.muted,quiet_start=excluded.quiet_start,quiet_end=excluded.quiet_end;
 end case;
 update rise.groups set revision=next_revision,updated_at=now() where id=target;return next_revision;
end;$$;

create function rise_private.create_group_invite(target uuid,expected integer,invitation uuid,digest bytea) returns table(revision integer,expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare g rise.groups;
begin
 if not rise_private.active_session() then raise exception using errcode='P0001',message='sign_in_required';end if;
 perform pg_advisory_xact_lock(hashtextextended('rise-personal:'||auth.uid()::text,0));
 select * into g from rise.groups where id=target for update;
 if not found or not rise_private.group_access(target,true) then raise exception using errcode='P0001',message='group_unavailable';end if;
 if g.archived then raise exception using errcode='P0001',message='group_archived';end if;
 if expected is null or g.revision<>expected then raise exception using errcode='P0001',message='group_changed';end if;
 insert into rise.group_invitations(id,group_id,created_by,token_hash) values(invitation,target,auth.uid(),digest);
 update rise.groups set revision=g.revision+1,updated_at=now() where id=target;
 return query select g.revision+1,i.expires_at from rise.group_invitations i where i.id=invitation;
end;$$;

create function rise_private.preview_group_invite(digest bytea) returns table(id uuid,name text,kind text,timezone text,expires_at timestamptz)
language sql stable security definer set search_path='' as $$
 select g.id,g.name,g.kind,g.timezone,i.expires_at from rise.group_invitations i join rise.groups g on g.id=i.group_id
 where (select rise_private.active_session()) and i.token_hash=digest and i.expires_at>now() and i.revoked_at is null and i.consumed_at is null and not g.archived;
$$;
create function rise_private.accept_group_invite(digest bytea,member_id uuid,nickname text) returns table(group_id uuid,revision integer)
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();g rise.groups;i rise.group_invitations;m rise.memberships;limits rise_private.group_limits;
begin
 if not rise_private.active_session() then raise exception using errcode='P0001',message='sign_in_required';end if;
 perform pg_advisory_xact_lock(hashtextextended('rise-personal:'||actor::text,0));
 select inv.* into i from rise.group_invitations inv where inv.token_hash=digest;
 if not found then raise exception using errcode='P0001',message='invitation_unavailable';end if;
 -- Lock group before invite everywhere: no accept/transfer/deletion lock inversion.
 select * into g from rise.groups where id=i.group_id for update;
 select inv.* into i from rise.group_invitations inv where inv.token_hash=digest for update;
 if not found or g.id is null or g.archived or i.expires_at<=now() or i.revoked_at is not null or i.consumed_at is not null then raise exception using errcode='P0001',message='invitation_unavailable';end if;
 select * into m from rise.memberships where memberships.group_id=g.id and user_id=actor;
 if m.status='active' then raise exception using errcode='P0001',message='already_member';end if;
 if m.departed_at is not null and i.created_at<=m.departed_at then raise exception using errcode='P0001',message='invitation_unavailable';end if;
 select * into strict limits from rise_private.group_limits;
 if (select count(*) from rise.memberships where memberships.group_id=g.id and status='active')>=limits.members_per_group
 or (select count(*) from rise.memberships where user_id=actor and status='active')>=limits.groups_per_account then raise exception using errcode='P0001',message='group_limit';end if;
 if m.id is null then insert into rise.memberships(id,group_id,user_id,display_name) values(member_id,g.id,actor,nickname);
 else update rise.memberships set status='active',display_name=nickname,joined_at=now(),departed_at=null where id=m.id;end if;
 insert into rise.group_preferences(group_id,user_id) values(g.id,actor) on conflict do nothing;
 update rise.group_invitations set consumed_at=now(),consumed_by=actor where id=i.id;
 update rise.groups set revision=g.revision+1,updated_at=now() where id=g.id;
 return query select g.id,g.revision+1;
end;$$;

-- Account suppression may only follow an atomic, locked ownership resolution.
create function rise_private.prepare_group_deletion() returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();g rise.groups;
begin
 if not rise_private.active_session() then raise exception using errcode='P0001',message='sign_in_required';end if;
 perform pg_advisory_xact_lock(hashtextextended('rise-personal:'||actor::text,0));
 for g in select gr.* from rise.groups gr where exists(select 1 from rise.memberships m where m.group_id=gr.id and m.user_id=actor) order by gr.id for update loop
  if g.owner_id=actor then raise exception using errcode='P0001',message='ownership_resolution_required';end if;
 end loop;
 update rise.group_invitations set revoked_at=coalesce(revoked_at,now()) where created_by=actor and consumed_at is null;
 delete from rise.group_preferences where user_id=actor;
 update rise.groups set revision=revision+1,updated_at=now() where id in(select group_id from rise.memberships where user_id=actor and status='active');
 update rise.memberships set user_id=null,display_name=null,status='deleted',departed_at=now() where user_id=actor;
end;$$;
create function rise_private.group_deletion_ready() returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from rise.groups where owner_id=(select auth.uid())) and not exists(select 1 from rise.memberships where user_id=(select auth.uid()));
$$;
-- AND, not a permissive alternative to the existing recent-auth ledger policy.
create policy ledger_groups_resolved on rise_private.deletion_ledger as restrictive for insert to rise_bff with check(rise_private.group_deletion_ready());

-- Backup replay can restore pre-transfer ownership. A retained deletion ledger
-- authorizes this terminal cleanup only in the isolated lifecycle process.
create function rise_private.purge_group_identity(subject uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from rise_private.deletion_ledger where user_id=subject) then raise exception using errcode='42501',message='suppression_required';end if;
 perform pg_advisory_xact_lock(hashtextextended('rise-personal:'||subject::text,0));
 perform 1 from rise.groups g where g.owner_id=subject or exists(select 1 from rise.memberships m where m.group_id=g.id and m.user_id=subject) order by g.id for update;
 delete from rise.groups where owner_id=subject;
 delete from rise.group_preferences where user_id=subject;
 update rise.groups set revision=revision+1,updated_at=now() where id in(select group_id from rise.memberships where user_id=subject and status='active');
 update rise.memberships set user_id=null,display_name=null,status='deleted',departed_at=now() where user_id=subject;
 update rise.group_invitations set revoked_at=coalesce(revoked_at,now()),created_by=null where created_by=subject;
 update rise.group_invitations set consumed_by=null where consumed_by=subject;
end;$$;
create or replace function rise_private.deletion_integrations_ready() returns boolean language sql stable security invoker set search_path=''
begin atomic
 return to_regclass('rise.family_tasks') is null and to_regclass('rise.shared_lists') is null
 and to_regclass('rise.squad_posts') is null and to_regclass('rise.squad_reactions') is null and to_regclass('rise.notification_jobs') is null;
end;
create function rise_private.prune_group_invitations(batch_size integer default 200) returns integer language plpgsql security definer set search_path='' as $$
declare removed integer;
begin
 if batch_size is null or batch_size<1 or batch_size>500 then raise exception using errcode='22023',message='invalid_batch_size';end if;
 delete from rise.group_invitations where id in(select id from rise.group_invitations where least(expires_at,revoked_at,consumed_at)<now()-interval '7 days' order by least(expires_at,revoked_at,consumed_at),id limit batch_size for update skip locked);
 get diagnostics removed=row_count;return removed;
end;$$;

-- No role membership remains after ownership assignment; not even the BFF can
-- SET ROLE to the guard. All functions are outside the Data API with fixed paths.
grant rise_group_guard to postgres;
grant create on schema rise_private to rise_group_guard;
do $$declare f record;begin
 for f in select oid::regprocedure as signature,proname from pg_proc where pronamespace='rise_private'::regnamespace and proname in
 ('group_access','group_recent_auth','scrub_group_member','group_rate','create_group','change_group','create_group_invite','preview_group_invite','accept_group_invite','prepare_group_deletion','group_deletion_ready','purge_group_identity','prune_group_invitations') loop
  execute format('alter function %s owner to rise_group_guard',f.signature);
  execute format('revoke all on function %s from public,anon,authenticated,service_role,rise_bff,rise_worker,rise_lifecycle',f.signature);
  if f.proname not in ('group_recent_auth','scrub_group_member','purge_group_identity','prune_group_invitations') then execute format('grant execute on function %s to rise_bff',f.signature);end if;
 end loop;
end;$$;
revoke create on schema rise_private from rise_group_guard;
grant execute on function rise_private.group_access(uuid,boolean,boolean) to authenticated;
grant execute on function rise_private.purge_group_identity(uuid) to rise_lifecycle;
grant execute on function rise_private.prune_group_invitations(integer) to rise_worker;
revoke rise_group_guard from postgres;
