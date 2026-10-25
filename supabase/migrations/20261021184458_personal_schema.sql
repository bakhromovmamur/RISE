-- AUTH-02: independent account records. No guest/device data is read or migrated.
set lock_timeout = '5s';
set statement_timeout = '30s';

create function rise_private.personal_json(value jsonb, allowed text[], required text[], maximum integer)
returns boolean language sql immutable parallel safe security invoker set search_path = ''
begin atomic
  return coalesce(jsonb_typeof(value) = 'object' and octet_length(value::text) <= maximum
    and array(select jsonb_object_keys(value)) <@ allowed
    and required <@ array(select jsonb_object_keys(value)), false);
end;
revoke all on function rise_private.personal_json(jsonb, text[], text[], integer) from public, anon, service_role;
grant execute on function rise_private.personal_json(jsonb, text[], text[], integer) to rise_bff, authenticated;

create table rise.profiles (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) <= 80),
  language text not null check (language in ('en','uz','ru')),
  timezone text not null check (char_length(timezone) between 1 and 100),
  started_on date not null, onboarded boolean not null
);
create table rise.account_preferences (
  owner_id uuid primary key references rise.profiles(owner_id) on delete cascade,
  selected_reward_id uuid, equipped_xp integer check (equipped_xp = 250),
  data jsonb not null check (rise_private.personal_json(data,
    array['appearance','reminders','quietStart','quietEnd','sound','haptics','reduceMotion','golden'],
    array['appearance','reminders','quietStart','quietEnd','sound','haptics','reduceMotion','golden'], 4096))
);
create table rise.habits (
  owner_id uuid not null references rise.profiles(owner_id) on delete cascade,
  id uuid not null, position integer not null check (position >= 0),
  data jsonb not null check (rise_private.personal_json(data,
    array['name','icon','area','reason','type','unit','created','archivedAt'],
    array['name','icon','area','reason','type','unit','created'], 16384)
    and data->>'type' in ('count','duration','check') and char_length(data->>'name') between 1 and 160),
  primary key (owner_id,id)
);
create table rise.habit_versions (
  owner_id uuid not null, habit_id uuid not null, effective date not null,
  data jsonb not null check (rise_private.personal_json(data,
    array['full','tiny','days','cue','reminder'], array['full','tiny','days','cue','reminder'], 16384)
    and jsonb_typeof(data->'full') = 'number' and (data->>'full')::numeric > 0
    and (data->'tiny' = 'null'::jsonb or (jsonb_typeof(data->'tiny') = 'number' and (data->>'tiny')::numeric > 0))
    and jsonb_typeof(data->'days') = 'array' and jsonb_array_length(data->'days') between 1 and 7),
  primary key (owner_id,habit_id,effective),
  foreign key (owner_id,habit_id) references rise.habits(owner_id,id) deferrable initially deferred
);
create table rise.habit_days (
  owner_id uuid not null references rise.profiles(owner_id) on delete cascade,
  date date not null, primary key (owner_id,date)
);
create table rise.habit_occurrences (
  owner_id uuid not null, date date not null, habit_id uuid not null,
  position integer not null check (position >= 0), check_kind text check (check_kind in ('full','tiny')),
  data jsonb not null check (rise_private.personal_json(data,
    array['name','icon','type','unit','full','tiny','cue'], array['name','icon','type','unit','full','tiny','cue'], 16384)
    and (data->>'full')::numeric > 0 and (check_kind is distinct from 'tiny' or data->'tiny' <> 'null'::jsonb)),
  xp integer generated always as (case check_kind when 'full' then 20 when 'tiny' then 10 else 0 end) stored,
  primary key (owner_id,date,habit_id),
  foreign key (owner_id,habit_id) references rise.habits(owner_id,id) deferrable initially deferred,
  foreign key (owner_id,date) references rise.habit_days(owner_id,date) deferrable initially deferred
);
create index habit_occurrences_habit on rise.habit_occurrences(owner_id,habit_id,date);
create table rise.goals (
  owner_id uuid not null references rise.profiles(owner_id) on delete cascade,
  id uuid not null, position integer not null check (position >= 0),
  data jsonb not null check (rise_private.personal_json(data,
    array['title','reason','targetDate','status','createdOn','completedOn','archivedOn'],
    array['title','reason','targetDate','status','createdOn'], 16384)
    and data->>'status' in ('active','paused','completed','archived') and char_length(data->>'title') between 1 and 160),
  primary key (owner_id,id)
);
create table rise.goal_milestones (
  owner_id uuid not null, goal_id uuid not null, id uuid not null,
  position integer not null check (position >= 0), retired boolean not null default false,
  data jsonb not null check (rise_private.personal_json(data, array['title','completedOn'], array['title'], 2048)
    and char_length(data->>'title') between 1 and 160),
  primary key (owner_id,goal_id,id),
  foreign key (owner_id,goal_id) references rise.goals(owner_id,id) deferrable initially deferred
);
create table rise.goal_habits (
  owner_id uuid not null, goal_id uuid not null, habit_id uuid not null,
  position integer not null check (position >= 0), primary key (owner_id,goal_id,habit_id),
  foreign key (owner_id,goal_id) references rise.goals(owner_id,id) deferrable initially deferred,
  foreign key (owner_id,habit_id) references rise.habits(owner_id,id) deferrable initially deferred
);
create index goal_habits_habit on rise.goal_habits(owner_id,habit_id);
create table rise.personal_rewards (
  owner_id uuid not null references rise.profiles(owner_id) on delete cascade,
  id uuid not null, position integer not null check (position >= 0),
  condition_kind text not null check (condition_kind in ('goal','weekly')),
  goal_id uuid, week date, target numeric, previous_attempt_id uuid,
  data jsonb not null check (rise_private.personal_json(data,
    array['name','createdOn','earnedOn','enjoyedOn','correctedOn','archivedOn'], array['name','createdOn'], 4096)
    and char_length(data->>'name') between 1 and 160),
  primary key (owner_id,id),
  check ((condition_kind = 'goal' and goal_id is not null and week is null and target is null)
    or (condition_kind = 'weekly' and goal_id is null and week is not null and target >= 1 and target < 'Infinity'::numeric)),
  check (previous_attempt_id is null or previous_attempt_id <> id),
  foreign key (owner_id,goal_id) references rise.goals(owner_id,id) deferrable initially deferred,
  foreign key (owner_id,previous_attempt_id) references rise.personal_rewards(owner_id,id) deferrable initially deferred
);
create index personal_rewards_goal on rise.personal_rewards(owner_id,goal_id);
create index personal_rewards_previous on rise.personal_rewards(owner_id,previous_attempt_id);
alter table rise.account_preferences add foreign key (owner_id,selected_reward_id)
  references rise.personal_rewards(owner_id,id) deferrable initially deferred;
