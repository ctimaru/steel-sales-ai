# Search → bill → RFQ → supplier response launch acceptance

Goal: [PRODUCT-FLOW1 #927](https://github.com/ctimaru/steel-sales-ai/issues/927).

## Implementation

- Classify the real absence of an active embedding model as configuration failure. Global Search keeps authorized structured results for unfiltered/mixed queries; document-only requests still report the missing configuration. Database, permission and inference failures retain their existing error behavior.
- Keep the bill controls inert until client draft restoration completes, and the calculator inert until retention restoration completes. The bill title is disabled while a restore decision is pending. Explicit readiness markers let browser tests observe actual readiness.
- Exercise the existing production actions and RPCs throughout the journey. No second cart, dispatch endpoint or supplier-response implementation is introduced.

## Reproducible acceptance

The dedicated `product-flow1-e2e.yml` workflow uses throwaway local Supabase, five real GoTrue accounts, the actual Worker and Next.js. Historical CI baselines are required to rebuild this repository; this is an assisted local rebuild, not evidence that bare production migrations reproduce every historical dependency.

1. Seed structured observations in two isolated organizations; deliberately leave zero active embedding models.
2. Call the actual Worker HTTP endpoint as buyer and producer, checking own results, geometry, foreign-result denial, invalid internal-token denial and explicit document-only configuration failure.
3. At 1440 and 390 px, search through the UI, complete the verified 60.3 × 3.2 mm tube in the existing calculator, and create two lines: EN 10219 / 3 × 6 m and EN 10210 / 2 × 12 m, grade S355J2H. Verify a single saved snapshot and private RFQ with both lines and 42 m.
4. Select two suppliers, cancel a reviewed dispatch, and verify no dispatch was queued. Reopen review, require a fresh affirmative recipient confirmation, and activate send twice. Verify exactly one acknowledged invitation per supplier and no resend on reload.
5. Open each freshly generated anonymous supplier capability, save and submit its own two-line offer. Verify line identity, quantity and length, absence of private buyer targets and competing quotes in the portal payload, and delivery context in the rendered portal.
6. Verify two complete comparable offers against the unchanged original lines; deny another tenant direct access to the buyer RFQ, bill, lines and dispatch ledger.

The provider preload is **test-only**, in a separate Next process. It requires exact local URLs, a synthetic key and two allowlisted `example.test` recipients; it rejects external fetch destinations and redirects. Capability URLs stay in a mode-0600 ephemeral file, never logs or artifacts. These tests prove application dispatch through a simulated transport; they do not prove delivery to a real mailbox.

BD15 remains separate with `RESEND_API_KEY` empty and its original 72 m/title assertions and zero-send SQL acceptance. Its new helper holds client scripts, verifies inert SSR controls, releases scripts, then verifies title and quantity survive a hydrated render. This closes the observed pre-readiness input window; it does not establish the root cause of every historical intermittent BD15 failure.

## Evidence from the 25 October 2026 local run

- Worker suite: **370 passed**, including eight real-retrieval regression cases.
- Web suite before the final browser-helper adjustment: **2147 passed**. Strengthened provider transport guard test subsequently passed separately.
- Deferred-client browser regression: **390 and 1440 passed**.
- Actual Worker/PostgREST runtime: **buyer and producer passed**, with no active embedding model.
- Complete local browser journey: **16 checks passed**, 1440/390, four captured synthetic invitations and zero external email.

Local browser used installed Chromium and Node 24; CI pins Node 22 and the Google Chrome channel. Local Docker's Auth health command received a proxy 403; local startup used `--ignore-health-check`, then the real Auth health endpoint returned 200 and all five real user logins succeeded. This workaround is not enabled in CI or hosted environments.

## Remaining release gates

- Verify the required CI checks and the dedicated Google Chrome workflow on the final PR commit, including two consecutive BD15 acceptance runs after the readiness change.
- Review and merge only after required checks pass; then verify deployment and authenticated hosted runtime acceptance. Local success does not close the separate hosted Worker acceptance issue #921.
- Preserve the distinction between simulated transport acceptance and real provider/mailbox delivery.
