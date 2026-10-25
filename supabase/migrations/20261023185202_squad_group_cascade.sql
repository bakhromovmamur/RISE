-- Stable member references remain mandatory at commit. A group-root cascade
-- may visit memberships before the post -> reaction cascade has run; defer
-- only these reference checks so deletion can finish atomically in either order.
alter table rise.squad_posts alter constraint squad_posts_group_id_author_member_id_fkey deferrable initially deferred;
alter table rise.squad_reactions alter constraint squad_reactions_group_id_member_id_fkey deferrable initially deferred;
