-- Read-only operational verification after approved migration and cron installation.
-- Returns counts and health signals only. No email, names, payloads, secrets or SQL command text.
with job as (
 select jobid,active,schedule from cron.job where jobname='mkt9-community-purge'
), runs as (
 select r.status,r.end_time from cron.job_run_details r join job j using(jobid)
 where r.start_time>=now()-interval '24 hours'
), backlog as (
 select
 (select count(*) from public.mkt9_community_interest where expires_at<=now()) as expired_leads,
 (select count(*) from public.mkt9_community_pending where expires_at<=now()) as expired_pending,
 (select count(*) from public.mkt9_community_rate where created_at<=now()-interval '24 hours') as expired_rate_records,
 (select count(*) from public.mkt9_community_interest where expires_at<=now()-interval '24 hours') as overdue_leads,
 (select count(*) from public.mkt9_community_pending where expires_at<=now()-interval '15 minutes') as overdue_pending,
 (select count(*) from public.mkt9_community_rate where created_at<=now()-interval '24 hours 15 minutes') as overdue_rate_records
)
select (select count(*) from job) as configured_jobs,
 coalesce((select bool_and(active and schedule='*/15 * * * *') from job),false) as schedule_correct,
 (select max(end_time) from runs where status='succeeded') as last_success,
 (select count(*) from runs where status='failed') as failures_24h,
 backlog.*,
 case when (select count(*) from job)<>1
 or not coalesce((select bool_and(active and schedule='*/15 * * * *') from job),false)
 or coalesce((select max(end_time) from runs where status='succeeded'),'-infinity'::timestamptz)<now()-interval '30 minutes'
 or overdue_leads+overdue_pending+overdue_rate_records>0 then 'review_required'
 else 'healthy' end as health
from backlog;
-- Escalate missed/failed runs, persistent backlog and any overdue counts. A healthy
-- query is a point-in-time result, not continuous monitoring or approval.
