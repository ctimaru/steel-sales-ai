-- NET-IT-QUEUE1 — Drain the Italian Network queue faster (13 Nov 2026, founder
-- request "possiamo smaltire la coda?").
-- AUTO2 now reviews ~300 candidates/hour (Railway cron every 10 minutes), so
-- AUTO3 runs three times per hour instead of once. Each run is still bounded
-- to 100 and the owner policy daily cap (max 300) is unchanged.
-- Applied in production with cron.alter_job on 13 Nov 2026 11:32.
SELECT cron.alter_job(jobid, schedule := '17,37,57 * * * *')
FROM cron.job WHERE jobname='net-it-auto3-hourly-release';
