# NET-CONNECT2D — Self-Service Company Growth

## Company experience
A Free/Pro member opens Network → Il mio percorso from either Network reader.
The step-by-step company panel only displays real states and the next purposeful action:
1. Active workspace membership (always required to load the route).
2. Network profile controlled by that organization: an active link to a published canonical identity, an approved claim, and active membership. Pending claims are separate and never treated as controlled.
3. Descriptive industrial profile: the existing managed-profile 7-section completeness report is informational, not another identity approval or purchasing gate. Only company admins can edit it.
4. First explicitly motivated request; can include withdrawn/declined requests as sent, but not as accepted.
5. First accepted outbound request, never implied by a sent request. Incoming pending requests are a separate attention count.

## Data and access
A new read-only netconnect2d_company_progress SQL RPC checks auth.uid() + active membership in the requested organization and returns only aggregate counts plus an approved canonical company ID. No personal data or contacts. Private helper is revoked from browser users. The endpoint cannot assign a profile, start a claim, invite a prospect, or enable inbound requests.

The existing m8_my_network_company, p3_7_managed_profile_state, and p4_get_inquiry_preferences remain the sole source for admin-only owned profile management. Role-aware category suggestions are not individual business recommendations. Eligibility is checked again by the existing p4_inquiry_eligibility and anti-spam backend at actual send time; provisional profiles never receive automatic requests.

## Product constraints
- No Feed, Follow, Save or private address-book leak.
- Free exploration, with professional value and no compelled Pro upgrade.
- Modern compact responsive UI: no huge forms, no duplicated profile editor.
- Fail closed on SQL read errors: show unavailable, never counterfeit a real zero or infer ownership.
- Company members can see their organization's aggregate progress; only admins can claim or change its profile.

## Acceptance
Front-end source test, P0 frontend/typecheck/build, SQL acceptance + HP13 cross-tenant negative, worker CI where required, Vercel preview. Apply new migration only when required SQL CI is green. No production write before then.

## Dependency
NET-CONNECT2C owner analytics PR #664 remains independent and was not green on the initial review. This microblock bases from main and does not import unreleased owner analytics.

## Next
NET-CONNECT2E — Real Connection Activation: improve discovery ranking by actual recipient readiness and first-response UX, preserving backend eligibility.