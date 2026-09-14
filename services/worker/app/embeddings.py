from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from typing import Any, Protocol

from huggingface_hub import InferenceClient

from .repository import WorkerRepository


class EmbeddingConfigurationError(RuntimeError):
    pass


class EmbeddingProviderError(RuntimeError):
    pass


class EmbeddingRepository(Protocol):
    async def get_chunks_needing_embedding(
        self, *, model_key: str, limit: int
    ) -> list[dict[str, Any]]: ...

    async def upsert_chunk_embeddings(self, rows: list[dict[str, Any]]) -> None: ...


class EmbeddingProvider(Protocol):
    async def embed(
        self,
        texts: list[str],
        *,
        model_name: str,
        normalize: bool,
    ) -> list[list[float]]: ...


@dataclass(frozen=True)
class EmbeddingBatchResult:
    model_key: str
    selected: int
    embedded: int
    skipped: int
    dimensions: int | None

    def as_dict(self) -> dict[str, object]:
        return {
            "model_key": self.model_key,
            "selected": self.selected,
            "embedded": self.embedded,
            "skipped": self.skipped,
            "dimensions": self.dimensions,
        }


class HuggingFaceEmbeddingProvider:
    """Feature-extraction adapter for Hugging Face Inference Providers."""

    def __init__(self) -> None:
        token = os.getenv("HF_TOKEN", "").strip()
        if not token:
            raise EmbeddingConfigurationError("HF_TOKEN is required for embedding inference.")
        provider = os.getenv("HF_INFERENCE_PROVIDER", "auto").strip() or "auto"
        self.client = InferenceClient(api_key=token, provider=provider)

    async def embed(
        self,
        texts: list[str],
        *,
        model_name: str,
        normalize: bool,
    ) -> list[list[float]]:
        if not texts:
            return []
        try:
            output = await asyncio.to_thread(
                self.client.feature_extraction,
                texts,
                model=model_name,
                normalize=normalize,
            )
        except Exception as exc:  # provider SDK exposes several transport-specific errors
            raise EmbeddingProviderError(f"Embedding inference failed: {exc}") from exc

        converted = output.tolist() if hasattr(output, "tolist") else output
        if not isinstance(converted, list):
            raise EmbeddingProviderError("Embedding provider returned an invalid payload.")
        if converted and converted[0] and isinstance(converted[0][0], list):
            raise EmbeddingProviderError(
                "Embedding provider returned token-level vectors instead of sentence vectors."
            )
        try:
            return [[float(value) for value in vector] for vector in converted]
        except (TypeError, ValueError) as exc:
            raise EmbeddingProviderError("Embedding vectors contain invalid values.") from exc


def _prepare_text(content: str, config: dict[str, Any]) -> str:
    prefix = str(config.get("passage_prefix") or "")
    return f"{prefix}{content}" if prefix else content


async def run_embedding_batch(
    *,
    model_key: str,
    limit: int = 32,
    repository: EmbeddingRepository | None = None,
    provider: EmbeddingProvider | None = None,
) -> EmbeddingBatchResult:
    if not model_key.strip():
        raise ValueError("model_key is required.")
    if limit < 1 or limit > 128:
        raise ValueError("limit must be between 1 and 128.")

    repo = repository or WorkerRepository()
    rows = await repo.get_chunks_needing_embedding(model_key=model_key, limit=limit)
    if not rows:
        return EmbeddingBatchResult(
            model_key=model_key,
            selected=0,
            embedded=0,
            skipped=0,
            dimensions=None,
        )

    first = rows[0]
    model_id = str(first["model_id"])
    model_name = str(first["model_name"])
    expected_dimensions = int(first["dimensions"])
    normalize = bool(first.get("normalized", True))
    config = first.get("config") or {}
    if not isinstance(config, dict):
        config = {}

    for row in rows:
        if str(row["model_id"]) != model_id or str(row["model_name"]) != model_name:
            raise RuntimeError("Embedding batch mixed multiple model definitions.")

    texts = [_prepare_text(str(row["content"]), config) for row in rows]
    embedder = provider or HuggingFaceEmbeddingProvider()
    vectors = await embedder.embed(texts, model_name=model_name, normalize=normalize)
    if len(vectors) != len(rows):
        raise EmbeddingProviderError(
            f"Embedding provider returned {len(vectors)} vectors for {len(rows)} chunks."
        )

    output_rows: list[dict[str, Any]] = []
    for row, vector in zip(rows, vectors, strict=True):
        if len(vector) != expected_dimensions:
            raise EmbeddingProviderError(
                f"Model {model_key} returned {len(vector)} dimensions; expected {expected_dimensions}."
            )
        output_rows.append(
            {
                "source_id": str(row["source_id"]),
                "document_id": str(row["document_id"]),
                "chunk_id": str(row["chunk_id"]),
                "model_id": model_id,
                "model_key": model_key,
                "embedding": vector,
                "embedding_dimensions": expected_dimensions,
                "content_checksum": str(row["content_checksum"]),
                "metadata": {
                    "model_name": model_name,
                    "model_revision": first.get("model_revision"),
                    "provider": "huggingface",
                },
            }
        )

    await repo.upsert_chunk_embeddings(output_rows)
    return EmbeddingBatchResult(
        model_key=model_key,
        selected=len(rows),
        embedded=len(output_rows),
        skipped=0,
        dimensions=expected_dimensions,
    )
