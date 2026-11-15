from __future__ import annotations

import asyncio
from unittest.mock import patch, AsyncMock

import pytest

from app.net_intel1_progressive import process_batch


def test_batch_size_is_bounded_before_connecting():
    with pytest.raises(ValueError):
        asyncio.run(process_batch(0))
    with pytest.raises(ValueError):
        asyncio.run(process_batch(101))


def test_progressive_empty_batch_calls_auto_publisher_and_no_crawler():
    class Repo:
        async def _request(self, method, path, **kwargs):
            assert method == "POST"
            if path.endswith("netintel1_next_batch"):
                assert kwargs["json"] == {"p_limit": 100}
                return []
            if path.endswith("netintel1_publish_safe_descriptions"):
                return {"published": 0, "accepted": 0}
            raise AssertionError(path)

    with patch("app.net_intel1_progressive.WorkerRepository", return_value=Repo()), \
         patch("app.net_intel1_progressive.extract_one", new_callable=AsyncMock) as crawl:
        result = asyncio.run(process_batch(100))
        crawl.assert_not_awaited()
    assert result["selected"] == 0
    assert result["errors"] == 0


def test_progressive_records_failed_evidence_without_public_promotion():
    calls = []

    class Repo:
        async def _request(self, method, path, **kwargs):
            calls.append((path, kwargs.get("json", {})))
            if path.endswith("netintel1_next_batch"):
                return [{"id": "a0000000-0000-0000-0000-000000000001", "website_url": "https://example.it/", "description": None}]
            if path.endswith("netintel1_publish_safe_descriptions"):
                return {"published": 0, "accepted": 0}
            if path.endswith("netintel1_record_attempt"):
                return None
            raise AssertionError(path)

    with patch("app.net_intel1_progressive.WorkerRepository", return_value=Repo()), \
         patch("app.net_intel1_progressive.extract_one", new_callable=AsyncMock,
               return_value={"status": "insufficient_steel_evidence"}) as crawl:
        result = asyncio.run(process_batch(1))
    assert result["counts"] == {"insufficient_steel_evidence": 1}
    assert any(path.endswith("netintel1_record_attempt") for path, _ in calls)
    assert not any(path.endswith("netprofile1c3_ingest_evidence") for path, _ in calls)
