import asyncio

from app.semantic_index import drain_semantic_index_backlog


class FakeRepository:
    def __init__(self, rows, *, active=True):
        self.rows = list(rows)
        self.active = active
        self.saved = []
        self.calls = []

    async def get_active_embedding_model(self):
        if not self.active:
            return None
        return {"model_key": "active-model"}

    async def get_chunks_needing_embedding(self, *, model_key: str, limit: int):
        self.calls.append((model_key, limit))
        return self.rows[:limit]

    async def upsert_chunk_embeddings(self, rows):
        self.saved.extend(rows)
        saved_ids = {row["chunk_id"] for row in rows}
        self.rows = [row for row in self.rows if row["chunk_id"] not in saved_ids]


class FakeProvider:
    def __init__(self):
        self.calls = []

    async def embed(self, texts, *, model_name: str, normalize: bool):
        self.calls.append((texts, model_name, normalize))
        return [[1.0, 0.0, 0.0] for _ in texts]


def sample_rows():
    common = {
        "source_id": "11111111-1111-1111-1111-111111111111",
        "document_id": "22222222-2222-2222-2222-222222222222",
        "model_id": "33333333-3333-3333-3333-333333333333",
        "model_key": "active-model",
        "model_name": "example/active-model",
        "model_revision": None,
        "dimensions": 3,
        "normalized": True,
        "config": {},
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
            "content": "S355J2H 323.9 x 7.1 EN 10219",
            "content_checksum": "checksum-b",
        },
    ]


def test_drain_semantic_index_backlog_processes_multiple_batches() -> None:
    repo = FakeRepository(sample_rows())
    provider = FakeProvider()

    result = asyncio.run(
        drain_semantic_index_backlog(
            repository=repo,
            provider=provider,
            batch_limit=1,
            max_batches=4,
        )
    )

    assert result == {
        "model_key": "active-model",
        "batches": 2,
        "selected": 2,
        "embedded": 2,
        "skipped": 0,
        "drained": True,
    }
    assert repo.rows == []
    assert len(repo.saved) == 2
    assert repo.calls == [
        ("active-model", 1),
        ("active-model", 1),
        ("active-model", 1),
    ]


def test_drain_semantic_index_backlog_finishes_early_on_partial_batch() -> None:
    repo = FakeRepository(sample_rows()[:1])
    provider = FakeProvider()

    result = asyncio.run(
        drain_semantic_index_backlog(
            repository=repo,
            provider=provider,
            batch_limit=128,
        )
    )

    assert result["embedded"] == 1
    assert result["batches"] == 1
    assert result["drained"] is True
    assert repo.rows == []


def test_drain_semantic_index_backlog_is_safe_without_active_model() -> None:
    repo = FakeRepository([], active=False)

    result = asyncio.run(drain_semantic_index_backlog(repository=repo))

    assert result["model_key"] is None
    assert result["embedded"] == 0
    assert result["drained"] is True
