-- GROUP-04: authorize the small current-owner set once per statement, rather
-- than rechecking session and membership for every retained invitation row.
-- rise.groups still enforces its current active-session/member RLS predicate.
-- No table grants, roles, write policies or owner semantics are broadened.
alter policy invitation_read on rise.group_invitations
 using(group_id in (select id from rise.groups where owner_id=(select auth.uid())));
