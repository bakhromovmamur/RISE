-- Managed Auth owns its schema and does not delegate USAGE grants to postgres.
-- Bind the existing auth.uid function while parsing as the migration role. This
-- returns only transaction-local identity; it grants no Auth table capability.
grant rise_group_guard to postgres;
grant create on schema rise_private to rise_group_guard;
create function rise_private.group_actor() returns uuid language sql stable security invoker set search_path=''
begin atomic
 return auth.uid();
end;
alter function rise_private.group_actor() owner to rise_group_guard;
revoke all on function rise_private.group_actor() from public,anon,authenticated,service_role,rise_bff,rise_worker,rise_lifecycle;
create or replace function rise_private.group_access(target uuid, owner_only boolean default false, writable boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select (select rise_private.active_session()) and exists(select 1 from rise.groups g join rise.memberships m on m.group_id=g.id
 where g.id=target and m.user_id=(select rise_private.group_actor()) and m.status='active' and (not owner_only or g.owner_id=m.user_id) and (not writable or not g.archived));
$$;

create or replace function rise_private.group_recent_auth() returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from rise_private.server_sessions where user_id=(select rise_private.group_actor())
 and provider_session_id::text=(current_setting('request.jwt.claims',true)::jsonb->>'session_id')
 and authenticated_at>now()-interval '10 minutes' and authenticated_at<=now());
$$;

create or replace function rise_private.group_rate(bucket text) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=rise_private.group_actor();limits rise_private.group_limits;maximum integer;duration interval;
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

create or replace function rise_private.create_group(target uuid,member_id uuid,group_kind text,title text,zone text,nickname text) returns integer
language plpgsql security definer set search_path='' as $$
declare actor uuid:=rise_private.group_actor();maximum integer;
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

create or replace function rise_private.change_group(target uuid,expected integer,action text,value text default null,muted_value boolean default null,quiet_start_value text default null,quiet_end_value text default null) returns integer
language plpgsql security definer set search_path='' as $$
declare actor uuid:=rise_private.group_actor();g rise.groups;recipient rise.memberships;next_revision integer;
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

create or replace function rise_private.create_group_invite(target uuid,expected integer,invitation uuid,digest bytea) returns table(revision integer,expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare g rise.groups;
begin
 if not rise_private.active_session() then raise exception using errcode='P0001',message='sign_in_required';end if;
 perform pg_advisory_xact_lock(hashtextextended('rise-personal:'||rise_private.group_actor()::text,0));
 select * into g from rise.groups where id=target for update;
 if not found or not rise_private.group_access(target,true) then raise exception using errcode='P0001',message='group_unavailable';end if;
 if g.archived then raise exception using errcode='P0001',message='group_archived';end if;
 if expected is null or g.revision<>expected then raise exception using errcode='P0001',message='group_changed';end if;
 insert into rise.group_invitations(id,group_id,created_by,token_hash) values(invitation,target,rise_private.group_actor(),digest);
 update rise.groups set revision=g.revision+1,updated_at=now() where id=target;
 return query select g.revision+1,i.expires_at from rise.group_invitations i where i.id=invitation;
end;$$;

create or replace function rise_private.accept_group_invite(digest bytea,member_id uuid,nickname text) returns table(group_id uuid,revision integer)
language plpgsql security definer set search_path='' as $$
declare actor uuid:=rise_private.group_actor();g rise.groups;i rise.group_invitations;m rise.memberships;limits rise_private.group_limits;
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

create or replace function rise_private.prepare_group_deletion() returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=rise_private.group_actor();g rise.groups;
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

create or replace function rise_private.group_deletion_ready() returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from rise.groups where owner_id=(select rise_private.group_actor())) and not exists(select 1 from rise.memberships where user_id=(select rise_private.group_actor()));
$$;
revoke create on schema rise_private from rise_group_guard;
revoke rise_group_guard from postgres;
