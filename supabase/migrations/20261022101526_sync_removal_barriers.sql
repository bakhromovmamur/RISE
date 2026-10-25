-- A cleared record remains causally removed even if another write later recreates it.
alter table rise.sync_changes add column barrier_revision bigint not null default 0 check(barrier_revision between 0 and 9007199254740991), add column barrier_operation uuid;
