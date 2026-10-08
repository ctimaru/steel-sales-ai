# SP6 — Steel Pulse Engagement & Retention Foundation

**8 October 2026 — explicit user value, not passive behavioral surveillance**

## Product objective
Give authenticated steel-industry professionals a reason to return to Smart Steel Sales between commercial tasks: preserve a personal reading list, mark items as read and quickly find the ones still unread. Steel Pulse still displays only licensed, independently approved cards. No email, push or unsolicited bell notifications in this phase.

## UX
- /pulse provides three views: Per te (SP5 interests), Da leggere (visible SP5 cards not explicitly marked read), and Salvati (bookmarks including items outside current topic preferences, if currently authorized).
- Each card has explicit Salva / Salvato and Segna letto / Letto buttons with reversible states and accessible labels. Browsing the feed or opening a source does not silently change the read state.
- Next.js Server Actions authenticate with Supabase getUser and validate canonical HTTPS source URLs and a fixed action enum. No user_id or organization_id is accepted from browser input.
- If production is not migrated, the SP5 feed still renders; SP6 controls are unavailable with an honest message.
- Public /login does not reveal saved/read states. No RFQ, imported email, pricing, contacts or organizational properties are used.

## Data and governance
Migration: supabase/migrations/20261008200000_sp6_steel_pulse_engagement_retention.sql
- Private steel_pulse_private.user_article_engagement(user_id,card_id,saved_at,read_at,updated_at). RLS and no direct anon/authenticated grants. Auth users and article foreign keys cascade deletes; per-user/card uniqueness. No full URLs, P.IVA, email or company identifier in state table.
- Authenticated sp6_set_article_engagement(source_url,action): save, unsave, read or unread only. Identity from auth.uid, never caller-specified. Requires SP4 public kill switch on and SP3 rights-current eligible card at every mutation.
- Authenticated sp6_my_article_engagement(limit): only caller's currently eligible saved/read state; limit 12 saved cards; no audit, legal evidence, personal IDs or saved timestamps returned; SP4 global switch checked at read time.
- Authenticated Platform Owner-only sp6_platform_retention_summary(): 30-day distinct-account activity counts, with a privacy minimum of five accounts. These are engagement signals, NOT validated retention cohorts, DAU/MAU or conversion measurements.
- All three privileged RPCs have empty search_path, authenticated-only grants and HP13 explicit security allowlist. No new anonymous function, public view or crawler.

## Revocation
Any source suspension, license expiration, content withdrawal or disabling the SP4 global switch immediately removes saved/read eligible cards on the next no-cache request, regardless of historical user state. State stays private while source rights are under review; user or card deletion cascades. SP6 itself never changes rights or editorial decisions.

## Acceptance
- SQL test with two independent users, denied anonymous access, global off switch, invalid actions, item rights, isolation, reversible state and source revocation.
- Node regression for URL/action parser, authenticated action flow, accessible saved/unread views and HP13 allowlist.
- Supabase rebuild and full Required Gate before merge.
- Production rollout of SP2–SP6 and first source/article licenses are SEPARATE tasks; no actual news production activated by SP6.

## Metrics and privacy
Do not label action counts retention. True repeat-visit retention needs consent/first-party event taxonomy and cohort methodology. This microblock adds no passive analytics SDK, background pings, cookies or marketing dispatch.

## Next
A separate rights-governed production launch, then a user-requested in-app digest and validated retention cohorts when real approved content is available.
