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
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
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
