-- INFRA-01: an additive empty application boundary. No existing browser/profile data is imported.
set lock_timeout = '5s';
set statement_timeout = '30s';

create role rise_bff nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role rise_worker nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role rise_lifecycle nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create schema rise;
create schema rise_private;
revoke all on schema rise, rise_private from public, anon, authenticated, service_role;
grant usage on schema rise_private to rise_bff, rise_worker, rise_lifecycle;

alter default privileges for role postgres in schema rise, rise_private revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema rise, rise_private revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema rise, rise_private revoke execute on functions from public, anon, authenticated, service_role;

create table rise_private.environment (
  singleton boolean primary key default true check (singleton),
  environment text not null check (environment in ('local', 'test', 'staging', 'production')),
  app_origin text not null check (length(app_origin) <= 300),
  provider_project_ref text not null check (provider_project_ref ~ '^(rise-local|rise-test|[a-z]{20})$'),
  installation_id uuid not null,
  schema_version integer not null default 1 check (schema_version = 1),
  created_at timestamptz not null default now(),
  check (environment <> 'production' or app_origin = 'https://habit.saraftech.com'),
  check (environment <> 'staging' or app_origin <> 'https://habit.saraftech.com')
);
alter table rise_private.environment enable row level security;
alter table rise_private.environment force row level security;
create policy environment_read on rise_private.environment for select to rise_bff, rise_worker, rise_lifecycle using (singleton);
create policy environment_admin on rise_private.environment for all to postgres using (true) with check (true);
grant select on rise_private.environment to rise_bff, rise_worker, rise_lifecycle;

-- Provenance only; real personal/group tables and their owner/member policies belong to AUTH/SYNC.
create table rise_private.synthetic_fixtures (
  fixture_key text primary key check (fixture_key ~ '^infra-[a-z-]{1,50}$'),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table rise_private.synthetic_fixtures enable row level security;
alter table rise_private.synthetic_fixtures force row level security;
create policy fixture_admin on rise_private.synthetic_fixtures for all to postgres using (true) with check (true);
comment on table rise_private.synthetic_fixtures is 'Infrastructure test provenance. Never seed production. No user habit/prayer records.';