create index account_preferences_reward on rise.account_preferences(owner_id,selected_reward_id);
create table rise.priority_days (
  owner_id uuid not null references rise.profiles(owner_id) on delete cascade,
  date date not null, primary key (owner_id,date)
);
create table rise.daily_priorities (
  owner_id uuid not null, date date not null, slot integer not null check (slot between 0 and 2),
  kind text not null check (kind in ('habit','milestone')), habit_id uuid, goal_id uuid, milestone_id uuid,
  primary key (owner_id,date,slot),
  unique nulls not distinct (owner_id,date,kind,habit_id,goal_id,milestone_id) deferrable initially deferred,
  check ((kind = 'habit' and habit_id is not null and goal_id is null and milestone_id is null)
    or (kind = 'milestone' and habit_id is null and goal_id is not null and milestone_id is not null)),
  foreign key (owner_id,date) references rise.priority_days(owner_id,date) deferrable initially deferred,
  foreign key (owner_id,habit_id) references rise.habits(owner_id,id) deferrable initially deferred,
  foreign key (owner_id,goal_id,milestone_id) references rise.goal_milestones(owner_id,goal_id,id) deferrable initially deferred
);
create index daily_priorities_habit on rise.daily_priorities(owner_id,habit_id);
create index daily_priorities_milestone on rise.daily_priorities(owner_id,goal_id,milestone_id);
create table rise.cosmetic_claims (
  owner_id uuid not null references rise.profiles(owner_id) on delete cascade,
  xp integer not null check (xp in (100,250,500,800,1200)), primary key (owner_id,xp)
);
create table rise.prayer_settings (
  owner_id uuid primary key references rise.profiles(owner_id) on delete cascade,
  data jsonb not null check (rise_private.personal_json(data, array['preferences','fajr','backupEnabled'], array['preferences','fajr','backupEnabled'], 16384))
);
create table rise.prayer_reminders (
  owner_id uuid not null references rise.profiles(owner_id) on delete cascade,
  prayer text not null check (prayer in ('fajr','dhuhr','asr','maghrib','isha')),
  data jsonb not null check (rise_private.personal_json(data, array['preparation','due'], array['preparation','due'], 1024)),
  primary key (owner_id,prayer)
);
create table rise.prayer_days (
  owner_id uuid not null references rise.profiles(owner_id) on delete cascade,
  date date not null,
  data jsonb not null check (rise_private.personal_json(data, array['source','sample','timezone','sunrise'], array['source','sample','timezone'], 16384)
    and data->'sample' = 'false'::jsonb), primary key (owner_id,date)
);
create table rise.prayer_windows (
  owner_id uuid not null, date date not null, prayer text not null check (prayer in ('fajr','dhuhr','asr','maghrib','isha')),
  data jsonb not null check (rise_private.personal_json(data,
    array['begins','target','ends','beginsAt','targetAt','endsAt'], array['begins','target','ends','beginsAt','targetAt','endsAt'], 4096)
    and (data->>'beginsAt')::timestamptz <= (data->>'targetAt')::timestamptz
    and (data->>'targetAt')::timestamptz < (data->>'endsAt')::timestamptz),
  primary key (owner_id,date,prayer),
  foreign key (owner_id,date) references rise.prayer_days(owner_id,date) deferrable initially deferred
);
create table rise.prayer_records (
  owner_id uuid not null, date date not null, prayer text not null,
  check_kind text not null check (check_kind in ('on_time','later','missed')),
  data jsonb not null check (rise_private.personal_json(data, array['performedAt','recordedAt'], array['recordedAt'], 2048)),
  primary key (owner_id,date,prayer),
  foreign key (owner_id,date,prayer) references rise.prayer_windows(owner_id,date,prayer) deferrable initially deferred
);
create table rise.prayer_pauses (
  owner_id uuid not null references rise.profiles(owner_id) on delete cascade,
  id uuid not null, position integer not null check (position >= 0), from_key text not null, through_key text,
  check (from_key ~ '^\d{4}-\d{2}-\d{2}:[0-4]$' and substring(from_key,1,10)::date is not null),
  check (through_key is null or (through_key ~ '^\d{4}-\d{2}-\d{2}:[0-4]$' and substring(through_key,1,10)::date is not null and through_key >= from_key)),
  primary key (owner_id,id)
);
create unique index prayer_pauses_active on rise.prayer_pauses(owner_id) where through_key is null;
create table rise.fajr_plans (
  owner_id uuid not null references rise.profiles(owner_id) on delete cascade,
  date date not null,
  data jsonb not null check (rise_private.personal_json(data,
    array['bedtime','wakeLead','backupMinutes','message','placement','enabled','backupEnabled'],
    array['bedtime','wakeLead','backupMinutes','message','placement','enabled'], 16384)
    and (data->>'wakeLead')::numeric between 0 and 120 and (data->>'backupMinutes')::numeric between 0 and 120),
  primary key (owner_id,date)
);
create table rise.fajr_acknowledgments (
  owner_id uuid not null references rise.profiles(owner_id) on delete cascade,
  date date not null, acknowledged_at timestamptz not null default now(), primary key (owner_id,date)
);
create table rise.reflections (
  owner_id uuid not null references rise.profiles(owner_id) on delete cascade,
  date date not null,
  data jsonb not null check (rise_private.personal_json(data, array['manageable','smaller'], array['manageable','smaller'], 65536)
    and char_length(data->>'manageable') <= 5000 and char_length(data->>'smaller') <= 5000),
  primary key (owner_id,date)
);
create table rise.saved_work_breaks (
  owner_id uuid not null, date date not null, prayer text not null,
  active boolean not null,
  data jsonb not null check (rise_private.personal_json(data, array['stage','note','wrapUsed'], array['stage','note','wrapUsed'], 32768)
    and data->>'stage' in ('save','away','returned') and char_length(data->>'note') <= 5000),
  primary key (owner_id,date,prayer),
  foreign key (owner_id,date,prayer) references rise.prayer_windows(owner_id,date,prayer) deferrable initially deferred
);
create unique index saved_work_breaks_active on rise.saved_work_breaks(owner_id) where active;
create table rise.personal_receipts (
  owner_id uuid not null references rise.profiles(owner_id) on delete cascade,
  operation_id uuid not null, request_hash bytea not null check (octet_length(request_hash) = 32),
  result jsonb not null check (rise_private.personal_json(result, array['operationId','operationRevision','xp'], array['operationId','operationRevision','xp'], 4096)),
  primary key (owner_id,operation_id)
);

