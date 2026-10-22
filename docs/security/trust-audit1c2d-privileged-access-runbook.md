# TRUST-AUDIT1C.2D — Privileged Access & Authorized Purge

Date: 2026-10-22. Status: INACTIVE PRICE LIST RPC READ GATE PASS / PHYSICAL DELETION NOT EXECUTED.

## Verified risk and remediation
Privileged DB-owner execution formerly returned 1 retired catalog version and 1,828 retired price items, despite source marked inactive. The public catalog, item explorer and private version-visibility helper now enforce active parent-list status. Five restrictive RLS policies cover list, version, section, item and component, relying on a narrow private security-definer boolean function to avoid RLS recursion. The first staging policy test detected recursion and was repaired **before** production; staging and production smoke checks are successful. No externally exploitable unauthorized access was established.

The inactive list still has 1,828 price items and 3,656 components physically present. Supabase service_role, DB-owner access, import governance and other privileged paths remain subject to a distinct access review. This code is NOT permission to delete data or destroy evidence.

## Gates before irreversible purge
- Counsel/data-controller decision on chain-of-custody, retention and legal hold.
- Exact restricted manifest; prove tenant and ownership and avoid unrelated records.
- Review source/price-list FKs, import decisions, workflow and linked documents.
- Check re-ingest and worker routes, privileged RPCs, and backups.
- Use Supabase Storage API remove on exact approved paths, NEVER SQL DELETE on storage.objects.
- Assert pre/post counts with rollback on mismatches, preserve unrelated network entities.
- Keep physical purge, backup retention and legal readiness as separate completion states.

## PR sequence
This PR is stacked on #867, which depends on #861. Complete required CI and verify clean staging rebuild, merge in dependency order, verify production deployment separately. Do not bypass GitHub branch protection.

Supabase docs: https://supabase.com/docs/guides/storage/management/delete-objects
