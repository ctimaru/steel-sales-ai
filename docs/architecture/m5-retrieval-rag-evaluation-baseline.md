# M5.8 — Retrieval / RAG production baseline

This file is populated after the first persisted production run of the Golden Query Set v1 harness.

The baseline run must use:

```bash
python -m app.evaluation_cli --set-version v1 --rag --persist
```

Do not edit baseline metrics manually before a persisted production run exists in `retrieval_evaluation_runs`.
