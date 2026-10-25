-- A documented 5,000-code-point field can occupy 20,000 UTF-8 bytes.
-- Expand only bounded per-entity snapshots, retaining every existing shape/domain check.
set lock_timeout = '5s';
do $$
declare item record;
begin
  for item in
    select c.conname, t.relname, pg_get_constraintdef(c.oid) as definition
    from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='rise' and c.contype='c'
      and t.relname in ('habit_versions','habit_occurrences','goals','prayer_settings','prayer_days','fajr_plans')
      and pg_get_constraintdef(c.oid) like '%personal_json%16384%'
  loop
    execute format('alter table rise.%I drop constraint %I',item.relname,item.conname);
    execute format('alter table rise.%I add constraint %I %s',item.relname,item.conname,replace(item.definition,'16384','32768'));
  end loop;
end $$;
