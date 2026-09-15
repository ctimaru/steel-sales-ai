# M5.8 — Retrieval / RAG production baseline

This file is populated after the persisted production run of the Golden Query Set v1 harness.

The baseline run must use:

```bash
python -m app.evaluation_cli --set-version v1 --rag --persist
```

The corrected production baseline rerun was triggered from `main` on 2026-09-15 after PR #37 aligned broad semantic relevance and extractive-fallback citation validation with the evaluation contract.

Metrics below remain intentionally empty until the corrected persisted run completes in `retrieval_evaluation_runs`.
