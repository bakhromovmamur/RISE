-- OPS-01: read-only, aggregate-only local monitoring. No existing rows change.
set lock_timeout = '5s';
set statement_timeout = '30s';
create role rise_ops nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role rise_ops_guard nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant usage on schema rise_private to rise_ops;
grant usage on schema rise,rise_private to rise_ops_guard;
grant select(environment,installation_id) on rise_private.environment to rise_ops_guard;
create policy ops_read on rise_private.environment for select to rise_ops_guard using(true);
grant select(heartbeat_at) on rise_private.push_senders to rise_ops_guard;
create policy ops_read on rise_private.push_senders for select to rise_ops_guard using(true);
grant select(status,fire_at,expires_at,lease_until,completed_at) on rise.push_jobs,rise.notification_jobs to rise_ops_guard;
create policy ops_read on rise.push_jobs for select to rise_ops_guard using(true);
create policy ops_read on rise.notification_jobs for select to rise_ops_guard using(true);
grant select(status,created_at,expires_at,completed_at) on rise.push_tests to rise_ops_guard;
create policy ops_read on rise.push_tests for select to rise_ops_guard using(true);
grant select(purged_at,purge_by,attempts) on rise_private.deletion_jobs to rise_ops_guard;
create policy ops_read on rise_private.deletion_jobs for select to rise_ops_guard using(true);

create function rise_private.operations_snapshot(expected_environment text, expected_installation uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare stamp timestamptz := clock_timestamp(); result jsonb;
begin
 if expected_environment not in ('local','test') or not exists (
   select 1 from rise_private.environment where environment=expected_environment and installation_id=expected_installation
 ) then raise exception 'operations_installation_mismatch'; end if;
 with jobs as (
   select status,fire_at,expires_at,lease_until,completed_at from rise.push_jobs
   union all select status,fire_at,expires_at,lease_until,completed_at from rise.notification_jobs
   union all select status,created_at,expires_at,null::timestamptz,completed_at from rise.push_tests
 ), queue as (
   select count(*) filter(where status in ('queued','leased')) as pending,
     count(*) filter(where status in ('queued','leased') and fire_at<=stamp) as due,
     coalesce(greatest(0,extract(epoch from stamp-min(fire_at) filter(where status in ('queued','leased') and fire_at<=stamp))),0)::bigint as oldest_due_seconds,
     count(*) filter(where status='leased' and lease_until<stamp) as stale_leases,
     count(*) filter(where status in ('queued','leased') and expires_at<stamp) as expired_pending,
     count(*) filter(where status='failed' and completed_at>stamp-interval '24 hours') as failed_24h,
     count(*) filter(where status='retired' and completed_at>stamp-interval '24 hours') as retired_24h
   from jobs
 ) select jsonb_build_object('sampledAt',stamp,'pending',pending,'due',due,'oldestDueSeconds',oldest_due_seconds,
   'staleLeases',stale_leases,'expiredPending',expired_pending,'failed24h',failed_24h,'retired24h',retired_24h,
   'senderReady',exists(select 1 from rise_private.push_senders where heartbeat_at>stamp-interval '30 seconds' and heartbeat_at<=stamp),
   'deletionOverdue',(select count(*) from rise_private.deletion_jobs where purged_at is null and purge_by<=stamp),
   'deletionRetrying',(select count(*) from rise_private.deletion_jobs where purged_at is null and attempts>0)) into result from queue;
 return result;
end $$;
revoke all on function rise_private.operations_snapshot(text,uuid) from public,anon,authenticated,service_role;
grant rise_ops_guard to postgres;
grant create on schema rise_private to rise_ops_guard;
alter function rise_private.operations_snapshot(text,uuid) owner to rise_ops_guard;
revoke create on schema rise_private from rise_ops_guard;
grant execute on function rise_private.operations_snapshot(text,uuid) to rise_ops;
revoke rise_ops_guard from postgres;
