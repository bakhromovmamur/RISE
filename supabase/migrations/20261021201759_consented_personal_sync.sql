-- SYNC-01: explicitly consented, bounded import staging; never an automatic guest upload.
set lock_timeout = '5s';
-- Older genuine reports may have no recorded timestamp. Do not fabricate one on import.
alter table rise.prayer_records drop constraint prayer_records_data_check;
alter table rise.prayer_records add constraint prayer_records_data_check check (
  rise_private.personal_json(data,array['performedAt','recordedAt'],array[]::text[],2048));
-- Prayer tracking may start later than habit history. Retain its own civil start date.
alter table rise.prayer_settings drop constraint prayer_settings_data_check;
alter table rise.prayer_settings add constraint prayer_settings_data_check check (
  rise_private.personal_json(data,array['preferences','fajr','backupEnabled','started'],array['preferences','fajr','backupEnabled'],32768));
create table rise.sync_imports (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null, base_revision bigint not null check (base_revision between 0 and 9007199254740991),
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  provenance text not null check (provenance in ('new','demo-or-mixed','unverified-legacy')),
  pages integer not null check (pages between 1 and 2500),
  created_at timestamptz not null default now(), expires_at timestamptz not null default (now()+interval '1 day'),
  committed_revision bigint, result jsonb,
  primary key (owner_id,id),
  check (committed_revision is null or committed_revision between 1 and 9007199254740991)
);
create index sync_imports_expiry on rise.sync_imports(owner_id,expires_at);
create table rise.sync_import_pages (
  owner_id uuid not null, import_id uuid not null, page integer not null check (page between 0 and 2499),
  data jsonb not null check (jsonb_typeof(data)='array' and jsonb_array_length(data) between 1 and 200 and octet_length(data::text)<=524288),
  primary key (owner_id,import_id,page),
  foreign key (owner_id,import_id) references rise.sync_imports(owner_id,id) on delete cascade
);
do $$
declare name text;
begin
  foreach name in array array['sync_imports','sync_import_pages'] loop
    execute format('alter table rise.%I enable row level security',name);
    execute format('alter table rise.%I force row level security',name);
    execute format('revoke all on rise.%I from public, anon, authenticated, service_role, rise_worker, rise_lifecycle',name);
    execute format('grant select,insert,update,delete on rise.%I to rise_bff',name);
    execute format('create policy sync_owner on rise.%I for all to rise_bff using (owner_id=(select auth.uid()) and (select rise_private.active_session())) with check (owner_id=(select auth.uid()) and (select rise_private.active_session()))',name);
    execute format('create policy sync_admin on rise.%I for all to postgres using (true) with check (true)',name);
  end loop;
end $$;
