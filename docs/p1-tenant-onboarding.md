# P1.1 — Tenant onboarding wizard & user roles

## Goal

A new steel company can create a Steel Sales AI workspace and reach a tenant-ready state without a manual database operation. An existing tenant admin can invite colleagues and assign least-privilege roles.

P1.1 builds on the organization boundary introduced in P0.2. `organization_id` remains the tenant boundary and authorization remains database-backed through RLS/functions rather than JWT `user_metadata`.

## Onboarding state machine

`organizations.onboarding_status`:

- `not_started` — reserved initial state;
- `profile` — organization exists and the creator is its admin;
- `sources` — at least one intended data source has been selected;
- `team` — reserved for future multi-step UI progression;
- `completed` — profile, source selection and data-processing acknowledgement passed.

Existing internal organizations are backfilled to `completed` to avoid breaking the P0 production tenant. The migration does **not** fabricate a historical consent record for those tenants.

## Role matrix

| Capability | admin | member | viewer |
| --- | --- | --- | --- |
| Read tenant commercial/knowledge data allowed by existing RLS | yes | yes | yes |
| Manage organization onboarding/profile | yes | no | no |
| View complete tenant member directory | yes | no | no |
| Send invitations | yes | no | no |
| Change member roles | yes | no | no |
| Demote the last active admin | no | no | no |

The last-admin guard prevents accidental tenant lockout.

## Invitation model

Pre-auth invitations live in `organization_invitations` and are email-scoped. A membership is not created until the authenticated user's verified Auth email matches the pending invitation.

Invitation lifecycle:

`pending → accepted | revoked | expired`

The trusted Railway worker performs the server-side Supabase Auth Admin invitation. The Vercel frontend never receives the Supabase service/secret key. Before sending an email the worker re-verifies that the acting user is an active tenant admin.

The email redirect lands on `/auth/finish?invited=1`. The browser accepts either an Auth code or an implicit invite session, prompts the invited user to set a password, then calls `claim_pending_organization_invitations()` to activate the tenant membership.

Supabase Auth redirect URLs must include the production application origin. The frontend sends an origin-derived HTTPS redirect URL; Supabase will ignore a redirect that is not allow-listed in Auth URL Configuration.

## New-tenant flow

1. User creates an Auth account from `/login`.
2. After email confirmation, `/auth/finish?signup=1` establishes the session.
3. `/onboarding` creates the organization and an active/default `admin` membership atomically.
4. Admin selects initial source types (`email`, `pdf`, `xlsx`) and acknowledges authorized processing.
5. `update_organization_onboarding(..., p_complete=true)` validates the contract and sets the organization to `completed`.
6. Workspace routes become available.

## Security properties

- authorization is checked in Postgres and rechecked by the invitation worker;
- email invitation records cannot be inserted/updated/deleted by browser clients;
- unrelated authenticated users cannot see tenant invitations;
- claims are matched against the email stored in `auth.users`, not user-controlled metadata;
- invitation claim is idempotent;
- organization creator cannot create a second active organization in P1.1 v1;
- invitation redirects reject non-local plain HTTP URLs;
- tenant admin email directory is exposed only by an authorization-checked function joining `auth.users`.

## Acceptance gate

The required GitHub CI rebuilds Supabase and exercises synthetic users/tenants for:

- self-service organization creation;
- admin default membership;
- onboarding fail-closed validation;
- source normalization and acknowledgement;
- invitation visibility/isolation;
- correct-email claim + idempotency;
- member denial for admin functions;
- admin role changes and last-admin lockout guard;
- admin-only tenant member directory.

Worker tests cover the internal invitation endpoint, worker-token enforcement, redirect/email normalization, and admin authorization error routing. Frontend CI covers TypeScript, tests and the production Next.js build.
