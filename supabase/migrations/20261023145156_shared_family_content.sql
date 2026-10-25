-- GROUP-02: group-owned content. Every write locks actor then group and shares
-- the existing group revision/receipt transaction. No private journey access.
create table rise.family_tasks (
 id uuid primary key,group_id uuid not null references rise.groups(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 160 and title !~ '[[:cntrl:]]'),
 notes text not null check(length(notes)<=800 and translate(notes,E'\n\t','') !~ '[[:cntrl:]]'),
 assigned_member_id uuid,date date not null check(date between date '0001-01-01' and date '9999-12-31'),
 time text check(time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),weekdays smallint[] not null default '{}',
 archived boolean not null default false,revision integer not null check(revision>0),
 unique(group_id,id),foreign key(group_id,assigned_member_id) references rise.memberships(group_id,id),
 check(cardinality(weekdays)<=7 and weekdays<@array[0,1,2,3,4,5,6]::smallint[] and array_position(weekdays,null) is null)
);
create index family_tasks_assignee on rise.family_tasks(group_id,assigned_member_id);
create table rise.task_occurrences (
 group_id uuid not null references rise.groups(id) on delete cascade,task_id uuid not null,
 date date not null check(date between date '0001-01-01' and date '9999-12-31'),
 completed boolean not null,completed_by uuid,completed_at timestamptz,
 title text not null check(length(btrim(title)) between 1 and 160),notes text not null check(length(notes)<=800),
 assigned_member_id uuid,time text check(time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),timezone text not null,
 task_revision integer not null check(task_revision>0),revision integer not null check(revision>=task_revision),
 primary key(group_id,task_id,date),foreign key(group_id,task_id) references rise.family_tasks(group_id,id) on delete cascade,
 foreign key(group_id,completed_by) references rise.memberships(group_id,id),
 foreign key(group_id,assigned_member_id) references rise.memberships(group_id,id),
 check((completed and completed_by is not null and completed_at is not null) or (not completed and completed_by is null and completed_at is null))
);
create index task_occurrences_date on rise.task_occurrences(group_id,date,task_id);
create index task_occurrences_actor on rise.task_occurrences(group_id,completed_by);
create index task_occurrences_assignee on rise.task_occurrences(group_id,assigned_member_id);
create table rise.shared_lists (
 id uuid primary key,group_id uuid not null references rise.groups(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 80 and name !~ '[[:cntrl:]]'),
 archived boolean not null default false,revision integer not null check(revision>0),unique(group_id,id)
);
create table rise.shared_items (
 id uuid primary key,group_id uuid not null references rise.groups(id) on delete cascade,list_id uuid not null,
 text text not null check(length(text)<=160 and text !~ '[[:cntrl:]]'),quantity text not null check(length(quantity)<=80),
 checked boolean not null default false,removed boolean not null default false,position integer,
 revision integer not null check(revision>0),unique(group_id,list_id,id),
 foreign key(group_id,list_id) references rise.shared_lists(group_id,id) on delete cascade,
 unique(group_id,list_id,position) deferrable initially deferred,
 check((removed and position is null and text='' and quantity='' and not checked) or (not removed and position between 1 and 1000000 and length(btrim(text))>0))
);
create table rise_private.shared_limits (
 singleton boolean primary key default true check(singleton),
 tasks_per_group integer not null default 500 check(tasks_per_group between 1 and 5000),
 lists_per_group integer not null default 100 check(lists_per_group between 1 and 1000),
 items_per_list integer not null default 1000 check(items_per_list between 1 and 10000),
 occurrences_per_task integer not null default 20000 check(occurrences_per_task between 1 and 100000)
);
insert into rise_private.shared_limits default values;
alter table rise_private.shared_limits enable row level security;
alter table rise_private.shared_limits force row level security;
revoke all on rise_private.shared_limits from public,anon,authenticated,service_role,rise_bff,rise_worker,rise_lifecycle;
grant select on rise_private.shared_limits to rise_group_guard;
create policy group_guard on rise_private.shared_limits for select to rise_group_guard using(true);
do $$declare t text;begin
 foreach t in array array['family_tasks','task_occurrences','shared_lists','shared_items'] loop
  execute format('alter table rise.%I enable row level security',t);execute format('alter table rise.%I force row level security',t);
  execute format('revoke all on rise.%I from public,anon,authenticated,service_role,rise_bff,rise_worker,rise_lifecycle',t);
  execute format('grant select,insert,update,delete on rise.%I to rise_group_guard',t);
  execute format('create policy group_guard on rise.%I for all to rise_group_guard using(true) with check(true)',t);
  execute format('grant select on rise.%I to rise_bff,authenticated',t);
  execute format('create policy shared_members on rise.%I for select to rise_bff,authenticated using(rise_private.group_access(group_id))',t);
 end loop;
