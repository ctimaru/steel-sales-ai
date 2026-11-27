# COMPANY-CLAIM1.A — From company discovery to a managed profile

## Product decision

On 27 November 2026 the founder prioritized the connection between company
profile editing and the shared Network profile, ahead of a future advertising
campaign inviting companies to claim their existing identity and update it.

The public acquisition entry point is `/azienda`. The company detail at
`/network/{id}` remains inside the authenticated Network. The campaign must not
promise an anonymous, search-indexed company page or immediate approval.
Claim and own-profile management are free; Pro commercial features retain their
existing access rules.

## Existing data model and its limits

`/company/profile` and `/network/manage` edit the same canonical company used by
the Network. The server derives its ID from the active organization link and
approved claim. Overview, products, facilities, capabilities, sectors and
certifications use their existing writers and provenance. The actions invalidate
the management and Network routes after writes.

There is no separate copy to synchronize and no general “publish every change”
button. For an already published company, saved presentation and canonical
industrial data are available to the relevant readers. Other resources have
their own publication conditions:

| Resource | Shared visibility |
| --- | --- |
| Facilities | Only published facilities; drafts remain private |
| Stock / planned availability | Explicit publication on a published company |
| Contacts | Company publication requests become `pending_review`; review must approve disclosure |
| Catalogues | Upload starts the existing document workflow; it does not publish a file or stock automatically |
| Research suggestions | C.1 description gives precedence to the company declaration; C.2 `ignore` only dismisses a private proposal |

The Free reader exposes a bounded presentation, roles, product families and
locations. Pro readers additionally expose logo, detailed industrial data,
canonical sectors/certifications and published contacts. The existing shared
research component is independent of those canonical relation edits. Ignoring a
suggestion is not a public correction, nor does it remove the researched fact.
This change explains that limit and removes the overbroad claim that every
research field can be corrected merely by claiming the profile. It does not
reinterpret historical decisions or modify research evidence.

## Acquisition and member handoff

The landing explains the benefit in ordinary language: find the company,
request management, and update it after approval. It reuses the anonymous
minimal lookup, its bounded results, opaque reference and existing events. No
industrial detail, contact or internal company ID is added to that response.

Previously an existing member arriving at `/register?claim_ref=…` was redirected
to the dashboard, and login also discarded registration intent for existing
members. Both Italian and English registration paths now preserve a valid
reference and resolve it using the session's default active organization.

`public.company_claim1a_resolve_target(text,uuid)` is a stable, authenticated-only
invoker facade over a guarded implementation in `private`. It checks `auth.uid`
and active admin membership before looking up a published, non-archived company
by the existing reference function. It calls HP5 before returning exactly the
contract, outcome code, boolean and company ID. It has no mutation or Platform
bypass and confers no claim, membership, link or product entitlement. Direct
implementation calls have the same guard. `anon`, `PUBLIC` and `service_role`
have no execution grant.

A successful resolution opens the existing `/network/{id}/claim` experience.
Legal acceptance, when required, retains that destination. A viewer sees an
admin requirement; an unavailable target offers a fresh search; a technical
failure retains the reference for retry. New applicants keep the established
registration bridge. No registration or claim is submitted on navigation.

The claim page previously used a Pro profile read as an initial existence check.
It now validates the ID, requires the administrator and reads HP5 only. HP5
already supplies identity, eligibility, proof and current-request state. Missing
companies return 404; denied reads retain the access boundary; inconsistent
receipts do not render a request form. The existing claim writer remains the
only mutation. Proving a corporate email relationship does not approve a claim.

## Management and truthful publication states

The own-profile page previously loaded the Pro-only inquiry preferences reader
unconditionally, which could block a Free owner from editing unrelated company
data. `getCompanyProfileAccess` reads the account's existing access state and
loads these preferences only for Pro. A Free owner can edit the profile while
the inquiry section explains its Pro requirement. Reader failure is a distinct
unavailable state; it never implies enabled preferences or changes permissions.

