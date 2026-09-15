# P0.7 — Entity Resolution Production Hardening

## Objective

P0.7 upgrades the M5.4 entity layer from a validated prototype to a production contract for the Steel Knowledge Graph.

The rule is deliberately conservative:

> Resolve deterministically when evidence is exact. Never auto-merge entities because they merely look similar.

This matters for steel data because names, grades, standards, plants and companies can differ by a single token while representing materially different commercial objects.

## Resolver contract

Resolver version: `p0.7-v2`.

The commercial resolver continues to extract canonical entities from:

- `grade`;
- `standard`;
- `product_type` → `product_family`.

Company, plant, country, process and application remain supported entity types for later data sources.

### Canonical identity

`canonical_knowledge_entity_key(type, value)` is now the normalization boundary.

For steel-specific entity types it reuses P0.4 primitives:

- grades → `canonical_steel_token()`;
- standards → `canonical_steel_token()`;
- processes → `canonical_steel_token()`;
- product families → `canonical_tube_family()` + steel token when the family is recognizable.

Examples:

- `EN 10224` = `EN10224` → `en10224`;
- `S355 J2H` = `S355J2H` → `s355j2h`;
- `CHS` → `roundtube`;
- `RHS` → `rectangulartube`.

This aligns entity resolution with the deterministic `tube:v1` identity introduced by P0.4.

## Confidence

M5.4 v1 wrote commercial entity mentions with confidence `1` regardless of parser confidence.

P0.7 removes that overclaim. For an entity extracted from a commercial observation:

`mention.confidence = source observation confidence`

bounded to `[0,1]`.

The original observation confidence is also persisted in mention metadata.

Historical M5.4 commercial mentions are upgraded in place to `p0.7-v2`, preserving stable mention IDs and reducing confidence where the source itself was uncertain.

Observed alias confidence is recalculated from the strongest grounded mention for that alias. Curated synonyms/manual aliases are not downgraded.

## Tenant-safe provenance

An explicit `p_document_id` can only be supplied together with `p_thread_id`.

The document is accepted only when its source is either:

- global; or
- owned by the same organization as the commercial thread.

Cross-tenant explicit grounding fails closed before any entity rows are created.

Automatic grounding follows the same rule for archive chunks and worker knowledge documents.

Mention metadata records:

- organization;
- source field;
- source observation confidence;
- canonical product ID when available;
- grounding method;
- resolver contract.

## Private entity identity

Legacy M5.4 private entities used the individual owner as the uniqueness boundary.

P0.7 moves private canonical identity to the tenant boundary:

`organization_id + entity_type + canonical_key`

`owner_id` remains creator/provenance information, but two users in the same company can no longer create two separate private canonical entities for the same object.

## Alias governance

Aliases remain normalized from their observed text so evidence is preserved.

A database guard rejects an alias when the same normalized alias would map to two different entities with:

- the same entity type; and
- the same visibility scope (global or the same private organization).

Aliases with the same spelling may still exist across different entity types or across different private organizations.

Ambiguity is therefore surfaced rather than silently merged.

## Merge governance

P0.7 introduces `merge_knowledge_entities(source, target, reason)`.

The operation is:

- explicit only;
- service-role only;
- atomic;
- audited;
- restricted to the same entity type;
- restricted to the same access scope;
- for private entities, restricted to the same organization.

It migrates aliases, mentions and bindings, removes duplicate edges, writes an immutable merge audit snapshot and then removes the source entity.

There is intentionally no fuzzy or automatic merge path in P0.7.

## Security

The following internal operations now run as `SECURITY INVOKER`:

- `resolve_commercial_entities`;
- `sync_knowledge_entity_bindings`;
- `merge_knowledge_entities`;
- worker entity-resolution trigger function;
- entity-resolution health RPC.

Resolver, binding, merge and health RPCs revoke execution from `PUBLIC`, `anon` and `authenticated`; application execution remains service-role only.

The merge audit table has RLS enabled and is not exposed to authenticated/anon roles.

## Production health contract

`entity_resolution_health()` reports:

- duplicate canonical identities;
- alias collisions;
- cross-tenant groundings;
- confidence overclaims;
- stale resolver versions;
- unresolved commercial fields;
- malformed private scope;
- canonical-key mismatches;
- informational ungrounded-to-chunk count;
- entity/alias/mention/binding totals.

`critical_issue_count = 0` is the P0.7 acceptance condition.

Ungrounded-to-chunk mentions are informational because an observation itself remains valid provenance when a historical exact chunk is unavailable.

## CI acceptance

`supabase/tests/p0_entity_resolution.sql` verifies:

1. P0.4-aligned canonicalization;
2. service-role-only / security-invoker contract;
3. organization-scoped private identity;
4. ambiguous alias rejection;
5. explicit audited merge;
6. source confidence propagation;
7. cross-tenant document rejection;
8. same-tenant document/chunk grounding;
9. idempotent second resolution;
10. zero critical issues from the health contract.

The P0 Foundation workflow runs P0.7 after the existing P0.2, P0.4 and P0.6 acceptance gates, followed by database lint and the complete worker/RAG regression suite.
