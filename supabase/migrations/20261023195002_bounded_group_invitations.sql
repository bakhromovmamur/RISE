-- GROUP-04: bounded current-owner invitation pages and retained metadata.
alter table rise_private.group_limits add column invitations_per_group integer not null default 10000 check(invitations_per_group between 1 and 100000);
create index group_invitations_page on rise.group_invitations(group_id,expires_at desc,id desc);

grant rise_group_guard to postgres;
create or replace function rise_private.create_group_invite(target uuid,expected integer,invitation uuid,digest bytea) returns table(revision integer,expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare g rise.groups;maximum integer;
begin
 if not rise_private.active_session() then raise exception using errcode='P0001',message='sign_in_required';end if;
 perform pg_advisory_xact_lock(hashtextextended('rise-personal:'||rise_private.group_actor()::text,0));
 select * into g from rise.groups where id=target for update;
 if not found or not rise_private.group_access(target,true) then raise exception using errcode='P0001',message='group_unavailable';end if;
 if g.archived then raise exception using errcode='P0001',message='group_archived';end if;
 if expected is null or g.revision<>expected then raise exception using errcode='P0001',message='group_changed';end if;
 if g.revision=2147483647 then raise exception using errcode='P0001',message='revision_limit';end if;
 select invitations_per_group into strict maximum from rise_private.group_limits;
 if (select count(*) from rise.group_invitations where group_id=target)>=maximum then raise exception using errcode='P0001',message='invitation_limit';end if;
 insert into rise.group_invitations(id,group_id,created_by,token_hash) values(invitation,target,rise_private.group_actor(),digest);
 update rise.groups set revision=g.revision+1,updated_at=now() where id=target;
 return query select g.revision+1,i.expires_at from rise.group_invitations i where i.id=invitation;
end;$$;
revoke rise_group_guard from postgres;
