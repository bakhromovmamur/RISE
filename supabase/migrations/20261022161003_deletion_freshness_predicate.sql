-- Keep the same owner/session/freshness check while evaluating Auth claims once.
alter policy ledger_bff_insert on rise_private.deletion_ledger with check (
  user_id = (select auth.uid()) and (select rise_private.active_session()) and exists (
    select 1 from rise_private.server_sessions s where s.user_id = (select auth.uid())
      and s.provider_session_id::text = ((select auth.jwt())->>'session_id')
      and s.authenticated_at > now() - interval '10 minutes' and s.authenticated_at <= now()
  )
);
