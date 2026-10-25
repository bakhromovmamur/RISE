-- A compact owner marker fences unversioned cancellation retries once their
-- immutable receipts have expired. It contains no event identifiers, scheduled instants or private source.
create table rise.push_receipt_floors (
 user_id uuid primary key references auth.users(id) on delete cascade,
 pruned_before timestamptz not null
);
alter table rise.push_receipt_floors enable row level security;
alter table rise.push_receipt_floors force row level security;
revoke all on rise.push_receipt_floors from public,anon,authenticated,service_role;
grant select on rise.push_receipt_floors to rise_bff;
create policy owner_read on rise.push_receipt_floors for select to rise_bff
 using(user_id=(select auth.uid()) and (select rise_private.active_session()));

create index push_receipts_expiry on rise.push_plan_receipts(created_at,user_id,id);
create index push_jobs_expiry on rise.push_jobs(expires_at,id);
create index push_jobs_owner_lease on rise.push_jobs(user_id,lease_until) where status='leased';
create index push_tests_expiry on rise.push_tests(created_at,id);
create index push_senders_expiry on rise_private.push_senders(heartbeat_at,id);

-- The sender may request bounded cleanup, but cannot read receipts or advance
-- arbitrary owners' markers. A non-login function owner has no private payload
-- or session grants. Keep ordinary BFF receipt update/delete denied.
create role rise_push_retention nologin noinherit;
grant usage on schema rise,rise_private to rise_push_retention;
grant select(user_id,id,created_at),delete on rise.push_plan_receipts to rise_push_retention;
create policy retention_read on rise.push_plan_receipts for select to rise_push_retention
 using(created_at<now()-interval '7 days');
create policy retention_delete on rise.push_plan_receipts for delete to rise_push_retention
 using(created_at<now()-interval '7 days');
grant select,insert,update on rise.push_receipt_floors to rise_push_retention;
create policy retention_floor on rise.push_receipt_floors for all to rise_push_retention using(true) with check(true);

create function rise_private.prune_push_receipts(batch_size integer default 200) returns integer
language plpgsql security definer set search_path=''
as $$
declare candidate record; cutoff timestamptz:=clock_timestamp()-interval '7 days'; removed integer:=0; n integer;
begin
 if batch_size<1 or batch_size>500 or batch_size is null then raise exception 'invalid_batch'; end if;
 for candidate in select user_id,id from rise.push_plan_receipts where created_at<cutoff order by created_at,user_id,id limit batch_size loop
  -- Every request/dispatch/deletion uses this same owner lock. A busy owner is
  -- retried next tick instead of delaying dispatch or reversing lock order.
  if pg_try_advisory_xact_lock(hashtextextended('rise-personal:'||candidate.user_id::text,0)) then
   insert into rise.push_receipt_floors(user_id,pruned_before) values(candidate.user_id,cutoff)
    on conflict(user_id) do update set pruned_before=greatest(rise.push_receipt_floors.pruned_before,excluded.pruned_before);
   delete from rise.push_plan_receipts where user_id=candidate.user_id and id=candidate.id and created_at<cutoff;
   get diagnostics n=row_count; removed:=removed+n;
  end if;
 end loop;
 return removed;
end $$;
grant rise_push_retention to postgres;
grant create on schema rise_private to rise_push_retention;
alter function rise_private.prune_push_receipts(integer) owner to rise_push_retention;
revoke all on function rise_private.prune_push_receipts(integer) from public,anon,authenticated,service_role;
grant execute on function rise_private.prune_push_receipts(integer) to rise_worker;
revoke create on schema rise_private from rise_push_retention;
revoke rise_push_retention from postgres;
