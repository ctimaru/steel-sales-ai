from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .repository import RepositoryConfigurationError, RepositoryError, WorkerRepository
from .retrieval_api import require_worker_token


class ReviewCorrectionRequest(BaseModel):
    actor_user_id: UUID
    corrected_values: dict[str, Any] = Field(default_factory=dict)


class ReviewCorrectionError(RuntimeError):
    pass


class ReviewCorrectionService:
    def __init__(self) -> None:
        self.repo = WorkerRepository()

    async def _active_write_membership(self, actor_user_id: UUID) -> dict[str, object]:
        rows = await self.repo._request(
            "GET",
            "/rest/v1/organization_memberships"
            f"?user_id=eq.{actor_user_id}&status=eq.active"
            "&role=in.(admin,member)"
            "&select=organization_id,user_id,role,is_default,created_at"
            "&order=is_default.desc,created_at.asc&limit=1",
        )
        if not isinstance(rows, list) or not rows:
            raise ReviewCorrectionError("Active organization write access is required.")
        return rows[0]

    async def correct(self, review_id: int, request: ReviewCorrectionRequest) -> dict[str, object]:
        if review_id < 1:
            raise ReviewCorrectionError("Invalid review id.")
        membership = await self._active_write_membership(request.actor_user_id)
        organization_id = membership.get("organization_id")
        if not organization_id:
            raise ReviewCorrectionError("Active organization is missing from membership.")
        result = await self.repo._request(
            "POST",
            "/rest/v1/rpc/p1_apply_review_correction",
            json={
                "p_review_id": review_id,
                "p_actor_user_id": str(request.actor_user_id),
                "p_organization_id": str(organization_id),
                "p_corrected_values": request.corrected_values,
                "p_metadata": {
                    "source": "review_queue_web",
                    "worker_contract": "p1.11a",
                    "membership_role": membership.get("role"),
                },
            },
        )
        if not isinstance(result, dict):
            raise ReviewCorrectionError("Correction promotion returned an invalid payload.")
        return {
            **result,
            "access": {"membership_verified": True, "role": membership.get("role")},
        }


router = APIRouter(prefix="/v1/reviews", tags=["review-corrections"])


@router.post("/{review_id}/correct")
async def correct_review(
    review_id: int,
    request: ReviewCorrectionRequest,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> dict[str, object]:
    require_worker_token(x_worker_token)
    try:
        return await ReviewCorrectionService().correct(review_id, request)
    except (RepositoryConfigurationError, RepositoryError, ReviewCorrectionError, RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
