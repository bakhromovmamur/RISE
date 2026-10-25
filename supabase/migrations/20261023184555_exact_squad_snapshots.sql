-- GROUP-03: owner-only expiring previews, exact published payloads and explicit
-- corrections. The existing group guard has no private-journey capability.
grant rise_group_guard to postgres;
create function rise_private.squad_snapshot_valid(payload jsonb) returns boolean
language plpgsql immutable strict security invoker set search_path='' as $$
declare day date;
begin
 if jsonb_typeof(payload)<>'object' or not payload ?& array['week','note']
 or exists(select 1 from jsonb_object_keys(payload) k where k not in ('week','note','habits','milestones','prayers'))
 or octet_length(payload::text)>131072 then return false;end if;
 if jsonb_typeof(payload->'week')<>'string' or payload->>'week' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 or jsonb_typeof(payload->'note')<>'string' or length(payload->>'note')>600
 or translate(payload->>'note',E'\n\t','') ~ '[[:cntrl:]]' then return false;end if;
 day:=(payload->>'week')::date;
 if day not between date '0001-01-01' and date '9999-12-31' or extract(isodow from day)<>1 then return false;end if;
 if payload ? 'habits' and (jsonb_typeof(payload->'habits')<>'number' or payload->>'habits' !~ '^(0|[1-9][0-9]{0,6})$') then return false;end if;
 if payload ? 'prayers' and (jsonb_typeof(payload->'prayers')<>'number' or payload->>'prayers' !~ '^(0|[1-9][0-9]?)$') then return false;end if;
 if (payload->>'habits')::integer>1000000 or (payload->>'prayers')::integer>35 then return false;end if;
 if payload ? 'milestones' then
  if jsonb_typeof(payload->'milestones')<>'array' then return false;end if;
  if jsonb_array_length(payload->'milestones')>100 or exists(select 1 from jsonb_array_elements(payload->'milestones') t
   where jsonb_typeof(t)<>'string' or length(btrim(t#>>'{}')) not between 1 and 160 or translate(t#>>'{}',E'\n\t','') ~ '[[:cntrl:]]') then return false;end if;
 end if;
 return length(btrim(payload->>'note'))>0 or payload ?| array['habits','milestones','prayers'];
exception when invalid_datetime_format or datetime_field_overflow then return false;
end;$$;
revoke all on function rise_private.squad_snapshot_valid(jsonb) from public,anon,authenticated,service_role,rise_bff,rise_worker,rise_lifecycle;
grant execute on function rise_private.squad_snapshot_valid(jsonb) to rise_group_guard;

create table rise.squad_posts (
 id uuid primary key,group_id uuid not null references rise.groups(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,author_member_id uuid not null,
 week date not null check(week between date '0001-01-01' and date '9999-12-31' and extract(isodow from week)=1),
 status text not null check(status in ('published','withdrawn','removed')),snapshot jsonb,
 revision integer not null check(revision>0),published_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(group_id,id),foreign key(group_id,author_member_id) references rise.memberships(group_id,id),
 check((status='published' and snapshot is not null and rise_private.squad_snapshot_valid(snapshot) and (snapshot->>'week')::date=week)
 or (status in ('withdrawn','removed') and snapshot is null))
);
create unique index squad_posts_author_week on rise.squad_posts(group_id,author_id,week) where status='published';
create index squad_posts_feed on rise.squad_posts(group_id,week,id) where status='published';
create index squad_posts_author on rise.squad_posts(author_id,group_id);
create index squad_posts_member on rise.squad_posts(group_id,author_member_id);
create table rise.squad_reactions (
 group_id uuid not null,post_id uuid not null,member_id uuid not null,
 user_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now(),
 primary key(group_id,post_id,member_id),unique(group_id,post_id,user_id),
 foreign key(group_id,post_id) references rise.squad_posts(group_id,id) on delete cascade,
 foreign key(group_id,member_id) references rise.memberships(group_id,id)
);
create index squad_reactions_owner on rise.squad_reactions(user_id,group_id);
create index squad_reactions_member on rise.squad_reactions(group_id,member_id);
create table rise_private.squad_previews (
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,
 group_id uuid not null references rise.groups(id) on delete cascade,post_id uuid not null,
 post_revision integer not null check(post_revision>=0),source_revision bigint not null check(source_revision>0),
 snapshot jsonb not null check(rise_private.squad_snapshot_valid(snapshot)),
 snapshot_hash text not null check(snapshot_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '10 minutes',
 check(expires_at=created_at+interval '10 minutes')
);
create index squad_previews_owner on rise_private.squad_previews(user_id,expires_at,id);
create index squad_previews_group on rise_private.squad_previews(group_id,post_id);
create index squad_previews_retention on rise_private.squad_previews(expires_at,id);
create table rise_private.squad_limits (
 singleton boolean primary key default true check(singleton),
 posts_per_group integer not null default 10000 check(posts_per_group between 1 and 100000),
 previews_per_account integer not null default 20 check(previews_per_account between 1 and 100),
 reactions_per_post integer not null default 1000 check(reactions_per_post between 1 and 10000)
);
insert into rise_private.squad_limits default values;
do $$declare t text;begin
 foreach t in array array['rise.squad_posts','rise.squad_reactions','rise_private.squad_previews','rise_private.squad_limits'] loop
  execute format('alter table %s enable row level security',t);execute format('alter table %s force row level security',t);
  execute format('revoke all on %s from public,anon,authenticated,service_role,rise_bff,rise_worker,rise_lifecycle',t);
  execute format('grant select,insert,update,delete on %s to rise_group_guard',t);
  execute format('create policy squad_guard on %s for all to rise_group_guard using(true) with check(true)',t);
 end loop;
end;$$;
revoke insert,update,delete on rise_private.squad_limits from rise_group_guard;
grant select(id,group_id,author_member_id,week,status,snapshot,revision,published_at,updated_at) on rise.squad_posts to rise_bff,authenticated;
grant select(group_id,post_id,member_id) on rise.squad_reactions to rise_bff,authenticated;
create policy squad_member_read on rise.squad_posts for select to rise_bff,authenticated using(status='published' and rise_private.group_access(group_id));
create policy squad_reaction_read on rise.squad_reactions for select to rise_bff,authenticated using(rise_private.group_access(group_id)
 and exists(select 1 from rise.squad_posts p where p.group_id=squad_reactions.group_id and p.id=squad_reactions.post_id));
alter table rise.group_receipts drop constraint group_receipts_kind_check;
alter table rise.group_receipts add constraint group_receipts_kind_check check(kind in
 ('group.create','group.rename','group.archive','group.restore','group.leave','group.delete','group.invite','group.transfer','group.remove','group.revoke','group.preferences','group.accept',
 'task.create','task.edit','task.archive','task.restore','task.complete','list.create','list.rename','list.archive','list.restore','item.add','item.edit','item.check','item.move','item.remove',
 'squad.publish','squad.withdraw','squad.remove','squad.react'));

create function rise_private.stage_squad_preview(target uuid,expected integer,preview uuid,post uuid,base integer,source bigint,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=rise_private.group_actor();g rise.groups;p rise.squad_posts;row rise_private.squad_previews;maximum integer;
begin
 if not rise_private.active_session() then raise exception using errcode='P0001',message='sign_in_required';end if;
 perform pg_advisory_xact_lock(hashtextextended('rise-personal:'||actor::text,0));
 select * into g from rise.groups where id=target for update;
 if not found or not rise_private.group_access(target) or g.kind<>'squad' then raise exception using errcode='P0001',message='group_unavailable';end if;
 if g.archived then raise exception using errcode='P0001',message='group_archived';end if;
 if expected is null or g.revision<>expected then raise exception using errcode='P0001',message='group_changed';end if;
 if not coalesce(rise_private.squad_snapshot_valid(payload),false) or source is null or source<1 or base is null or base<0 then raise exception using errcode='P0001',message='invalid_input';end if;
 select * into p from rise.squad_posts where id=post;
 if found then
  if p.group_id<>target or p.author_id<>actor or p.status<>'published' then raise exception using errcode='P0001',message='squad_unavailable';end if;
  if p.revision<>base or p.week<>(payload->>'week')::date then raise exception using errcode='P0001',message='squad_changed';end if;
 elsif base<>0 then raise exception using errcode='P0001',message='squad_unavailable';
 elsif exists(select 1 from rise.squad_posts where group_id=target and author_id=actor and week=(payload->>'week')::date and status='published') then
  raise exception using errcode='P0001',message='squad_changed';
 end if;
 delete from rise_private.squad_previews where user_id=actor and expires_at<=now();
 select previews_per_account into maximum from rise_private.squad_limits;
 if (select count(*) from rise_private.squad_previews where user_id=actor)>=maximum then raise exception using errcode='P0001',message='squad_preview_limit';end if;
 insert into rise_private.squad_previews(id,user_id,group_id,post_id,post_revision,source_revision,snapshot,snapshot_hash)
 values(preview,actor,target,post,base,source,payload,encode(sha256(convert_to(payload::text,'UTF8')),'hex')) returning * into row;
 return jsonb_build_object('accountId',actor,'groupId',target,'postId',post,'previewId',preview,'groupRevision',g.revision,'postRevision',base,'sourceRevision',source,
 'expiresAt',to_char(row.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'hash',row.snapshot_hash,'snapshot',row.snapshot);
end;$$;

create function rise_private.change_squad(target uuid,expected integer,input jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare actor uuid:=rise_private.group_actor();g rise.groups;p rise.squad_posts;preview rise_private.squad_previews;
 action text:=input->>'kind';post uuid;member uuid;allowed text[];next_revision integer;limits rise_private.squad_limits;
begin
 if not rise_private.active_session() then raise exception using errcode='P0001',message='sign_in_required';end if;
 perform pg_advisory_xact_lock(hashtextextended('rise-personal:'||actor::text,0));
 select * into g from rise.groups where id=target for update;
 if not found or not rise_private.group_access(target) or g.kind<>'squad' then raise exception using errcode='P0001',message='group_unavailable';end if;
 if expected is null or g.revision<>expected then raise exception using errcode='P0001',message='group_changed';end if;
 if g.revision=2147483647 then raise exception using errcode='P0001',message='revision_limit';end if;
 case action
 when 'squad.publish' then allowed:=array['kind','groupId','postId','previewId','hash'];
 when 'squad.withdraw','squad.remove' then allowed:=array['kind','groupId','postId'];
 when 'squad.react' then allowed:=array['kind','groupId','postId','encourage'];
 else raise exception using errcode='P0001',message='invalid_input';end case;
 if jsonb_typeof(input)<>'object' or not input ?& allowed or exists(select 1 from jsonb_object_keys(input) k where not k=any(allowed))
 or (input->>'groupId')::uuid is distinct from target then raise exception using errcode='P0001',message='invalid_input';end if;
 if action='squad.react' and jsonb_typeof(input->'encourage')<>'boolean' then raise exception using errcode='P0001',message='invalid_input';end if;
 -- Erasure stays available in an archived group; publication/new reactions do not.
 if g.archived and (action='squad.publish' or action='squad.react' and (input->>'encourage')::boolean) then raise exception using errcode='P0001',message='group_archived';end if;
 post:=(input->>'postId')::uuid;next_revision:=g.revision+1;
 select * into strict limits from rise_private.squad_limits;
 select id into strict member from rise.memberships where group_id=target and user_id=actor and status='active';
 select * into p from rise.squad_posts where group_id=target and id=post;
 if action='squad.publish' then
  select * into preview from rise_private.squad_previews where id=(input->>'previewId')::uuid and user_id=actor and group_id=target and post_id=post;
  if not found or preview.expires_at<=now() or preview.snapshot_hash is distinct from input->>'hash' then raise exception using errcode='P0001',message='squad_preview_expired';end if;
  if p.id is not null then
   if p.author_id<>actor or p.status<>'published' then raise exception using errcode='P0001',message='squad_unavailable';end if;
   if p.revision<>preview.post_revision or p.week<>(preview.snapshot->>'week')::date then raise exception using errcode='P0001',message='squad_changed';end if;
   update rise.squad_posts set snapshot=preview.snapshot,revision=next_revision,updated_at=now() where id=post and group_id=target;
  else
   if preview.post_revision<>0 then raise exception using errcode='P0001',message='squad_unavailable';end if;
   if exists(select 1 from rise.squad_posts where group_id=target and author_id=actor and week=(preview.snapshot->>'week')::date and status='published') then raise exception using errcode='P0001',message='squad_changed';end if;
   if (select count(*) from rise.squad_posts where group_id=target)>=limits.posts_per_group then raise exception using errcode='P0001',message='squad_limit';end if;
   insert into rise.squad_posts(id,group_id,author_id,author_member_id,week,status,snapshot,revision)
    values(post,target,actor,member,(preview.snapshot->>'week')::date,'published',preview.snapshot,next_revision);
  end if;
  delete from rise_private.squad_previews where id=preview.id;
 else
  if p.id is null or p.status<>'published' then raise exception using errcode='P0001',message='squad_unavailable';end if;
  if action='squad.react' then
   if (input->>'encourage')::boolean then
    if not exists(select 1 from rise.squad_reactions where group_id=target and post_id=post and member_id=member)
    and (select count(*) from rise.squad_reactions where group_id=target and post_id=post)>=limits.reactions_per_post then raise exception using errcode='P0001',message='squad_limit';end if;
    insert into rise.squad_reactions(group_id,post_id,member_id,user_id) values(target,post,member,actor) on conflict do nothing;
   else delete from rise.squad_reactions where group_id=target and post_id=post and user_id=actor;end if;
  else
   if action='squad.withdraw' and p.author_id<>actor then raise exception using errcode='P0001',message='author_required';end if;
   if action='squad.remove' and g.owner_id<>actor then raise exception using errcode='P0001',message='owner_required';end if;
   delete from rise.squad_reactions where group_id=target and post_id=post;
   delete from rise_private.squad_previews where group_id=target and post_id=post;
   update rise.squad_posts set status=case when action='squad.withdraw' then 'withdrawn' else 'removed' end,snapshot=null,revision=next_revision,updated_at=now() where group_id=target and id=post;
  end if;
 end if;
 update rise.groups set revision=next_revision,updated_at=now() where id=target;return next_revision;
end;$$;

create function rise_private.prune_squad_previews(batch_size integer default 200) returns integer
language plpgsql security definer set search_path='' as $$
declare removed integer;
begin
 if batch_size is null or batch_size<1 or batch_size>500 then raise exception using errcode='22023',message='invalid_batch_size';end if;
 delete from rise_private.squad_previews where id in(select id from rise_private.squad_previews where expires_at<=now() order by expires_at,id limit batch_size for update skip locked);
 get diagnostics removed=row_count;return removed;
end;$$;

-- Removal is part of pre-suppression authorization, not deferred to provider
-- success. Include former memberships so retained posts cannot bypass cleanup.
create or replace function rise_private.prepare_group_deletion() returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=rise_private.group_actor();g rise.groups;
begin
 if not rise_private.active_session() then raise exception using errcode='P0001',message='sign_in_required';end if;
 perform pg_advisory_xact_lock(hashtextextended('rise-personal:'||actor::text,0));
 for g in select gr.* from rise.groups gr where exists(select 1 from rise.memberships m where m.group_id=gr.id and m.user_id=actor)
 or exists(select 1 from rise.squad_posts p where p.group_id=gr.id and p.author_id=actor)
 or exists(select 1 from rise.squad_reactions r where r.group_id=gr.id and r.user_id=actor)
 or exists(select 1 from rise_private.squad_previews p where p.group_id=gr.id and p.user_id=actor) order by gr.id for update loop
  if g.owner_id=actor then raise exception using errcode='P0001',message='ownership_resolution_required';end if;
 end loop;
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
 and not exists(select 1 from rise_private.squad_previews where user_id=(select rise_private.group_actor()));
$$;
create or replace function rise_private.purge_group_identity(subject uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from rise_private.deletion_ledger where user_id=subject) then raise exception using errcode='42501',message='suppression_required';end if;
 perform pg_advisory_xact_lock(hashtextextended('rise-personal:'||subject::text,0));
 perform 1 from rise.groups g where g.owner_id=subject or exists(select 1 from rise.memberships m where m.group_id=g.id and m.user_id=subject)
 or exists(select 1 from rise.squad_posts p where p.group_id=g.id and p.author_id=subject)
 or exists(select 1 from rise.squad_reactions r where r.group_id=g.id and r.user_id=subject)
 or exists(select 1 from rise_private.squad_previews p where p.group_id=g.id and p.user_id=subject) order by g.id for update;
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
 return to_regclass('rise.notification_jobs') is null;
end;

grant create on schema rise_private to rise_group_guard;
alter function rise_private.stage_squad_preview(uuid,integer,uuid,uuid,integer,bigint,jsonb) owner to rise_group_guard;
alter function rise_private.change_squad(uuid,integer,jsonb) owner to rise_group_guard;
alter function rise_private.prune_squad_previews(integer) owner to rise_group_guard;
revoke all on function rise_private.stage_squad_preview(uuid,integer,uuid,uuid,integer,bigint,jsonb),rise_private.change_squad(uuid,integer,jsonb),rise_private.prune_squad_previews(integer)
 from public,anon,authenticated,service_role,rise_bff,rise_worker,rise_lifecycle;
grant execute on function rise_private.stage_squad_preview(uuid,integer,uuid,uuid,integer,bigint,jsonb),rise_private.change_squad(uuid,integer,jsonb) to rise_bff;
grant execute on function rise_private.prune_squad_previews(integer) to rise_worker;
revoke create on schema rise_private from rise_group_guard;
revoke rise_group_guard from postgres;
