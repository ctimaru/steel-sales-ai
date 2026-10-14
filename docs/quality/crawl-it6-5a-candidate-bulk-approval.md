# CRAWL-IT6.5a — Candidate Gate Bulk Approval

## Contract and operator experience
The existing **Platform → Company Discovery → Governance → Candidate Gate** adds a batch review panel before the individual candidate actions. Only the Platform Owner (currently the sole holder of `discovery.governance_review`) can use it. Selection is manual; a separate review step requires a free-text justification (12–1000 characters) and an explicit attestation that company-only facts and source reuse rights have been checked.

- Maximum **50 selected** per operation; the interface lists only currently eligible candidates from the first 80 pending candidates; all eligibility is verified again by the SQL function.
- A single transactional RPC locks candidates and their source runs; each successful decision delegates to the existing PA1.5 governed single-candidate function, producing **one immutable governance event** per approval.
- Reasons for exclusions: missing candidate, non-Italian, already decided, personal-data markers, identity match or identity signals, quality flags, absent evidence, source rights/governance missing. Excluded candidates are not changed.
- The Server Action summarizes approved and excluded totals and reasons; no candidate IDs or personal data are disclosed in the URL.
- The RPC neither creates a company nor publishes a profile, changes any facility, merges an identity or schedules a crawler. Source governance cannot be silently overwritten.
- A replayed batch skips previously approved candidates and creates no new audit events.

## Safety boundaries
Source runs must already have explicit approved governance with reusable terms, low-risk/licensed database rights, company-only/exclude-personal-data policy and recorded human reviewer. Candidate must be `IT`, `pending_review`, `unreviewed`, not matched to an existing company, without other match signals, quality flags or personal-data flags, and include source evidence.

An empty personal-data flag is **not** automatic evidence of compliance; the operator's positive human confirmation remains required. Candidates involving personal contacts, ambiguous identity or legal review must be handled **individually**. Source approval and candidate approval do **not** imply separate company publication approval.

## Release
- Local synthetic SQL fixture tests 2 eligible/3 excluded, audit immutability, replay, bound (50), authorization and confirmation; no hosted business data modified.
- Frontend unit/static regression verifies eligibility and two-stage confirmation.
- Merge to `main` only after P0 CI including SQL and Next build green, and any applicable Chrome/accessibility workflows.
- Production migration applies only the new RPC; **does not execute the bulk approval**. Actual operator selection remains a separate conscious action.

## Production read-only audit before implementation (2026-10-14)
43 discovery candidates were pending commercial review, 32 had existing identity matches. Seven met source/status/personal-data criteria; a further one among these had matching signals and must remain individual. Final eligibility is rechecked at operation time, so counts may change.