-- Every record has server revision/time provenance. Table names are fixed migration constants.
do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','account_preferences','habits','habit_versions','habit_days','habit_occurrences',
    'goals','goal_milestones','goal_habits','personal_rewards','priority_days','daily_priorities','cosmetic_claims',
    'prayer_settings','prayer_reminders','prayer_days','prayer_windows','prayer_records','prayer_pauses',
    'fajr_plans','fajr_acknowledgments','reflections','saved_work_breaks','personal_receipts']
  loop
    execute format('alter table rise.%I add column revision bigint not null check (revision between 1 and 9007199254740991), add column created_at timestamptz not null default now(), add column updated_at timestamptz not null default now()', table_name);
    execute format('alter table rise.%I enable row level security', table_name);
    execute format('alter table rise.%I force row level security', table_name);
    execute format('revoke all on rise.%I from public, anon, authenticated, service_role, rise_bff, rise_worker, rise_lifecycle', table_name);
    execute format('grant select on rise.%I to authenticated, rise_bff', table_name);
    execute format('grant insert, update, delete on rise.%I to rise_bff', table_name);
    execute format('create policy personal_read on rise.%I for select to authenticated, rise_bff using (owner_id = (select auth.uid()) and (select rise_private.active_session()))', table_name);
    execute format('create policy personal_insert on rise.%I for insert to rise_bff with check (owner_id = (select auth.uid()) and (select rise_private.active_session()))', table_name);
    execute format('create policy personal_update on rise.%I for update to rise_bff using (owner_id = (select auth.uid()) and (select rise_private.active_session())) with check (owner_id = (select auth.uid()) and (select rise_private.active_session()))', table_name);
    execute format('create policy personal_delete on rise.%I for delete to rise_bff using (owner_id = (select auth.uid()) and (select rise_private.active_session()))', table_name);
    execute format('create policy personal_admin on rise.%I for all to postgres using (true) with check (true)', table_name);
  end loop;
