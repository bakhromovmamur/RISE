-- Resolve catalog objects when the migration owner has schema lookup privileges.
-- The runtime function owner retains only column SELECT grants and owner-filtered RLS.
-- Managed Auth schema USAGE cannot be delegated by the migration role on Supabase.
grant rise_session_guard to postgres;
create or replace function rise_private.active_session() returns boolean
language sql stable security definer set search_path = ''
begin atomic
  return exists (
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
