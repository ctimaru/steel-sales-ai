from __future__ import annotations

from .main import app
from .observability import install_observability, router as observability_router
from .retrieval_api import router as retrieval_router

app.include_router(retrieval_router)
app.include_router(observability_router)
install_observability(app)

__all__ = ["app"]
