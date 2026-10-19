# NET-UX COMPACT4B — Geographic Density Sprint

## Operational scope

Actual database snapshot, 2026-10-19. **25 distinct company records** in `services/worker/data/netcompact4b_approved_25.json`:
- 18 published Italian firms, official HTTPS site and website domain, with no published facility or earlier geo candidate.
- 7 discovered end-user leads (`official_company_research`, `needs_review`) with an exact-domain first-party site and no sourced geo.
- Each company UUID, website and domain is derived from the existing Network database, not fabricated.

Production baseline **before** this batch:
- 3 published facilities, 7 usable pending-review canonical geographic candidates, 21 sourced provisional locations: up to 31 known company localities out of 501.
- All newly collected rows must stay `pending_review` / `source_observed`, never company validation, published facilities or exact street geocoding.

## Worker command (dry-run first)

```bash
cd services/worker
python -m app.netcompact4b_geo_batch --manifest data/netcompact4b_approved_25.json --max-sites 5
# After examining source URLs, missing/multiple-location decisions and DB access:
python -m app.netcompact4b_geo_batch --manifest data/netcompact4b_approved_25.json --max-sites 25 --persist
```

Worker-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are required **only** to persist. No secrets in GitHub, browser or logs. Or run workflow `NET-UX COMPACT4B — Geographic first-party batch` manually on main; select 1,5,10,25 and opt into writes. The workflow is not scheduled.

Fetch policy: use the shared robots-aware, DNS/IP-checked, bounded HTTP fetcher (three pages/site maximum; 2 seconds between sites). Follow only official-domain links containing contact/location paths. Collect explicit Italian postcode+municipality+(province) or original JSON-LD PostalAddress fields. Reject missing address, inaccessible site, non-first-party domain, ambiguous multiple cities, unknown ISTAT municipality, city/province mismatch, or existing facility/evidence. Existing ISTAT registry has 7,894 current municipalities.

Persistence:
- Canonical: service-role-only invoker RPC `netcompact4b_stage_canonical_geo`, immutable source excerpt, validation against canonical website domain and unique current municipality/province, idempotent skip if prior geo already exists.
- Discovered: reuse service-only `neteima2_stage_provisional_geo`, with its existing exact-domain, end-user lead and ISTAT checks.
- No anonymous access; no direct writes from a public frontend. `COMPACT4` currently makes sourced geography visible with `Località indicativa` and source link after a successful database write.

## Acceptance

1. CI worker and Supabase foundation + SEC1 green before merge and migration.
2. Verify RPC service-role-only grants; anonymous and authenticated cannot execute intake.
3. Run dry-run on 5, inspect all candidate URLs; then execute the opted-in real batch.
4. Compare counts before/after for 25 company UUIDs in `network_it_geo_evidence_candidates` and `network_neteima2_provisional_geo`. Distinguish checked vs candidates vs staged.
5. Test sample "CPS S.r.l.": official first-party contact page includes `20863 Concorezzo (MB)`; for "Pedrali" headquarters official first-party location page states Mornico al Serio, Bergamo. These sources are starting examples, not proof all 25 succeed.
6. Verify no new `network_facilities` rows and no claim/verification changes; check Network page as authenticated Free and Pro at desktop and mobile.
7. On robots/network/timeouts or conflicting locations, mark `blocked_or_unavailable` / `multiple_localities_manual_review`, never backfill by guessing.

Goal for this initial batch is **measured geographic coverage gained**, not 25 artificially filled addresses. The first complete dry-run determines real yield. Do not treat a runnable workflow as evidence of a completed 25-site production run.
