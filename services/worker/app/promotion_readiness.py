from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .repository import RepositoryConfigurationError, RepositoryError, WorkerRepository
from .retrieval_api import require_worker_token


class PromotionReadinessRequest(BaseModel):
    actor_user_id: UUID
    limit: int = Field(default=100, ge=1, le=500)


class PromotionReadinessError(RuntimeError):
    pass


class PromotionReadinessService:
    def __init__(self) -> None:
        self.repo = WorkerRepository()

    async def _organization_id(self, actor_user_id: UUID) -> str:
        rows = await self.repo._request(
            "GET",
            "/rest/v1/organization_memberships"
            f"?user_id=eq.{actor_user_id}&status=eq.active"
            "&role=in.(admin,member,viewer)"
            "&select=organization_id,is_default,created_at"
            "&order=is_default.desc,created_at.asc&limit=1",
        )
        if not isinstance(rows, list) or not rows:
            raise PromotionReadinessError("Active organization access is required.")
        organization_id = rows[0].get("organization_id")
        if not organization_id:
            raise PromotionReadinessError("Active organization is missing from membership.")
        return str(organization_id)

    async def readiness(self, request: PromotionReadinessRequest) -> dict[str, object]:
        organization_id = await self._organization_id(request.actor_user_id)
        payload = await self.repo._request(
            "POST",
            "/rest/v1/rpc/p1_promotion_readiness",
            json={"p_organization_id": organization_id, "p_limit": request.limit},
        )
        if not isinstance(payload, dict):
            raise PromotionReadinessError("Promotion readiness returned an invalid payload.")
        return payload

    async def grouped_readiness(self, request: PromotionReadinessRequest) -> dict[str, object]:
        organization_id = await self._organization_id(request.actor_user_id)
        payload = await self.repo._request(
            "POST",
            "/rest/v1/rpc/p1_grouped_rfq_readiness",
            json={"p_organization_id": organization_id, "p_limit": request.limit},
        )
        if not isinstance(payload, dict):
            raise PromotionReadinessError("Grouped RFQ readiness returned an invalid payload.")
        return payload

    async def identity_readiness(self, request: PromotionReadinessRequest) -> dict[str, object]:
        organization_id = await self._organization_id(request.actor_user_id)
        payload = await self.repo._request(
            "POST",
            "/rest/v1/rpc/p1_rfq_identity_readiness",
            json={"p_organization_id": organization_id, "p_limit": request.limit},
        )
        if not isinstance(payload, dict):
            raise PromotionReadinessError("RFQ identity readiness returned an invalid payload.")
        return payload


router = APIRouter(prefix="/v1/promotions", tags=["promotions"])


@router.post("/readiness")
async def promotion_readiness(
    request: PromotionReadinessRequest,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> dict[str, object]:
    require_worker_token(x_worker_token)
    try:
        return await PromotionReadinessService().readiness(request)
    except (
        PromotionReadinessError,
        RepositoryConfigurationError,
        RepositoryError,
        RuntimeError,
        ValueError,
    ) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/group-readiness")
async def grouped_promotion_readiness(
    request: PromotionReadinessRequest,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> dict[str, object]:
    require_worker_token(x_worker_token)
    try:
        return await PromotionReadinessService().grouped_readiness(request)
    except (
        PromotionReadinessError,
        RepositoryConfigurationError,
        RepositoryError,
        RuntimeError,
        ValueError,
    ) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/identity-readiness")
async def identity_readiness(
    request: PromotionReadinessRequest,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> dict[str, object]:
    require_worker_token(x_worker_token)
    try:
        return await PromotionReadinessService().identity_readiness(request)
    except (
        PromotionReadinessError,
        RepositoryConfigurationError,
        RepositoryError,
        RuntimeError,
        ValueError,
    ) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
