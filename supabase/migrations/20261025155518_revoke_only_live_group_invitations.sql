-- GROUP-01/04: revoke outstanding links without rewriting terminal history.
-- Expiry and consumption already reject acceptance under the same group lock.
-- Preserve the security-definer owner, grants, RLS, and explicit per-link revoke.
grant rise_group_guard to postgres;
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
  update rise.group_invitations set revoked_at=coalesce(revoked_at,now()) where group_id=target and consumed_at is null and revoked_at is null and expires_at>now();
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
   update rise.group_invitations set revoked_at=coalesce(revoked_at,now()) where group_id=target and consumed_at is null and revoked_at is null and expires_at>now();
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

revoke rise_group_guard from postgres;
