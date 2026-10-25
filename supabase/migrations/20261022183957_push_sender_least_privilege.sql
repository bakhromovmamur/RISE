-- The sender may retire consent; it cannot create, enable, transfer or edit it.
revoke all on rise.push_subscriptions from rise_worker;
grant select on rise.push_subscriptions to rise_worker;
grant update(enabled,endpoint_hash,subscription_cipher,version,updated_at) on rise.push_subscriptions to rise_worker;
drop policy subscriptions_sender on rise.push_subscriptions;
create policy subscriptions_sender_read on rise.push_subscriptions for select to rise_worker using(enabled);
create policy subscriptions_sender_retire on rise.push_subscriptions for update to rise_worker
  using(enabled) with check(not enabled and endpoint_hash is null and subscription_cipher is null);
revoke update on rise.push_tests from rise_worker;
grant update(status,completed_at) on rise.push_tests to rise_worker;
revoke delete on rise.push_subscriptions,rise.push_tests from rise_bff;
