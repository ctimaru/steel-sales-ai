# M5.5 Hybrid Retrieval API

## Goal

M5.5 exposes an owner-scoped knowledge retrieval layer that combines:

- semantic vector similarity using the single active embedding model;
- PostgreSQL full-text search;
- canonical entity resolution from M5.4;
- structured commercial filters;
- Reciprocal Rank Fusion (RRF);
- source/document/chunk provenance suitable for downstream RAG.

The active production model is currently `multilingual-e5-large-instruct-v1` (1024 dimensions).

## Endpoint

`POST /v1/knowledge/search`

The endpoint is protected by `WORKER_INTERNAL_TOKEN`, like the other internal worker routes.

Example request shape:

```json
{
  "owner_id": "<authenticated-owner-id>",
  "query": "Trova ordini S355J2H EN 10219 spessore 8 mm",
  "limit": 10,
  "candidate_count": 60,
  "entity_filters": {
    "grade": ["S355J2H"],
    "standard": ["EN 10219"]
  },
  "commercial_filters": {
    "item_role": "ordered",
    "thickness_mm": 8
  }
}
```

### Entity filters

Supported canonical entity dimensions:

- `company`
- `plant`
- `country`
- `standard`
- `product_family`
- `grade`
- `process`
- `application`

Values are resolved against canonical entity keys and aliases. Different entity types are combined with AND semantics; multiple values inside one type use OR semantics.

### Commercial filters

Supported structured fields:

- `item_role`: `requested | offered | ordered | delivered`
- `outer_diameter_mm`
- `width_mm`
- `height_mm`
- `thickness_mm`
- `length_mm`

Commercial filters are checked against `commercial_observations` linked to a chunk through historical `source_locator.observation_id` or M5.4 entity mentions.

## Query intent inference

If `item_role` is omitted, the worker can infer it from unambiguous Italian/English query language:

- offerte / quote / quotation -> `offered`
- ordini / order -> `ordered`
- consegne / deliveries -> `delivered`
- richieste / RFQ / request -> `requested`

Inference is conservative. If more than one role family is present, no automatic role filter is applied.

Clients can disable this with `infer_item_role: false`.

## Semantic query embedding

The worker loads the unique model whose status is `active` from `knowledge_embedding_models`.

For E5, the query uses the model's configured `query_prefix` before embedding. The vector is validated against the active model dimensions before the database search is called.

## Full-text search

`knowledge_chunks.search_vector` is a stored `tsvector` generated with PostgreSQL `simple` configuration and indexed with GIN.

The retrieval query uses a relaxed OR tsquery generated from the lexemes in the user's text. This is intentional: natural-language words such as “trova” or “offerte” must not make lexical recall collapse when the underlying chunk contains the technical terms but not every query word.

## Entity signal

M5.5 automatically recognizes canonical entity names and aliases inside the normalized query. Product-family aliases include common Italian and English phrases such as:

- `tubi rettangolari` / `rectangular tubes`
- `tubi quadri` / `square tubes`
- `tubi tondi` / `round tubes`

Matched query entities are compared to M5.4 chunk entity mentions and contribute an entity relevance signal.

## Ranking

The database independently builds vector and lexical candidate lists, then combines them with Reciprocal Rank Fusion.

Default parameters:

- returned matches: `10`
- candidate pool per channel: `60`
- RRF `k`: `60`

Canonical query-entity matches add a deterministic relevance boost after the two retrieval channels are fused.

The API returns the individual scoring components for observability:

- `vector_similarity`
- `lexical_score`
- `entity_match_count`
- `rrf_score`
- `matched_entities`

## Provenance

Every result includes enough information for M5.6+ answer grounding:

- `chunk_id`
- `source_id`
- `document_id`
- chunk text
- language
- document title / filename / type
- source name / class / URI
- page range
- section path
- `source_locator`
- chunk metadata

## Owner isolation

The service-role RPC explicitly restricts sources to:

- global knowledge sources; or
- owner-scoped sources whose `owner_id` equals the requested owner.

Structured commercial filters also require the linked `commercial_observation.owner_id` to match the same owner.

## Production validation

The SQL layer was validated against the current corpus before exposing the worker endpoint.

Validation cases include:

1. Italian natural query `Trova offerte S355J2H EN 10219 tubi rettangolari`:
   - relaxed lexical search produces non-null FTS scores;
   - canonical query entities resolve grade, standard and `Rectangular Tube`.
2. Structured query with `ordered + S355J2H + EN 10219 + thickness 8`:
   - 10 results returned;
   - 10/10 independently verified against `commercial_observations` as `ordered` and `thickness_mm = 8`.

## Runtime composition

The existing worker application remains in `app.main`.

M5.5 adds `app.server`, which imports the existing FastAPI app and includes the retrieval router. Railway/Uvicorn now serves `app.server:app`; existing routes and health checks remain unchanged.
