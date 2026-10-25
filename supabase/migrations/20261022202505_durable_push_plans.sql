-- Local scheduling substrate; production activation waits for PUSH-03/04.
create table rise.push_plans (
 user_id uuid primary key references auth.users(id) on delete cascade,
 primary_installation uuid not null,
 generation integer not null check(generation>0),
 source_revision integer not null check(source_revision>=0),
 timezone text not null check(length(timezone)<=80),
 queued_through timestamptz,
 updated_at timestamptz not null default now(),
 foreign key(user_id,primary_installation) references rise.push_subscriptions(user_id,id) on delete cascade
);
create table rise.push_plan_receipts (
 user_id uuid not null references auth.users(id) on delete cascade,
 id uuid not null, digest text not null, result jsonb not null,
 created_at timestamptz not null default now(), primary key(user_id,id)
);
create table rise.push_jobs (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 installation_id uuid not null, installation_version integer not null check(installation_version>0),
 generation integer not null check(generation>0), event_key uuid not null,
 fire_at timestamptz not null, expires_at timestamptz not null,
 status text not null default 'queued' check(status in ('queued','leased','accepted','expired','canceled','failed','retired')),
 attempts integer not null default 0 check(attempts between 0 and 5),
 next_attempt_at timestamptz not null, lease_token uuid, lease_until timestamptz,
 completed_at timestamptz,
 foreign key(user_id,installation_id) references rise.push_subscriptions(user_id,id) on delete cascade,
 unique(user_id,installation_id,generation,event_key),
 check(expires_at>fire_at and expires_at<=fire_at+interval '2 minutes'),
 check((status='leased')=(lease_token is not null and lease_until is not null))
);
create index push_jobs_due on rise.push_jobs(next_attempt_at) where status in ('queued','leased');
create index push_jobs_owner on rise.push_jobs(user_id,installation_id);
do $$ declare t text; begin
 foreach t in array array['push_plans','push_plan_receipts','push_jobs'] loop
 execute format('alter table rise.%I enable row level security',t);
 execute format('alter table rise.%I force row level security',t);
 execute format('revoke all on rise.%I from public,anon,authenticated,service_role',t);
 execute format('grant select,insert on rise.%I to rise_bff',t);
 execute format('create policy owner on rise.%I for all to rise_bff using(user_id=(select auth.uid()) and (select rise_private.active_session())) with check(user_id=(select auth.uid()) and (select rise_private.active_session()))',t);
 end loop;
end $$;
grant update on rise.push_plans to rise_bff;
grant update(status,lease_token,lease_until,completed_at) on rise.push_jobs to rise_bff;
grant select on rise.push_plans,rise.push_jobs to rise_worker;
grant update(status,attempts,next_attempt_at,lease_token,lease_until,completed_at) on rise.push_jobs to rise_worker;
grant delete on rise.push_jobs to rise_worker;
create policy worker_read on rise.push_plans for select to rise_worker using(true);
create policy worker_read on rise.push_jobs for select to rise_worker using(true);
create policy worker_update on rise.push_jobs for update to rise_worker using(true) with check(true);
create policy worker_cleanup on rise.push_jobs for delete to rise_worker using(expires_at<now()-interval '1 day');
