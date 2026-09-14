import asyncio

import pytest

from app.embeddings import EmbeddingProviderError, run_embedding_batch


class FakeRepository:
    def __init__(self, rows):
        self.rows = rows
        self.saved = []
        self.calls = []

    async def get_chunks_needing_embedding(self, *, model_key: str, limit: int):
        self.calls.append((model_key, limit))
        return self.rows

    async def upsert_chunk_embeddings(self, rows):
        self.saved.extend(rows)


class FakeProvider:
    def __init__(self, vectors):
        self.vectors = vectors
        self.calls = []

    async def embed(self, texts, *, model_name: str, normalize: bool):
        self.calls.append((texts, model_name, normalize))
        return self.vectors


def sample_rows():
    common = {
        "source_id": "11111111-1111-1111-1111-111111111111",
        "document_id": "22222222-2222-2222-2222-222222222222",
        "model_id": "33333333-3333-3333-3333-333333333333",
        "model_key": "multilingual-e5-base-v1",
        "model_name": "intfloat/multilingual-e5-base",
        "model_revision": None,
        "dimensions": 3,
        "normalized": True,
        "config": {"passage_prefix": "passage: "},
    }
    return [
        {
            **common,
            "chunk_id": "44444444-4444-4444-4444-444444444444",
            "content": "P265GH 406.4 x 6.3 EN 10224",
            "content_checksum": "checksum-a",
        },
        {
            **common,
            "chunk_id": "55555555-5555-5555-5555-555555555555",
            "content": "L275 323.9 x 7.1",
            "content_checksum": "checksum-b",
        },
    ]


def test_embedding_batch_is_incremental_and_persists_checksum() -> None:
    repo = FakeRepository(sample_rows())
    provider = FakeProvider([[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]])

    result = asyncio.run(
        run_embedding_batch(
            model_key="multilingual-e5-base-v1",
            limit=16,
            repository=repo,
            provider=provider,
        )
    )

    assert result.embedded == 2
    assert result.dimensions == 3
    assert repo.calls == [("multilingual-e5-base-v1", 16)]
    assert provider.calls[0][0] == [
        "passage: P265GH 406.4 x 6.3 EN 10224",
        "passage: L275 323.9 x 7.1",
    ]
    assert repo.saved[0]["content_checksum"] == "checksum-a"
    assert repo.saved[1]["content_checksum"] == "checksum-b"
    assert repo.saved[0]["model_key"] == "multilingual-e5-base-v1"


def test_embedding_batch_skips_provider_when_no_chunks_are_stale() -> None:
    repo = FakeRepository([])
    provider = FakeProvider([])

    result = asyncio.run(
        run_embedding_batch(
            model_key="baai-bge-m3-v1",
            repository=repo,
            provider=provider,
        )
    )

    assert result.selected == 0
    assert result.embedded == 0
    assert provider.calls == []
    assert repo.saved == []


def test_embedding_batch_rejects_wrong_vector_dimensions() -> None:
    repo = FakeRepository(sample_rows()[:1])
    provider = FakeProvider([[1.0, 0.0]])

    with pytest.raises(EmbeddingProviderError, match="expected 3"):
        asyncio.run(
            run_embedding_batch(
                model_key="multilingual-e5-base-v1",
                repository=repo,
                provider=provider,
            )
        )

    assert repo.saved == []
