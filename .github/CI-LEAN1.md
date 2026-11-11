# CI-LEAN1.A — Policy for superseded pull-request checks

Five heavyweight pull-request workflows cancel **only** prior runs of the
same workflow for the same pull-request number. This applies to:

- P0 Required Gate
- FLOW1 Search to Supplier Response Acceptance
- PERF2.1 Mobile UX & Payload Acceptance
- DEMOTEST2.3 Chrome Real Multi-Account Acceptance
- NET-UX-FILTERS1 Chrome Responsive Acceptance

## Cancellation boundary

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event_name == 'pull_request' && format('pr-{0}', github.event.pull_request.number) || github.run_id }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

A new PR commit invalidates obsolete checks for that **same** PR.
A different PR gets another group. Runs on the protected `main` branch,
manually dispatched workflows, and scheduled runs are **never cancelled**
by this policy. No tests, permissions, or required check names are removed.

## Follow-up: CI-LEAN1.B

This is a runner-cost and stale-feedback optimization, not a substitute
for targeted checks. FLOW1 and PERF2.1 remain broad, including unrelated
Network, Commerciale, School and Calculator cases. Split them by domain
while preserving tenant isolation, server-side RBAC/RLS, RFQ side-effect
gates, and explicit human approval. Do not make a critical test
non-blocking merely by moving it out of a monolithic workflow.

Project tracking: https://github.com/ctimaru/steel-sales-ai/issues/1273

## CI-LEAN1.B/C — Scoped test execution and required routing

- **Commerciale/RFQ**: FLOW1 PR tests now route only from relevant files, including AI services, authorization, Distinta and supplier response. Network Romania and onboarding checks run as part of the full nightly/manual integration workflow.
- **Mobile**: PERF2.1 selects School, Calculator/Distinta and Home tests by changed paths. Unknown or shared paths fall back to the full responsive suite.
- **Network**: NET-UX-FILTERS1 owns Network responsive tests and reacts to Network UI changes.
- **Critical routing**: P0's existing required `tracked secret guard` executes `.github/scripts/ci-lean1-validate.py`. Auth, RLS and database unit/SQL coverage remain under P0.
- **Nightly**: FLOW1 and PERF2.1 keep full cross-domain suites so selective PR routing does not permanently discard coverage.
- **Caveat**: GitHub requires `required`, not every separate browser workflow. Domain-specific browser checks are reviewed during acceptance; future hardening can make a selected E2E mandatory without forcing the whole suite on unrelated PRs.

Metrics baseline: P0 186 seconds, FLOW1 497 seconds, PERF2.1 464 seconds average (3 recent samples per workflow, some FLOW1 runs failed). Post-change savings must be measured from comparable PRs, not inferred from these figures.
