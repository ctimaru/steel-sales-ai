from __future__ import annotations

from .main import app
from .retrieval_api import router as retrieval_router

app.include_router(retrieval_router)

__all__ = ["app"]
