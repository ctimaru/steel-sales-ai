# M5.1 — Knowledge schema and provenance contract

M5.1 establishes the persistent knowledge layer used by Semantic Search, grounded RAG and the future Global Tube Intelligence Database.

## Source of truth

PostgreSQL remains the source of truth. Vector embeddings introduced in M5.2 are derived indexes over `knowledge_chunks`; they are never authoritative records.

The lineage is:

`knowledge_sources -> knowledge_documents -> knowledge_chunks -> knowledge_evidence`

Every document, chunk and evidence row is therefore traceable to one source.

## Access model

`knowledge_sources.access_scope` has two values:

- `owner`: private knowledge belonging to exactly one authenticated user (`owner_id` is required).
- `global`: curated/shared knowledge (`owner_id` must be null).

Access scope is defined only on the source. Child rows carry `source_id`, and composite foreign keys keep document/chunk/evidence lineage consistent.

Authenticated clients receive read-only access through RLS:

- a user can read their own `owner` sources and descendants;
- every authenticated user can read `global` sources and descendants;
- browser roles cannot write to the knowledge tables;
- ingestion/curation writes are service-role-only and must stay server-side.

This intentionally separates private commercial knowledge from future shared Tube Intelligence data.

## Tables

### `knowledge_sources`

Registry of provenance sources. Important fields include source key/type/class, provider, URI, country/language, licence, trust score and arbitrary metadata.

`source_class` distinguishes `internal`, `official`, `primary`, `secondary` and `inferred` sources. The class describes provenance, not truth: confidence is still recorded on evidence.

### `knowledge_documents`

A versioned document inside a source. It stores document type, MIME/storage information, checksum, version, language, publication/validity dates, extraction metadata and lifecycle status.

Identical content in the same source is deduplicated by `(source_id, checksum_algorithm, content_checksum)`. `supersedes_document_id` allows explicit version history without overwriting prior evidence.

### `knowledge_chunks`

Deterministic text units generated from a document. Each chunk preserves ordinal position, checksum, optional character/page ranges, section path and structured `source_locator` metadata.

The locator is designed to hold source-specific coordinates such as email/thread identifiers, PDF pages, Excel sheets/cells or catalog sections.

### `knowledge_evidence`

Grounded facts/quotes/table cells/metadata extracted from a document or chunk. Evidence can carry a provisional subject/predicate/object representation before canonical entity resolution exists.

Important fields include evidence text/value, confidence, extraction method/version, review state and temporal validity.

M5.4 will introduce canonical entities and explicit entity relationships; M5.1 deliberately avoids locking evidence to an unfinished ontology.

## Invariants

- Private and global knowledge cannot share the same access state accidentally: the source owns the scope.
- Chunks must belong to the same source as their document.
- Evidence must belong to the same source/document as its optional chunk.
- Validity end dates cannot precede start dates.
- Confidence/trust values are bounded to `[0,1]`.
- Browser/authenticated access is read-only; writes are performed by trusted server-side ingestion.
- Every derived semantic/vector representation must remain reproducible from document/chunk content and version metadata.

## Future compatibility

The model is intentionally generic enough to ingest:

- internal email archives, offers, orders and attachments;
- technical PDFs and certificates;
- standards and country-specific regulatory material;
- producer catalogs and dimensional capability tables;
- company/plant/product evidence for Global Tube Intelligence.

A future query such as “which European plants produce seamless API 5L above 500 mm?” can combine structured entity filters with semantic evidence while retaining the original source and exact document location.
