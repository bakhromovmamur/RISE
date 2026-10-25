-- Recovery replay can capture opaque handles from a restored DB before the
-- provider purge. No ciphertext, email or token projection is granted.
grant select (id_hash,context_hash,user_id) on rise_private.server_sessions to rise_lifecycle;
create policy sessions_lifecycle_deleted on rise_private.server_sessions for select to rise_lifecycle using (exists(select 1 from rise_private.deletion_ledger d where d.user_id=rise_private.server_sessions.user_id));
grant select (id_hash),delete on rise_private.auth_contexts to rise_lifecycle;
create policy contexts_lifecycle_read on rise_private.auth_contexts for select to rise_lifecycle using (exists(select 1 from rise_private.deleted_sessions s where s.context_hash=rise_private.auth_contexts.id_hash));
create policy contexts_lifecycle_delete on rise_private.auth_contexts for delete to rise_lifecycle using (exists(select 1 from rise_private.deleted_sessions s where s.context_hash=rise_private.auth_contexts.id_hash));
