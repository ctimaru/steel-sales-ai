# M5.6 Semantic Search UI / Knowledge Explorer

## Goal

M5.6 exposes the M5 knowledge layer as an authenticated web experience inside the existing Steel Sales AI Next.js workspace.

The UI is intentionally part of the main product rather than a standalone search demo. It is the first user-facing surface of the future Tube Intelligence experience.

## Route

`/knowledge-explorer`

The workspace navigation contains a dedicated **Knowledge Explorer** entry.

## Security model

The browser never receives worker, Hugging Face or Supabase service-role secrets.

The flow is:

1. the authenticated Next.js server action reads the verified Supabase Auth claims;
2. `owner_id` is derived server-side from the session and cannot be supplied by the browser;
3. the server action calls the Railway worker using `WORKER_URL`;
4. `WORKER_INTERNAL_TOKEN` is attached only on the server-to-server request;
5. the worker performs the owner-scoped M5.5 retrieval.

This mirrors the existing secure upload pattern.

## Search experience

The primary input is a free-form Italian/English query. Examples include:

- `Trova offerte S355J2H EN 10219 tubi rettangolari`
- `Ordini EN 10224 L275 spessore 7,1 mm`
- `Tubi P265GH diametro 406,4 mm disponibili`

The UI exposes the following structured filters.

### Canonical entity filters

- company
- grade/material
- standard
- product family
- country

### Commercial filters

- item role (`requested`, `offered`, `ordered`, `delivered`)
- outer diameter
- width
- height
- thickness
- length

When role is not explicitly selected, the conservative M5.5 query-intent inference remains enabled.

### Source/document filters

- source class
- source type
- document type
- title / filename / source-name text
- date from
- date to

M5.6 adds `hybrid_search_knowledge_filtered`, a service-role-only wrapper around the M5.5 retrieval RPC, so these filters preserve the same owner isolation and provenance contract.

## Results

Results are grouped by `document_id` and render individual evidence chunks beneath each document.

Each evidence card exposes:

- source class and document type;
- language;
- document title / filename;
- chunk content;
- page and section path where available;
- matched canonical entities;
- vector similarity;
- full-text score;
- entity match count;
- final RRF score.

The UI also shows the active filters returned by the worker, making retrieval behavior observable.

## Opening the source

The result header chooses the most useful source target available:

1. an HTTP(S) `source_uri` opens the original external source;
2. otherwise a `source_locator.thread_id` opens the internal Steel Sales AI conversation route;
3. if neither is present, the evidence remains inspectable in the Knowledge Explorer without inventing a source link.

## Document-aware retrieval extension

The new RPC `hybrid_search_knowledge_filtered` accepts:

- `source_class`
- `source_type`
- `document_type`
- `document_id`
- `document_query`
- `date_from`
- `date_to`

The date field uses the first available timestamp in this order:

`published_at -> fetched_at -> extracted_at -> created_at`

The wrapper requests up to 50 ranked M5.5 matches before applying document/source filters and then returns the requested top N.

This is deliberately a low-risk M5.6 extension for the current ~1.3k-chunk corpus. Because document filtering occurs after the inner top-50 retrieval, M5.8 should include filtered-query recall tests and move the document predicates into the base candidate-selection CTE if evaluation shows measurable recall loss at larger corpus sizes.

## Production validation

The document-aware RPC was validated on the production corpus without consuming a new Hugging Face inference call by using an already stored active-model vector.

Test case:

- query: `S355J2H EN 10219 Bologna`
- `source_class = internal`
- `document_query = Bologna`
- requested matches: 10

Result: 10/10 returned rows had `source_class = internal` and titles/filenames matching Bologna.

## Runtime configuration

The web runtime needs:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `WORKER_URL`
- `WORKER_INTERNAL_TOKEN`

The last two are server-only and must never be exposed as `NEXT_PUBLIC_*` variables.
