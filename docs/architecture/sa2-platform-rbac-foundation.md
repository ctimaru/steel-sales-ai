# SA2 — Platform RBAC Foundation

## Scope

SA2 implements the database-backed authorization substrate defined by SA1 without cutting any existing Platform domain over from the current Platform Owner check.

The current production control plane therefore remains operationally unchanged:

- existing Platform pages still call the legacy Superadmin gate;
- existing registration/discovery/claim RPCs still use the historical root predicate;
- the singleton Platform Owner remains uninterrupted;
- SA2 only adds the delegated-staff foundation that SA3/SA4+ can consume.

## New security entities

### platform_permissions

Frozen semantic permission catalog.

- 31 v1 permissions;
- area, action and risk metadata;
- explicit root-only flag;
- no browser-table access.

### platform_roles

Six fixed v1 role templates:

- registration_admin
- network_operations_admin
- claims_verification_admin
- knowledge_editor
- knowledge_publisher
- platform_auditor

Platform Owner is deliberately **not** represented as a staff role.

### platform_role_permissions

Fixed role-template mappings.

A database trigger rejects any attempt to map a root-only permission into a staff role.

### platform_staff

One row per delegated authenticated human.

Lifecycle:

    active ↔ suspended → revoked

Revoked identities cannot be silently reactivated. They require a new invitation.

A database trigger prevents the active Platform Owner from also becoming Platform Staff.

### platform_staff_roles

Append-preserving role-assignment history.

A partial unique index allows only one active assignment for a given user + role while historical revoked assignments remain available for audit.

### platform_staff_invitations

Email-scoped invitation lifecycle:

    pending → accepted | revoked | expired

Only verified Auth identities with a matching email can claim an invitation.

### platform_access_events

Common Platform privileged-action ledger.

SA2 records:

- invitation creation/revocation/acceptance;
- role changes;
- staff status changes.

Every event carries actor identity, authority type, role snapshot, permission used, entity and before/after state where applicable.

## Capability resolver

SA2 introduces:

    private.has_platform_permission(permission_key)
    public.has_platform_permission(permission_key)

Resolution rules:

1. unknown permission key → false;
2. active Platform Owner + known permission → true;
3. active Platform Staff → union of active fixed-role permissions;
4. suspended/revoked/missing staff → false.

This means stale JWT state cannot preserve authorization after suspension.

## Fail-closed helper

Future Platform RPCs can use:

    private.require_platform_permission(permission_key)

Denied or unknown capability raises SQLSTATE 42501.

No migrated domain uses this helper yet in SA2. Registration cutover is SA4.

## Platform access context

The authenticated UI-facing resolver:

    public.platform_access_context()

returns:

- authority_type;
- owner/staff flags;
- staff status;
- active roles;
- effective permissions.

Platform Owner receives the conceptual role label platform_owner and all 31 known permissions.

## Staff invitation primitives

### Create

    sa2_create_platform_staff_invitation(...)

Requires platform.staff.invite.

Because that permission is root-only and cannot be mapped to staff roles, only Platform Owner can create invitations in v1.

### Claim

    sa2_claim_platform_staff_invitation()

Requires:

- authenticated identity;
- verified Auth email;
- pending, unexpired invitation for the same normalized email;
- caller is not Platform Owner.

Claim activates/re-activates the staff identity and applies exactly the role set chosen by the inviter.

### Revoke invitation

    sa2_revoke_platform_staff_invitation(...)

Root-only.

## Staff lifecycle primitives

### Roles

    sa2_set_platform_staff_roles(...)

Requires platform.staff.manage_roles.

The desired role set is validated against active fixed templates. Role history is preserved.

### Status

    sa2_set_platform_staff_status(...)

- suspend/revoke requires platform.staff.suspend;
- reactivation from suspended requires platform.staff.manage_roles;
- revoked identities cannot be reactivated without reinvitation.

## Read primitives for SA3

SA2 prepares authorization-checked data sources for the future People & Access UI:

    sa2_platform_staff_directory()
    sa2_platform_staff_invitation_queue()

Both require platform.staff.read.

The Platform Auditor role receives staff.read but no staff mutation permission.

## Raw-table isolation

Authenticated and anonymous browser roles receive no direct access to the RBAC tables or audit ledger.

UI/server code must use authorization-checked functions.

Tenant data permissions are untouched: Platform Staff membership does not create organization_memberships and does not alter tenant RLS.

## No per-user permission overrides

There is intentionally no user-permission table.

Effective staff authority remains:

    union(active fixed role templates)

This locks the SA1 v1 contract and avoids silent one-off escalation.

## Root compatibility

The existing table and predicate remain intact:

    platform_user_roles
    private.is_platform_superadmin()
    public.is_platform_superadmin()

SA2 does not rename, delete or weaken them.

The new resolver treats the current active platform_superadmin as Platform Owner.

## SA2 acceptance

SA2 tests verify:

- 31 permissions, 6 roles and 39 mappings;
- no root-only permission can be assigned to a staff role;
- Platform Owner receives every known permission but not unknown permissions;
- Platform Owner cannot become Platform Staff;
- email-scoped invitation claim;
- Registration Admin domain isolation;
- union of multiple fixed templates;
- no staff self-elevation;
- immediate permission loss on suspension;
- terminal revocation;
- Knowledge Editor / Publisher separation;
- raw RBAC tables denied to authenticated browser roles;
- privileged lifecycle audit events;
- legacy is_platform_superadmin behavior remains available.

## Next boundary

SA3 may now build People & Access on top of these primitives.

SA4 will be the first authorization cutover: Registrations moves from the root-only predicate to explicit registration permissions, with database acceptance proving that delegated operators cannot cross into Discovery, Claims or tenant-private data.
