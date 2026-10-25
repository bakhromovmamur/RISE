-- GROUP-02 / PRD-06. Private opaque references survive shared-record removal.
-- No group content, permissions or membership is copied into the personal store.
alter table rise.daily_priorities add column group_id uuid,add column task_id uuid,add column task_date date;
alter table rise.daily_priorities drop constraint daily_priorities_kind_check,drop constraint daily_priorities_check,
 drop constraint daily_priorities_owner_id_date_kind_habit_id_goal_id_milest_key;
alter table rise.daily_priorities add constraint daily_priorities_kind_check check(kind in ('habit','milestone','task')),
 add constraint daily_priorities_reference check(
  (kind='habit' and habit_id is not null and goal_id is null and milestone_id is null and group_id is null and task_id is null and task_date is null)
  or (kind='milestone' and habit_id is null and goal_id is not null and milestone_id is not null and group_id is null and task_id is null and task_date is null)
  or (kind='task' and habit_id is null and goal_id is null and milestone_id is null and group_id is not null and task_id is not null and task_date is not null and task_date between date '0001-01-01' and date '9999-12-31')),
 add constraint daily_priorities_unique_reference unique nulls not distinct(owner_id,date,kind,habit_id,goal_id,milestone_id,group_id,task_id,task_date) deferrable initially deferred;
-- These identifiers deliberately have no shared-parent cascade: an unavailable
-- selection must remain visible/removable without erasing the other priorities.
-- Existing owner/session RLS and Auth-root private purge remain unchanged.

create function rise_private.lock_shared_priority_groups(targets uuid[]) returns void language plpgsql security definer set search_path='' as $$
begin
 if not rise_private.active_session() then raise exception using errcode='P0001',message='sign_in_required';end if;
 if targets is null or cardinality(targets)>300 or array_position(targets,null) is not null then raise exception using errcode='P0001',message='invalid_input';end if;
 perform pg_advisory_xact_lock(hashtextextended('rise-personal:'||rise_private.group_actor()::text,0));
 -- The batch prelocks every referenced authorized group in this order. Readers
 -- share these locks; membership/content mutations take FOR UPDATE instead.
 perform 1 from rise.groups g where g.id=any(targets) and rise_private.group_access(g.id) order by g.id for share;
end;$$;
create function rise_private.authorize_shared_priorities(refs jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare r jsonb;targets uuid[];day date;
begin
 if not rise_private.active_session() then raise exception using errcode='P0001',message='sign_in_required';end if;
 if refs is null or jsonb_typeof(refs)<>'array' or jsonb_array_length(refs)>3 then raise exception using errcode='P0001',message='invalid_input';end if;
 for r in select value from jsonb_array_elements(refs) loop
  if jsonb_typeof(r)<>'object' or not r ?& array['groupId','taskId','date'] or (select count(*) from jsonb_object_keys(r))<>3
   or jsonb_typeof(r->'groupId')<>'string' or jsonb_typeof(r->'taskId')<>'string' or jsonb_typeof(r->'date')<>'string'
   or r->>'date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception using errcode='P0001',message='invalid_input';end if;
 end loop;
 select coalesce(array_agg(distinct (value->>'groupId')::uuid),'{}') into targets from jsonb_array_elements(refs);
 perform rise_private.lock_shared_priority_groups(targets);
 for r in select value from jsonb_array_elements(refs) loop
  day:=(r->>'date')::date;
  if not exists(select 1 from rise.family_tasks t join rise.groups g on g.id=t.group_id where t.id=(r->>'taskId')::uuid and t.group_id=(r->>'groupId')::uuid
   and g.kind='family' and rise_private.group_access(g.id,false,true) and not t.archived
   and ((cardinality(t.weekdays)=0 and t.date=day) or (cardinality(t.weekdays)>0 and day>=t.date and extract(dow from day)::smallint=any(t.weekdays)))) then return false;end if;
 end loop;
 return true;
end;$$;
grant rise_group_guard to postgres;
grant create on schema rise_private to rise_group_guard;
alter function rise_private.lock_shared_priority_groups(uuid[]) owner to rise_group_guard;
alter function rise_private.authorize_shared_priorities(jsonb) owner to rise_group_guard;
revoke all on function rise_private.lock_shared_priority_groups(uuid[]),rise_private.authorize_shared_priorities(jsonb) from public,anon,authenticated,service_role,rise_bff,rise_worker,rise_lifecycle;
grant execute on function rise_private.lock_shared_priority_groups(uuid[]),rise_private.authorize_shared_priorities(jsonb) to rise_bff;
revoke create on schema rise_private from rise_group_guard;
revoke rise_group_guard from postgres;
