# SP5 — Steel Pulse Personalized Feed

**8 ottobre 2026 — individual topics and professional relevance, default-off until editorial launch**

## Product scope
Steel Pulse gains an authenticated personal home at /pulse in the Workspace. The Workspace home links to it through one compact card, rather than adding another permanent primary navigation item. The original public login SP4 feed remains generic and anonymous; it is never personalized using a login form value or a company identity.

An individual professional can select six topics:
- market / Mercato
- trade / Commercio
- regulation / Normative
- raw_materials / Materie prime
- technology / Tecnologia
- companies / Industria

Optional professional interest (not an employer role): all, producer, trader, processor, end_user. It ranks results among permitted topics, using explicit transparent rules (e.g. trader highlights market/trade). Language Italian or English; explicit topic selection filters, no topics means "all". No profiling based on private RFQs, commercial emails, purchasing history, cookies or company network taxonomy; zero cross-tenant joins.

## Server contract
Migration: supabase/migrations/20261008195000_sp5_steel_pulse_personalized_feed.sql

Private table steel_pulse_private.user_feed_preferences:
- key = auth.users.id (deletion cascades)
- only topics, personal professional interest and language; updated_at
- no organization_id, company identifiers, contact data or analytics events
- RLS enabled; anon/authenticated do NOT have schema/table access
- service role has access for controlled operations; browser uses audited functions only

Two SECURITY DEFINER functions in the public API, both authenticated-only, fixed search_path and approved under HP13:
1. sp5_save_feed_preferences(p_topics,p_role_interest,p_language_code): no user_id argument; always derives current auth.uid; rejects invalid categories, duplicate topics, role and language.
2. sp5_my_steel_pulse_feed(p_limit): returns current user's own preferences plus up to 12 curated cards. Missing row → safe defaults. Calls the SP3 private rights-current eligibility projection; checks SP4 kill switch. Source revoked, expired or editorial card withdrawn → disappears from new requests. An invalid limit never exposes cards.

Every news item contains only public SP4 display fields, no private approval ledger, staff identities or tenant records. The client validates all payloads again before rendering. The form submits a Next.js Server Action, authenticates via Supabase getUser, writes through the authenticated RPC, refreshes and redirects with simple success/error status, without user-identifying URL parameters.

## UX and empty states
- Accessible choice grid of six checkbox topics, role-interest select, language select and a 44px save control.
- "Il tuo aggiornamento sull'acciaio" with clear note that personal preferences never affect colleagues.
- When backend production migration is missing, save is disabled, error is announced, and data remains unavailable rather than claiming success.
- When no approved cards match or the SP4 switch remains off, a transparent no-news state links to Scuola; **no fake headlines**.
- Mobile-first card layout and accessible HTML articles with outbound source credit (HTTPS/noopener/noreferrer).
- A compact Workspace dashboard entry reinforces return behavior without distracting from daily tasks.

## Acceptance & non-goals
- CI: full Supabase rebuild, actual SQL acceptance for own-user writes, rejected invalid topics, different users getting isolated preferences, off-state, article filtering, license/source revocation, Node validators, frontend typecheck/build and worker regression.
- No live crawler, real source approvals, auto-publishing, notification emails, new personalization tracking, admin role inference or global activity profile.
- **No production migration manually applied by this code PR**. Production must apply SP2–SP5 in order, validate migrations and keep SP4 publication_settings.enabled=false until documented source rights and editorial/owner approval.
- SP6 will cover useful alerts and measured retention after the feed has real approved content; subscriptions/opt-in should not become notifications automatically.
