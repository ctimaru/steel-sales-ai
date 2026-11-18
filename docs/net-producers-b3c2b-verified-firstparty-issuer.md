# B3.C2.B — From verified producer upload to catalog intelligence, without invented rights

## Product consequence

The producer uses the existing one-page **/network/manage/cataloghi** interface to upload PDF/CSV, provide the real first-party HTTPS catalogue URL and attest specific derivative rights. This feature needs no new customer subscription: Intelligence is part of Network PRO for producers.

The B3.C2.B worker runs on the **existing Railway AUTO1 cron**, bounded to two documents, *before* the B3.C1 private parser. Its flag `NETPRODUCERS_B3C2_ISSUER_ENABLED=1` is default **OFF** until a protected Railway release.

### Independent acceptance conditions (all required)

1. Existing independently verified corporate identity: published IT producer, valid company claim `approved`, proof `verified` with proof timestamp, and uploader still an active `admin` of the claiming organization.
2. Explicit rights declaration captured as `submitted_by`, `rights_declared_at`, company, edition, source URL and unique uploaded SHA; not inferred from a discovered `link_only` URL.
3. Exact official company HTTPS hostname: same canonical site domain; no other registrable subdomains or hosted third-party files; non-standard ports, redirects, proxy and credentials rejected.
4. Independent source byte retrieval by the worker: resolve DNS and reject *any* non-global address; open a pinned socket to a public address only, use the original hostname for SNI/TLS certificate and HTTP Host validation. Fetch without redirects or decompression, 12 second timeout and strict PDF (8 MiB) / CSV (2 MiB) byte caps.
5. Download the *private* Supabase Storage file with service credentials; compute its SHA-256 independently and match both uploaded SHA and the same bytes served on the company official HTTPS URL. A PDF on an unrelated site or even a different official PDF edition does not qualify.
6. Service-role-only guarded RPC atomically registers **one** bounded B2 grant, enqueues that **same** company/document SHA to B3.C1 and logs evidence. A rejected/stale object cannot leave a partial approved licence. SQL rechecks current admin/claim and locks the submission before accepting the worker result.
7. Revocation during lease atomically clears its token and blocks approval. B2 revocation subsequently marks derived candidates stale and C1 jobs blocked. Only bounded error codes, retry/backoff and append-only private audit are persisted.

Source match is documentary proof of *the document*, **not** confirmation of manufacturing availability, prices, measures, capacity, stock or exact grade×section tuples. B3.B PDF candidates remain `pending_verification`; B3.C3 geometric table verification is a separate gate.

### Intentional failure handling

- Official URL unreachable or private Storage temporarily unavailable: retry with bounded backoff, then `needs_review`.
- Different source SHA, unsafe DNS, unsupported bytes, revoked company identity: fail closed. No grant.
- No verified producer uploads: source issuer returns 0 leases; zero-eligible canary is valid, not a positive PDF proof.
- Third-party CDN/document repository aliases: not implicitly trusted. Support requires a separate, documented organization-to-source-domain ownership verification design.
- Large or image-only PDFs: parser still denies OCR or speculative association.
- Retention, original-file deletion following revocation, scheduled revalidation and full UI of per-page table claims are future work.

## Deployment/checklist

1. Pass worker, P0 frontend, Supabase foundation, SQL and JWT scopes, SEC1, secret guard on final HEAD.
2. Protected merge; apply the single add-only migration exactly once. Read back private tables, RLS, service-only RPC, immutable audit, zero grants/candidates and state check.
3. Run real service-role `stats` / `claim {limit:1}` empty canary. Run false user SQL smoke test; verify B2 = 0 and no public technical assertion.
4. **Railway is pinned to an older explicit SHA and must not be assumed updated by the merge.** Review policy (one deployment daily) and release the approved commit in the next permitted Railway window; add `NETPRODUCERS_B3C2_ISSUER_ENABLED=1` only when the new code is deployed. No extra cron.
5. First positive canary only when real independently verified producer submits their *actual document* with exact matching HTTPS bytes. Record verified-vs-candidate-vs-source-verified counts; don't fake a producer or licence.

## Technical dependencies

B3.C2.A #1441, B3.C1 #1437, B3.A/B PDF candidates; next C3 #1442 table geometry cross-header checks and robust exact tuple verification. Network producer Intelligence must remain behind PRO entitlement.
