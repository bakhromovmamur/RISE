-- active_session is owned by the existing narrow predicate role. postgres may
-- administer membership, but an ordinary GRANT without that ownership is a no-op.
grant rise_session_guard to postgres;
grant execute on function rise_private.active_session() to rise_group_guard;
revoke rise_session_guard from postgres;
do $$begin
 if not has_function_privilege('rise_group_guard','rise_private.active_session()','execute')
 or not has_function_privilege('rise_bff','rise_private.group_access(uuid,boolean,boolean)','execute')
 or not has_function_privilege('rise_lifecycle','rise_private.purge_group_identity(uuid)','execute')
 or not has_function_privilege('rise_worker','rise_private.prune_group_invitations(integer)','execute') then
 raise exception 'group_capability_grant_missing';end if;
 if pg_has_role('rise_bff','rise_group_guard','member') or pg_has_role('rise_worker','rise_group_guard','member')
 or pg_has_role('rise_lifecycle','rise_group_guard','member') then raise exception 'group_guard_membership_forbidden';end if;
end;$$;