The header opens “Vedi profilo nel Network” only for a published company. The
visibility explanation identifies the viewer's Free/Pro view, individual
publication rules and the research distinction.

Contact cards show actual stored states, including “In revisione” and “Bozza
privata”. The select describes the request, not an immediate publication. Editing
a published contact makes the existing writer reassess it. Success feedback uses
the writer receipt, including the contact ID, create/update result, review flag
and publication status. An absent or inconsistent receipt directs the user to
check persisted state before retrying; it does not claim success.

## Verification

### Execution status — 27 November 2026

The complete frontend suite passed: 3,090 tests, zero failures or skips.
TypeScript checking and the production Next.js build passed. Independent code
reviews covered the claim handoff, SQL authorization and profile publication
states; the identified receipt-validation issues were fixed and retested.

The database integration test and authenticated Chrome scenario below run in CI.
This workspace has no local PostgreSQL/Docker runtime, and the available browsers
could not reach the local preview server. The execution results and screenshot
review for each published revision are recorded in
[PR #1631](https://github.com/ctimaru/steel-sales-ai/pull/1631).

The initial GitHub upload was stopped by automatic authorization review. On
27 November the founder explicitly authorized publishing this change set to
`ctimaru/steel-sales-ai`, on `company-claim1a-profile-conversion`, and opening a
draft pull request to complete CI. The PR records the subsequent CI results.
Production migration, merge and deployment remain separate release steps.

### Test coverage

The frontend tests execute the member-entry helper, IT/EN registration pages,
login action and claim page with controlled dependency responses. They cover
default-organization selection, Free admin, viewer, reference validation,
membership/read failures, legal handoff, missing targets and unchanged ordinary
registration. Profile-access tests also exercise the actual inquiry loader's
response handling, not just a higher-level mock.

`supabase/tests/company_claim1a_resolve_target.sql` runs actual authorization
cases on disposable fixtures: ordinary Free admin, viewer, foreign organization,
suspended membership, no membership/auth, anonymous and service roles, malformed
and non-public targets, existing request states, exact response fields and
unchanged records across nine relevant tables. All data roll back.

`apps/web/tests/company-claim1a-chrome.mjs` uses local Supabase and real Chrome
at 1440, 390 and 320 px. It follows anonymous lookup through registration/login
to a Free administrator's claim; submits a single synthetic request; then uses
an explicit local fixture approval to exercise owner editing. A second Free
company reads the description saved by the first. Pending/draft contact states,
the unchanged Pro boundary, viewer denials, overflow, console diagnostics and
screenshots are included. Hosted requests are blocked.

## Release and campaign readiness

Apply `20261127155119_company_claim1a_resolve_target.sql` before the new UI, after
the exact-head review and required checks. The addition is compatible with old
clients. If deployed without the resolver, member handoff reports temporary
unavailability and preserves intent; it does not create a duplicate application.
Then use protected merge, deploy and authenticated production smoke checks. This
implementation does not itself apply a production migration or launch ads.

The production `/register` page was inspected on 27 November and visibly states
that registration is still invitation-only during the pilot. Do not advertise
open self-registration until that operational gate has been legitimately opened.
Do not disable it as part of a navigation change or populate legal identity with
invented values.

The next acquisition milestones are a controlled company pilot, explicit public
research-correction semantics, and outcome analytics: approved claim, first
actual profile update, visible profile and return visit. Existing lookup/start
events alone do not measure acquisition of an active company. Advertising spend,
outreach, automatic claim approval and new public visibility are separate work.

Project references: [COMPANY-UX2](https://app.notion.com/p/424f059cecb5819e96fece60ccef97fa),
[P3.7](https://app.notion.com/p/3e8f059cecb58183b81ee42e3afc0e50),
[PA1.4](https://app.notion.com/p/3eff059cecb581839f33e55cc91e6c64),
[NET-UX1.1](https://app.notion.com/p/3fbf059cecb58154bf95d3a277f63a9f).
