# M5.2 — pgvector and multilingual embeddings contract

M5.2 adds vector search as a derived index over `knowledge_chunks`. PostgreSQL text, checksums and provenance remain authoritative.

## Storage model

- `knowledge_embedding_models` is the versioned registry of embedding models.
- `knowledge_chunk_embeddings` stores one derived embedding per `(chunk_id, model_id)`.
- The chunk `content_checksum` is copied into the embedding row so stale vectors can be detected without trusting timestamps.
- Embeddings are service-role only. Browser roles do not receive direct vector-table access.
- Model rows remain `candidate` until an explicit benchmark promotes one model to `active`.
- Only one model may be active at a time.

The embedding column is intentionally dimension-agnostic. Each candidate has its own partial HNSW cosine index with an explicit cast to its dimensionality. This lets M5.2 compare models with different dimensions without rebuilding the knowledge schema.

## Candidate set

The first benchmark gate compares three commercially usable multilingual baselines:

| model key | model | dims | role |
| --- | --- | ---: | --- |
| `baai-bge-m3-v1` | `BAAI/bge-m3` | 1024 | quality / long-context challenger |
| `multilingual-e5-base-v1` | `intfloat/multilingual-e5-base` | 768 | balanced retrieval candidate |
| `multilingual-minilm-l12-v2` | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | 384 | latency / low-resource candidate |

Jina Embeddings v3 is not in the default candidate set because its Hugging Face model card is CC BY-NC 4.0; Steel Sales AI is a commercial project and should not silently depend on a non-commercial model license.

## Benchmark gate

Do not choose the production model from public leaderboard scores alone. Run an IT/EN steel-domain retrieval set after M5.3 has populated representative chunks.

Minimum query families:

1. exact commercial dimensions and grade: `P265GH 406.4 x 6.3`, `L275 323.9 x 7.1`;
2. cross-language retrieval: Italian query -> English document and English query -> Italian document;
3. standards and product families: EN 10224, API 5L, seamless/welded, boiler/pressure tubes;
4. producer/plant capability questions;
5. noisy email language, abbreviations and decimal-comma variants;
6. negative controls where near-looking dimensions or grades must rank lower.

Record at least Recall@5, MRR@10, latency per query, model memory footprint and embedding throughput. Prefer the smallest model whose retrieval quality stays within the accepted quality margin of the best candidate.

The initial M5.2 harness builds deterministic bilingual benchmark cases from real `commercial_observations` linked back to `knowledge_chunks`. The runner records standard Recall@5, MRR@10, Hit@5, query-embedding throughput, mean/p95 vector-search latency and estimated total query latency. A default quality margin of 0.03 is used when recommending the smallest acceptable model.

## Operational benchmark command

The worker exposes the benchmark as a module CLI so it can run only in the trusted server environment where Supabase service-role and provider credentials are available:

```bash
python -m app.embedding_benchmark_cli \
  --fill \
  --case-limit 40 \
  --match-count 10 \
  --quality-margin 0.03 \
  --include-cases
```

`--fill` repeatedly calls the incremental embedding pipeline before evaluation. The default candidate list is the three models above. `HF_TOKEN` must be configured server-side; it must never be exposed to the browser. A final run may add `--activate-recommended`, which uses the service-role-only `activate_embedding_model` RPC to atomically promote the recommendation after the benchmark completes. Do not activate a model from incomplete embeddings or a partial benchmark run.

Provider-hosted inference means worker memory is not a meaningful proxy for model resident memory. For the remote-provider benchmark, record dimensions, provider latency and throughput; if Steel Sales AI later self-hosts an embedding model, add measured resident memory/GPU memory to the same evaluation record.

## Incremental and re-embedding semantics

For model `M`, a chunk needs embedding when no `(chunk_id, M)` row exists or when the stored `content_checksum` differs from the current chunk checksum. This makes normal ingestion idempotent and supports controlled re-embedding.

Re-embedding a new model version must create a new registry row/model key and new derived rows. Do not overwrite historical embeddings in-place until the replacement model has passed evaluation. When a model is retired, its rows may be removed in a later maintenance job without affecting source knowledge.

## Index strategy

HNSW with cosine distance is the default ANN index. Supabase currently recommends HNSW over IVFFlat for robustness as data changes. M5.5 will add the retrieval API and will own query-time tuning and hybrid structured/FTS/vector ranking.
