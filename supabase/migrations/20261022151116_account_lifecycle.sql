-- DATA-04. No existing account or personal record is removed by this migration.
set lock_timeout = '5s';
set statement_timeout = '30s';

alter table rise_private.auth_challenges add column purpose text not null default 'signin' check (purpose in ('signin', 'reauth'));
alter table rise_private.auth_challenges add column bound_user_id uuid;
alter table rise_private.auth_challenges add column bound_session_hash bytea;
alter table rise_private.auth_challenges add constraint challenge_purpose_binding check (
  (purpose = 'signin' and bound_user_id is null and bound_session_hash is null) or
  (purpose = 'reauth' and bound_user_id is not null and octet_length(bound_session_hash) = 32)
);

-- No Auth FK: suppression must survive primary deletion and backup replay.
create table rise_private.deletion_ledger (
  user_id uuid primary key,
  deleted_at timestamptz not null default now()
);
create table rise_private.deletion_jobs (
  user_id uuid primary key references rise_private.deletion_ledger(user_id),
  request_id uuid unique not null,
  requested_at timestamptz not null default now(),
  purge_by timestamptz not null default (now() + interval '7 days'),
  purged_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text check (last_error in ('purge_failed', 'integration_pending'))
);
create index deletion_jobs_pending on rise_private.deletion_jobs(next_attempt_at) where purged_at is null;
-- Opaque cookie hashes permit a lost-reply retry/status after Auth has been purged.
-- They grant no access to private records and are removed after 35 days.
create table rise_private.deleted_sessions (
  id_hash bytea primary key check (octet_length(id_hash) = 32),
  context_hash bytea not null check (octet_length(context_hash) = 32),
  user_id uuid not null references rise_private.deletion_ledger(user_id),
  deleted_at timestamptz not null default now()
);
create index deleted_sessions_owner on rise_private.deleted_sessions(user_id);
alter table rise_private.deletion_ledger enable row level security;
alter table rise_private.deletion_ledger force row level security;
alter table rise_private.deletion_jobs enable row level security;
alter table rise_private.deletion_jobs force row level security;
alter table rise_private.deleted_sessions enable row level security;
alter table rise_private.deleted_sessions force row level security;
revoke all on rise_private.deletion_ledger, rise_private.deletion_jobs, rise_private.deleted_sessions from public, anon, authenticated, service_role;
grant select, insert on rise_private.deletion_ledger, rise_private.deletion_jobs, rise_private.deleted_sessions to rise_bff;
grant select, insert, update, delete on rise_private.deletion_ledger, rise_private.deletion_jobs, rise_private.deleted_sessions to rise_lifecycle;
create policy ledger_bff_read on rise_private.deletion_ledger for select to rise_bff using (true);
create policy ledger_bff_insert on rise_private.deletion_ledger for insert to rise_bff with check (user_id = (select auth.uid()) and (select rise_private.active_session()) and exists (
  select 1 from rise_private.server_sessions s where s.user_id = (select auth.uid())
  and s.provider_session_id::text = (select auth.jwt()->>'session_id') and s.authenticated_at > now() - interval '10 minutes' and s.authenticated_at <= now()
));
create policy jobs_bff_read on rise_private.deletion_jobs for select to rise_bff using (true);
create policy jobs_bff_insert on rise_private.deletion_jobs for insert to rise_bff with check (user_id = (select auth.uid()));
create policy deleted_sessions_bff_read on rise_private.deleted_sessions for select to rise_bff using (true);
create policy deleted_sessions_bff_insert on rise_private.deleted_sessions for insert to rise_bff with check (user_id = (select auth.uid()));
create policy ledger_lifecycle on rise_private.deletion_ledger for all to rise_lifecycle using (true) with check (true);
create policy jobs_lifecycle on rise_private.deletion_jobs for all to rise_lifecycle using (true) with check (true);
create policy deleted_sessions_lifecycle on rise_private.deleted_sessions for all to rise_lifecycle using (true) with check (true);
create policy ledger_admin on rise_private.deletion_ledger for all to postgres using (true) with check (true);
create policy jobs_admin on rise_private.deletion_jobs for all to postgres using (true) with check (true);
create policy deleted_sessions_admin on rise_private.deleted_sessions for all to postgres using (true) with check (true);

grant select on rise_private.deletion_ledger to rise_session_guard;
create policy ledger_session_guard on rise_private.deletion_ledger for select to rise_session_guard using (user_id = (select auth.uid()));
grant rise_session_guard to postgres;
create or replace function rise_private.active_session() returns boolean
language sql stable security definer set search_path = ''
begin atomic
  return not exists (select 1 from rise_private.deletion_ledger d where d.user_id = (select auth.uid())) and exists (
    select 1 from rise_private.server_sessions s
    join auth.sessions p on p.id = s.provider_session_id and p.user_id = s.user_id
    join auth.users u on u.id = s.user_id
    where s.user_id = (select auth.uid())
      and s.provider_session_id::text = (select auth.jwt()->>'session_id')
      and s.revoked_at is null and s.idle_expires_at > now() and s.absolute_expires_at > now()
      and (p.not_after is null or p.not_after > now())
      and u.deleted_at is null and (u.banned_until is null or u.banned_until <= now())
  );
end;
revoke rise_session_guard from postgres;

-- Explicit integration seams. GROUP-01/PUSH-01 must replace these with locked
-- ownership resolution / immediate cancellation before adding their tables.
-- Until then, fail closed if such modules appear; never pretend they were cleaned.
create function rise_private.deletion_integrations_ready() returns boolean
language sql stable security invoker set search_path = ''
begin atomic
  return to_regclass('rise.groups') is null and to_regclass('rise.memberships') is null
    and to_regclass('rise.push_subscriptions') is null and to_regclass('rise.notification_jobs') is null;
end;
revoke all on function rise_private.deletion_integrations_ready() from public, anon, authenticated, service_role;
grant execute on function rise_private.deletion_integrations_ready() to rise_bff, rise_lifecycle;

create function rise_private.reject_deleted_session() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if exists (select 1 from rise_private.deletion_ledger d where d.user_id = new.user_id) then
    raise exception using errcode = '42501', message = 'account_deleted';
  end if;
  return new;
end;
$$;
revoke all on function rise_private.reject_deleted_session() from public, anon, authenticated, service_role;
create trigger reject_deleted_session before insert on rise_private.server_sessions for each row execute function rise_private.reject_deleted_session();

-- Separate process role; no Auth credentials or administrative connection in BFF.
-- Only an already suppressed subject can be purged. Auth FK cascades remove its
-- personal rows, imports, receipts, sessions and refresh tokens atomically.
grant select (id), delete on auth.users to rise_lifecycle;
create policy rise_lifecycle_users_read on auth.users for select to rise_lifecycle using (exists (select 1 from rise_private.deletion_ledger d where d.user_id = id));
create policy rise_lifecycle_users_delete on auth.users for delete to rise_lifecycle using (exists (select 1 from rise_private.deletion_ledger d where d.user_id = id));
create function rise_private.purge_deleted_account(subject uuid) returns boolean
language sql volatile security invoker set search_path = ''
begin atomic
  delete from auth.users where id = subject
    and exists (select 1 from rise_private.deletion_ledger d where d.user_id = subject)
    and rise_private.deletion_integrations_ready();
  return not exists (select 1 from auth.users where id = subject);
end;
revoke all on function rise_private.purge_deleted_account(uuid) from public, anon, authenticated, service_role, rise_bff, rise_worker;
grant execute on function rise_private.purge_deleted_account(uuid) to rise_lifecycle;
