# SP8.A — Steel Pulse Editorial Studio · Read-Only Preview Foundation

**30 October 2026 · implementation proposal; SP7.2 remains on hold.**

## Why
HOME-AUTH-PULSE2 ships three clearly labeled editorial examples on the authenticated Home until approved news is available. SP2–SP7.1 already provide a private source registry, permissions, drafts/review/publication contracts, a production readiness RPC and Platform Owner gate. The founder explicitly paused SP7.2 live source approval and ingestion. This work **does not reopen it**.

## Delivery
- New restricted Platform Owner route: `/platform/steel-pulse/editorial`.
- Link from existing `/platform/steel-pulse` readiness page.
- Compact status filters: all, unassigned, draft, in_review, editor_approved, legal_approved, published, withdrawn.
- Queue from **existing** `sp3_editorial_queue(p_state,p_limit=25)`. Strict validation, no fake rows, no misleading total beyond the first 25.
- Detail from **existing** `sp3_editorial_detail(p_item_id)` only when the selected UUID is present in the current owner-scoped queue. Private original draft preview, source status/right-current flag and up to 12 audit events, with no legal attestation contents displayed.
- No data writes, source permissions, independent-role overrides, ingestion, publish/withdraw, email or background schedule.
- URL scheme checks before linking to an original source; no external images.

## Security and acceptance
- Authenticated Platform Owner only (not a tenant admin, viewer or Platform Staff).
- No browser-side privileged fetching; RPCs called server-side with caller session, no service role or direct private table grants.
- Fail closed on malformed queue, missing grants, stale RPC or invalid source URL. Empty state is honest: no articles invented.
- Node tests and required GitHub gate. Final QA 1440/390/320 before any protected merge/production rollout.
- Keep original SP7.2 human/license/robots/SSRF requirements and the publication kill switch untouched.

## Next phases (not authorized by this block)
SP8.B can later add role-gated draft editing and controlled actions through existing SP3 RPCs after a separate design/security review; SP7.2 activation remains suspended until founder explicitly reopens it.
