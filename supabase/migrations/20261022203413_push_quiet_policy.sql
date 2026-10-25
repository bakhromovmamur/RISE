-- Opt-in applies to this explicitly accepted plan, never inferred from old consent.
alter table rise.push_plans add column allow_during_quiet boolean not null default false;
alter table rise.push_plans add column suppressed integer not null default 0 check(suppressed>=0);
