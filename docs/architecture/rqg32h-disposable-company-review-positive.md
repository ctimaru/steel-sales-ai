# RQG3.2h — Company Review Positive Acceptance (Disposable Local)

## Why isolated
Production Chrome RQG3.2f (Platform) and RQG3.2g (unassigned Company denial) both passed **12/12** with zero transmitted application writes. Hosted production still contains **zero** synthetic company workspaces and zero synthetic Review records, and test-only `.test` identities lack genuine terms acknowledgement. We **do not** modify that state to manufacture a green test.

This microblock reuses the already-established PERF1 / RQG3.1 disposable local Supabase + GoTrue + Next + Google Chrome CI pipeline, rather than provisioning a hosted tenant or duplicating a costly Vercel deployment. Local seed rows for organization membership and legal acceptance are **exclusively test fixtures in an isolated, destroyed database**, never presented as consent by a real person.

## Acceptance in local Chrome and PostgREST
- Buyer (Company A) logs into genuine *local* GoTrue and sees only Review items **98031, 98032**, including private marker `RQG31 PRIVATE A`; Company B marker is never rendered.
- Trader (Company B) logs into separate GoTrue and sees only Review items **98033, 98034** with `RQG31 PRIVATE B`; Company A marker is never rendered.
- The Buyer Viewer belongs to Company A and has a current **local-only** legal test fixture. It must **still** be denied Company Review, legacy Review, and Platform Review because Viewer has no administrative authority. This separates authorization from the legal gate.
- Platform Registration Staff and the synthetic local Platform Owner without company membership are denied Company Review.
- Every participant's PostgREST query, using its own authenticated JWT (not service role), returns only the permitted Review rows.
- The existing **RQG3.1** browser suite runs *after* this read-only suite on the same disposable fixtures and exercises real confirm/correct Server Actions, RLS, RPC and replay denial. It verifies that modifications cannot cross tenant boundaries. No hosted commercial data ever changes.

## Execute and verify
A PR changing `rqg32h-*.mjs` triggers the existing `PERF1 Chrome Auth & Multi-Account Acceptance` workflow with the new step included. Its result provides machine-verified Chrome evidence **before PR merge**. Optionally rerun independently through GitHub Actions → **RQG3.2h — Disposable Company Review Positive Acceptance**, manual workflow on `main`, which reuses the exact pipeline through a reusable workflow call.

There are no secrets to configure, production tokens, migrations, frontend runtime changes, browser artifacts or Vercel cron costs. The local CI instance and temporary credentials are destroyed at the end.

**Exit classification:** positive authenticated **local** Company Review accepted; production Platform and negative Company accepted separately. Full positive **hosted production** Company Review remains open pending an actually approved legal-compliant production test organization and consenting users. Never claim local success is hosted production success.
