-- C.4 operational candidate. DO NOT RUN until retention, migration, role and monitoring gates pass.
-- Run as authorized maintenance operator; pg_cron executes as scheduling DB role.
-- One job every 15 minutes, bounded verified-lead deletion; no PII returned.
-- Verify there is no existing job with this name and review existing capacity before scheduling.
select cron.schedule('mkt9-community-purge','*/15 * * * *', $mkt9purge$
with expired as (
  select id from public.mkt9_community_interest
  where expires_at <= now()
  order by expires_at,id
  limit 1000 for update skip locked
)
delete from public.mkt9_community_interest i using expired e where i.id=e.id;

delete from public.mkt9_community_pending where expires_at<=now();
delete from public.mkt9_community_rate where created_at<=now()-interval '24 hours';
$mkt9purge$);
-- Readback: inspect job status, run history, remaining expired counts and alert on missed/failed execution.
-- Rollback: select cron.unschedule('mkt9-community-purge');
