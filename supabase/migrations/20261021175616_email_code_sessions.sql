-- AUTH-01: server-only sessions. No personal journey or browser-storage migration.
set lock_timeout = '5s';
set statement_timeout = '30s';

create table rise_private.auth_contexts (
  id_hash bytea primary key check (octet_length(id_hash) = 32),
  expires_at timestamptz not null
);
create index auth_contexts_expiry on rise_private.auth_contexts (expires_at);
create table rise_private.auth_challenges (
  context_hash bytea primary key references rise_private.auth_contexts(id_hash) on delete cascade,
  challenge_hash bytea unique not null check (octet_length(challenge_hash) = 32),
  encrypted_email text not null check (length(encrypted_email) < 4096),
  remembered boolean not null,
  attempts integer not null default 0 check (attempts between 0 and 5),
  provider_ready boolean not null default false,
  expires_at timestamptz not null
);
create index auth_challenges_expiry on rise_private.auth_challenges (expires_at);
create table rise_private.server_sessions (
  id_hash bytea primary key check (octet_length(id_hash) = 32),
  context_hash bytea not null references rise_private.auth_contexts(id_hash) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_session_id uuid unique not null,
  provider_cipher text check (length(provider_cipher) < 65536),
  access_expires_at timestamptz not null,
  remembered boolean not null,
  authenticated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  idle_expires_at timestamptz not null,
  absolute_expires_at timestamptz not null,
  revoked_at timestamptz,
  check (provider_cipher is not null or revoked_at is not null)
);
create index server_sessions_context on rise_private.server_sessions (context_hash);
create index server_sessions_expiry on rise_private.server_sessions (absolute_expires_at);
create index server_sessions_actor on rise_private.server_sessions (user_id, provider_session_id) where revoked_at is null;
create table rise_private.auth_limits (
  subject_hash bytea not null check (octet_length(subject_hash) = 32),
  window_seconds integer not null check (window_seconds between 60 and 86400),
  window_start timestamptz not null,
  attempts integer not null check (attempts between 1 and 100000),
  primary key (subject_hash, window_seconds, window_start)
);
create index auth_limits_expiry on rise_private.auth_limits (window_start);

alter table rise_private.auth_contexts enable row level security;
alter table rise_private.auth_contexts force row level security;
alter table rise_private.auth_challenges enable row level security;
alter table rise_private.auth_challenges force row level security;
alter table rise_private.server_sessions enable row level security;
alter table rise_private.server_sessions force row level security;
alter table rise_private.auth_limits enable row level security;
alter table rise_private.auth_limits force row level security;
create policy contexts_bff on rise_private.auth_contexts for all to rise_bff using (true) with check (true);
create policy challenges_bff on rise_private.auth_challenges for all to rise_bff using (true) with check (true);
create policy sessions_bff on rise_private.server_sessions for all to rise_bff using (true) with check (true);
create policy limits_bff on rise_private.auth_limits for all to rise_bff using (true) with check (true);
create policy contexts_admin on rise_private.auth_contexts for all to postgres using (true) with check (true);
create policy challenges_admin on rise_private.auth_challenges for all to postgres using (true) with check (true);
create policy sessions_admin on rise_private.server_sessions for all to postgres using (true) with check (true);
create policy limits_admin on rise_private.auth_limits for all to postgres using (true) with check (true);
revoke all on rise_private.auth_contexts, rise_private.auth_challenges, rise_private.server_sessions, rise_private.auth_limits from public, anon, authenticated, service_role;
grant select, insert, update, delete on rise_private.auth_contexts, rise_private.auth_challenges, rise_private.server_sessions, rise_private.auth_limits to rise_bff;

-- A deliberately narrow, read-only lookup for revocation predicates, including already-issued JWTs.
-- No caller-selected actor ID, no table projection, no managed token-table access, no BYPASSRLS.
create role rise_session_guard nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant usage on schema auth, rise_private to rise_session_guard;
grant select (id, user_id, not_after) on auth.sessions to rise_session_guard;
grant select (id, banned_until, deleted_at) on auth.users to rise_session_guard;
grant select (user_id, provider_session_id, revoked_at, idle_expires_at, absolute_expires_at) on rise_private.server_sessions to rise_session_guard;
create policy session_guard_private on rise_private.server_sessions for select to rise_session_guard using (user_id = (select auth.uid()));
create policy rise_session_guard_sessions on auth.sessions for select to rise_session_guard using (user_id = (select auth.uid()));
create policy rise_session_guard_users on auth.users for select to rise_session_guard using (id = (select auth.uid()));
create function rise_private.active_session() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from rise_private.server_sessions s
    join auth.sessions p on p.id = s.provider_session_id and p.user_id = s.user_id
    join auth.users u on u.id = s.user_id
    where s.user_id = (select auth.uid())
      and s.provider_session_id::text = (select auth.jwt()->>'session_id')
      and s.revoked_at is null and s.idle_expires_at > now() and s.absolute_expires_at > now()
      and (p.not_after is null or p.not_after > now())
      and u.deleted_at is null and (u.banned_until is null or u.banned_until <= now())
  );
$$;
grant rise_session_guard to postgres;
grant create on schema rise_private to rise_session_guard;
alter function rise_private.active_session() owner to rise_session_guard;
revoke create on schema rise_private from rise_session_guard;
revoke all on function rise_private.active_session() from public, anon, service_role;
grant usage on schema rise_private to authenticated;
grant execute on function rise_private.active_session() to authenticated, rise_bff;
comment on function rise_private.active_session() is 'AUTH-01: fixed boolean predicate for verified request JWT claims. Private, least-privilege owner; never returns sessions/tokens. Required in future personal/group RLS.';
revoke rise_session_guard from postgres;
