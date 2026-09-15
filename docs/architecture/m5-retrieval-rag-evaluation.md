# M5.8 — Automated Retrieval / RAG Evaluation

The M5.8 harness evaluates the immutable `Golden Query Set v1` against the production retrieval and grounded-RAG stack.

## Scope

The 52-case Golden set is evaluated in two layers:

- **Retrieval:** all 44 positive cases use their expected entity/commercial/document filters as oracle filters. The active embedding model embeds all 52 queries in one batch and hybrid RRF search is measured at top 5 / top 10.
- **Runtime RAG:** the 12 semantic, 4 negative and 4 security cases are passed through the real `answer_knowledge_rag` path. A pre-embedded retriever preserves the runtime filter parsing while avoiding a second embedding call.
- The 32 structured cases are intentionally not forced through RAG because production routes them through deterministic commercial tools.

## Metrics

Retrieval metrics:

- Recall@5 and Recall@10
- MRR@10
- Hit@5 and Hit@10
- document Hit@10
- IT vs EN Recall@10 and absolute cross-language delta
- provenance completeness
- embedding latency / query
- retrieval mean and p95 latency

RAG and safety metrics:

- semantic RAG supported rate (`found` + gold evidence hit)
- negative fail-closed rate
- citation validity rate
- detected security fabrication rate
- RAG mean and p95 latency
- per-case pass/failure reasons

Security cases are safe only when the answer refuses/fails closed or remains citation-grounded. Numeric/percentage literals requested by an adversarial prompt are also checked: a literal absent from evidence but repeated by the answer is treated as detected fabrication.

## Initial quality gates

The harness reports, but does not automatically block deployment unless the CLI is run with `--enforce`:

- positive Hit@10 >= 0.90
- positive MRR@10 >= 0.50
- IT/EN Recall@10 delta <= 0.10
- provenance completeness = 1.00
- negative fail-closed rate = 1.00
- citation validity = 1.00
- detected security fabrication rate = 0.00

These gates are deliberately separate from the historical M5.2 embedding-model benchmark: they test the full hybrid retrieval + grounded-answer behavior.

## Persistence

`retrieval_evaluation_runs` stores aggregate configuration, metrics and quality-gate outcome. `retrieval_evaluation_case_results` stores each Golden case result, failure reasons and latency. Both tables and the Golden owner-resolution RPC are service-role only.

## CLI

From `services/worker`:

```bash
python -m app.evaluation_cli --set-version v1 --rag --persist
```

Add `--include-cases` to print every per-case result, or `--enforce` to return a non-zero exit code when a quality gate fails.

A production baseline run should always use `--rag --persist`; retrieval-only runs are useful for diagnostics but do not exercise the RAG safety gates.
