-- Preserve owner-consistent composite history constraints and add the missing
-- root cleanup path. No rows are removed; existing references are validated.
alter table rise.habit_versions add constraint habit_versions_profile_owner foreign key(owner_id) references rise.profiles(owner_id) on delete cascade;
alter table rise.habit_occurrences add constraint habit_occurrences_profile_owner foreign key(owner_id) references rise.profiles(owner_id) on delete cascade;
alter table rise.goal_milestones add constraint goal_milestones_profile_owner foreign key(owner_id) references rise.profiles(owner_id) on delete cascade;
alter table rise.goal_habits add constraint goal_habits_profile_owner foreign key(owner_id) references rise.profiles(owner_id) on delete cascade;
alter table rise.daily_priorities add constraint daily_priorities_profile_owner foreign key(owner_id) references rise.profiles(owner_id) on delete cascade;
alter table rise.prayer_windows add constraint prayer_windows_profile_owner foreign key(owner_id) references rise.profiles(owner_id) on delete cascade;
alter table rise.prayer_records add constraint prayer_records_profile_owner foreign key(owner_id) references rise.profiles(owner_id) on delete cascade;
alter table rise.saved_work_breaks add constraint saved_work_breaks_profile_owner foreign key(owner_id) references rise.profiles(owner_id) on delete cascade;