end $$;
revoke delete on rise.profiles from rise_bff;
revoke update, delete on rise.personal_receipts from rise_bff;
revoke all on schema rise from public, anon, service_role, rise_worker, rise_lifecycle;
grant usage on schema rise to authenticated, rise_bff;

-- There is no writable XP total. The view keeps the caller's table grants and RLS.
create view rise.personal_totals with (security_invoker = true, security_barrier = true) as
  select p.owner_id, p.revision, coalesce(sum(o.xp),0)::bigint as xp
  from rise.profiles p left join rise.habit_occurrences o on o.owner_id = p.owner_id
  group by p.owner_id,p.revision;
revoke all on rise.personal_totals from public, anon, service_role, rise_worker, rise_lifecycle;
grant select on rise.personal_totals to authenticated, rise_bff;

comment on schema rise is 'AUTH-02: account-owned relational records. Unexposed by the Data API; BFF transactions establish verified session claims and remain subject to owner/session RLS.';

create function rise_private.keep_occurrence_snapshot() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.data is distinct from old.data then raise exception using errcode = '23514', message = 'immutable_occurrence_snapshot'; end if;
  return new;
end $$;
revoke all on function rise_private.keep_occurrence_snapshot() from public, anon, authenticated, service_role;
grant execute on function rise_private.keep_occurrence_snapshot() to rise_bff;
create trigger keep_occurrence_snapshot before update on rise.habit_occurrences
  for each row execute function rise_private.keep_occurrence_snapshot();
