# NET-CONNECT2C — Activation Funnel & Company Growth

## Purpose
Measure how actual registrations convert into reachable company-owned Network profiles and first purposeful B2B relationships. Prioritize growth over cosmetics, without fake contacts, follow systems or automatic invitations.

## Denominators and interpretation
- Cohort = registration application with \`submitted_at\` (UTC); 30-day rolling window and eight weekly submission cohorts.
- Stages: submitted → currently activated → currently owned (published profile, active link, approved claim, active member) → at least one outbound request → at least one accepted outbound request.
- All downstream stages refer to the **current status of an application submitted during that period**. They are NOT the number of activations/connections that happened in the same week. Young cohorts are still maturing.
- Independent activity flow: outbound request \`created_at\` within 30 days; connection \`decided_at\` within 30 days. Not part of application-cohort stage counts.
- Keep catalog size (published + provisional) separate from registered business conversion. No implied ownership, no automated claim, no guessed contact information.

## Release contract
- Aggregation through \`public.netconnect2c_growth_overview()\` guarded by \`private.is_platform_superadmin()\`; private helper unavailable to authenticated users; no anonymous execute.
- UI: existing owner-only \`/platform/network-activation\` page, 30-day conversion counts and rates, eight-week cohort table, actionable unactivated applications and owned-but-no-outreach gap. Mobile-friendly, compact and accessible.
- SQL tests for ACL and eligibility truth, HP13 tenant negative, frontend source test, required CI gate.
- Additive migration, no data mutation. Production migration only after required SQL CI green; merge only after CI green.

## Next block
NET-CONNECT2D — Self-Service Company Growth: company-facing setup progress and first connection CTA; respect eligibility, purpose requirement and anti-spam limits.
