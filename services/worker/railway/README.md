# NET-IT — Railway cron jobs

GitHub Actions schedules for `net-it-auto2-reviewer.yml` and `net-it-seed1-finder.yml`
never fired in practice (11 Nov 2026: zero scheduled runs in 4+ hours), so the
Italian Network pipeline stalls. These configs move the periodic execution to
Railway cron services. GitHub workflows stay for manual runs.

One Railway service per file, all built from `services/worker/Dockerfile` on `main`,
with **Settings → Config-as-code path** pointing to the file:

| Service | Config file | Schedule (UTC) | Command |
| --- | --- | --- | --- |
| `net-it-auto2-reviewer` | `services/worker/railway/net-it-auto2-reviewer.json` | `17 * * * *` | AUTO2, 50 sites |
| `net-it-seed1-crawl` | `services/worker/railway/net-it-seed1-crawl.json` | `52 * * * *` | SEED1 crawl, 200 sites |
| `net-it-seed1-harvest` | `services/worker/railway/net-it-seed1-harvest.json` | `22 3 * * *` | SEED1 harvest, 20 index pages |

Each service needs only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, as variable
references to the existing `steel-sales-ai` service. No public domain, no healthcheck:
a cron job runs, exits and waits for the next slot (Railway skips a slot while the
previous run is still active).

Safety is unchanged: AUTO2 and SEED1 never publish. The database refuses every call
unless the Platform Owner policies (AUTO3, SEED1) are on, and enforces daily caps
(AUTO3 300/day, SEED1 5,000 sites/day).
