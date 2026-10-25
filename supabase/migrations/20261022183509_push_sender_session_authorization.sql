-- active_session is owned by the existing narrow non-login session guard.
-- Grant through that owner rather than relying on a non-owner GRANT warning.
grant rise_session_guard to postgres;
grant execute on function rise_private.active_session() to rise_worker;
revoke rise_session_guard from postgres;
