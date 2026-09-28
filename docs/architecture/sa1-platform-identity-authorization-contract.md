# SA1 — Platform Identity & Authorization Contract

## Goal

Evolve Steel Sales AI from a single-human Platform Superadmin model into a delegated Platform Staff model without weakening tenant isolation, auditability or root ownership.

SA1 defines the target security contract only. It does **not** yet change production authorization behavior, create staff accounts or expose new Platform UI. Those changes belong to SA2+.

The existing platform_superadmin remains the production root-of-trust until the RBAC foundation is implemented and accepted.

## Current state

Production currently enforces a deliberately narrow control-plane model:

- public.platform_user_roles accepts only platform_superadmin;
- a unique partial index allows only one active platform_superadmin;
- private.is_platform_superadmin() is the root authorization predicate;
- /platform is available only when is_platform_superadmin() is true;
- registration, discovery, claim and verification RPCs frequently check the same predicate directly;
- platform actions are therefore all-or-nothing from a human authorization perspective.

This is safe for a founder-operated platform but cannot support delegated daily operations.

## Core decision

The target model is:

~~~
Platform Owner (singleton root authority)
        │
        └── Platform Staff identities
              ├── Registration Admin
              ├── Network Operations Admin
              ├── Claims & Verification Admin
              ├── Knowledge Editor
              ├── Knowledge Publisher
              └── Platform Auditor
~~~

A Platform Staff identity is a normal authenticated user. Shared administrative credentials are forbidden.

The Platform Owner is **not** another staff role. Root ownership is a distinct authority that cannot be assigned through normal staff-role administration.

## Root authority

The current production role key is platform_superadmin.

The target product language is Platform Owner.

SA2 may preserve the existing database key for backwards compatibility while exposing platform_owner as the conceptual target role.

Root invariants:

1. exactly one active root authority remains allowed;
2. a Platform Staff role can never grant root ownership;
3. no delegated administrator can create another Platform Owner;
4. no staff role template can contain root-only permissions;
5. the Platform Owner implicitly satisfies every Platform permission check;
6. suspending or revoking staff must never affect the Platform Owner;
7. root ownership changes require a separate future recovery/transfer procedure and are outside ordinary People & Access operations.

## Identity boundaries

The product has three distinct identity/authorization planes.

### 1. Auth identity

auth.users.id identifies the human.

Every privileged Platform action must resolve to a concrete authenticated user.

### 2. Platform authority

Platform Owner and Platform Staff determine access to the global SaaS control plane.

This authority covers platform operations such as:

- company registration review;
- Network discovery operations;
- company claim verification;
- Knowledge editorial operations;
- global audit;
- staff administration.

### 3. Tenant membership

organization_memberships determines access to a company's private workspace.

Platform authority does **not** imply tenant membership.

Tenant membership does **not** imply Platform authority.

These planes must remain independently enforceable in Postgres.

## Tenant-private-data invariant

Normal Platform Staff must never receive automatic access to:

- tenant email;
- commercial documents;
- offers;
- RFQs;
- orders;
- private contacts;
- private conversations;
- private Commercial Memory;
- private tenant Knowledge.

Company onboarding metadata, public Network evidence and Platform audit records are Platform data and may be exposed according to Platform permissions.

Emergency tenant-private-data access is represented by the reserved permission tenant_access.break_glass.

SA1 intentionally does not implement it and no staff template grants it.

A future break-glass implementation must require, at minimum:

- explicit reason;
- bounded duration;
- immutable audit;
- target organization;
- actor identity;
- automatic expiry;
- no silent standing access.

## Authorization model

Authorization is capability-based RBAC.

A route or mutation does not ask only "is this user an admin?". It asks whether the authenticated human has the required Platform permission.

Target database predicate:

    has_platform_permission(permission_key)

Target fail-closed helper:

    require_platform_permission(permission_key)

The database remains the final authorization authority.

UI visibility is only a projection of the same permission model.

## Permission naming

Permission keys follow:

    <area>.<action>

