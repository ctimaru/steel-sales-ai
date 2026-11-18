# NET-PRO-PRODUCERS1.B3.B — PDF manufacturer catalogue intake (conservative)

## Scope and evidence states

A producer-provided PDF may contain precise EN 10219 / EN 10210 dimensional rows.
This step can only produce **pending_verification** private candidate records.
A PDF row is not proof of **manufacturer_confirmed**, stock, orderability,
price, lead-time or compliance. No consumer-visible read path is created.

B2 approval must already exist from an independently verified source:
exact canonical first-party producer, matching catalogue ID, URL, SHA-256,
document edition, allowed actions, verified and unexpired rights. The existing
five legacy link-only catalogues are **not** upgraded to PDF extraction grants.

## Read-only parser boundary

The function \`stage_authorised_pdf(db, manifest, pdf_bytes)\` in
\`app.net_pro_producers_catalog_b3b_pdf\` must be called from a service-role
worker handling a deliberately provided PDF. It does not fetch URLs or expose
a public upload route. It retrieves B2 rights via trusted RPC, then validates
the PDF bytes and SHA through B1, before launching a separate Python
interpreter with isolated mode (\`-I\`).

The child enforces 512 MiB address-space, 5 CPU seconds, 9 seconds wall time
(parent timeout), 8 MiB source, 15 pages, 500 lines/page and bounded text.
It uses only selectable text from pypdf in layout mode. No PDF script execution,
OCR, image extraction, embedded file handling, or external HTTP requests.
This is a bounded **process**, not a container or kernel-enforced network sandbox;
do not route untrusted arbitrary PDFs from public endpoints until an OS-level
isolation review is complete.

Strict candidate format: \`EN 10219 | S355J2H | RHS | 200x100x6\`, or four
equivalent columns delimited unambiguously by semicolons, tabs or large
layout spaces **on the same extracted line**. Headers and dimensional ranges
cannot be combined with separate lines or pages. Scanned/image PDFs and
ambiguous layouts return \`no_exact_pdf_lines\` — never a fabricated match.

Each stored candidate includes company, catalog, source URL/edition,
document SHA, exact page+line locator, SHA of the extracted line,
standard, grade, shape, dimensions and pending-verification status.
Raw PDF bytes and raw page text are not stored in Supabase by this module.
The catalogue hash is derived from supplied bytes, not a URL or title.

## Database controls and rollback invariants

Additive migration \`20261118123000_net_pro_producers1_b3b_pdf_candidates.sql\`.
New private tables are RLS deny-all, not directly accessible to service_role,
anon or authenticated; a narrowly permissioned service-only RPC validates
current B2 rights, company and first-party domain, SHA, edition, page and line,
tuple completeness and dimensional coherence at write time. Insertion is
strictly idempotent; a conflicting replay is rejected. B2 grant revocation
marks PDF rows stale transactionally and logs the transition in an append-only
ledger. Expiry is rechecked at every RPC.

The existing B2 CSV and B3.A source-verified data are never modified
or conflated with pending PDF candidates.

## Release/canary protocol

1. Exact PR HEAD: required P0 worker/secret/Supabase rebuild and
   real tenant-isolation checks, SQL review and actual pypdf regression.
2. Merge protected branch only if green, then apply migration exactly
   once and verify permissions, RLS, triggers and empty initial counts.
3. Verify invalid service RPC calls without rights reject with 42501.
4. **Only with a genuine producer-provided document and independently
   verified B2 grant**, feed the PDF bytes into the worker call; inspect:
   pages, candidate rows, replay, rejected/ignored lines; observe zero public
   claims and zero manufacturer confirmation.
5. For same PDF re-run, all candidates replay idempotently. For grant revoke,
   all associated pending rows become stale. No cross-grant resurrection.
6. Do not schedule indiscriminate crawls or auto-grants. The next workstream
   is verified producer onboarding/licences and controlled admission of more
   layouts (multi-line tables with geometric proof), separately reviewed.

## Limitations

- Only machine-readable selectable-text PDFs; no OCR.
- Requires four explicit fields on one line. Real industrial layouts often
  put standards/grades in headers and dimensions in tables: these must be
  treated as **not yet proven** until a layout-aware evidence algorithm is
  separately validated.
- The current worker infrastructure has not been wired to a catalogue
  ingestion queue or company upload control by this PR.
- No autonomous web download of a document is authorized by the schema.
