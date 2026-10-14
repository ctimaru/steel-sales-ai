# RQG4.3 — Release & Navigation Acceptance (Synthetic-only)

## Release boundaries
This release acceptance applies to the **pre-pilot synthetic technical environment**. Hosted Company-positive acceptance remains **deferred** until genuinely authorized pilot participants, as agreed in RQG3.2j (issue #549). No real-company data, legal acknowledgments or production permission changes are required.

## Navigation contract
- **Dashboard / Workspace**: active Company admins find **Qualità dati aziendali** in the profile menu; the link opens canonical `/operations/review`. Viewers never receive the admin menu item.
- **Company Review**: links back to `/dashboard` and to the three specialized `/operations/review/{coverage,identities,offer-reparse}` paths. Specialized pages retain their old `/review/*` URLs as guarded bookmarks but internal back-links use canonical Operations paths.
- **Platform Review**: `/platform/review` remains a separately guarded Platform context. Its eligible Platform Staff and Owner see governed Platform lanes only. Company admins and viewers cannot access it. Platform staff/Owner without company memberships cannot see private commercial Review records.
- **Direct URL access**: Legacy and canonical Company Review paths remain protected by `requireWorkspaceAdmin` on their separate layouts. Menu visibility is only presentation, never authorization.

## Truthful queue states
- `awaiting_assignment`: no imported historical commercial dataset for this organization. Show a first-import explanation and upload CTA, not a false **Coda pulita**.
- `live` with zero Review rows and at least one accessible dataset: legitimately clean queue; show the ordinary empty state.
- `unavailable`: if the Review read or the dataset-count check fails, show a neutral technical warning; **never** treat the failure as zero pending decisions. No correction is submitted.
- `live` with pending rows: action controls and source evidence remain scope-limited to current company and permissions, with no impact on Server Actions/RPC/RLS.

## Evidence and test execution
The existing disposable PERF1 workflow creates four synthetic companies with separate real local GoTrue accounts and test-only legal fixtures. Company A and B have private Review markers; Producer has no imported commercial dataset; Processor has a local-only dataset with no Review rows (RQG4.3 fixture). New Chrome checks cover menu links, navigation to/from Dashboard, canonical advanced links, role-scoped Platform Review, Viewer denial of canonical and legacy deep links, and both empty-state variants.

The new runner is inserted **after** RQG3.2h positive A/B and RQG4.2 keyboard/mobile checks and **before** RQG3.1 local Confirm/Correct/RLS/RPC mutations. All local data and credentials are destroyed after execution; no additional Vercel runtime, production API or cron tasks.

## Exit
- P0 Required Gate (tests, typecheck, build) PASS.
- PERF1 Chrome includes new RQG4.3, existing Company A/B and Viewer denial, RQG4.2 accessibility, RQG3.1 RLS/RPC decisions PASS.
- Other triggered mobile/performance checks remain green.
- Merge only with CI green. This closes **RQG4 technical UX/navigation acceptance**, **not hosted positive Company pilot acceptance**.