Examples:

    registrations.read
    registrations.approve
    discovery.publish
    claims.revoke
    knowledge.publish
    platform.staff.manage_roles

Permissions are immutable semantic identifiers. Labels may change without changing permission keys.

## Risk levels

Every permission belongs to a risk class.

| Risk | Meaning |
| --- | --- |
| low | read-only or basic control-plane access |
| medium | workflow mutation without final ownership/activation consequence |
| high | approval, publication, activation, rejection, revocation or identity-impacting mutation |
| critical | staff authority, global settings or tenant-private emergency access |

Risk level is metadata in SA1. SA2+ can use it for stronger audit, confirmation or approval requirements.

## Permission catalog v1

### Platform

| Permission | Risk | Purpose |
| --- | --- | --- |
| platform.console.access | low | open Platform Control Plane |
| platform.staff.read | medium | view Platform Staff and role assignments |
| platform.staff.invite | critical | invite Platform Staff |
| platform.staff.manage_roles | critical | assign/remove staff role templates |
| platform.staff.suspend | critical | suspend/revoke Platform Staff |
| platform.audit.read | medium | read privileged-action audit |
| platform.settings.manage | critical | change global platform settings |

### Registrations

| Permission | Risk |
| --- | --- |
| registrations.read | low |
| registrations.review | medium |
| registrations.request_information | medium |
| registrations.approve | high |
| registrations.reject | high |
| registrations.activate | high |
| registrations.bridge_network | high |

### Company Discovery

| Permission | Risk |
| --- | --- |
| discovery.read | low |
| discovery.run | medium |
| discovery.review | medium |
| discovery.publish | high |
| discovery.enrich | high |
| discovery.close_duplicates | high |

### Claims & verification

| Permission | Risk |
| --- | --- |
| claims.read | low |
| claims.review_proof | medium |
| claims.approve | high |
| claims.reject | high |
| claims.revoke | high |

### Knowledge

| Permission | Risk |
| --- | --- |
| knowledge.read_drafts | low |
| knowledge.edit | medium |
| knowledge.review | medium |
| knowledge.publish | high |
| knowledge.quality_audit | medium |

### Reserved

| Permission | Risk |
| --- | --- |
| tenant_access.break_glass | critical |

## Root-only permissions

In v1 the following permissions are root-only and are not included in any Platform Staff template:

    platform.staff.invite
    platform.staff.manage_roles
    platform.staff.suspend
    platform.settings.manage
    tenant_access.break_glass

This means People & Access starts founder-controlled.

Delegated staff management can be considered later, after the audit/security center is mature.

## Role templates v1

### Registration Admin

Purpose: daily company onboarding.

Permissions:

    platform.console.access
    registrations.read
    registrations.review
    registrations.request_information
    registrations.approve
    registrations.reject
    registrations.activate
    registrations.bridge_network

This role can process the full registration lifecycle but cannot manage staff, settings, Company Discovery, Claims or Knowledge.

### Network Operations Admin

Purpose: operate Company Discovery and controlled public Network enrichment.

Permissions:

    platform.console.access
    discovery.read
    discovery.run
    discovery.review
    discovery.publish
    discovery.enrich
    discovery.close_duplicates

This role does not receive Claim authority.

### Claims & Verification Admin

Purpose: process ownership evidence and claim lifecycle.

Permissions:

    platform.console.access
    claims.read
    claims.review_proof
    claims.approve
    claims.reject
    claims.revoke

### Knowledge Editor

Purpose: prepare editorial content without publication authority.

Permissions:

    platform.console.access
    knowledge.read_drafts
    knowledge.edit
    knowledge.review
    knowledge.quality_audit

Explicitly excluded: knowledge.publish.

### Knowledge Publisher

Purpose: independent review and publication.

Permissions:

    platform.console.access
    knowledge.read_drafts
    knowledge.review
    knowledge.publish
    knowledge.quality_audit

Draft editing remains separated from publication in the default template.

