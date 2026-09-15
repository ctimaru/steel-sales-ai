# M5.7 AI Assistant RAG grounded on the knowledge layer

## Goal

M5.7 integrates the M5 semantic retrieval layer into the existing AI Assistant without replacing the deterministic commercial tools built in M3/M4.

The assistant now has two grounded execution paths:

1. **Structured tools** for prices, price history, commercial observations, open offers and market overlays.
2. **Knowledge RAG** for questions about emails, documents, specifications, certificates, clauses and other source text.

A structured answer is still computed from owner-scoped database queries. A document answer can only be synthesized from chunks returned by the M5.5 hybrid retrieval layer.

## Routing

`services/worker/app/assistant_market.py` remains the public assistant orchestrator used by `POST /v1/ai/assistant`.

Routing order:

- explicit document/source language, or a follow-up to a previous RAG turn -> `answer_knowledge_rag`;
- market language -> existing market overlay path;
- supported commercial intent -> existing structured commercial path;
- previously unsupported natural-language question -> one knowledge retrieval attempt;
- if retrieval/generation cannot support the answer -> explicit insufficient-evidence response.

This preserves deterministic behavior for requests such as latest price or orders while broadening the assistant to unstructured knowledge.

## Retrieval

The RAG path calls the same `search_knowledge` function used by M5.5:

- owner id comes from the authenticated request;
- active multilingual embedding model is used for semantic search;
- PostgreSQL FTS and entity signals are fused with vector candidates;
- grade and exact commercial dimensions parsed from the user question are forwarded as structured filters when available;
- role terms such as offers/orders/deliveries are also forwarded as structured commercial filters.

Default RAG retrieval parameters:

- returned candidates: `8`;
- candidate pool per retrieval channel: `60`;
- RRF `k`: `60`;
- source evidence exposed to the generator: first `6` candidates.

A weak-retrieval gate fails closed when the top candidates contain no lexical/entity signal and their vector similarity is below `RAG_MIN_VECTOR_SIMILARITY` (default `0.55`).

## Generation

Generation uses the existing Railway `HF_TOKEN` through `huggingface_hub.InferenceClient`.

Default generation model:

`Qwen/Qwen3-4B-Instruct-2507`

The model can be changed server-side with:

`RAG_LLM_MODEL=<hugging-face-model-id>`

Provider routing can be overridden with:

`RAG_INFERENCE_PROVIDER=<provider>`

The default provider is `auto`.

The prompt treats all retrieved source text as **untrusted data**. Instructions contained inside a retrieved email/document are never treated as assistant instructions.

Generation rules require:

- no external knowledge;
- no claims beyond retrieved evidence;
- every factual sentence must end in one or more `[S#]` citations;
- any inference must be explicitly labelled `Inferenza:` / `Inference:` and cite its supporting evidence;
- if evidence cannot answer the question, the model must return the sentinel `EVIDENCE_INSUFFICIENT`.

## Post-generation grounding gate

The worker does not trust the model response solely because it was prompted correctly.

After generation it verifies that:

- at least one citation exists;
- every cited id belongs to the evidence set passed to the model;
- every substantial sentence contains a citation.

If validation fails, or if the provider is unavailable, the worker returns an **extractive fallback** built only from retrieved evidence. It never replaces a failed generation with an ungrounded free-form answer.

If the model returns `EVIDENCE_INSUFFICIENT`, the API returns `found=false` and an explicit insufficient-evidence message.

## Response contract

RAG responses retain the existing assistant fields and add:

- `intent = knowledge_rag`;
- `evidence[]` with stable citation ids (`S1`, `S2`, ...), chunk text and full provenance;
- `grounding.mode`;
- `grounding.status` (`grounded`, `extractive_fallback`, `insufficient_evidence`);
- generator/model metadata;
- retrieval and embedding-model metadata;
- validated citation ids.

Each evidence object includes the source/document/chunk identifiers, title/filename, source URI, page/section location, source locator, scoring components and matched entities.

Structured assistant responses also receive a `grounding` descriptor so the UI can visibly distinguish deterministic database answers from document synthesis.

## Multi-turn RAG

RAG context stores the resolved `knowledge_query`.

When a follow-up begins with language such as `e ...`, `e per ...`, `solo ...`, `invece ...`, `stesso ...`, the previous knowledge query is prepended before retrieval. This keeps document follow-ups grounded without pretending that the language model has hidden conversational memory.

## Frontend

The existing `/assistant` page remains the single assistant experience.

For RAG turns it now renders:

- `Knowledge RAG` intent badge;
- `Sintesi da evidence`, `Fallback estrattivo` or `Evidence insufficiente` status;
- visible `[S1]`, `[S2]` citations in the answer;
- source cards whose citation ids match the answer;
- document metadata, provenance, semantic score and matched-entity count;
- direct link to the original internal conversation/thread or external source URI when available.

Structured commercial source cards continue to render separately and are labelled as deterministic data.

## Security boundaries

- Browser never receives `HF_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` or `WORKER_INTERNAL_TOKEN`.
- Vercel derives `owner_id` from the verified Supabase Auth session and calls Railway server-to-server.
- Retrieval is owner-scoped inside the M5.5 database function.
- Source text is explicitly treated as untrusted prompt data.
- Generation has a fail-closed citation validator and extractive fallback.

M5.8 remains responsible for adversarial prompt-injection tests, golden-query evaluation, filtered-retrieval recall and broader security/retrieval regression coverage.
