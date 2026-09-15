# P0 tenant isolation contract

## Goal

Move Steel Sales AI from a single-user ownership boundary (`owner_id = auth.uid()`) to an organization-level SaaS boundary without losing provenance or breaking the existing commercial archive.

## Core decisions

1. `organization_id` is the security / tenant boundary.
2. `owner_id` remains during the migration as provenance (`created_by` / original owning user), not as the long-term authorization boundary.
3. Membership is explicit in `organization_memberships`.
4. Existing data is backfilled by creating one default organization per distinct legacy owner and adding that owner as an active admin member.
5. Authenticated clients read/write tenant data through organization membership. Internal worker/evaluation tables remain inaccessible to browser roles unless explicitly needed.
6. Global knowledge stays global. Private knowledge is organization-scoped.
7. Every server-to-server commercial/knowledge request carries both authenticated user context and organization context until owner-scoped APIs have been fully retired.

## New entities

### `organizations`

- `id uuid primary key`
- `name text`
- `slug text unique`
- `created_by uuid references auth.users`
- `created_at`, `updated_at`

### `organization_memberships`

- `organization_id uuid references organizations`
- `user_id uuid references auth.users`
- `role`: `admin | member | viewer`
- `status`: `active | invited | suspended`
- `created_at`, `updated_at`
- primary key `(organization_id, user_id)`

For P0, organization creation and membership administration remain server/service controlled. P1 will add customer-facing invitations and organization administration.

## Tenant-owned data

`organization_id` must be added to the owner-scoped commercial and private knowledge resources, including:

- commercial datasets, threads, observations and review queue
- companies, contacts, conversations, messages, documents
- products, RFQs, offers, orders, availability, deliveries, certificates, extracted fields and price history
- worker jobs
- private `knowledge_sources`, `knowledge_entities` and `knowledge_entity_bindings`

Derived knowledge rows (`knowledge_documents`, `knowledge_chunks`, evidence, mentions, aliases) inherit visibility from their source/entity and do not need a duplicated tenant key unless query performance later requires it.

## RLS contract

- `organization_memberships`: an authenticated user can read their own membership rows. P0 client writes are disabled.
- `organizations`: an authenticated user can read organizations where they have an active membership.
- tenant-owned commercial tables: active membership in `organization_id` is the authorization boundary.
- `commercial_review_queue`: active members can SELECT and UPDATE within the organization.
- private knowledge: active membership in the associated organization grants visibility.
- `access_scope = 'global'` knowledge remains visible to authenticated users independently of tenant membership.
- worker staging/jobs that are internal-only remain denied to browser roles; service role performs persistence.

Cross-tenant access must remain denied even if a caller knows another row UUID.

## Service / API context

Web server actions resolve the active organization from the authenticated Supabase user. The server, not the browser, sends organization context to the internal worker.

Worker request context evolves from:

```text
owner_id
```

to:

```text
owner_id        # authenticated user / provenance
organization_id # tenant authorization / data partition
```

Internal worker token remains required.

## Storage contract

The private `commercial-uploads` bucket remains non-public and service-role controlled in P0. New object paths should be organization-prefixed:

```text
organizations/<organization_id>/jobs/<job_id>/<filename>
```

Legacy objects remain readable by service role and are not mass-moved during P0.2.

## RPC migration strategy

Owner-scoped RPCs are retained temporarily for rollback compatibility, while organization-scoped equivalents are introduced and the worker switches to them:

- latest offered price
- price history
- offers without order
- commercial search
- hybrid knowledge retrieval
- knowledge ingestion

After the application no longer calls owner-scoped RPCs and tenant acceptance tests pass, the legacy RPCs can be deprecated in a later cleanup migration.

## Backfill rules

1. Collect distinct non-null legacy `owner_id` values from tenant-owned tables.
2. Create one deterministic default organization row per owner if no mapping exists.
3. Create active admin membership for that owner.
4. Populate each row's `organization_id` through the owner→organization mapping.
5. Global/internal rows with no owner stay organization-null where appropriate.
6. Do not make nullable legacy tables `organization_id NOT NULL` until data-quality checks prove all private rows are assigned.

## Acceptance tests

P0.2 is complete only when all of the following hold:

1. User A can read their organization data.
2. User B in the same organization can read the same tenant data.
3. User C in another organization cannot read it, even by direct UUID.
4. A removed/suspended member loses access.
5. Global knowledge remains visible according to its global scope.
6. Private knowledge is visible only to organization members.
7. Uploads persist `organization_id` from web → worker job → commercial dataset/observations → knowledge source/document.
8. Assistant/RAG and commercial queries return organization data, not only data created by the current user.
9. Browser roles cannot read worker staging/jobs or service-only evaluation tables.
10. Existing legacy archive remains queryable after migration.

## Rollout

1. Land schema + backfill + tenant-aware policies/RPCs behind a PR.
2. Validate SQL in an isolated Supabase branch before production migration.
3. Run cross-tenant SQL/integration tests.
4. Update web and worker context propagation.
5. Run worker/frontend CI and golden retrieval regression.
6. Apply migration to production.
7. Run P0.2 security acceptance and Supabase security advisor checks.

No production DDL should be applied before step 2 is available or an equivalent isolated validation environment is explicitly approved.