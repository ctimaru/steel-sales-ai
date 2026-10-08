# NC3.1 — Workspace Bell & Notification Center

**Release scope:** per-person in-app notification UX for authenticated Workspace, **not** the Platform console. This replaces the operational-alert-only header bell while retaining the operational alert registry at `/operations/alerts`.

## Product experience

- **One Workspace bell**, next to the profile menu on desktop and mobile. It shows the personal unread count, capped at `99+`; on query/error/invalid JSON, it shows **!** and the explicit message "verifica non disponibile" (never a healthy-looking zero). The dropdown preview shows up to five latest personal rows, with timestamp, generic source-specific title, safe internal link, "Centro notifiche" and "Alert operativi" shortcuts.
- Responsive modal popover, close button, backdrop-click dismissal, Escape, keyboard tab wrap and focus return. No duplicate bell in mobile bottom navigation; follow established header palette green `#173f35` and restrained neutrals.
- `/notifications`: all, unread, commercial, system, archived; 15 per page, server pagination with bounded offset, exact personal counts. Individual mark read/unread, archive/restore. Source business state (RFQ award, import job, operational alert ack/resolve, Marketplace read) **must never be modified by inbox status changes**. No bulk action without a separate audited policy.
- Generic safe message strings, no prices, contact details, mail subject, sender, legal evidence or private record content in inbox or preview.
- `/notifications/open/[id]` uses the **recipient id**, not an arbitrary direct object URL. Server-authenticated resolver rechecks active company membership, exact personal recipient, current RFQ campaign owner or active assigned team, and Marketplace match + current unlock; only then redirects to existing authorized product detail. Failed/revoked or nonexistent deep link returns a generic unavailable notice rather than leaking an entity ID. Direct pages enforce their own permissions as a second line of defense. Import links go to existing uploads tool; operational alerts link to the original registry.
- Viewer users can read their own Workspace notifications and control **personal read/archive**, but they still cannot acknowledge/resolve operational alerts or write commercial data. Platform Owner/Staff do **not** inherit company access in this UX; it uses `getWorkspaceContext` and tenant RLS.

## Security and DB model

- `nc31_workspace_notifications_read`: `SECURITY INVOKER`, authenticated-only; active tenant membership, per-user recipient and event-table RLS; allowed filters, maximum 50 per request, offsets capped at 1000. Counts and rows calculated in the same RPC execution. Unknown/malformed RPC output is **not an empty list**.
- `nc31_workspace_notification_set_state`: narrow `SECURITY DEFINER` RPC because the NC2.1 schema purposefully revokes direct browser UPDATE. Explicit `auth.uid`, active organization membership, exact own `recipient_user_id`, joined event's tenant, validated action and `FOR UPDATE` lock. Changes only one personal recipient read/archived timestamp, no bulk writes. No Platform tables or arbitrary user IDs. PUBLIC/anon Execute revoked.
- `nc31_workspace_notification_destination`: restricted authenticated `SECURITY DEFINER` resolver, origin verified from own recipient; source lookup and current RFQ assignment/Marketplace entitlement rechecked, no arbitrary URL parameter, no source payload returned. All other sources resolve only to fixed legacy internal product tool pages when current access is valid.
- No new direct recipient DML grants; Platform inbox remains separate for NC3.2. No email/push/Reatime subscriptions (NC3.3/NC4). No production fixtures or retroactive projection. Failed access must not be disguised as an empty inbox.

## Validation and rollout

- Required CI: new Supabase migrations + rollback-only SQL acceptance for two organizations and multiple users; negative tests for same-org nonrecipient, foreign organization and revoked membership; read/unread/archive/restore, page bounds and entitlement-aware deep link, no unauthenticated function access. Frontend tests/typecheck/build, existing alert UX regressions, worker suite.
- Production verification: check three function EXECUTE grants and SECURITY INVOKER/DEFINER boundary, unchanged personal recipient DML grants and RLS, Vercel production READY and alias `www.smartsteelsales.com`; no synthetic records. Authenticated browser smoke and screen-reader/mobile QA remain NC5.1 obligations unless explicitly tested.
- Next **NC3.2 — Platform Bell & Governance Inbox** (separate Platform permission and owner/staff context), then NC3.3 freshness/poll/realtime. Keep Platform notifications physically separated.
