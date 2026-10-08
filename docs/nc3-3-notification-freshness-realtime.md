# NC3.3 — Notification Freshness & Realtime

**Scope:** both authenticated in-app inboxes, after NC3.1 Workspace and NC3.2 Platform. No SMS, email, PWA push, new source events, historical backfills or browser service keys.

## Delivery model

- **Authoritative data:** existing personal, RLS-backed `nc31_workspace_notifications_read` and `nc32_platform_notifications_read` RPCs. A websocket change is **only an invalidation hint**: never render its payload, never use it to select a recipient or source, never copy customer data into a realtime event.
- **RLS-filtered Realtime:** adds *only* `public.workspace_notification_recipients` and `public.platform_notification_recipients` to existing `supabase_realtime` publication. No events, source ledgers, outbox, worker queue or payload-heavy tables. Existing SELECT policies enforce `recipient_user_id=auth.uid()` and current membership/Platform permission. Browser postgres_changes subscription is also filtered by verified auth user UUID, and scoped to the current context/table.
- **No new grants or replica identity expansion:** users have SELECT with RLS, no UPDATE/INSERT/DELETE on recipient tables. DEFAULT replica identity, NOT FULL. No new `realtime.messages` policies or publicly writable channels.
- **Fallback and bounded resource use:** every visible, online tab checks its personal inbox at most every **90 seconds**; refresh triggered by realtime events is debounced (900ms) with a 10s nonmanual request floor. Only one listener in the current layout header, no second channel in the full inbox page, no global websocket listening to commercial events. Hidden/offline tabs disconnect and stop requests; focus/visibility/online recover. Unsubscribe and clear intervals/timers on unmount/context switch/logout.
- **A lost websocket is not a lost inbox:** connection states live / polling / paused. Realtime failures and subscribe timeouts leave polling on; periodic verification also detects role/membership revocations that cannot publish a personal receipt event. When auth fails, a parsed RPC is invalid, or server cannot verify, cached private inbox disappears and UI shows **! / Dati da verificare**, never a false 0. Even when successful, after three minutes without a verified read the badge becomes unknown. The timestamp is set **only** on verified server/RPC read; it is not presented as the timestamp of the source event or the last cron run.
- **Page refresh:** the full `/notifications` and `/platform/notifications` pages retain independent server authenticated reads. The bell calls `router.refresh()` when a verified personal inbox change is detected while the matching page is open. Both pages also offer an explicit refresh button. Read/archive personal server actions use the existing NC3.1/3.2 RPC, not web sockets.
- **Permission changes:** revoking team membership/staff capability cannot be circumvented with a websocket. RLS protects postgres changes, and every refetch re-authorizes; cached data clears on a forbidden RPC. On return from a hidden tab, privileges refresh before showing new data. Postgres Changes subscription access relies on the current Realtime JWT and RLS; JWT rotation is handled by Supabase client and re-subscribe on TOKEN_REFRESHED. Temporary in-tab data may persist up to polling or a visibility event after a server-side revocation; NC5.1 must test real revocations end-to-end. No realtime client can be treated as authoritative for authorization.

## Observability and costs

- Operational measurements: authorized read RPC success/failure, time since last verified inbox read, Realtime subscription state, reconnect and fallback rate, median freshness after source bridge projection. The UI shows the last **verified query time** only.
- Scale: a 90s poll equals no more than 40 checks/user-hour during continuous active visibility (normally fewer due to hidden tabs). Database RLS and Postgres Changes have nonzero per-subscriber costs; at high concurrency, evaluate private **Broadcast** instead of Postgres Changes. Do not convert to shared channels without private-channel topic RLS, no raw tenant payloads, and load testing.
- NC3.3 does not prove delivery latency of the *source-to-bridge job*: the NC2.3 cron executes every five minutes and may delay the first notification. Realtime begins only after an authorized recipient row is committed.
- No hidden synthetic production events: safe acceptance via SQL transaction rollback and client static regressions. Full websocket delivery/latency, multi-session browser, accessibility and network-throttling/mobile tests remain NC5.1 acceptance gates.

## Security acceptance

- Verify only two recipient relations in `supabase_realtime`, protected by SELECT RLS with auth.uid; anon denied and authenticated cannot write recipients.
- Verify other relevant tables are absent from Realtime publication; no REPLICA IDENTITY FULL.
- Frontend regressions verify verified-identity subscription filters, ignoring websocket payload, private state purge on RPC failure/signout, polling/debounce/cooldown, tab suspend, reconnection, explicit refresh, and separation between Platform and Workspace.
- Gate: full rebuild of Supabase migrations and SQL `supabase/tests/nc33_notification_realtime_publication.sql`, previous tenant/Platform security tests, frontend test/typecheck/build, worker and RAG regression.
