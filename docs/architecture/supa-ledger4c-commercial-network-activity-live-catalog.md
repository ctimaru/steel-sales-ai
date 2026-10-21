# SUPA-LEDGER4C — Commercial, RFQ and Network activity live-catalog adjudication

**Captured:** 21 October 2026 · **Repo:** `ctimaru/steel-sales-ai` · **Supabase production:** `ecrafjdummcdfycznitx`.  
**Scope:** three remaining SQL-token mismatches, plus three historical P4.7 correction markers from [SUPA-LEDGER #780](https://github.com/ctimaru/steel-sales-ai/issues/780). Only GitHub file read, production migration-history SELECT, PostgreSQL catalog and aggregate count SELECT. **No PostgreSQL password reset, Railway access, DDL, DML, migration repair, impersonated user, or application deployment.**

## Three historical differences vs current functionality

| Migration | Exact historical source difference | Production evidence | Decision |
|---|---|---|---|
| `p2_legacy_message_identity_recovery` | GitHub adds **nine optional `AS` alias keywords** in the attribution status SELECT; otherwise compared SQL tokens align. | `p2_rfq_attribution_recovery_status` checks `is_organization_member`; `p2_recover_legacy_message_identity_impl` and `p2_finalize_legacy_conversation_identity_impl` require `auth.uid()` and org write-membership. Source hash uniqueness on `(organization_id,source_kind,source_content_hash)`, recovery table RLS and member-only read policy; public P2 RPCs deny anon EXECUTE. | **Historical text variant is cosmetic/semantic no-op in reviewed projection**; don't replay SQL. Private P2 implementation routines nevertheless still have `anon` EXECUTE grants, but **`anon` has no USAGE on schema `private`**, and public wrappers deny anon. This is a **least-privilege cleanup candidate**, *not proof of an exposed API path*. Track separately before expanding exposed schemas. |
| `p4_5_interaction_read_models` | Remote historical function declares `v_eligible=false` and `v_reason='recipient_unavailable'`, then sets `true/'eligible'`; GitHub returns the same fixed success values directly. | Current eligibility checks sender org membership, published company + active link + approved claim, avoids self-inquiry, checks recipient preference and blocked organizations. Inquiry list scopes `received/sent` to current organization and checks active membership; public RPC entitlement gate present. Underlying inquiry/preference/block tables RLS-enabled, no direct browser SELECT. | **No behavioral difference established** for reviewed success return. Production uses claim and tenant controls; don't replay historical SQL. |
| `p4_7_follow_activity_foundation` | Repo source consolidates later fixes: activity-follow timestamps `clock_timestamp()`, event key `gen_random_uuid()::text` rather than earlier defaults/hash; remote original is earlier historical version. | Current catalog has all **4** `clock_timestamp()` column defaults; immutable append-only activity event trigger; unique indexes on company follows, activity event keys and reads. Feed filters published companies, active followers, follow-creation time; all public activity RPCs require Network entitlement. Sensitive tables RLS-enabled with no direct client SELECT. | **Expected historical difference because later fixes already applied**. Never replay the initial migration. |

Three original production correction versions are intentionally **comment-only GitHub placeholders** while their SQL remains preserved in remote ledger: `p4_7_follow_activity_ordering_fix`, `p4_7_follow_activity_statement_dedupe_fix`, `p4_7_activity_event_identity_fix`. Live `private.p4_7_append_activity` uses the final UUID event key (not the intermediate `statement_timestamp()` dedupe hash), and `clock_timestamp()`; preserve history and don't restore older implementations.

## Repeatable 20-assertion SQL audit

[`supabase/audits/supa_ledger4c_commercial_network_readonly.sql`](../../supabase/audits/supa_ledger4c_commercial_network_readonly.sql) contains **only SELECT statements** reading function definitions, policies, permissions, index and trigger metadata.

**Executed on 21 October 2026 against Supabase production: 20 / 20 checks PASS**.

The 20 catalog assertions cover:
- P2 public anonymous denial, private schema isolation, function membership checks, recovery RLS, tenant policy, source-hash uniqueness and recovery-status tenant checks.
- P4.5 sender+recipient+claim+block checks, tenant-scoped inquiry list, public entitlement gate and no direct inquiry-table browser SELECT.
- P4.7 public entitlement gate, active membership, follow/publication/time filtering, read-marker visibility, unique indexes, UUID event identity, four corrected timestamp defaults, append-only trigger and private tables.

**Important limitation:** A catalog/source pattern check is not an authenticated runtime negative permission test and does not demonstrate real-world Free/Pro behavior.

## Product metrics — observed aggregates, not activation results

| Production aggregate (21 Oct) | Count |
|---|---:|
| Legacy commercial message-identity recovery rows | **33** |
| Network activity events | **163** |
| Active follow rows | **0** |
| Network activity read markers | **0** |
| Network inquiry rows | **0** |
| `network_access` entitlement events | **0** |
| Supabase recorded migration history | **466** |

The feed infrastructure has produced events, but the chain **follow → user feed → business inquiry → RFQ conversion** shows no production uptake in these aggregate tables. A `network_access` entitlement policy gates public Network RPCs; activation or paid entitlements must be tested explicitly before proposing product metrics or opening functionality. **Never weaken RLS to make UI tests appear green.**

## Follow-up and release gates

1. **SEC1 / Least privilege:** Consider a reviewed non-production hardening migration to `REVOKE EXECUTE ... FROM anon` on the two private P2 recovery implementations (subject to complete dependency and impact review). No urgent vulnerability is proven because `anon` lacks schema USAGE; no production privilege changes occurred in this block.
2. **Negative ACL acceptance:** Test anon, authenticated outsider, sender and recipient organization members, owner of a claimed company, Free/Pro entitlement denial/grant, unfollowed/unpublished activity visibility and recovery across two tenants. Perform in isolated staging with safe fixtures.
3. **Commercial activation:** Add a separate Free/Pro Network product acceptance task for entitlement zero-events; do not conflate a functioning SQL catalog with real commercial usage.
4. **SUPA-LEDGER #780 still OPEN:** Three historical Commerciale/Network migrations are adjudicated against current catalog, not repaired in history. **Nine** SQL token-divergent historical names remain (seven Knowledge/technical standards and two private price-list). Duplicate names, remote-only/local-only migrations, historical version drift and official CLI password failure remain.
5. **IDENTITY2D #799/#801/#803** still staged, not applied or merged. Do not run `db push`, manual history update, or broad `supabase migration repair`.

**Exit criterion for this microblock:** durable read-only SQL, evidence document, reviewed GitHub CI, no production DB mutation.
