-- Managed Auth does not delegate DELETE on auth.users to the migration role.
-- Use the supported admin endpoint in the isolated lifecycle process instead.
drop function rise_private.purge_deleted_account(uuid);
drop policy rise_lifecycle_users_read on auth.users;
drop policy rise_lifecycle_users_delete on auth.users;
revoke select (id), delete on auth.users from rise_lifecycle;
