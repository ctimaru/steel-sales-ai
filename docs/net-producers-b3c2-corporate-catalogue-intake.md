# NET-PRO-PRODUCERS1.B3.C2.A — Verified-company catalogue intake

## What is implemented

This increment introduces /network/manage/cataloghi: a one-page responsive PDF/CSV upload interface for approved producers, reachable from the Company Hub. It is a company-authenticated private submission inbox, **not** an automatic grant issuer.

Producer eligibility is rechecked inside a SECURITY DEFINER RPC against:
- an existing published Italian company with active producer role and domain;
- an existing approved claim with proof_status=verified and no revocation;
- the current authenticated user's ACTIVE organization admin membership for that claim.

The browser receives no service key. It computes SHA-256 using Web Crypto, prepares a 30-minute upload reservation, uploads with upsert:false to an 8MB capped private Storage bucket and finalizes only after the server sees a matching object with correct size/type. File path binds canonical company UUID, catalogue UUID, exact SHA and extension.

A producer's explicit declaration covers extraction, derivative storage and use in producer search. The declaration does not prove rights over third-party content. It creates state pending_provenance, which is **not** an approved B2 grant. No PDF candidate, technical tuple, stock or manufacturing capability is published.

Clients can INSERT ONLY into Storage for a verified own pending reservation; they cannot enumerate/download, overwrite, or delete private catalogue bytes via Storage policies. The SQL frontend RPC returns only state and names for the caller's verified organization, never the original bytes. Quota: max five reservations per producer per 24 hours. Revision and retention of orphaned uploads require follow-on implementation.

Revocation is available in one click, including transactional B2 grant revocation if a trusted issuer subsequently registered that exact catalogue. Existing B3.A/B3.B/C1 revocation triggers cascade to stale candidates and blocked queue jobs.

## Important remaining work before positive canary

1. Trusted server-side independent provenance and document rights verifier must inspect company attestation, company claim status, first-party URL, file bytes, SHA, source credibility, retention period and conflicts before it can invoke the existing service-only B2 register and C1 enqueue functions. No auto-grant is introduced in this PR.
2. Test the page on Vercel and 1440/390/320 widths; inspect real JWT authorization for company admin vs member vs competitor. No verified company has been found in production yet; therefore no legitimate positive upload or B2 grant can be invented.
3. B3.C3: parser for truly tabular PDF layouts, binding standard/grade headers to dimensional rows using geometric proof and independently reproducible source page+line; only promote as source_verified when unambiguous.
4. A producer-provided catalogue may require a first-party URL that is not yet publicly linked. B2 currently requires an HTTPS URL on the exact canonical producer domain. Extend provenance model explicitly if private-only documents are later supported; never synthesize imaginary public URLs.

## Test/release

Run P0 required worker + frontend + Supabase foundation & JWT tenant isolation on final HEAD. Merge protected; install new migration once. After migration, test no public SELECT/UPDATE/DELETE policy on catalogue bucket, anon denies RPC, member/pending/competitor deny uploads, verified admin can prepare and finalize only their own valid object. Negative no-grant canary must remain zero.
