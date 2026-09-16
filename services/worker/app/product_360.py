from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .repository import RepositoryConfigurationError, RepositoryError, WorkerRepository
from .retrieval_api import require_worker_token


class ProductCatalogRequest(BaseModel):
    actor_user_id: UUID
    query: str | None = Field(default=None, max_length=300)
    limit: int = Field(default=100, ge=1, le=250)


class Product360Request(BaseModel):
    actor_user_id: UUID
    limit: int = Field(default=200, ge=1, le=500)


class Product360Error(RuntimeError):
    pass


class Product360Service:
    def __init__(self) -> None:
        self.repo = WorkerRepository()

    async def _active_membership(self, actor_user_id: UUID) -> dict[str, object]:
        rows = await self.repo._request(
            "GET",
            "/rest/v1/organization_memberships"
            f"?user_id=eq.{actor_user_id}&status=eq.active"
            "&role=in.(admin,member,viewer)"
            "&select=organization_id,user_id,role,is_default,created_at"
            "&order=is_default.desc,created_at.asc&limit=1",
        )
        if not isinstance(rows, list) or not rows:
            raise Product360Error("Active organization access is required.")
        return rows[0]

    async def catalog(self, request: ProductCatalogRequest) -> dict[str, object]:
        membership = await self._active_membership(request.actor_user_id)
        organization_id = membership.get("organization_id")
        if not organization_id:
            raise Product360Error("Active organization is missing from membership.")
        raw = await self.repo._request(
            "POST",
            "/rest/v1/rpc/p1_product_catalog",
            json={
                "p_organization_id": str(organization_id),
                "p_query": request.query.strip() if request.query and request.query.strip() else None,
                "p_limit": request.limit,
            },
        )
        if not isinstance(raw, dict):
            raise Product360Error("Product catalog returned an invalid payload.")
        return {
            **raw,
            "query": request.query.strip() if request.query else None,
            "access": {"membership_verified": True, "role": membership.get("role")},
        }

    async def detail(self, product_id: UUID, request: Product360Request) -> dict[str, object]:
        membership = await self._active_membership(request.actor_user_id)
        organization_id = membership.get("organization_id")
        if not organization_id:
            raise Product360Error("Active organization is missing from membership.")
        raw = await self.repo._request(
            "POST",
            "/rest/v1/rpc/p1_product_360",
            json={
                "p_organization_id": str(organization_id),
                "p_product_id": str(product_id),
                "p_limit": request.limit,
            },
        )
        if not isinstance(raw, dict):
            raise Product360Error("Product 360 returned an invalid payload.")
        return {
            **raw,
            "access": {"membership_verified": True, "role": membership.get("role")},
        }


router = APIRouter(prefix="/v1/products", tags=["product-360"])


@router.post("")
async def product_catalog(
    request: ProductCatalogRequest,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> dict[str, object]:
    require_worker_token(x_worker_token)
    try:
        return await Product360Service().catalog(request)
    except (RepositoryConfigurationError, RepositoryError, Product360Error, RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{product_id}")
async def product_360(
    product_id: UUID,
    request: Product360Request,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> dict[str, object]:
    require_worker_token(x_worker_token)
    try:
        return await Product360Service().detail(product_id, request)
    except (RepositoryConfigurationError, RepositoryError, Product360Error, RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
