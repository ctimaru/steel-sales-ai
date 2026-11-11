-- NET-IT-AUTO scheduler: call the delegated publishers every hour from inside
-- the database, so growth does not depend on an external assistant session.
--
-- Nothing is authorized here. Each function is a no-op that returns
-- 'delegation_disabled' until a real Platform Owner enables its policy in the
-- console, stops at the owner's daily cap, and stops immediately on revoke or
-- expiry. pg_cron runs the job as the database owner with no JWT, which is
-- exactly the maintenance identity both functions require.
--
-- cron.schedule() replaces a job with the same name: re-running is safe.
select cron.schedule(
 'net-it-auto1-hourly-release',
 '7 * * * *',
 $job$select private.net_it_auto1_release(100,false);$job$
);
select cron.schedule(
 'net-it-auto3-hourly-release',
 '37 * * * *',
 $job$select private.net_it_auto3_release(100,false);$job$
);
