-- Candidate operational command only. Do not apply to production before retention approval.
-- Run via authorized database maintenance role, never anon or browser.
-- Bounded batches; rerun daily with pg_cron if already approved and available.
with expired as (
  select id from public.mkt9_community_interest
  where expires_at <= now()
  order by expires_at,id
  limit 1000 for update skip locked
)
delete from public.mkt9_community_interest i using expired e where i.id=e.id;
-- No returning PII. Monitor remaining expired count separately:
-- select count(*) from public.mkt9_community_interest where expires_at <= now();
-- No cron automatically created here; verify capacity, schedule and monitoring first.