A single person may receive multiple role templates when operationally necessary, but the assignment must be explicit and auditable.

### Platform Auditor

Purpose: read-only oversight.

Permissions:

    platform.console.access
    platform.staff.read
    platform.audit.read
    registrations.read
    discovery.read
    claims.read
    knowledge.read_drafts
    knowledge.quality_audit

No mutation permission is granted.

## No custom per-user overrides in v1

SA1 deliberately rejects free-form checkbox permissions for individual staff accounts.

Initial policy:

    effective permissions = union(role template permissions)

No arbitrary allow/deny override is supported.

Reasons:

- easier audit;
- lower privilege-escalation risk;
- simpler UI;
- deterministic support;
- stable acceptance tests.

A future override layer can be introduced only if real operational needs justify the added complexity.

## Staff lifecycle target

Target Platform Staff states:

    invited → active → suspended | revoked

Rules:

- invitation is email-scoped;
- accepting an invitation requires a matching authenticated identity;
- staff access exists only after activation;
- suspension denies all Platform capabilities immediately while preserving identity/history;
- revocation is terminal for the assignment but must not delete historical audit;
- reinvitation creates a new lifecycle event, not silent resurrection of old audit history.

SA2 decides the final schema.

## Route contract

Target route authorization:

| Route | Permission |
| --- | --- |
| /platform | platform.console.access |
| /platform/people | platform.staff.read |
| /platform/audit | platform.audit.read |
| /platform/registrations | registrations.read |
| /platform/company-discovery | discovery.read |
| /platform/company-claims | claims.read |
| /platform/knowledge | knowledge.read_drafts |

Navigation must render only permitted areas.

Manual URL entry must still fail at server/database authorization.

## Action contract

Existing actions map to capabilities rather than a generic Superadmin check.

### Registrations

    request information   → registrations.request_information
    approve               → registrations.approve
    reject                → registrations.reject
    activate workspace    → registrations.activate
    registration bridge   → registrations.bridge_network

### Discovery

    start crawl           → discovery.run
    review candidate      → discovery.review
    publish new company   → discovery.publish
    enrich existing       → discovery.enrich
    close exact duplicate → discovery.close_duplicates

One UI form may require more than one permission depending on the selected decision.

For example a publish_new discovery decision requires both discovery.review and discovery.publish.

### Claims

    review proof  → claims.review_proof
    approve claim → claims.approve
    reject claim  → claims.reject
    revoke claim  → claims.revoke

## Enforcement layers

A Platform permission must be enforced at all relevant layers.

### UI

- hide unavailable navigation;
- hide unavailable buttons/actions;
- explain role context;
- never treat hidden UI as security.

### Server route/action

- resolve authenticated Platform context;
- require explicit permission;
- fail closed;
- never infer permission from route visibility.

### Postgres RPC

- recheck the explicit permission;
- never trust a permission passed from the browser;
- continue using auth.uid() as actor identity;
- return 42501 for authorization failure.

The database is authoritative.

## Service role

service_role is a trusted machine credential, not a Platform Staff identity.

Rules:

- service-role access is separately granted for background/infrastructure workflows;
- service-role capability must never create a human Platform session;
- staff authorization must never be implemented as possession of a service key;
- frontend code must never receive a service key.

## Privilege-escalation invariants

1. staff cannot assign or increase their own authority;
2. staff cannot mutate Platform Owner authority;
3. no role template includes root-only permissions;
4. staff suspension is checked at authorization time, not only at login time;
5. stale JWT/user metadata cannot grant authority;
6. Platform roles live in database-backed authorization state;
7. no permission check relies on client-provided organization, role or permission values;
8. a user with multiple roles receives only the union of those fixed role templates;
9. deletion of a role assignment cannot delete prior audit history;
10. platform authorization must fail closed for unknown permission keys.

## Audit contract

Every privileged human mutation must eventually emit a common Platform audit event.

