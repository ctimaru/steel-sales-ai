# SA3 — Superadmin People & Access

## Goal

SA3 turns the SA2 RBAC substrate into an owner-facing control plane for delegated administration.

The Platform Owner can now:

- create Platform Staff invitations;
- choose one or more fixed role templates;
- inspect the exact permissions included by each template;
- resend or revoke pending invitations;
- update the fixed role set of an activated staff identity;
- suspend, reactivate or permanently revoke Platform Staff;
- inspect active/suspended/revoked staff and invitation history.

SA3 does **not** yet delegate existing Platform operational domains. Registrations, Company Discovery and Company Claims remain behind the current root Platform gate until their dedicated cutovers.

## Owner-only boundary

The People & Access page lives at:

    /platform/people

The current Platform layout is still root-only, and every SA3 mutation action independently calls the existing Platform Owner guard.

Database functions then enforce the root-only capabilities introduced in SA2.

The UI is never the final security boundary.

## Invitation flow

The target invitation flow is now end-to-end:

    Platform Owner
        ↓
    create DB invitation + fixed role set
        ↓
    authenticated Edge Function sends Supabase Auth invitation
        ↓
    recipient verifies email and sets password
        ↓
    sa2_claim_platform_staff_invitation()
        ↓
    Platform Staff active

Invitations expire after 7 days.

The database invitation is authoritative. Email delivery never grants Platform permissions by itself.

## Invite email Edge Function

Function:

    sa3-platform-staff-invite

Security requirements:

- JWT verification enabled;
- caller token resolved to a real Auth user;
- caller must still be the active platform_superadmin / Platform Owner;
- a matching non-expired pending Platform Staff invitation must already exist;
- service-role key exists only inside the Supabase Edge Function environment;
- browser/server Next.js code never receives the service-role key.

The function uses Supabase Auth admin invite delivery only after those checks.

The production fallback redirect is:

    /auth/finish?invited=1&staff=1

An optional Supabase function secret named SA3_PLATFORM_INVITE_REDIRECT_URL can override the full redirect URL if the public application domain changes.

## Existing Auth users

Supabase Auth admin invitation can report that the invited email already has an account.

In that case:

- the Platform Staff DB invitation remains pending;
- the owner sees a warning rather than a false delivery success;
- the existing user only needs to log in with the invited email;
- normal login attempts sa2_claim_platform_staff_invitation();
- the matching verified identity acquires the pending staff invitation.

No password or shared credential is created by the Platform Owner.

## Staff activation route

Route:

    /staff/access

This route is outside the root-only Platform layout.

It exists so delegated staff can:

- complete/confirm invitation activation;
- see current Platform Staff status;
- see assigned role templates;
- see suspended/revoked state;
- remain separated from tenant onboarding.

It does not expose Platform operational modules in SA3.

## People & Access UX

The owner page contains:

1. Platform Owner root card.
2. Staff/invitation counters.
3. New staff invitation form.
4. Role-template permission preview.
5. Platform Staff directory.
6. Per-user role update controls.
7. Suspend/reactivate/revoke controls.
8. Pending invitation queue.
9. Resend/revoke invitation controls.
10. Invitation lifecycle history.

Every role preview is generated from the same SA1/SA2 TypeScript contract used by the application.

No arbitrary per-user permission checkbox exists.

## Lifecycle semantics

### Invitation

    pending → accepted | revoked | expired

### Staff

    active ↔ suspended → revoked

Suspension is reversible.

Revocation is terminal and requires a new invitation before the human can return as active Platform Staff.

## Tenant isolation

SA3 does not create organization_memberships.

Activating Platform Staff therefore grants no automatic access to:

- tenant offers;
- RFQs;
- orders;
- emails;
- contacts;
- private Commercial Memory;
- private tenant documents.

The Staff access page repeats this separation explicitly.

## Audit

SA3 reuses the SA2 Platform audit ledger.

The following owner actions remain auditable:

- invitation creation;
- invitation revocation;
- invitation acceptance;
- staff role change;
- staff suspension;
- staff reactivation;
- staff revocation.

The lifecycle history is not deleted when access is revoked.

## Product terminology

The owner-facing shell now uses:

    Platform Owner

instead of the historical product label:

    Platform Superadmin

The underlying database bootstrap key remains platform_superadmin for backward compatibility.

## SA3 acceptance

SA3 acceptance verifies:

- pending invitation appears in owner queue;
- matching verified email claims it;
- delegated role permissions are exact;
- Platform Staff receives no tenant membership;
- owner directory shows activated staff;
- suspension removes effective capabilities immediately;
- delegated staff cannot create new staff invitations;
- owner can reactivate staff;
- pending invitations can be revoked while remaining in history;
- lifecycle actions leave audit evidence;
- invitation email logic remains isolated in a JWT-protected Edge Function;
- normal login can acquire an invitation for an already-existing Auth user.

## Next boundary

SA4 — Registration Delegation Cutover is the first operational-domain cutover.

It should replace direct Superadmin checks only for the Registration area and map each operation to the SA1 permission contract while leaving Discovery, Claims, Knowledge and tenant-private data unchanged.
