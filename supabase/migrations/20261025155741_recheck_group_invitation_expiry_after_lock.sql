-- GROUP-01/04: an older waiting transaction must not revive an expired link.
-- Check the current database clock after the existing group and invite locks.
-- Keep audit/receipt time semantics, authority, and lock order unchanged.
grant rise_group_guard to postgres;
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
 if not found or g.id is null or g.archived or i.expires_at<=clock_timestamp() or i.revoked_at is not null or i.consumed_at is not null then raise exception using errcode='P0001',message='invitation_unavailable';end if;
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

revoke rise_group_guard from postgres;