Minimum fields:

    actor_user_id
    actor_authority_type
    actor_role_snapshot
    permission_key
    action
    entity_type
    entity_id
    target_organization_id?
    before?
    after?
    reason?
    occurred_at
    request/session context?

The current registration ledger already records actor identity but uses the historical actor type platform_superadmin.

Migration rule:

- keep historical events unchanged;
- allow future actor types platform_owner and platform_staff;
- include permission_key and role snapshot for delegated actions;
- do not rewrite past audit history merely to normalize terminology.

## Two-person controls

SA1 does not mandate four-eyes approval for daily operations.

The architecture must, however, support future policy such as:

    prepared_by != approved_by

for selected critical workflows.

Likely future candidates:

- root ownership transfer;
- high-risk staff-role changes;
- tenant break-glass;
- destructive global settings;
- selected Marketplace moderation actions.

Normal registration approval and activation remain single-operator capable in v1.

## Knowledge-specific separation of duties

Knowledge uses two default templates to avoid coupling authorship and publication:

    Knowledge Editor    → edit + review, no publish
    Knowledge Publisher → review + publish, no edit by default

K8 publication-readiness remains a content-quality gate.

Authorization and content readiness are separate conditions:

    can publish =
      has_platform_permission('knowledge.publish')
      AND
      content_readiness = true

Neither condition replaces the other.

## Platform UI target

Platform navigation is derived from effective permissions.

Example Registration Admin:

    Platform Home
    Registrazioni aziende

Example Network Operations Admin:

    Platform Home
    Company Discovery

Example Platform Owner:

    Platform Home
    People & Access
    Registrazioni aziende
    Company Discovery
    Company Claims
    Knowledge Operations
    Audit & Security
    Platform Settings

The Platform shell must show the actual authority label instead of hardcoding Platform Superadmin.

## SA2 target schema

SA1 does not create tables, but SA2 should implement the conceptual model with equivalents of:

    platform_staff
    platform_staff_invitations
    platform_roles
    platform_permissions
    platform_role_permissions
    platform_staff_roles
    platform_access_events

The existing platform_user_roles remains the root bootstrap until a safe migration path is accepted.

## Migration strategy from current Superadmin checks

Do not replace all authorization in one uncontrolled migration.

Order:

1. create Platform Staff/RBAC schema;
2. add has_platform_permission() with automatic Platform Owner bypass;
3. add immutable role templates/permission catalog;
4. add staff invitation and lifecycle functions;
5. add central Platform context resolver;
6. migrate one bounded domain at a time;
7. start with Registrations;
8. then Company Discovery;
9. then Claims;
10. then Knowledge;
11. only remove direct Superadmin checks after every mapped action has acceptance coverage.

During migration the Platform Owner must retain uninterrupted access.

## Security acceptance criteria for SA2+

At minimum:

1. Platform Owner continues to access every Platform area.
2. Registration Admin can open Registrations but cannot open Discovery or Claims.
3. Registration Admin can approve/activate only through registration permissions.
4. Network Operations Admin cannot approve Claims.
5. Knowledge Editor cannot publish.
6. Knowledge Publisher can publish only content that passes the Knowledge readiness gate.
7. Platform Auditor cannot mutate anything.
8. suspended staff loses Platform access immediately.
9. staff cannot self-elevate.
10. staff cannot grant Platform Owner.
11. no Platform role exposes tenant-private Commercial Memory.
12. direct RPC invocation with insufficient permission returns authorization failure.
13. manual URL entry cannot bypass route permission.
14. service role remains machine-only and does not act as a human RBAC identity.
15. every delegated privileged mutation records actor + permission in audit.

## SA1 completion definition

SA1 is complete when:

- root authority is formally distinct from Platform Staff;
- identity planes and tenant-isolation rules are explicit;
- the permission catalog is frozen for SA2 v1;
- initial role templates are frozen;
- root-only permissions are explicit;
- route and existing-action mappings are explicit;
- escalation, audit and service-role invariants are explicit;
- no production authorization behavior has been weakened;
- acceptance tests lock the contract before SA2 schema work begins.
