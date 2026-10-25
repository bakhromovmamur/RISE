-- SYNC-02: compact owner-private change feed and a monotonic rebase floor.
set lock_timeout = '5s';
create table rise.sync_state (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  floor_revision bigint not null check (floor_revision between 0 and 9007199254740991)
);
-- Existing accounts start at a snapshot boundary; historical data is never rewritten.
insert into rise.sync_state(owner_id,floor_revision) select owner_id,revision from rise.profiles;
create table rise.sync_changes (
  owner_id uuid not null references auth.users(id) on delete cascade,
  table_name text not null check (table_name in ('profiles','account_preferences','habits','habit_versions','habit_days','habit_occurrences','goals','goal_milestones','goal_habits','personal_rewards','priority_days','daily_priorities','cosmetic_claims','prayer_settings','prayer_reminders','prayer_days','prayer_windows','prayer_records','prayer_pauses','fajr_plans','fajr_acknowledgments','reflections','saved_work_breaks')),
  record_key text not null check (octet_length(record_key)<=512),
  revision bigint not null check (revision between 1 and 9007199254740991),
  deleted boolean not null,
  changed_at timestamptz not null default now(),
  primary key(owner_id,table_name,record_key)
);
create index sync_changes_cursor on rise.sync_changes(owner_id,revision,table_name,record_key);
create index sync_changes_retention on rise.sync_changes(owner_id,changed_at);
create index personal_receipts_retention on rise.personal_receipts(owner_id,created_at);
do $$ declare name text; begin
  foreach name in array array['sync_state','sync_changes'] loop
    execute format('alter table rise.%I enable row level security',name);
    execute format('alter table rise.%I force row level security',name);
    execute format('revoke all on rise.%I from public, anon, authenticated, service_role, rise_worker, rise_lifecycle',name);
    execute format('grant select,insert,update,delete on rise.%I to rise_bff',name);
    execute format('create policy sync_owner on rise.%I for all to rise_bff using (owner_id=(select auth.uid()) and (select rise_private.active_session())) with check (owner_id=(select auth.uid()) and (select rise_private.active_session()))',name);
    execute format('create policy sync_admin on rise.%I for all to postgres using (true) with check (true)',name);
  end loop;
end $$;
-- The BFF can prune only its current owner's expired receipts; never update/rewrite one.
drop policy personal_delete on rise.personal_receipts;
create policy receipt_retention on rise.personal_receipts for delete to rise_bff
  using (owner_id=(select auth.uid()) and (select rise_private.active_session()) and created_at < now()-interval '90 days');
grant delete on rise.personal_receipts to rise_bff;
