-- PUSH-01: consent is installation-local and separate from the personal journey.
create table rise.push_subscriptions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_hash bytea not null unique check(octet_length(installation_hash)=32),
  provider_session_id uuid not null,
  endpoint_hash bytea unique check(endpoint_hash is null or octet_length(endpoint_hash)=32),
  subscription_cipher text check(subscription_cipher is null or length(subscription_cipher) between 30 and 12000),
  enabled boolean not null default false,
  details boolean not null default false,
  language text not null check(language in ('en','ru','uz')),
  version integer not null default 1 check(version>0),
  next_test_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,id),
  check (enabled = (subscription_cipher is not null and endpoint_hash is not null))
);
create index push_subscriptions_owner on rise.push_subscriptions(user_id);
create table rise.push_tests (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id uuid not null,
  installation_version integer not null check(installation_version>0),
  status text not null default 'queued' check(status in ('queued','accepted','failed','retired','canceled','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '2 minutes',
  completed_at timestamptz,
  foreign key(user_id,installation_id) references rise.push_subscriptions(user_id,id) on delete cascade,
  check(expires_at>created_at and expires_at<=created_at+interval '2 minutes')
);
create index push_tests_owner_device on rise.push_tests(user_id,installation_id,created_at desc);
create index push_tests_pending on rise.push_tests(created_at) where status='queued';
alter table rise.push_subscriptions enable row level security;
alter table rise.push_subscriptions force row level security;
alter table rise.push_tests enable row level security;
alter table rise.push_tests force row level security;
revoke all on rise.push_subscriptions,rise.push_tests from public,anon,authenticated,service_role;
grant select,insert,update,delete on rise.push_subscriptions,rise.push_tests to rise_bff;
create policy subscriptions_owner on rise.push_subscriptions for all to rise_bff
  using(user_id=(select auth.uid()) and (select rise_private.active_session()))
  with check(user_id=(select auth.uid()) and (select rise_private.active_session()));
create policy tests_owner on rise.push_tests for all to rise_bff
  using(user_id=(select auth.uid()) and (select rise_private.active_session()))
  with check(user_id=(select auth.uid()) and (select rise_private.active_session()));
-- Isolated sender has only these two tables, environment metadata and the boolean
-- authorization predicate. It has no personal history, provider tokens or admin key.
grant usage on schema rise to rise_worker;
grant select,update,delete on rise.push_subscriptions,rise.push_tests to rise_worker;
create policy subscriptions_sender on rise.push_subscriptions for all to rise_worker using(true) with check(true);
create policy tests_sender on rise.push_tests for all to rise_worker using(true) with check(true);
grant execute on function rise_private.active_session() to rise_worker;
-- Push suppression happens before deletion ledger insertion; Auth-root cascades
-- purge both tables. Future group/real scheduling modules remain fail closed.
create or replace function rise_private.deletion_integrations_ready() returns boolean
language sql stable security invoker set search_path=''
begin atomic
  return to_regclass('rise.groups') is null and to_regclass('rise.memberships') is null
    and to_regclass('rise.notification_jobs') is null;
end;
