-- Operational liveness only: no capabilities or personal journey data.
create table rise_private.push_senders (
 id uuid primary key,
 heartbeat_at timestamptz not null default clock_timestamp()
);
alter table rise_private.push_senders enable row level security;
alter table rise_private.push_senders force row level security;
revoke all on rise_private.push_senders from public,anon,authenticated,service_role;
grant select on rise_private.push_senders to rise_bff;
grant select,insert,update,delete on rise_private.push_senders to rise_worker;
create policy sender_read on rise_private.push_senders for select to rise_bff using(true);
create policy sender_process on rise_private.push_senders for all to rise_worker using(true) with check(true);

-- Preserve provider acceptance evidence when a later command suppresses display.
alter table rise.push_jobs add column presentation_canceled boolean not null default false;
grant update(presentation_canceled) on rise.push_jobs to rise_bff;
