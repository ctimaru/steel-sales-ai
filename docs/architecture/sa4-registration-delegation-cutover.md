# SA4 — Registration Delegation Cutover

## Goal

SA4 is the first real operational-domain cutover from the historical root-only Platform model to delegated Platform Staff authorization.

Registration Admin can now enter the Platform Console and operate the company-registration workflow without receiving authority over Discovery, Claims, Knowledge, People & Access or tenant-private data.

## Delegated domain

The following registration capabilities are active:

- registrations.read
- registrations.request_information
- registrations.approve
- registrations.reject
- registrations.activate
- registrations.bridge_network

Every route, server action and Postgres RPC uses the matching capability.

## Platform shell

The Platform layout now resolves authenticated authority through platform_access_context() rather than requiring the root Platform Owner.

Active Platform Staff with platform.console.access can enter /platform.

The navigation remains staged:

- Platform Home: staff-enabled;
- Registrations: staff-enabled when registrations.read is present;
- People & Access: root-only in SA4;
- Company Discovery: root-only in SA4;
- Company Claims: root-only in SA4.

This avoids exposing future domains before their own security cutover.

## Registration UI

/platform/registrations requires registrations.read.

/platform/registrations/[id] requires registrations.read and renders each mutation independently:

- request information only with registrations.request_information;
- approve only with registrations.approve;
- reject only with registrations.reject;
- activate only with registrations.activate;
- Network bridge and candidate matching only with registrations.bridge_network.

A read-only Platform Auditor can therefore inspect the queue and detail without seeing mutation controls.

## Server actions

Every registration Server Action rechecks its dedicated capability before invoking Supabase.

Hiding a button is never treated as authorization.

## Database authorization

The legacy direct Superadmin checks are removed from the eight registration-domain private implementations:

- p0a_admin_registration_queue_impl
- p0a_admin_registration_detail_impl
- p0a_request_registration_information_impl
- p0a_approve_registration_application_impl
- p0a_reject_registration_application_impl
- p0a_activate_registration_application_impl
- m7_application_candidates_impl
- m7_bridge_registration_impl

Each now calls private.require_platform_permission(...).

Unknown or missing permissions continue to fail closed with SQLSTATE 42501.

Platform Owner keeps implicit access through the SA2 permission resolver.

## Registration audit

Historical registration events remain unchanged.

New privileged registration events distinguish:

- platform_owner
- platform_staff

The registration ledger constraints were expanded without rewriting old platform_superadmin history.

Delegated mutations also emit the common Platform audit event introduced in SA2 with:

- actor identity;
- role snapshot;
- permission key;
- action;
- registration application id;
- before/after status.

## Tenant isolation

Activation creates the applicant's organization and Organization Admin membership exactly as before.

The Registration Admin performing the activation receives no organization_membership and therefore no access to the new tenant's private workspace or Commercial Memory.

## Authentication routing

Active Platform Staff now enter /platform after login or staff-invite activation.

Suspended or revoked staff remain on /staff/access and have no effective Platform permissions.

The Platform shell hides the Company Workspace shortcut for delegated staff so Platform authority is not presented as tenant authority.

## Root-only domains

SA4 deliberately does not cut over:

- People & Access mutations;
- Company Discovery;
- Company Claims;
- Knowledge Operations.

Direct navigation to root-only pages remains protected even though the shared Platform layout now accepts delegated staff.

## Acceptance

SA4 acceptance proves that:

1. Registration Admin reads queue and detail.
2. Registration Admin requests information, approves, rejects, activates and bridges.
3. Registration Admin lacks Discovery, Claims, Knowledge and staff-governance permissions.
4. Platform Auditor reads Registrations but cannot mutate or inspect bridge candidates.
5. Normal authenticated users cannot read the registration queue.
6. delegated activation does not grant tenant membership to the operator.
7. delegated registration events identify platform_staff.
8. global audit records actor + permission for delegated mutations.
9. Platform Owner retains uninterrupted access.
10. frontend navigation and action visibility match the same capability model.

## Next boundary

SA5 should perform the Company Discovery / Network Operations delegation cutover using the same staged pattern:

route visibility → server action capability → Postgres capability → audit → tenant-isolation acceptance.
