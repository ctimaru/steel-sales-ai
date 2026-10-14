# RQG3.2a / RQG3.2c — Protected Production QA Activation

**Status: not provisioned, NOT accepted.** The live Supabase inventory taken for RQG3.2c showed **one active Platform Owner, zero RQG32 synthetic users, zero QA organizations, zero QA Review records**. The test fixtures must never be confused with actual steel-industry companies or real customer documents.

## Fixed test identities (not credentials)

| Persona | Synthetic Auth email | Role to grant ONLY through governed Owner workflow |
| --- | --- | --- |
| Registration | `rqg32-registration@smartsteelsales.test` | `registration_admin` |
| Claims | `rqg32-claims@smartsteelsales.test` | `claims_verification_admin` |
| Trust | `rqg32-trust@smartsteelsales.test` | `network_trust_admin` |
| Auditor | `rqg32-auditor@smartsteelsales.test` | `platform_auditor` |
| Company admin A | `rqg32-company-a@smartsteelsales.test` | admin of `rqg32-company-a` only |
| Company admin B | `rqg32-company-b@smartsteelsales.test` | admin of `rqg32-company-b` only |
| Company viewer | `rqg32-viewer@smartsteelsales.test` | viewer of `rqg32-company-a` only |

The reserved `.test` domain cannot receive real email messages. Auth Admin creates confirmed, synthetic accounts for isolated acceptance **without proving real email ownership or accepting legal consent**. Do not use `.test` addresses for real customer registration, invites, correspondence or marketplace dispatch.

## Minimal protected GitHub configuration — human setup required

1. In repository **Settings → Environments**, create `production-qa`. Restrict it to branch `main`, configure required reviewers where your GitHub plan permits, and limit who may configure credentials. **Do not run privileged QA if this environment is unprotected.**
2. Within the protected `production-qa` **environment secrets** (not repository secrets), configure **eight** values: `RQG32A_AUTH_SECRET_KEY` (a short-lived, server-side Supabase secret with Auth Admin access) and **seven** independently random passwords, each at least 20 characters, named `RQG32_<ROLE>_PASSWORD` for REGISTRATION, CLAIMS, TRUST, AUDITOR, COMPANY_A, COMPANY_B and VIEWER. Avoid placing passwords or the Supabase key in this chat, Issues, Notion, PRs or logs; rotate the Supabase key after use. No QA email/marker secrets are required: they are fixed, non-sensitive identifiers.
3. Launch **Actions → RQG3.2a Controlled Production Test Personas** on `main`. Select `preflight`, approval `RQG32A_INSPECT_SYNTHETIC_USERS`. This only reads the Auth directory, one active Owner, and QA-named records — it does not require any QA passwords to be populated or passed to the preflight step.
4. When the preflight succeeds, select `create`, approval **`RQG32A_CREATE_SEVEN_SYNTHETIC_USERS`**. This invokes Supabase **Auth Admin** to create only missing, trusted, tagged QA identities. It does not insert SQL users, grant platform permissions, activate organizations, accept terms or seed commercial records. Unique strong passwords are used only for this step and never logged.
5. Select `verify` with `RQG32A_INSPECT_SYNTHETIC_USERS` to verify seven tagged Auth users and exactly one Owner. The create operation is idempotent and fails closed on email collisions. **Do not create another superadmin.**

## Owner-controlled role and organization governance

After Auth bootstrap, the sole real Platform Owner can use `/platform/people` to invite and assign exactly four Platform Staff roles. Their ownership-invitation claim is handled by the existing login flow. These synthetic `.test` users cannot receive invite emails; use the existing-user path and explicitly confirm activation only through the governed UI/RPC lifecycle.

The two synthetic company identities should follow the normal registration review and activation process; the company Viewer should be assigned via the established company membership workflow. **Do not forge actual legal acceptance**, do not invent a VAT/tax ID as if real, and do not bypass an activation gate simply because the entity is a demo. If the existing registration system requires an actual person or verifiable legal declaration, STOP instead of fabricating the information — resolve this with a separately audited synthetic-only test path.

Only after both synthetic organizations are genuinely authorized and the staff/admin memberships exist may an approved operator use the optional transaction-scoped SQL file `supabase/ops/rqg32a_synthetic_review_seed.sql`. It checks exact test accounts, exact company slugs, a single Owner, approved memberships, and reserved IDs before creating two private synthetic Review records:

- Company A: `RQG32-ORG_A-20261013`
- Company B: `RQG32-ORG_B-20261013`

This SQL **must not** be applied as a migration or automatically on deployment. Cleanup is separately guarded in `supabase/ops/rqg32a_synthetic_review_cleanup.sql`; it does not revoke staff or delete Auth accounts and refuses to erase rows after review decisions.

## Final strict gate

Execute `mode=ready` with approval `RQG32A_INSPECT_SYNTHETIC_USERS`. This makes **no writes** and verifies exactly seven tagged Auth personas, a single Owner, their scoped staff/member roles, exactly two completed demo organizations and two pending tenant-isolated Review markers.

Then manually run **RQG3.2 — Production Review Chrome Auth Read-Only** on `main`, with `I_APPROVE_READ_ONLY_RQG32`. The protected environment workflow invokes readiness before launching Chrome; all application writes except sign-in are blocked. A green result is required before claiming authenticated production acceptance. No superadmin password is requested or exported, and no second Owner persona is created.

**Project exit state until these gated manual operations succeed: RQG3.2c code-ready / production activation pending.**
