# COMPANY-UX2.D.2 — Catalogues in the company workspace

## Purpose and entry points

D.2 brings the existing governed producer-catalogue workflow into **Prodotti e
cataloghi** at `/company/profile#products-catalogues`. Company administrators can
see their recent documents, open one upload form, follow source and rights
checks, and explicitly withdraw a submission without leaving the company
workspace. The ten primary workspace panels remain unchanged.

`/network/manage/cataloghi` preserves the Network feature flag and the workspace
administrator guard, then redirects to the canonical anchor. Company overview
and inventory catalogue links use the same destination. The managed company
context remains checked by the canonical server page; the client component is
keyed by organization and company so drafts do not survive an identity change.

## Existing authority and writers

The implementation reuses
`public.netproducers1_b3c2_catalog_submission(text,jsonb)`. The existing owner
authorization still requires a published, non-archived Italian producer with a
website domain, an approved and independently verified company claim, and an
active administrator of the claiming organization. The single approved-claim
index continues to determine the organization for this contract.

Upload remains `prepare → private Storage insert → finalize`. PDF files are
limited to 8 MB and CSV files to 2 MB. The explicit rights declaration retains
its existing meaning. The browser hashes the selected bytes, validates the
reservation receipt against the exact company/document/hash path, uploads
without upsert, and checks the final receipt. Receipt validation requires
`rights_verified: false` and `published_claims: 0`; an upload is not a licence,
published claim, product SKU, or commercial stock row.

Opening or cancelling an untouched form makes no reservation or Storage write.
A synchronous submission guard prevents duplicate requests while a previous
submission is in flight. Editable values remain on validation or service errors.
An ambiguous outcome after reservation starts disables a second submission and
offers a read-only status refresh. Refresh does not automatically retry a
writer or re-enable submission. The administrator can inspect and withdraw an
incomplete entry before reopening the form.

Withdrawal first shows the document name and a local confirmation. It then uses
the existing `withdraw` operation, which revokes applicable grants, stales the
derived records, and blocks pending processing. There is no optimistic success
or local state change before a valid server receipt. A failed or ambiguous
receipt directs the administrator to refresh the persisted state.

## Additive read contract

Migration `20261127150419_company_ux2d2_catalog_status.sql` patches only the two
returns of the existing `status` read branch. Its exact-anchor checks fail if the
reviewed function body has changed. The authority guards, organization choice,
`prepare`, `finalize`, `withdraw`, public facade, grants, and Storage policies are
unchanged.

The base contract stays `netproducers-b3c2-v1`. Both eligible and ineligible
responses add `details_contract: company-ux2d2-catalog-status-v1` and `limit: 20`.
The item list remains bounded to the 20 most recent submissions, including
withdrawn entries. The UI explicitly describes that bound; summary counts cover
only those returned entries.

Each item preserves its previous identifiers, name, edition, format, submission
state, creation date and upload date, and adds:

| Field | Meaning |
| --- | --- |
| `source_url` | The submitted official document URL |
| `rights_declared_at` | When the uploader made the rights declaration |
| `source_checked_at` | Last recorded source check, or null |
| `withdrawn_at` | Submission withdrawal date, or null |
| `rights_status` | `not_verified`, `active`, `expired`, or `revoked` |
| `rights_verified_at` | Exact matching grant verification date, or null |
| `rights_expires_at` | Exact matching grant expiry date, or null |
| `rights_revoked_at` | Exact matching grant revocation date, or null |

Rights are joined only when catalog ID, company, document hash, source URL,
edition, and format all match the submission. Revocation takes precedence over
expiry. Active rights additionally require a verified, current, approved grant,
the full existing extraction rights, an unwithdrawn submission, and a source
matching the company's current domain. A missing or mismatched grant has no
grant dates and is `not_verified`. An entry withdrawn before any grant exists
does not acquire invented licence history.

The historical submission state `in_analysis` never determines current rights.
It records handoff to technical analysis, not completion or publication. No
Storage paths, content hashes, private verification references, worker details,
or submitting-user identifiers are exposed in the new read response.

## Interface and failure states

The workspace distinguishes loading, unavailable reads, ineligible access,
confirmed empty lists, and populated lists. An old or malformed response fails
closed as unavailable. The parser validates the version, bounds, unique IDs,
enums, safe source URLs, timestamps and active-rights consistency for the whole
response; it never silently drops malformed entries and presents a false zero.

Source links use the stored HTTPS URL. Cards show source-check, submission and
rights dates separately. Rights status comes from the server, not the browser
clock or the upload checkbox. User-facing states are in Italian, with explicit
feedback focus and preserved form values on read failure.

The existing structured-fact moderation and PDF-size owner components are
mounted only after an eligible administrator opens **Rivedi dati estratti**.
Their existing permission checks and individual confirm/remove/restore actions
are retained.

## Scope boundaries

There is no canonical submission-to-product-family relationship in the existing
model. D.2 makes catalogues and declared products reachable in the same panel;
it does not invent associations from filenames, extracted text, or AI.

Catalogue CSV remains the existing producer technical-document intake. Governed
CSV/Excel stock import is a separate subsequent block. `/uploads` remains the
private Commercial Memory workflow. No new crawler, AI model, data harvesting,
licence issuer, public catalogue search, or stock-publication rule is introduced.

## Verification and release order

The frontend parser has behavioral tests for versioning, empty/ineligible/error
distinction, bounds, safe sources, timestamp validation, and independent rights
states. Existing catalogue integration tests follow the canonical workspace.

`supabase/tests/company_ux2d2_catalog_status.sql` uses synthetic fixtures and a
rollback to test actual SQL rights combinations, matching identities, changed
domains, authorization denial, no private-field leakage, read-only behavior,
and the 20-item bound.

`apps/web/tests/company-ux2d2-chrome.mjs` runs authenticated Chrome against the
disposable local database at 1440, 390 and 320 pixels. It exercises real PDF/CSV
uploads, cancellation, file/source validation, duplicate-submit prevention,
ambiguous completion, state refresh, rights combinations, confirmed withdrawal
and its derived effects, eligibility, lazy moderation, the legacy redirect, and
responsive screenshots. External requests are blocked. The Company workflow
also runs prior A/C.1/C.2/D.1 acceptance before D.2.

For production, apply `20261127150419_company_ux2d2_catalog_status.sql` **before
deploying the new UI**, then perform the protected merge/deploy and authenticated
smoke check on the verified commit. The additive database read remains backward
compatible with the old UI. If the UI is deployed without the migration, its
contract check deliberately shows unavailable instead of hiding missing data.
Development and CI do not apply migrations or upload documents to a hosted
production project.
