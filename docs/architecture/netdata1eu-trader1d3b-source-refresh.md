# TRADER1D.3B — Governed automatic EU source refresh (first operational slice)

2026-10-20 · **Implementation PR (no schema or Network data mutation).**

## Why this design

The founder explicitly rejects per-company manual verification as a condition of growth. A reliable, scalable Network needs **deterministic automated checks**, clear provenance and a **company-claim-first** editing model. An official corporate page is an identity/industry research reference; it does not itself authorize extracting/copying/distributing its text, images, product catalogues, price lists or personal contacts. The refresh must not make ungrounded promises about legal identity, availability, licenses or supplier eligibility.

## Actual source inventory

- File: `services/worker/data/trader1d3b_sources.json`. Snapshot extracted read-only on 20 October 2026 from actual production private EU research: **60 distinct first-party website domains**, one documented role-evidence URL per domain, research-market country. No private research UUIDs or personal contact fields.
- Snapshot is *versioned data*, not a live DB cursor; subsequent additions/changes to private research do **not** appear until governed manifest synchronization. Each domain is checked against its exact/same-domain HTTPS source URL. No automatic company/legal-entity merge.
- **All seed source rights are `not_assessed`.** This cannot be changed by the worker.

## Automated bounded runner

- Module: `services/worker/app/trader1d3b_source_refresh.py`.
- Workflow: `.github/workflows/trader1d3b-eu-source-refresh.yml`; GitHub Actions on main **daily at 05:37 UTC**, once at workflow introduction on main, plus manual dispatch. At most **five domains per run**, distributed deterministically across a 12-day rotation for 60 current domains. Site visits sequential, 2-second pause between domains, 9-minute job timeout, no immediate retry on failures.
- Per domain: enforce HTTPS, exact official domain and blocked directory/social host list, reject userinfo, unsafe/private IP literal and nonstandard ports, call existing DNS-public guard and safe bounded robots.txt logic. Robots not allowed/unreachable **fails closed**. Only then issue exactly **one HEAD request** to the documented company page. No redirects followed, no HTML company-page body downloaded, no link following, no text extraction or scraping.
- HEAD 405/501 means *method not supported*, not offline. 301/302 means *redirect observed*, not identity validated. 429 means rate-limited, no retry. Robots blocked or network error never turns into `reachable` or grants any rights.
- Hash only URL + HTTP status + normalized content type + ETag/Last-Modified metadata; never store body, image, personal data, or response cookies. Fingerprint changes only show **metadata change**, not substantive content change.
- Emit a JSON artifact for every run (30-day retention), including UTC check timestamp, outcomes per domain, source URL and status, no API secrets. A best-effort GitHub Actions cache accumulates last successful observations per domain and shows first observation / changed / unchanged. Cache can expire; a missing cache resets the comparison rather than fabricating an unchanged state.
- **Supabase writes=0, company publication=0, source-rights updates=0**. No service key needed. This early monitor cannot verify live content relevance, exact EU legal entity, product assortment, physical facility, licensing, or public Network eligibility.

## Tests

`services/worker/tests/test_trader1d3b_source_refresh.py` covers: first-party only URL safety, duplicate and out-of-EU rejection, source rights not assessed, 60-domain deterministic rotation, robots denials, HEAD statuses, no redirects, fingerprint changes, non-publication, no company-content capture. Required P0 worker gate runs against source.

## Next planned increment

**TRADER1D.3B.2 — DB-sourced refresh & governed observation ledger**, only **after** resolving [Supabase migration version drift #780](https://github.com/ctimaru/steel-sales-ai/issues/780). Introduce service-only bounded feed/append ledger (no exposed private browser grants) with idempotent run key, per-source URL revisions, consent/terms/robots state, stale detection, safe facts and provenance. Compare the source evidence **separately** from legal entity reconciliation, source reuse authorization and published company profiles. Refresh can inform the owner quality dashboard; cannot publish.

**TRADER1D.3C**: only publish field-level metadata backed by lawful use, provenance and collision checks; **TRADER1D.3D**: companies claim published profiles and maintain their own data under verified ownership. No central company-by-company editorial approvals.
