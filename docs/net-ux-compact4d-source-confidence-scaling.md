# NET-UX COMPACT4D — Geographic Source Confidence & Scaling

## Source-backed production baseline, 2026-10-19
- 501 Network companies. 3 companies with published facilities, 25 canonical candidate geographies, 28 discovered source-observed geographies: **56/501 (11.2%)** with a city/region.
- **388** additional `official_company_research` end-user leads have a HTTPS official domain, status `needs_review`, and no sourced geography. These are **not** new localities.
- Only three published Italian companies remain without any location; Dalmine and two Marcegaglia firms use group-level domains. **Do not automatically treat group headquarters as their own registered office**.
- Important candidate exceptions: TAD Long Products has *UFFICI* in its evidence, not *sede legale*. Cinelli uses *Gruppo Srl Div. Cinelli* in source evidence; verify brand/entity ownership before any official publication.

## Delivered architecture
1. `netcompact4d_next_discovered_geo_batch` (service-role only): dynamically and deterministically selects at most 25 still-unlocated discovered end-user companies with exactly matching HTTPS official domains. The batch is idempotent because already-sourced targets disappear from the eligible set.
2. `netcompact4d_geo_quality_audit` (service-role only): summarizes official-source domain matches and labels evidence excerpts according to **stated** registered office, main office, plant, offices, or unspecified; flags possible entity mismatch such as divisions and group addresses. These are screening indicators, **not confidence scores or verified addresses**.
3. `services/worker/app/netcompact4d_geo_scale.py`: runtime batch selector, unchanged source safety validation, dry-run default, optional service-role candidate-only staging. Quality audit is always read-only.
4. Existing manual GitHub Actions workflow now supports `source_mode`: `next_eligible` (default), `quality_audit`, `approved_25`. It never runs on a schedule. Explicit `persist_candidates: true` is required for any candidate write.

## Acceptance and limits
- CI worker test, Supabase local foundation and required gate green before merging.
- Run one `quality_audit` and one `next_eligible` **dry-run first**. Actual yield depends on robots.txt, reachable official site, and unique address evidence; never claim all 25 have been geolocated until database verification.
- Verify grants: anonymous/authenticated cannot execute either service RPC; service_role only. Preserve published facility count of 3.
- Cases with multiple cities, subsidiary/brand conflicts, unverified website ownership, or generic offices must remain indicative and flagged for review. No automatic publication or confidence promotion.
- No false geographic count on the public Network. The compact UI and source links remain unchanged. Post-deploy authenticated visual acceptance is still outstanding.

## Next expansion
Run bounded 25-company microbatches, record `candidate_yield`, `blocked`, `ambiguous`, `staged`, `identity_review` and distinct domains. Strengthen extraction for Italian addresses without postal-code parentheses only after accuracy tests; do not silently lower the provenance threshold.
