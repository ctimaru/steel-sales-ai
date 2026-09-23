from __future__ import annotations

import os
from datetime import datetime
from typing import Any
from uuid import UUID

import httpx


class RepositoryConfigurationError(RuntimeError):
    pass


class RepositoryError(RuntimeError):
    pass


STAGING_OBSERVATION_FIELDS = (
    "source_filename",
    "source_text",
    "item_role",
    "grade",
    "standard",
    "outer_diameter_mm",
    "width_mm",
    "height_mm",
    "thickness_mm",
    "length_mm",
    "quantity",
    "quantity_unit",
    "price_value",
    "price_unit",
    "currency",
    "availability_status",
    "confidence",
    "metadata",
)


def normalize_observation(job_id: UUID, observation: dict[str, Any]) -> dict[str, Any]:
    """Return a stable PostgREST row shape for bulk staging inserts."""
    row = {
        "job_id": str(job_id),
        **{field: observation.get(field) for field in STAGING_OBSERVATION_FIELDS},
    }
    row["metadata"] = observation.get("metadata") or {}
    return row


class WorkerRepository:
    def __init__(self) -> None:
        self.base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
        self.key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        if not self.base_url or not self.key:
            raise RepositoryConfigurationError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
            )
        self.headers = {
            "Authorization": f"Bearer {self.key}",
            "apikey": self.key,
            "Content-Type": "application/json",
        }

    async def create_job(
        self,
        *,
        job_id: UUID,
        owner_id: UUID,
        filename: str,
        extension: str,
        size_bytes: int,
        created_at: datetime,
    ) -> None:
        payload = {
            "id": str(job_id),
            "owner_id": str(owner_id),
            "filename": filename,
            "extension": extension,
            "size_bytes": size_bytes,
            "status": "queued",
            "created_at": created_at.isoformat(),
        }
        await self._request(
            "POST",
            "/rest/v1/worker_jobs",
            json=payload,
            prefer="return=minimal",
        )

    async def update_job(self, job_id: UUID, values: dict[str, Any]) -> None:
        await self._request(
            "PATCH",
            f"/rest/v1/worker_jobs?id=eq.{job_id}",
            json=values,
            prefer="return=minimal",
        )

    async def insert_observations(
        self,
        *,
        job_id: UUID,
        observations: list[dict[str, Any]],
    ) -> None:
        if not observations:
            return
        rows = [normalize_observation(job_id, observation) for observation in observations]
        await self._request(
            "POST",
            "/rest/v1/worker_staging_observations",
            json=rows,
            prefer="return=minimal",
        )

    async def promote_job(self, job_id: UUID) -> dict[str, Any]:
        result = await self._request(
            "POST",
            "/rest/v1/rpc/promote_worker_job",
            json={"target_job_id": str(job_id)},
        )
        if not isinstance(result, dict):
            raise RepositoryError("Supabase worker promotion returned an invalid payload.")
        return result


    async def persist_message_identity(
        self,
        *,
        job_id: UUID,
        identity: dict[str, Any] | None,
    ) -> None:
        if not identity:
            return
        await self.update_job(
            job_id,
            {
                "source_message_id": identity.get("source_message_id"),
                "source_thread_id": identity.get("source_thread_id"),
                "sender_email": identity.get("sender_email"),
                "recipient_emails": identity.get("recipient_emails") or [],
                "sent_at": identity.get("sent_at"),
                "email_subject": identity.get("email_subject"),
            },
        )

    async def materialize_message_identity(self, job_id: UUID) -> dict[str, Any]:
        result = await self._request(
            "POST",
            "/rest/v1/rpc/materialize_worker_message_identity",
            json={"p_job_id": str(job_id)},
        )
        if not isinstance(result, dict):
            raise RepositoryError("Message identity materialization returned an invalid payload.")
        return result

    async def get_job(self, job_id: UUID) -> dict[str, Any] | None:
        rows = await self._request(
            "GET",
            f"/rest/v1/worker_jobs?id=eq.{job_id}&select=*",
        )
        return rows[0] if rows else None

    async def ingest_knowledge_upload(
        self,
        *,
        owner_id: UUID,
        document: dict[str, Any],
    ) -> dict[str, Any]:
        result = await self._request(
            "POST",
            "/rest/v1/rpc/ingest_knowledge_upload",
            json={
                "p_owner_id": str(owner_id),
                "p_external_id": document["external_id"],
                "p_document_type": document["document_type"],
                "p_title": document["title"],
                "p_filename": document["filename"],
                "p_mime_type": document["mime_type"],
                "p_storage_path": document["storage_path"],
                "p_content_checksum": document["content_checksum"],
                "p_extraction_method": document["extraction_method"],
                "p_extraction_version": document["extraction_version"],
                "p_language_code": document["language_code"],
                "p_chunks": document["chunks"],
            },
        )
        if not isinstance(result, dict):
            raise RepositoryError("Knowledge ingestion returned an invalid payload.")
        return result

    async def get_chunks_needing_embedding(
        self, *, model_key: str, limit: int
    ) -> list[dict[str, Any]]:
        result = await self._request(
            "POST",
            "/rest/v1/rpc/get_chunks_needing_embedding",
            json={"target_model_key": model_key, "batch_limit": limit},
        )
        if not isinstance(result, list):
            raise RepositoryError("Embedding batch selector returned an invalid payload.")
        return result

    async def upsert_chunk_embeddings(self, rows: list[dict[str, Any]]) -> None:
        if not rows:
            return
        await self._request(
            "POST",
            "/rest/v1/knowledge_chunk_embeddings?on_conflict=chunk_id,model_id",
            json=rows,
            prefer="resolution=merge-duplicates,return=minimal",
        )

    async def get_embedding_model(self, model_key: str) -> dict[str, Any] | None:
        rows = await self._request(
            "GET",
            "/rest/v1/knowledge_embedding_models"
            f"?model_key=eq.{model_key}&select=model_key,model_name,dimensions,normalized,config,status",
        )
        if not isinstance(rows, list):
            raise RepositoryError("Embedding model lookup returned an invalid payload.")
        return rows[0] if rows else None

    async def get_active_embedding_model(self) -> dict[str, Any] | None:
        rows = await self._request(
            "GET",
            "/rest/v1/knowledge_embedding_models"
            "?status=eq.active&select=model_key,model_name,dimensions,normalized,config,status&limit=2",
        )
        if not isinstance(rows, list):
            raise RepositoryError("Active embedding model lookup returned an invalid payload.")
        if len(rows) > 1:
            raise RepositoryError("Multiple active embedding models are configured.")
        return rows[0] if rows else None

    async def hybrid_search_knowledge(
        self,
        *,
        owner_id: UUID,
        query_text: str,
        query_embedding: list[float],
        match_count: int,
        candidate_count: int,
        entity_filters: dict[str, list[str]],
        commercial_filters: dict[str, object],
        document_filters: dict[str, object],
        rrf_k: int = 60,
    ) -> list[dict[str, Any]]:
        result = await self._request(
            "POST",
            "/rest/v1/rpc/hybrid_search_knowledge_filtered",
            json={
                "p_owner_id": str(owner_id),
                "p_query_text": query_text,
                "p_query_embedding": query_embedding,
                "p_match_count": match_count,
                "p_candidate_count": candidate_count,
                "p_entity_filters": entity_filters,
                "p_commercial_filters": commercial_filters,
                "p_document_filters": document_filters,
                "p_rrf_k": rrf_k,
            },
        )
        if not isinstance(result, list):
            raise RepositoryError("Hybrid knowledge search returned an invalid payload.")
        return result

    async def get_embedding_benchmark_cases(self, *, limit: int) -> list[dict[str, Any]]:
        result = await self._request(
            "POST",
            "/rest/v1/rpc/get_embedding_benchmark_cases",
            json={"p_limit": limit},
        )
        if not isinstance(result, list):
            raise RepositoryError("Embedding benchmark case lookup returned an invalid payload.")
        return result

    async def search_embedding_benchmark(
        self,
        *,
        model_key: str,
        query_embedding: list[float],
        match_count: int,
    ) -> list[dict[str, Any]]:
        result = await self._request(
            "POST",
            "/rest/v1/rpc/search_embedding_benchmark",
            json={
                "p_model_key": model_key,
                "p_query_embedding": query_embedding,
                "p_match_count": match_count,
            },
        )
        if not isinstance(result, list):
            raise RepositoryError("Embedding benchmark search returned an invalid payload.")
        return result

    async def activate_embedding_model(self, model_key: str) -> dict[str, Any]:
        result = await self._request(
            "POST",
            "/rest/v1/rpc/activate_embedding_model",
            json={"p_model_key": model_key},
        )
        if not isinstance(result, dict):
            raise RepositoryError("Embedding model activation returned an invalid payload.")
        return result

    async def claim_offer_source_reingest(
        self, *, reingest_id: int, owner_id: UUID
    ) -> dict[str, Any]:
        result = await self._request(
            "POST",
            "/rest/v1/rpc/p1_claim_offer_source_reingest",
            json={"p_reingest_id": reingest_id, "p_owner_id": str(owner_id)},
        )
        if not isinstance(result, dict):
            raise RepositoryError("Offer source re-ingest claim returned an invalid payload.")
        return result

    async def complete_offer_source_reingest(
        self,
        *,
        reingest_id: int,
        source_job_id: UUID,
        filename: str,
        storage_path: str,
        content_checksum: str,
        size_bytes: int,
    ) -> dict[str, Any]:
        result = await self._request(
            "POST",
            "/rest/v1/rpc/p1_complete_offer_source_reingest",
            json={
                "p_reingest_id": reingest_id,
                "p_source_job_id": str(source_job_id),
                "p_filename": filename,
                "p_storage_path": storage_path,
                "p_content_checksum": content_checksum,
                "p_size_bytes": size_bytes,
            },
        )
        if not isinstance(result, dict):
            raise RepositoryError("Offer source re-ingest completion returned an invalid payload.")
        return result

    async def fail_offer_source_reingest(
        self, *, reingest_id: int, error: str
    ) -> dict[str, Any]:
        result = await self._request(
            "POST",
            "/rest/v1/rpc/p1_fail_offer_source_reingest",
            json={"p_reingest_id": reingest_id, "p_error": error},
        )
        if not isinstance(result, dict):
            raise RepositoryError("Offer source re-ingest failure returned an invalid payload.")
        return result


    async def claim_offer_source_reparse_run(self, run_id: int) -> dict[str, Any]:
        result = await self._request(
            "POST",
            "/rest/v1/rpc/p1_claim_offer_source_reparse_run",
            json={"p_run_id": run_id},
        )
        if not isinstance(result, dict):
            raise RepositoryError("Offer source reparse claim returned an invalid payload.")
        return result

    async def complete_offer_source_reparse_run(
        self, *, run_id: int, candidates: list[dict[str, Any]]
    ) -> dict[str, Any]:
        result = await self._request(
            "POST",
            "/rest/v1/rpc/p1_complete_offer_source_reparse_run",
            json={"p_run_id": run_id, "p_candidates": candidates},
        )
        if not isinstance(result, dict):
            raise RepositoryError("Offer source reparse completion returned an invalid payload.")
        return result

    async def fail_offer_source_reparse_run(
        self, *, run_id: int, error: str
    ) -> dict[str, Any]:
        result = await self._request(
            "POST",
            "/rest/v1/rpc/p1_fail_offer_source_reparse_run",
            json={"p_run_id": run_id, "p_error": error},
        )
        if not isinstance(result, dict):
            raise RepositoryError("Offer source reparse failure update returned an invalid payload.")
        return result

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json: Any = None,
        prefer: str | None = None,
    ) -> Any:
        headers = dict(self.headers)
        if prefer:
            headers["Prefer"] = prefer
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.request(
                method,
                f"{self.base_url}{path}",
                headers=headers,
                json=json,
            )
        if response.is_error:
            detail = response.text.strip()
            suffix = f" Response: {detail[:500]}" if detail else ""
            raise RepositoryError(
                f"Supabase worker persistence failed with HTTP {response.status_code}.{suffix}"
            )
        if not response.content:
            return None
        return response.json()
