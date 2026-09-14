# M5.4 Entity Resolution

## Goal

M5.4 introduces a canonical entity layer between raw/structured commercial observations and the future hybrid retrieval/RAG stack.

Supported entity types:

- `company`
- `plant`
- `country`
- `standard`
- `product_family`
- `grade`
- `process`
- `application`

The current commercial corpus directly supplies `grade`, `standard`, and `product_type` (mapped to `product_family`). The remaining entity types are supported by the schema and generic resolver and can be populated by future external/global knowledge sources.

## Data model

### `knowledge_entities`

Canonical entity registry. Entities can be globally visible or owner-scoped, using the same access model as `knowledge_sources`.

Global examples:

- `grade / S355J2H`
- `standard / EN 10219`
- `product_family / Rectangular Tube`

Owner-scoped entities are intended for private company/plant/application knowledge.

### `knowledge_entity_aliases`

Maps observed names, synonyms, abbreviations, codes, and manual aliases to a canonical entity.

Entity keys and aliases use `normalize_knowledge_entity_value()` for deterministic comparison. Display names use `canonical_knowledge_entity_name()`.

### `knowledge_entity_mentions`

Connects canonical entities to provenance. A mention can be grounded in:

1. a `commercial_observation`;
2. a `knowledge_document`;
3. a `knowledge_chunk` when an exact chunk can be identified.

This allows the resolver to preserve commercial structure even when exact chunk grounding is unavailable.

### `knowledge_entity_bindings`

Bridge from canonical entities to owner-scoped global tube database rows:

- `companies`
- `products`

Bindings are exact-normalized in M5.4 v1. The table supports multiple canonical entity dimensions linking to the same product row (grade, standard, product family, manufacturing process).

## Resolution flow

`resolve_commercial_entities(thread_id, document_id, limit)`:

1. selects unresolved commercial observations;
2. creates/reuses global canonical grade, standard and product-family entities;
3. records observed aliases;
4. writes idempotent mentions linked to the commercial observation;
5. grounds mentions to historical archive chunks via `source_locator.observation_id` when available;
6. otherwise uses the worker knowledge document and attempts exact source-text-to-chunk grounding;
7. synchronizes available company/product bindings.

The resolver is idempotent. A second run over a fully resolved corpus returns zero selected observations and creates no duplicate rows.

## New-upload integration

`worker_jobs_resolve_entities_after_update` is an `AFTER UPDATE` trigger on `worker_jobs`.

When a worker job reaches `completed` with both `thread_id` and `knowledge_document_id`, it calls M5.4 resolution for that job. The trigger is best-effort: resolver errors are raised as PostgreSQL warnings and do not fail the core ingestion pipeline.

## Current production backfill

Initial M5.4 backfill over the existing corpus:

- commercial observations scanned: **1,350**
- canonical entities created: **19**
- aliases created: **19**
- entity mentions created: **2,598**
- mentions linked to commercial observations: **2,598 / 2,598**
- mentions additionally grounded to documents/chunks: **2,592 / 2,598**
- company/product bindings: **0** (expected: both source tables are currently empty)

Current canonical catalog contains:

- 12 grades
- 4 standards
- 3 product families

## Security

All M5.4 tables have RLS enabled.

- global entities and their aliases are readable by authenticated users;
- owner entities are visible only to their owner;
- mentions are visible through either their source visibility or the owning commercial observation;
- bindings are owner-scoped;
- write operations and resolver RPCs are service-role only.

## M5.5 contract

M5.5 Hybrid Retrieval can now combine:

- structured commercial filters;
- canonical entity IDs / aliases;
- full-text search;
- vector similarity against the active embedding model;
- provenance back to observation, document and chunk.

This entity layer should be used as the normalization/filter boundary rather than filtering raw grade/standard/product strings directly where possible.