end;$$;
alter table rise.group_receipts drop constraint group_receipts_kind_check;
alter table rise.group_receipts add constraint group_receipts_kind_check check(kind in
 ('group.create','group.rename','group.archive','group.restore','group.leave','group.delete','group.invite','group.transfer','group.remove','group.revoke','group.preferences','group.accept',
 'task.create','task.edit','task.archive','task.restore','task.complete','list.create','list.rename','list.archive','list.restore','item.add','item.edit','item.check','item.move','item.remove'));

create function rise_private.change_shared_content(target uuid,expected integer,input jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare actor uuid:=rise_private.group_actor();g rise.groups;member uuid;t rise.family_tasks;l rise.shared_lists;i rise.shared_items;o rise.task_occurrences;
 action text:=input->>'kind';allowed text[];task uuid;list uuid;item uuid;assignee uuid;day date;days smallint[];
 limits rise_private.shared_limits;next_revision integer;order_ids uuid[];anchor uuid;anchor_position integer;
begin
 if not rise_private.active_session() then raise exception using errcode='P0001',message='sign_in_required';end if;
 perform pg_advisory_xact_lock(hashtextextended('rise-personal:'||actor::text,0));
 select * into g from rise.groups where id=target for update;
 if not found or not rise_private.group_access(target) or g.kind<>'family' then raise exception using errcode='P0001',message='group_unavailable';end if;
 if g.archived then raise exception using errcode='P0001',message='group_archived';end if;
 if expected is null or g.revision<>expected then raise exception using errcode='P0001',message='group_changed';end if;
 if g.revision=2147483647 then raise exception using errcode='P0001',message='revision_limit';end if;
 next_revision:=g.revision+1;
 select id into strict member from rise.memberships where group_id=target and user_id=actor and status='active';
 select * into strict limits from rise_private.shared_limits;
 case action
 when 'task.create','task.edit' then allowed:=array['kind','groupId','taskId','title','notes','assignee','date','time','weekdays'];
 when 'task.archive','task.restore' then allowed:=array['kind','groupId','taskId'];
 when 'task.complete' then allowed:=array['kind','groupId','taskId','date','completed'];
 when 'list.create','list.rename' then allowed:=array['kind','groupId','listId','name'];
 when 'list.archive','list.restore' then allowed:=array['kind','groupId','listId'];
 when 'item.add','item.edit' then allowed:=array['kind','groupId','listId','itemId','text','quantity'];
 when 'item.check' then allowed:=array['kind','groupId','listId','itemId','checked'];
 when 'item.move' then allowed:=array['kind','groupId','listId','itemId','beforeId'];
 when 'item.remove' then allowed:=array['kind','groupId','listId','itemId'];
 else raise exception using errcode='P0001',message='invalid_input';end case;
 if jsonb_typeof(input)<>'object' or not input ?& allowed or exists(select 1 from jsonb_object_keys(input) k where not k=any(allowed))
 or (input->>'groupId')::uuid is distinct from target then raise exception using errcode='P0001',message='invalid_input';end if;
 if action like 'task.%' then
  task:=(input->>'taskId')::uuid;
  if action<>'task.create' then
   select * into t from rise.family_tasks where group_id=target and id=task;
   if not found then raise exception using errcode='P0001',message='shared_unavailable';end if;
   if t.archived and action not in ('task.restore','task.complete') then raise exception using errcode='P0001',message='shared_archived';end if;
  end if;
  if action in ('task.create','task.edit') then
   if jsonb_typeof(input->'title')<>'string' or jsonb_typeof(input->'notes')<>'string' or jsonb_typeof(input->'date')<>'string'
    or jsonb_typeof(input->'weekdays')<>'array' or jsonb_typeof(input->'time') not in ('string','null') or jsonb_typeof(input->'assignee') not in ('string','null')
    or input->>'date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception using errcode='P0001',message='invalid_input';end if;
   if jsonb_array_length(input->'weekdays')>7 or exists(select 1 from jsonb_array_elements(input->'weekdays') d where jsonb_typeof(d)<>'number' or d::text !~ '^[0-6]$') then raise exception using errcode='P0001',message='invalid_input';end if;
   select coalesce(array_agg(value::smallint order by value::smallint),'{}') into days from jsonb_array_elements_text(input->'weekdays');
   if cardinality(days)<>(select count(distinct d) from unnest(days) d) then raise exception using errcode='P0001',message='invalid_input';end if;
   assignee:=(input->>'assignee')::uuid;day:=(input->>'date')::date;
   if assignee is not null and not exists(select 1 from rise.memberships where group_id=target and id=assignee and status='active') then raise exception using errcode='P0001',message='member_unavailable';end if;
   if action='task.create' then
    if (select count(*) from rise.family_tasks where group_id=target)>=limits.tasks_per_group then raise exception using errcode='P0001',message='shared_limit';end if;
    insert into rise.family_tasks(id,group_id,title,notes,assigned_member_id,date,time,weekdays,revision)
     values(task,target,input->>'title',input->>'notes',assignee,day,input->>'time',days,next_revision);
   else
    update rise.family_tasks set title=input->>'title',notes=input->>'notes',assigned_member_id=assignee,date=day,time=input->>'time',weekdays=days,revision=next_revision where id=task and group_id=target;
   end if;
  elsif action='task.complete' then
   if jsonb_typeof(input->'completed')<>'boolean' or jsonb_typeof(input->'date')<>'string' or input->>'date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception using errcode='P0001',message='invalid_input';end if;
   day:=(input->>'date')::date;select * into o from rise.task_occurrences where group_id=target and task_id=task and date=day;
   if (input->>'completed')::boolean then
    -- A second fresh completion does not replace the first actor/time/snapshot.
    if not coalesce(o.completed,false) then
     if t.archived then raise exception using errcode='P0001',message='shared_archived';end if;
     if not ((cardinality(t.weekdays)=0 and day=t.date) or (cardinality(t.weekdays)>0 and day>=t.date and extract(dow from day)::smallint=any(t.weekdays))) then raise exception using errcode='P0001',message='occurrence_unavailable';end if;
     if o.task_id is null and (select count(*) from rise.task_occurrences where group_id=target and task_id=task)>=limits.occurrences_per_task then raise exception using errcode='P0001',message='shared_limit';end if;
     insert into rise.task_occurrences(group_id,task_id,date,completed,completed_by,completed_at,title,notes,assigned_member_id,time,timezone,task_revision,revision)
      values(target,task,day,true,member,now(),t.title,t.notes,t.assigned_member_id,t.time,g.timezone,t.revision,next_revision)
      on conflict(group_id,task_id,date) do update set completed=true,completed_by=excluded.completed_by,completed_at=excluded.completed_at,title=excluded.title,notes=excluded.notes,assigned_member_id=excluded.assigned_member_id,time=excluded.time,timezone=excluded.timezone,task_revision=excluded.task_revision,revision=excluded.revision;
    end if;
   else
    -- Existing explicit reports stay correctable after plan/archive changes.
    if o.task_id is null then raise exception using errcode='P0001',message='occurrence_unavailable';end if;
    if o.completed then update rise.task_occurrences set completed=false,completed_by=null,completed_at=null,revision=next_revision where group_id=target and task_id=task and date=day;end if;
   end if;
  else update rise.family_tasks set archived=action='task.archive',revision=next_revision where id=task and group_id=target;
  end if;
 else
  list:=(input->>'listId')::uuid;
  if action<>'list.create' then
   select * into l from rise.shared_lists where group_id=target and id=list;
   if not found then raise exception using errcode='P0001',message='shared_unavailable';end if;
   if l.archived and action<>'list.restore' then raise exception using errcode='P0001',message='shared_archived';end if;
  end if;
  if action in ('list.create','list.rename') then
   if jsonb_typeof(input->'name')<>'string' then raise exception using errcode='P0001',message='invalid_input';end if;
   if action='list.create' then
    if (select count(*) from rise.shared_lists where group_id=target)>=limits.lists_per_group then raise exception using errcode='P0001',message='shared_limit';end if;
    insert into rise.shared_lists(id,group_id,name,revision) values(list,target,input->>'name',next_revision);
   else update rise.shared_lists set name=input->>'name',revision=next_revision where group_id=target and id=list;end if;
  elsif action in ('list.archive','list.restore') then update rise.shared_lists set archived=action='list.archive',revision=next_revision where group_id=target and id=list;
  else
   item:=(input->>'itemId')::uuid;
   if action<>'item.add' then
    select * into i from rise.shared_items where group_id=target and list_id=list and id=item and not removed;
    if not found then raise exception using errcode='P0001',message='shared_unavailable';end if;
   end if;
   if action in ('item.add','item.edit') then
    if jsonb_typeof(input->'text')<>'string' or jsonb_typeof(input->'quantity')<>'string' then raise exception using errcode='P0001',message='invalid_input';end if;
    if action='item.add' then
     -- Tombstones count too: an old ID is never recycled by a queued write.
     if (select count(*) from rise.shared_items where group_id=target and list_id=list)>=limits.items_per_list then raise exception using errcode='P0001',message='shared_limit';end if;
     insert into rise.shared_items(id,group_id,list_id,text,quantity,position,revision)
      select item,target,list,input->>'text',input->>'quantity',coalesce(max(position),0)+1,next_revision from rise.shared_items where group_id=target and list_id=list;
    else update rise.shared_items set text=input->>'text',quantity=input->>'quantity',revision=next_revision where id=item and group_id=target and list_id=list;end if;
   elsif action='item.check' then
    if jsonb_typeof(input->'checked')<>'boolean' then raise exception using errcode='P0001',message='invalid_input';end if;
    update rise.shared_items set checked=(input->>'checked')::boolean,revision=next_revision where id=item and group_id=target and list_id=list;
   else
    select coalesce(array_agg(id order by position),'{}') into order_ids from rise.shared_items where group_id=target and list_id=list and not removed and id<>item;
    if action='item.move' then
     if jsonb_typeof(input->'beforeId') not in ('string','null') then raise exception using errcode='P0001',message='invalid_input';end if;
     anchor:=(input->>'beforeId')::uuid;anchor_position:=array_position(order_ids,anchor);
     if anchor is not null and anchor_position is null then raise exception using errcode='P0001',message='shared_unavailable';end if;
     if anchor is null then order_ids:=array_append(order_ids,item);
     else order_ids:=order_ids[1:anchor_position-1]||array[item]||order_ids[anchor_position:cardinality(order_ids)];end if;
    else update rise.shared_items set removed=true,position=null,text='',quantity='',checked=false,revision=next_revision where id=item and group_id=target and list_id=list;
    end if;
    update rise.shared_items s set position=p.ordinality,revision=next_revision from unnest(order_ids) with ordinality p(id,ordinality)
     where s.id=p.id and s.group_id=target and s.list_id=list and s.position is distinct from p.ordinality;
   end if;
   update rise.shared_lists set revision=next_revision where group_id=target and id=list;
  end if;
 end if;
 update rise.groups set revision=next_revision,updated_at=now() where id=target;return next_revision;
end;$$;
grant rise_group_guard to postgres;
grant create on schema rise_private to rise_group_guard;
alter function rise_private.change_shared_content(uuid,integer,jsonb) owner to rise_group_guard;
revoke all on function rise_private.change_shared_content(uuid,integer,jsonb) from public,anon,authenticated,service_role,rise_bff,rise_worker,rise_lifecycle;
grant execute on function rise_private.change_shared_content(uuid,integer,jsonb) to rise_bff;
revoke create on schema rise_private from rise_group_guard;
revoke rise_group_guard from postgres;

-- All new actor/assignee references target the stable group membership ID, not
-- Auth identity. Existing suppression/purge scrubs the member in place; history
-- survives with no nickname/user ID. Group deletion cascades every content row.
-- Future squad/job tables still fail closed until their own hooks are verified.
create or replace function rise_private.deletion_integrations_ready() returns boolean language sql stable security invoker set search_path=''
begin atomic
 return to_regclass('rise.squad_posts') is null and to_regclass('rise.squad_reactions') is null and to_regclass('rise.notification_jobs') is null;
end;
