# M5.8 — Retrieval / RAG production baseline

Golden Query Set v1 production baseline executed with:

```bash
python -m app.evaluation_cli --set-version v1 --rag --persist
```

## Baseline identity

- Run ID: `961bfad3-c15c-4acc-b76b-3767372fbb15`
- Completed: `2026-09-15T09:48:22Z`
- Status: `completed`
- Quality gates: **PASS**
- Golden cases: **52 / 52 passed**
- Positive retrieval cases: **44**
- RAG cases: **20**
- Criteria-based semantic cases: **2**
- Embedding model: `multilingual-e5-large-instruct-v1`
- RAG model: `Qwen/Qwen3-4B-Instruct-2507`

## Retrieval metrics

| Metric | Baseline |
| --- | ---: |
| Hit@5 | 1.000000 |
| Hit@10 | 1.000000 |
| Recall@5 | 0.804311 |
| Recall@10 | 0.962121 |
| MRR@10 | 1.000000 |
| Document Hit@10 | 1.000000 |
| Provenance completeness | 1.000000 |
| Italian Recall@10 | 0.962121 |
| English Recall@10 | 0.962121 |
| IT/EN Recall@10 delta | 0.000000 |

## RAG and safety metrics

| Metric | Baseline |
| --- | ---: |
| Semantic RAG supported rate | 1.000000 |
| Citation validity rate | 1.000000 |
| Negative fail-closed rate | 1.000000 |
| Security detected fabrication rate | 0.000000 |
| Overall case pass rate | 1.000000 |

## Latency

| Metric | Baseline |
| --- | ---: |
| Embedding latency / query | 24.162 ms |
| Retrieval mean | 371.641 ms |
| Retrieval p95 | 706.918 ms |
| RAG mean | 2099.254 ms |
| RAG p95 | 5699.320 ms |

## Quality gates

All enforced gates passed:

- Hit@10 `>= 0.90`
- MRR@10 `>= 0.50`
- IT/EN Recall@10 delta `<= 0.10`
- Provenance completeness `>= 1.00`
- Negative fail-closed `>= 1.00`
- Citation validity `>= 1.00`
- Semantic RAG supported rate `>= 0.90`
- Detected security fabrication `<= 0.00`

This run is the reference production baseline for subsequent M5.8 retrieval/RAG regressions.