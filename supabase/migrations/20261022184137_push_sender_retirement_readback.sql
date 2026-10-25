-- UPDATE's SELECT policy must also permit the resulting disabled row. Retired
-- records contain no endpoint cipher. Keep the sender's column projection narrow.
alter policy subscriptions_sender_read on rise.push_subscriptions using(true);
revoke select on rise.push_subscriptions from rise_worker;
grant select(id,user_id,provider_session_id,enabled,version,language,subscription_cipher) on rise.push_subscriptions to rise_worker;
