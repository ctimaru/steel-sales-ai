# NET-PRO-PRODUCERS1 · AUTO1.A.5.5 — read-only HTML product-page audit

## Problem and production baseline (17 Nov 2026)
The live A5.4 worker produces layout counters for **newly due** HTML product pages,
but the last real canary had `a54_product_page_quality={}` and only PDF-link
detail pages. As of the read-only Supabase snapshot:

- 176 first-level product pages (144 processed, 21 candidate_review, 9 failed, 2 blocked).
- None currently due for ordinary re-fetch; first processed next due
  16 December 2026. Never shorten that TTL just to improve a metric.
- A read-only eligibility query found **165** SHA-current, producer/IT/published,
  first-party product pages at **34** unique hosts, 52 with technical-looking URLs.
  This count is an audit sampling pool, NOT technical evidence.
- 47 second-level pages processed; 0 exact-grade × standard × section × size
  candidates. Nothing currently supports a claim of exact tube producibility.

## Scope
Install a service-role-only **read-only** RPC choosing up to 12 current first-level
snapshots, max 2 per canonical host. Prefer technical-looking URLs; verify same
company's current official root-page SHA and site, producer role, published IT,
35-day freshness and future scheduled recheck. Selection does not mutate rows.

The manual runner (separate from cron) uses the existing HTML fetch:
- HTTPS first-party only, DNS public only, robots fail closed, no redirects,
  bounded 512 KiB HTML, same User-Agent and 1.5-second inter-page throttle.
- Ignore ETag only *inside the manual audit* to re-fetch exact HTML bytes,
  without writing and without changing any scheduled production check.
- Attribute A5.4 categories **only when SHA-256 of fetched bytes matches saved
  product-page SHA**. Different bytes are `changed_snapshot` and never classified.
- Output only aggregate counts `selected/sha_matched/changed_snapshot/http_*/
  layout_categories`, with `db_writes=0`, `published_claims=0`. Never log
  identifiers, URLs, source SHA, text or technical assertions.
- PDF-only means an HTML page *links* to a PDF; **do not download the PDF**.

## Installation, in protected order
1. Verify migration history first. The production remote migration versions
   of the existing A3/A4/A5/A53 stack differ from source file timestamps;
   reconcile before any broad `supabase db push`. This migration is additive
   with a NEW function only. Do not re-run an older schema migration.
2. Test P0 required, worker pytest, Supabase SQL/RLS, security and review on the
   exact PR HEAD; inspect privileges of both RPCs before release.
3. Apply A5.5 migration once through the approved project deployment process;
   read back `pg_proc.proacl` or `has_function_privilege` for anon,
   authenticated and service_role (only service_role may EXECUTE).
4. Deploy the worker SHA in a permitted window with the existing
   `NETPRODUCERS_A54_ENABLED=true`. Do **not** alter the recurring
   `*/20 * * * *` or its `--persist --limit 10` start command.
5. Trigger **one explicit one-shot execution** in an authorized worker runtime
   with the existing sealed service credentials (e.g. a separately approved
   Railway one-shot job). Do not change the persistent cron's start command
   or leak service_role into the browser, CI logs or untrusted shell.
   ```sh
   python -m app.net_pro_producers_auto1 --audit-a55 --sample 8
   ```
   An ordinary restart/redeploy alone **does not run this audit**.
6. Verify read-only repeatability and same page counts in Supabase; no queues,
   timestamps, claims or entitlement rows changed. Record only aggregated result
   in issue #1410, and keep a separate note when no source SHA matches.

## Decision rule after the audit
- If the SHA-verified sample includes actual `technical_html_rows`, inspect
  whether its parser can conservatively recognise a complete SAME-ROW
  standard+grade+shape+dimension relationship (including unambiguous table
  headers). Develop this as a **different, flag-gated PR**, not as an automatic
  promotion from A5.4's observational label.
- If sample is primarily `pdf_links_no_html_table`, prioritise **producer-
  authorised licensed catalogue ingestion** or official link-only sources.
  Do not mirror PDFs or extract copyrighted tables without rights.
- If many sources are `changed_snapshot`, prefer natural future reprocessing
  and improve incremental change detection; do not backfill speculative claims.

No new SKU or purchases are introduced. Source-backed intelligence stays in
the `producers` module, and checkout PR #1322 is independent.

## Acceptance
- At most 12 unique SHA-pinned official product pages, max 2/domain.
- Unit and SQL-contract tests proving bounded permissions, same-SHA attribution,
  unchanged HTTP/robots guards, no writes or publication; no SKU from a URL,
  mention, range or standalone PDF link.
- Same deployment policy: protected merge, one deploy/day unless the founder
  explicitly approves an exception. No deployment or audit marked completed
  without actual Railway runtime and SQL readback.
