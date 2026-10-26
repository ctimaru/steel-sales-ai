# HOME-CALC-FLOAT1B — Floating UX & Functional Acceptance

Date: 2026-10-26. Stacked on HOME-CALC-FLOAT1A, PR #949, commit `2a63798cb53a3e155c66ae59dccb3d0454bc1c4b`.

## Source and scope

The requested FLOAT1B identifier was not found in accessible chat context, Notion memory or indexed project pages. The implementation follows the explicit outstanding acceptance checklist in PR #949. Public IT/EN homepage dock → existing same-origin calculator or public bill builder → editable, retained draft. This is functional acceptance of the floating tools, not acceptance of live supplier dispatch.

## Changes

- Native modal dialogs provide browser focus containment and inert background. Body scrolling is restored, and focus returns to the initiating button after closing.
- Escape inside an iframe closes the outer tool only after the inner document has handled its own Escape. Closing the calculator's cart leaves the calculator open.
- First activation loads the real route. Closing a tool keeps its iframe mounted; switching tools never opens two modal dialogs at once or duplicates a calculation.
- Consent banner and privacy reopening button remain usable: the dock rises above them only where their horizontal footprints intersect. Consent decisions, analytics and storage rules are unchanged.
- Each panel offers its real full-page destination, an explicit close button and loading status. No duplicated formulas, fabricated RFQs or new backend endpoints.

## Observed local acceptance

Production Next.js build and typecheck pass. All 483 existing frontend test files pass across the suite and the isolated rerun of `product-flow1-local-provider.test.mjs` (the initial sandbox denied that test's subprocess with EPERM).

`tests/home-calc-float1b-chrome-acceptance.mjs` passes against the production server in IT and EN at 320/390/768/1440 px:

- no iframe before first activation; no dock/consent or dock/privacy-control overlap;
- native modal, initial close-button focus, backward Tab containment, body scroll lock/restoration and return focus;
- real calculator: three 12 m bars, one retained 36 m bill row, no duplication after reopening;
- unavailable authentication is shown as an error; draft remains, no false RFQ success and no dispatch;
- inner-cart Escape first, outer Escape next, button closure, switching tools, request text/title preserved;
- parent URL unchanged and no horizontal homepage overflow or unhandled page errors;
- Axe: zero serious/critical findings in the calculator modal at 390/1440, both languages.

24 screenshots are generated in `/tmp/home-calc-float1b` and uploaded by the PERF2.1 workflow. The workflow now watches floating-tool components and tests, and runs this acceptance against its disposable production build.

## Remaining release evidence

- CI/Preview status and Lighthouse samples are recorded in the PR after execution.
- Authenticated private RFQ creation and live provider email are not exercised by this credential-free dock test. Same-origin browser cookies are neither replaced nor exported. Existing business-flow acceptance remains separate.
- Preview review and integration of the parent PR #949 remain separate from this stacked change. No production deployment is performed by local acceptance.
