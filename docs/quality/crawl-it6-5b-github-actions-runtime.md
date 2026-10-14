# CRAWL-IT6.5b — Railway-independent GitHub Actions crawler

## Executive decision
Use **GitHub-hosted Actions** for the low-volume Wikidata discovery source, independently of the unavailable Railway worker. A short weekly job (one WDQS query and at most five proposed domain records) avoids always-on Vercel/Railway runtime for *this crawler only*.

The Railway app currently reports **offline** and refuses deployments because its trial expired. GitHub Actions does **not** restore the separate email ingestion / document processing / other FastAPI worker functions. Those need a different paid host or a separately engineered alternative.

## Technical contract
- GitHub workflow: `.github/workflows/crawl-it65b-weekly-discovery.yml`
- Scheduler: **Wednesday 15:47 UTC**, once per week, **only on `main`**, with `concurrency` to avoid two jobs from the same workflow running at once.
- OFF until GitHub repository Actions variable `CRAWL_IT65B_ENABLED=true`. No PR/push paths can start ingestion. Manual `preview` needs **no Supabase secrets**; manual `stage` has the same opt-in gate as the schedule.
- Database `crawl_it65b_source_preflight()` reads only approved/enabled Wikidata row and checks rights, reviewed actor, max budget **1–5** and elapsed interval **>=168h**. Returns `eligible=false` if not due; workflow performs zero WDQS requests and zero writes then.
- The worker script performs *one* 12-second WDQS request (P17=Italy, P452=iron and steel, P856=site; LIMIT 20) to find at most five HTTPS company domains + Wikidata Q evidence; never visits company websites or acquires personal contact data.
- The `crawl_it65b_commit_wikidata_leads(jsonb)` RPC is **SECURITY INVOKER** and executable only by Supabase `service_role`; it locks the source row, independently revalidates license/limits/cooldown and all submitted URLs. It inserts `pending_review` **only**, skipping known company, candidate and domain-lead matches. The same transaction advances `last_discovered_at`, even for an empty result, preventing rapid repeat loops.
- Duplicate/replay, malformed evidence, foreign source, role mismatch, too many domains and premature run all fail closed.
- No company/facility publication, no identity merge, no user contacts or geolocation claims, no jobs added on Vercel or Railway.

## Required GitHub setup — NOT performed automatically
1. Supabase dashboard → project `ecrafjdummcdfycznitx` → **Settings → API Keys**: create a *dedicated* **`sb_secret_...` key** named for GitHub crawler; do **not** use a browser publishable key. This key bypasses RLS — treat it as highly privileged, rotate if leaked; do not paste it in chat, a PR or workflow logs. The runner uses the `apikey` header, never `Authorization: Bearer sb_secret_...`.
2. GitHub repository `ctimaru/steel-sales-ai` → **Settings → Secrets and variables → Actions → Secrets → New repository secret**:
   - Name: `CRAWL_IT65B_SUPABASE_SECRET_KEY`
   - Value: dedicated Supabase backend secret key
3. Under **Variables** in the same GitHub Actions settings, create:
   - `CRAWL_IT65B_SUPABASE_URL` = `https://ecrafjdummcdfycznitx.supabase.co`
   - `CRAWL_IT65B_ENABLED` = `false` initially.
4. Actions → **CRAWL-IT6.5b — Italy GitHub Actions Discovery** → **Run workflow**, select **preview**. Check that the public WDQS query returns syntactically valid candidates (0–5) and no Supabase writes.
5. Once approved by the Platform Owner, set variable `CRAWL_IT65B_ENABLED=true`. Use **Run workflow → stage** to test the source gate. Since the previously recorded production `last_discovered_at` is **2026-10-14 13:25:30 UTC**, the first eligible moment is **2026-10-21 13:25:30 UTC** (unless source governance/cadence changes). Before that, runs correctly report `skipped / not_due`.
6. On and after the next eligible Wednesday, the **15:47 UTC** schedule makes the query and stages **up to five unique pending leads** only if the source is still approved/enabled. GitHub's cron scheduling can be delayed; the database remains the source of truth. In public repositories schedules can be disabled after prolonged repository inactivity; check periodic successful runs.
7. The Operator manually reviews domains in Platform Company Discovery and approves/rejects; later site crawl/promotion is a separate controlled action. Turn off by changing `CRAWL_IT65B_ENABLED=false` OR source `enabled_for_discovery=false`.

### Verification
- Workflow `P0 Required Gate`: worker unit/mock tests, SQL privilege/expiry/idempotence and one-transaction staging fixture, Next static contract.
- On production: verify RPC exposed only to `service_role`, source governance unchanged, 4 previously staged Wikidata leads unchanged, 30 published Italy companies unchanged. Apply SQL migration **without triggering ingestion**.
- After activation, validate single-run GitHub job counts (`inserted`, `existing_network`, `existing_candidates`, `existing_leads`) and database `last_discovered_at`; never infer success from a green scheduler alone.

## Cost / trade-off
- One short Linux Actions run per week rather than 24/7 worker. GitHub Actions minutes depend on the repository visibility and user plan; most likely negligible at this cadence, but minutes are not guaranteed free. No new Vercel function/cron and no paid Railway service for this pipeline.
- Main risk: the dedicated `sb_secret_` backend key still has **full Supabase `service_role` privileges**, despite its separate name. Keep it only in Actions secrets; use least-privilege repository access and workflow approvals if available. A future hardened version could use GitHub OIDC + server-verified short-lived identity and a narrower API.
- Growth is bounded by source availability, not automation frequency: Wikidata producer-biased data is finite. Expanding to Italian *commercianti* requires separate rights-reviewed sources and deduplication pipeline.

## Separate unresolved infrastructure ticket
See GitHub issue #564. FastAPI worker remains offline; this microblock does **not** claim worker recovery. The high-impact next task is restoring email/document ingestion independently while testing GitHub Actions crawler.
