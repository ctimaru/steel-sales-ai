# RQG3.1 — Chrome Multi-Role Production Acceptance

## Environment boundary
- **Authenticated browser/RPC acceptance:** Chrome stable + real GoTrue sessions + real Next Server Actions + PostgREST/RLS and RPC against a **disposable local Supabase**. Existing PERF1 pipeline is extended rather than spawning an expensive additional Vercel deployment. Three disposable delegated identities are added (Claims, Network Trust, auditor).
- **Production anonymous smoke:** Chrome stable visits both private Review entry trees and Platform governance entry routes **without any authentication**. Blocks all non-GET/HEAD requests before network transmission. No production customer records are changed and no emails/dispatches are sent.
- **Authenticated production acceptance:** remains **not verified** until a securely authenticated and scoped multi-account browser test can run against pre-approved synthetic production accounts and records. Browser/connector state has no signed-in profiles. Do not infer production tenant permission acceptance from local fixtures or anonymous route denials.

## Acceptance matrix
| Actor | Platform Review | Company Review | Mutations |
| --- | --- | --- | --- |
| Anonymous | Login redirect | Login redirect | No writes |
| Platform Owner (no tenant membership) | All 5 lanes | Denied | No tenant access implicit |
| Registration staff | Registration lane only | Denied | Cannot forge Claim/Trust decisions |
| Claims staff | Claims only | Denied | Claim permission checked by real RPC |
| Trust staff | Network Trust only | Denied | Trust permission checked by real RPC |
| Platform Auditor | 5 read-only lanes | Denied | Claim/Trust writes denied by real RPC |
| Company Admin A | Denied | Only A's 2 synthetic items | UI-confirm A; RPC-correct A; audited actor |
| Company Admin B | Denied | Only B's 2 synthetic items | Cannot confirm/correct A; B stays pending |
| Company Viewer A | Denied | Denied (including deep links) | Direct RPC denied |

## Safety & integrity
- All identities are freshly created in a disposable **localhost-only** GoTrue; temp credential files are \`0600\`, never uploaded.
- Source observation and document evidence preserved, replays rejected, tenant B cannot see or alter tenant A.
- Positive mutations run **only against local fixed 98031–98034 fixture IDs**. Before any RPC, the test asserts Supabase URL is loopback and holds only a local publishable key.
- Production phase never submits forms, signs into customer accounts, or performs mutations.
- Gate: GitHub **P0 Required Gate** green + **PERF1 Chrome Auth** green + **production anonymous Chrome** green; only then merge. Production authenticated acceptance must remain explicitly pending if not performed.
- No database migration, production seed, new cron, background query or extra Vercel build introduced by test code.
