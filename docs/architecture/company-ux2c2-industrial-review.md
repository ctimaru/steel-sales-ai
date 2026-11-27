# COMPANY-UX2.C.2 — Structured industrial review

## Product purpose

C.1 lets a company compare and confirm its description. C.2 extends the same
human decision to industrial records already represented by the managed profile:
product relationships, capabilities at a real facility, served sectors and
certification types. Each proposal is reviewed in its existing workspace panel.

The source is the current published NET-RESEARCH1 record. C.2 does not invoke an
extractor or model. Its suggestions are not additions to the company profile
until an authorized company administrator confirms a canonical selection.

| Research field | Canonical destination | Required human selection |
| --- | --- | --- |
| `products` | Company product relationship | Product family, commercial relationship, company/facility scope |
| `activities` | Facility capability | Capability and an existing facility |
| `sectors` | Company market/industrial sector | Sector |
| `certifications` | Company certification | Certification type and company/facility scope |

Geographic `markets` are not industrial sectors. `plants_count` does not identify
a facility. The review creates no roles, subtypes, facilities, addresses, product
standards, material grades, dimensional scopes or verification records.

## Sources and meaning

NET-RESEARCH1 currently saves industrial labels and shared research URLs, without
a supporting quotation for each individual label. The interface therefore says
**Fonti della ricerca** and shows the original label beside the proposed
canonical category. It does not display a fabricated quotation or confidence.

Mappings use complete, allowlisted aliases or complete taxonomy names. Unknown,
ambiguous and negative phrases are not mapped by substring. A recognized label
is still a proposal: the administrator must review and confirm it. A context
lost during upstream extraction cannot be reconstructed from the stored label.

For certification proposals, confirmation records only the selected type and
scope as an unverified company declaration. Issuer, identifier, validity dates,
scope text and evidence reference remain absent; the existing certification
editor supports entering those details later.

## API and authority

`company_ux2c2_industrial_review(organization, company)` returns the
`company-ux2c2-industrial-v1` contract: availability, research metadata, four
current-state hashes and bounded proposals. Each proposal has a stable
`content_key`, a source-sensitive `proposal_hash`, an optional suggested key and
any persisted decision.

`company_ux2c2_decide_industrial(organization, company, proposal_hash, state_hash,
action, selection)` accepts `confirm` or `ignore`. The server obtains the
organization from the authenticated workspace context. The database derives the
proposal and its kind from the stored research, checks the same explicit
organization/admin/link/approved-claim authority as C.1 and validates every
canonical key and facility. Platform administrator status alone is insufficient.

The public RPC facades are invoker functions. Privileged implementations and
helpers live in `private`, with an empty search path and explicit privileges.
The new decision ledger has RLS and no direct client access.

## Additions, duplicates and concurrency

C.2 uses the existing governed P3.7B writers. A successful new relation receives
the existing company-declared assertion and profile event. The separate C.2
ledger retains the original label, sources, extraction metadata and selection.

An already-present target is not rewritten. In particular, C.2 does not replace
manual details, change an existing assertion or downgrade a verified record.
Target identity is product family + relationship + scope; capability + facility;
sector; or, conservatively for C.2, certification type + scope. The certification
rule does not introduce a global unique constraint or remove the manual editor's
ability to register distinct certificates.

The mutation compares the proposal and relevant group state under locks. Group
state includes the facility state where applicable. A changed research version,
changed target data, unavailable facility or concurrent unique conflict requires
an updated comparison rather than a partial write. A retry of the same decision
is idempotent; a different action or selection is not accepted as that retry.

The stable content identity excludes timestamps, so the same ignored label is
not proposed again just because a research attempt refreshes its date. Decisions
are immutable; the actor can be anonymized only through the guarded account
erasure FK path. Changes to publication, claim and verification remain outside
this flow.

## Interaction

The four instances of `CompanyIndustrialAssistant` use stable company/group and
content keys. **Rivedi** opens the canonical controls; commercial relationship
and scope are explicit. **Ignora** works without a category, relationship or
facility. Only the affected row shows pending/error/result feedback.

Concurrent updates preserve selections. A refresh that removes a candidate or
facility leaves the opened draft available for inspection and directs the user
to the canonical editor. Decisions remain historical if a confirmed target is
later removed; links fall back to the panel instead of a missing record anchor.

## Verification and release

Behavioral parser tests cover explicit selections, strict result contracts,
unsafe evidence, ignored incomplete suggestions and immutable source snapshots.
SQL coverage exercises permissions, revocation, add-only writes, provenance,
duplicates, stale snapshots, retries and ledger protection. Chrome covers real
authenticated decisions, simultaneous requests, preserved selections, source
states and 1440/390/320 layouts. C.1 and the existing workspace suites remain in
the Company workflow. Security Advisors run against its disposable local DB.

The migration `20261127110633_company_ux2c2_industrial_review.sql` must be applied
before deploying this UI in an authorized release. It builds on the two C.1
migrations. Keep the decisions ledger if the UI is rolled back. Hosted migration
versions may differ from repository filenames: record their name/version/hash
mapping instead of replaying files or rewriting global migration history.

Release results and visual acceptance belong in the pull request and the
COMPANY-UX2 Notion page. This design document does not itself certify that a
hosted migration or deployment has taken place.
